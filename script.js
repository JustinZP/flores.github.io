const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const centro = document.getElementById("centro");

/* =========================================================
   CONFIG — todo lo que probablemente quieras ajustar está
   aquí. No necesitas tocar el resto del archivo.
   ========================================================= */
const CONFIG = {
  estrellas: {
    densidadDivisor: 16000, // más alto = menos estrellas = más "espacio vacío"
  },

  nebulosa: {
    activa: false, // ponlo en true si quieres las manchas de color de fondo
  },

  vortice: {
    activo: false, // ponlo en true si quieres el disco/remolino bajo la flor
  },

  flor: {
    numPetalos: 24,
    largoPetalo: 185,
    anchoPetalo: 46,
    radioCentro: 68,
    puntosSemillas: 260,          // puntitos del centro (se dibujan UNA sola vez, no por frame)
    respiracionAmplitud: 0.015,   // qué tanto "respira" (pulso) al crecer/encoger
    colores: ["#fff8dc", "#ffe98a", "#ffd93d", "#ffc93d", "#ffb700", "#ff9d1e"],
    coloresCentro: ["#7a4a12", "#8f5a1a", "#a5701f", "#c98a2c"],
  },

  // Ramas/tallos verdes debajo de cada girasol del ramo. Se dibujan aparte
  // de la cabeza de la flor (no giran con ella) para que se vean naturales.
  tallos: {
    activo: true,
    largo: 190,               // largo base del tallo (se escala junto con la flor)
    grosor: 12,
    colorTallo: "#2f7d2a",
    colorTalloClaro: "#7fd94a",
    colorHoja1: "#79d64a",
    colorHoja2: "#2b6b1f",
    balanceo: 4,              // qué tanto se mecen con el tiempo
  },

  // Si tienes tu PROPIA imagen con licencia (foto o dibujo de girasoles,
  // en PNG con fondo transparente) puedes usarla en vez de la flor vectorial
  // generada por código. Solo:
  //   1) coloca el archivo en, por ejemplo, "flores/girasol.png"
  //   2) pon usarImagenPersonalizada en true
  // Si el archivo no existe o falla al cargar, la página sigue funcionando
  // normalmente usando la flor vectorial de respaldo (no se rompe nada).
  imagenFlor: {
    usarImagenPersonalizada: false,
    ruta: "flores/girasol.png",
  },

  // Ramo: varios girasoles alrededor del central, que van "floreciendo"
  // uno por uno (de pequeño a su tamaño final) según su "retraso" en segundos.
  // El orden de la lista también define qué flor se dibuja encima de cuál
  // (las últimas de la lista quedan por delante).
  //
  // Cada flor puede tener opcionalmente:
  //   imagen: "ruta.jpg"  -> usa esa imagen en vez de la flor vectorial
  //   sinTallo: true      -> no le dibuja el tallo verde debajo (útil para
  //                          fotos que ya no son "una flor" como tal, p.ej. Snoopy)
  ramo: {
    duracionAparicion: 1.4, // segundos que tarda cada flor en "abrir"
    flores: [
      { x: -230, y: 80,  escala: 0.5,  retraso: 1.0 },
      { x: 235,  y: 75,  escala: 0.5,  retraso: 1.8 },
      { x: -150, y: 220, escala: 0.4,  retraso: 2.6 },
      { x: 155,  y: 225, escala: 0.4,  retraso: 3.4 },
      { x: 0,    y: -190,escala: 0.38, retraso: 4.2 },
      // Flor central: aparece primero. Ahora es la foto de Snoopy
      // (flores/imagen3.jpg) en vez del girasol dibujado por código.
      { x: 0, y: 0, escala: 1.0, retraso: 0, imagen: "flores/imagen3.jpg", sinTallo: true },
    ],
  },

  mensajesOrbita: {
    activo: true,
    textos: [
      "Eres una persona admirable",
      "Te mereces lo mejor de este mundo",
      "Gracias por existir",
      "Mereces ser inmensamente feliz",
      "Contigo todo es mejor",
      "Siempre mi persona favorita",
      "Eres increíble tal como eres",
      "Tu esfuerzo vale muchísimo",
      "Brillas más de lo que crees",
      "Eres capaz de todo lo que te propongas",
      "Tu sonrisa vale oro",
      "Eres suficiente, siempre lo fuiste",
      "El mundo es mejor contigo en él",
      "Eres fuerte, valiente y hermosa",
      "Confío en ti, siempre",
      "Nunca dudes lo especial que eres",
    ],
    emojis: ["🌻", "🌼", "⭐", "✨", "💛", "🌟"],
    radioX: 660,
    radioY: 320,
    // Las tarjetas ya NO giran solas con el tiempo: su ángulo ahora sigue
    // a "rotacionManual" (el mismo ángulo que controla la flor al
    // arrastrarla), así que solo se mueven cuando el usuario gira el ramo.
    opacidadBase: 0.4,
  },

  petalosCayendo: {
    cantidad: 8,
  },
};

let ancho, alto;
let particulas = [];

let mouse = { x: null, y: null, radio: 120 };

function ajustarTamano() {
  ancho = window.innerWidth;
  alto = window.innerHeight;
  canvas.width = ancho;
  canvas.height = alto;
}
ajustarTamano();

window.addEventListener("resize", () => {
  ajustarTamano();
  crearParticulas();
});

window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener("mouseout", () => {
  mouse.x = null;
  mouse.y = null;
});

/* ================= GIRO DE LA FLOR CONTROLADO POR LA PERSONA ================= */
// Antes las flores giraban solas; ahora el ángulo lo maneja quien arrastra
// el mouse (o el dedo, en móvil) sobre el ramo. "rotacionManual" es el
// ángulo (en radianes) que se suma a cada flor en dibujarUnaFlor(), y
// también es lo que ahora mueve las tarjetas orbitando (ver animarOrbita).
let rotacionManual = 0;
let arrastrandoFlor = false;
let anguloAlEmpezarArrastre = 0;
let rotacionAlEmpezarArrastre = 0;

function anguloDesdeCentro(clientX, clientY) {
  const rect = centro.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2 - 25;
  return Math.atan2(clientY - cy, clientX - cx);
}

function empezarArrastre(clientX, clientY) {
  arrastrandoFlor = true;
  anguloAlEmpezarArrastre = anguloDesdeCentro(clientX, clientY);
  rotacionAlEmpezarArrastre = rotacionManual;
  centro.style.cursor = "grabbing";
}

function moverArrastre(clientX, clientY) {
  if (!arrastrandoFlor) return;
  const anguloActual = anguloDesdeCentro(clientX, clientY);
  rotacionManual = rotacionAlEmpezarArrastre + (anguloActual - anguloAlEmpezarArrastre);
}

function terminarArrastre() {
  arrastrandoFlor = false;
  centro.style.cursor = "grab";
}

centro.style.cursor = "grab";
centro.addEventListener("mousedown", (e) => empezarArrastre(e.clientX, e.clientY));
window.addEventListener("mousemove", (e) => moverArrastre(e.clientX, e.clientY));
window.addEventListener("mouseup", terminarArrastre);

centro.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  empezarArrastre(t.clientX, t.clientY);
}, { passive: true });
window.addEventListener("touchmove", (e) => {
  if (!arrastrandoFlor) return;
  const t = e.touches[0];
  moverArrastre(t.clientX, t.clientY);
}, { passive: true });
window.addEventListener("touchend", terminarArrastre);

/* ================= ESTRELLAS DE FONDO ================= */

class Particula {
  constructor() {
    this.x = Math.random() * ancho;
    this.y = Math.random() * alto;
    this.radioBase = Math.random() * 1.8 + 0.6;
    this.radio = this.radioBase;
    this.velX = (Math.random() - 0.5) * 0.25;
    this.velY = (Math.random() - 0.5) * 0.25;
    this.brillo = Math.random() * 0.5 + 0.5;
    this.velBrillo = (Math.random() * 0.02) + 0.005;
    const colores = ["#ffd93d", "#ffe98a", "#fff4c2", "#ffffff", "#cfe0ff"];
    this.color = colores[Math.floor(Math.random() * colores.length)];
  }

  actualizar() {
    this.x += this.velX;
    this.y += this.velY;

    if (this.x < 0) this.x = ancho;
    if (this.x > ancho) this.x = 0;
    if (this.y < 0) this.y = alto;
    if (this.y > alto) this.y = 0;

    this.brillo += this.velBrillo;
    if (this.brillo > 1 || this.brillo < 0.3) {
      this.velBrillo *= -1;
    }

    if (mouse.x !== null && mouse.y !== null) {
      let dx = this.x - mouse.x;
      let dy = this.y - mouse.y;
      let distancia = Math.sqrt(dx * dx + dy * dy);

      if (distancia < mouse.radio) {
        let fuerza = (mouse.radio - distancia) / mouse.radio;
        let angulo = Math.atan2(dy, dx);
        this.x += Math.cos(angulo) * fuerza * 2;
        this.y += Math.sin(angulo) * fuerza * 2;
        this.radio = this.radioBase * (1 + fuerza);
      } else {
        this.radio = this.radioBase;
      }
    }
  }

  dibujar() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.brillo;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.closePath();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

function crearParticulas() {
  particulas = [];
  let cantidad = Math.floor((ancho * alto) / CONFIG.estrellas.densidadDivisor);
  for (let i = 0; i < cantidad; i++) {
    particulas.push(new Particula());
  }
}
crearParticulas();

/* ================= NEBULOSA DE FONDO ================= */
// Manchas suaves de color que dan ambiente de galaxia, muy sutiles y estáticas
const nebulosaBlobs = [
  { xr: 0.5, yr: 0.38, r: 0.55, color: "rgba(255,217,61,0.10)" },
  { xr: 0.18, yr: 0.75, r: 0.35, color: "rgba(120,90,210,0.07)" },
  { xr: 0.85, yr: 0.7, r: 0.4, color: "rgba(60,150,190,0.06)" },
  { xr: 0.75, yr: 0.15, r: 0.3, color: "rgba(255,150,90,0.05)" },
];

function dibujarNebulosa() {
  if (!CONFIG.nebulosa.activa) return;
  nebulosaBlobs.forEach((b) => {
    const x = ancho * b.xr;
    const y = alto * b.yr;
    const r = Math.max(ancho, alto) * b.r;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, b.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ancho, alto);
  });
}

/* =========================================================
   FLOR — ahora es una IMAGEN (bitmap) pre-renderizada UNA sola
   vez, no miles de partículas recalculándose en cada frame.
   Esto es lo que elimina el lag: antes, cada flor dibujaba miles
   de círculos con sombra (shadowBlur) 60 veces por segundo; ahora
   cada flor es un solo drawImage() por frame, sin importar cuántos
   pétalos o semillas tenga.
   ========================================================= */

// Dibuja una hoja simple (forma de almendra) en (x, y), apuntando a la
// izquierda si dir es -1 o a la derecha si dir es 1.
function dibujarHoja(c, x, y, tamano, dir, colorClaro, colorOscuro) {
  c.save();
  c.translate(x, y);
  c.rotate(dir > 0 ? -0.5 : 0.5);
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(dir * tamano * 0.8, -tamano * 0.36, dir * tamano * 1.4, 0);
  c.quadraticCurveTo(dir * tamano * 0.8, tamano * 0.36, 0, 0);
  c.closePath();
  const grad = c.createLinearGradient(0, 0, dir * tamano * 1.4, 0);
  grad.addColorStop(0, colorClaro);
  grad.addColorStop(1, colorOscuro);
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = Math.max(tamano * 0.05, 1);
  c.strokeStyle = "rgba(20,50,10,0.55)";
  c.stroke();
  // nervadura central de la hoja
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(dir * tamano * 1.15, 0);
  c.strokeStyle = "rgba(20,50,10,0.35)";
  c.lineWidth = Math.max(tamano * 0.035, 0.8);
  c.stroke();
  c.restore();
}

// Dibuja el tallo y un par de hojas debajo de una flor. Se dibuja en
// coordenadas SIN rotar (a diferencia de la cabeza), para que el tallo
// se quede quieto/mecido mientras la flor gira, como en la realidad.
// Es una forma RELLENA (no una simple línea) para que se note bien.
function dibujarTallo(cx, cy, escalaBase, tiempo, faseRot) {
  const cfg = CONFIG.tallos;
  if (!cfg.activo) return;

  const largo = cfg.largo * escalaBase;
  const grosor = cfg.grosor * escalaBase;
  const balanceo = Math.sin(tiempo * 0.0004 + faseRot) * cfg.balanceo * escalaBase;

  ctx.save();
  ctx.translate(cx, cy);

  const yInicio = 8 * escalaBase;
  const xCtrl = balanceo;
  const yCtrl = largo * 0.55;
  const xFin = balanceo * 0.6;
  const yFin = largo;

  // cuerpo del tallo como forma rellena, más ancho arriba y afinándose
  ctx.beginPath();
  ctx.moveTo(-grosor / 2, yInicio);
  ctx.quadraticCurveTo(xCtrl - grosor / 2.6, yCtrl, xFin - grosor / 3.4, yFin);
  ctx.lineTo(xFin + grosor / 3.4, yFin);
  ctx.quadraticCurveTo(xCtrl + grosor / 2.6, yCtrl, grosor / 2, yInicio);
  ctx.closePath();

  const gradTallo = ctx.createLinearGradient(-grosor / 2, 0, grosor / 2, 0);
  gradTallo.addColorStop(0, cfg.colorTallo);
  gradTallo.addColorStop(0.5, cfg.colorTalloClaro);
  gradTallo.addColorStop(1, cfg.colorTallo);
  ctx.fillStyle = gradTallo;
  ctx.fill();
  ctx.strokeStyle = "rgba(15,40,8,0.6)";
  ctx.lineWidth = Math.max(grosor * 0.14, 1);
  ctx.stroke();

  dibujarHoja(ctx, xCtrl * 0.55, largo * 0.4, 44 * escalaBase, 1, cfg.colorHoja1, cfg.colorHoja2);
  dibujarHoja(ctx, xCtrl * 0.8, largo * 0.72, 38 * escalaBase, -1, cfg.colorHoja1, cfg.colorHoja2);

  ctx.restore();
}

function dibujarFormaPetalo(c, largo, ancho) {
  // Pétalo redondeado (no puntiagudo), como el de un girasol real:
  // se ensancha y termina en una punta suave, no en una aguja.
  const redondeo = ancho * 0.22;
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(ancho * 0.58, largo * 0.16, ancho * 0.52, largo * 0.78, redondeo, largo - redondeo * 0.5);
  c.quadraticCurveTo(0, largo, -redondeo, largo - redondeo * 0.5);
  c.bezierCurveTo(-ancho * 0.52, largo * 0.78, -ancho * 0.58, largo * 0.16, 0, 0);
  c.closePath();
}

// Genera la textura de la flor (pétalos sólidos + centro con semillas)
// UNA sola vez y la deja lista en un canvas oculto para reutilizarla.
function generarTexturaFlor() {
  const cfg = CONFIG.flor;
  const extent = (cfg.largoPetalo + cfg.anchoPetalo) * 1.05;
  const size = Math.ceil(extent * 2);

  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const octx = off.getContext("2d");
  octx.translate(size / 2, size / 2);

  // halo suave detrás de los pétalos (se hornea junto con la textura)
  const haloTex = octx.createRadialGradient(0, 0, 0, 0, 0, extent);
  haloTex.addColorStop(0, "rgba(255,225,120,0.22)");
  haloTex.addColorStop(0.55, "rgba(255,217,61,0.06)");
  haloTex.addColorStop(1, "rgba(255,217,61,0)");
  octx.fillStyle = haloTex;
  octx.beginPath();
  octx.arc(0, 0, extent, 0, Math.PI * 2);
  octx.fill();

  // pétalos como formas sólidas con degradado (ya no puntos sueltos)
  for (let p = 0; p < cfg.numPetalos; p++) {
    const angulo = (p / cfg.numPetalos) * Math.PI * 2;
    octx.save();
    octx.rotate(angulo);

    const grad = octx.createLinearGradient(0, 0, 0, cfg.largoPetalo);
    grad.addColorStop(0, cfg.colores[0]);
    grad.addColorStop(0.45, cfg.colores[2]);
    grad.addColorStop(1, cfg.colores[cfg.colores.length - 1]);

    octx.fillStyle = grad;
    octx.shadowColor = "rgba(255,180,20,0.35)";
    octx.shadowBlur = 10;
    dibujarFormaPetalo(octx, cfg.largoPetalo, cfg.anchoPetalo);
    octx.fill();

    // una leve línea central en el pétalo para dar textura
    octx.shadowBlur = 0;
    octx.strokeStyle = "rgba(180,120,10,0.25)";
    octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(0, cfg.largoPetalo * 0.08);
    octx.lineTo(0, cfg.largoPetalo * 0.92);
    octx.stroke();

    octx.restore();
  }

  // centro del girasol: base + patrón de semillas en espiral de Fibonacci
  octx.beginPath();
  octx.arc(0, 0, cfg.radioCentro, 0, Math.PI * 2);
  const gradCentro = octx.createRadialGradient(0, 0, 0, 0, 0, cfg.radioCentro);
  gradCentro.addColorStop(0, cfg.coloresCentro[3]);
  gradCentro.addColorStop(1, cfg.coloresCentro[0]);
  octx.fillStyle = gradCentro;
  octx.fill();

  const anguloDorado = Math.PI * (3 - Math.sqrt(5)); // ~137.5°
  for (let i = 0; i < cfg.puntosSemillas; i++) {
    const t = i / cfg.puntosSemillas;
    const r = cfg.radioCentro * Math.sqrt(t) * 0.94;
    const ang = i * anguloDorado;
    octx.beginPath();
    octx.fillStyle = cfg.coloresCentro[i % cfg.coloresCentro.length];
    octx.globalAlpha = 0.55 + 0.45 * Math.random();
    octx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 1.7, 0, Math.PI * 2);
    octx.fill();
  }
  octx.globalAlpha = 1;

  return off;
}

const texturaFlor = generarTexturaFlor();

// Imagen personalizada opcional (ver CONFIG.imagenFlor). Si no existe o
// falla, la página sigue usando "texturaFlor" sin ningún error visible.
const imagenFlorPersonalizada = new Image();
let imagenFlorLista = false;
imagenFlorPersonalizada.onload = () => { imagenFlorLista = true; };
imagenFlorPersonalizada.onerror = () => {
  console.warn(
    'No se pudo cargar "' + CONFIG.imagenFlor.ruta + '". Se usará la flor generada por código.'
  );
};
if (CONFIG.imagenFlor.usarImagenPersonalizada) {
  imagenFlorPersonalizada.src = CONFIG.imagenFlor.ruta;
}

// Quita el fondo blanco (o casi blanco) de una imagen ya cargada,
// devolviendo un <canvas> con esos píxeles vueltos transparentes. Se hace
// UNA sola vez por imagen, no en cada frame. "umbral" define qué tan
// blanco debe ser un píxel para desaparecer, y "suavizado" crea un
// degradado de opacidad cerca del umbral para que el borde del dibujo no
// se vea "cortado" con serrucho.
function quitarFondoBlanco(img, umbral = 235, suavizado = 30) {
  const off = document.createElement("canvas");
  off.width = img.naturalWidth || img.width;
  off.height = img.naturalHeight || img.height;
  const octx = off.getContext("2d");
  octx.drawImage(img, 0, 0);

  try {
    const datos = octx.getImageData(0, 0, off.width, off.height);
    const px = datos.data;
    const limiteInferior = Math.max(umbral - suavizado, 0);

    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const minCanal = Math.min(r, g, b);

      if (minCanal >= umbral) {
        px[i + 3] = 0; // blanco puro (o casi): totalmente transparente
      } else if (minCanal > limiteInferior) {
        // zona de transición: baja la opacidad de forma gradual
        const factor = (minCanal - limiteInferior) / (umbral - limiteInferior);
        px[i + 3] = Math.round(px[i + 3] * (1 - factor));
      }
    }

    octx.putImageData(datos, 0, 0);
  } catch (e) {
    // Si el navegador bloquea leer los píxeles (canvas "tainted"), esto
    // pasa normalmente al abrir el .html directamente con doble clic
    // (protocolo file://). Solución: abre el proyecto con un servidor
    // local, por ejemplo la extensión "Live Server" de VS Code.
    console.warn(
      'No se pudo quitar el fondo blanco de la imagen (posible restricción de seguridad al abrir el archivo directamente). Sirve la página desde un servidor local, por ejemplo con la extensión "Live Server" de VS Code, y vuelve a intentarlo.',
      e
    );
  }

  return off;
}

// Caché de imágenes personalizadas por-flor (p.ej. la foto de Snoopy de la
// flor central). Cada ruta se carga UNA sola vez y se reutiliza; mientras
// la imagen todavía no cargó, esa flor sigue mostrando la textura vectorial
// de respaldo así nada se rompe ni se ve en blanco. Una vez cargada, se le
// quita el fondo blanco automáticamente.
const cacheImagenesFlores = {};
function cargarImagenPersonalizada(ruta) {
  if (cacheImagenesFlores[ruta]) return cacheImagenesFlores[ruta];
  const img = new Image();
  const estado = { img, lista: false };
  img.onload = () => {
    estado.img = quitarFondoBlanco(img);
    estado.lista = true;
  };
  img.onerror = () => {
    console.warn('No se pudo cargar "' + ruta + '". Se usará la flor generada por código.');
  };
  img.src = ruta;
  cacheImagenesFlores[ruta] = estado;
  return estado;
}

function dibujarUnaFlor(cx, cy, escalaFlor, tiempo, faseRot, opciones = {}) {
  const cfg = CONFIG.flor;
  const escalaBase = Math.max(escalaFlor, 0.001); // evita escala 0 exacta

  // Ya no gira sola: el ángulo lo controla la persona arrastrando el mouse
  // (ver "rotacionManual" más abajo). faseRot mantiene a cada flor del
  // ramo con un ligero desfase entre sí para que no giren idénticas.
  const rotacion = rotacionManual + faseRot;
  const respiracion = 1 + Math.sin(tiempo * 0.0006 + faseRot) * cfg.respiracionAmplitud;
  const escalaTotal = escalaBase * respiracion;

  if (!opciones.sinTallo) {
    dibujarTallo(cx, cy, escalaBase, tiempo, faseRot);
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotacion);
  ctx.scale(escalaTotal, escalaTotal);

  let fuente = texturaFlor;
  if (opciones.fuenteImagen && opciones.fuenteImagen.lista) {
    // Imagen específica de esta flor (p.ej. Snoopy en la flor central)
    fuente = opciones.fuenteImagen.img;
  } else if (CONFIG.imagenFlor.usarImagenPersonalizada && imagenFlorLista) {
    fuente = imagenFlorPersonalizada;
  }

  const destino = (cfg.largoPetalo + cfg.anchoPetalo) * 2.1;
  const escalaAjuste = destino / Math.max(fuente.width, fuente.height);
  const dw = fuente.width * escalaAjuste;
  const dh = fuente.height * escalaAjuste;

  // Un único drawImage por flor y por frame: esto es lo que la hace fluida.
  ctx.drawImage(fuente, -dw / 2, -dh / 2, dw, dh);

  ctx.restore();
}

function dibujarRamo(tiempo) {
  const rect = centro.getBoundingClientRect();
  const cxBase = rect.left + rect.width / 2;
  const cyBase = rect.top + rect.height / 2;
  const durMs = CONFIG.ramo.duracionAparicion * 1000;

  CONFIG.ramo.flores.forEach((flor, i) => {
    const delayMs = flor.retraso * 1000;
    let progreso = (tiempo - delayMs) / durMs;
    progreso = Math.min(Math.max(progreso, 0), 1);
    const factor = progreso * progreso * (3 - 2 * progreso); // smoothstep: apertura suave

    const escalaFinal = flor.escala * factor;
    if (escalaFinal <= 0.001) return; // todavía no le toca "florecer"

    const opciones = {};
    if (flor.imagen) {
      opciones.fuenteImagen = cargarImagenPersonalizada(flor.imagen);
      opciones.sinTallo = !!flor.sinTallo;
    }

    // Las flores vectoriales usan un pequeño desfase de rotación (i * 0.6)
    // para que no giren todas idénticas, pero eso no importa porque son
    // radialmente simétricas. Una FOTO (como la de Snoopy) no lo es: ese
    // mismo desfase la hacía verse de cabeza. Por eso las flores con
    // "imagen" siempre arrancan con desfase 0 (derecha hacia arriba).
    const faseRot = flor.imagen ? 0 : i * 0.6;

    dibujarUnaFlor(cxBase + flor.x, cyBase + flor.y, escalaFinal, tiempo, faseRot, opciones);
  });
}

/* ================= VÓRTICE / DISCO GIRATORIO BAJO LA FLOR ================= */

function generarVortice() {
  const puntos = [];
  const cantidad = 150;
  for (let i = 0; i < cantidad; i++) {
    const t = i / cantidad;
    puntos.push({
      anguloBase: t * Math.PI * 12,
      radioBase: 14 + t * 150,
      velocidad: 0.00025 + Math.random() * 0.00035,
      radio: Math.random() * 1.3 + 0.4,
      fase: Math.random() * Math.PI * 2,
    });
  }
  return puntos;
}

const vorticeParticulas = generarVortice();

function dibujarVortice(tiempo, cx, cy) {
  if (!CONFIG.vortice.activo) return;
  ctx.save();
  ctx.translate(cx, cy + 95);
  ctx.globalCompositeOperation = "lighter";

  vorticeParticulas.forEach((p) => {
    const ang = p.anguloBase + tiempo * p.velocidad;
    const r = p.radioBase;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r * 0.32; // aplanado para efecto de disco visto en perspectiva
    const brillo = 0.12 + 0.14 * Math.sin(tiempo * 0.0009 + p.fase);

    ctx.beginPath();
    ctx.globalAlpha = Math.max(brillo, 0);
    ctx.fillStyle = "#ffe98a";
    ctx.shadowColor = "#ffe98a";
    ctx.shadowBlur = 5;
    ctx.arc(x, y, p.radio, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ================= LOOP DE ANIMACIÓN PRINCIPAL ================= */

function animar(tiempo) {
  ctx.clearRect(0, 0, ancho, alto);

  dibujarNebulosa();

  particulas.forEach((p) => {
    p.actualizar();
    p.dibujar();
  });

  const rect = centro.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2 - 25;

  dibujarVortice(tiempo, cx, cy);
  dibujarRamo(tiempo);

  requestAnimationFrame(animar);
}
requestAnimationFrame(animar);

/* ================= PÉTALOS CAYENDO ================= */
const simbolos = ["🌼", "🌻", "💛"];
for (let i = 0; i < CONFIG.petalosCayendo.cantidad; i++) {
  const p = document.createElement("div");
  p.className = "petalo-cae";
  p.textContent = simbolos[Math.floor(Math.random() * simbolos.length)];
  p.style.left = Math.random() * 100 + "vw";
  p.style.fontSize = (Math.random() * 10 + 12) + "px";
  p.style.animationDuration = (Math.random() * 6 + 7) + "s";
  p.style.animationDelay = (Math.random() * 8) + "s";
  document.body.appendChild(p);
}

/* ================= CHISPAS AL TOCAR LA FLOR ================= */
centro.addEventListener("click", () => {
  const rect = centro.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2 - 25;

  for (let i = 0; i < 18; i++) {
    const chispa = document.createElement("div");
    chispa.className = "chispa";
    const angulo = Math.random() * Math.PI * 2;
    const distancia = Math.random() * 90 + 40;
    chispa.style.setProperty("--dx", Math.cos(angulo) * distancia + "px");
    chispa.style.setProperty("--dy", Math.sin(angulo) * distancia + "px");
    chispa.style.left = cx + "px";
    chispa.style.top = cy + "px";
    document.body.appendChild(chispa);
    setTimeout(() => chispa.remove(), 900);
  }
});

/* ================= MENSAJES ORBITANDO (efecto galaxia, sin chocar) ================= */
if (CONFIG.mensajesOrbita.activo) {
  const contenedorOrbita = document.getElementById("orbitaMensajes");
  const cfgOrbita = CONFIG.mensajesOrbita;

  const elementosOrbita = cfgOrbita.textos.map((texto, i) => {
    const emoji = cfgOrbita.emojis[i % cfgOrbita.emojis.length];
    const el = document.createElement("div");
    el.className = "mensaje-orbita";
    el.textContent = `${emoji} ${texto} ${emoji}`;
    contenedorOrbita.appendChild(el);
    // medimos el tamaño real de la tarjeta una sola vez (el texto es fijo)
    const rectEl = el.getBoundingClientRect();
    return {
      el,
      offset: (i / cfgOrbita.textos.length) * Math.PI * 2,
      ancho: rectEl.width || 140,
      alto: rectEl.height || 34,
      x: 0,
      y: 0,
    };
  });

  // Separa tarjetas que se solapen, empujándolas por el eje donde se
  // encimen menos, para que el ajuste sea mínimo y se note poco.
  function resolverColisiones(items, margen, iteraciones) {
    for (let iter = 0; iter < iteraciones; iter++) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const superposX = (a.ancho / 2 + b.ancho / 2 + margen) - Math.abs(dx);
          const superposY = (a.alto / 2 + b.alto / 2 + margen) - Math.abs(dy);
          if (superposX > 0 && superposY > 0) {
            if (superposX < superposY) {
              const empuje = (superposX / 2) * (dx >= 0 ? 1 : -1);
              a.x -= empuje; b.x += empuje;
            } else {
              const empuje = (superposY / 2) * (dy >= 0 ? 1 : -1);
              a.y -= empuje; b.y += empuje;
            }
          }
        }
      }
    }
  }

  const animarOrbita = (tiempo) => {
    const rect = centro.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2 - 40;

    // 1) posición "ideal" de cada tarjeta según su órbita. Ya NO avanza
    //    sola con el tiempo: el ángulo depende de "rotacionManual", el
    //    mismo valor que controla el giro de la flor al arrastrarla. Así
    //    las tarjetas solo se mueven cuando el usuario gira el ramo.
    elementosOrbita.forEach((item) => {
      const angulo = rotacionManual + item.offset;
      item.angulo = angulo;
      item.x = cx + Math.cos(angulo) * cfgOrbita.radioX;
      item.y = cy + Math.sin(angulo) * cfgOrbita.radioY;
    });

    // 2) separa las que se encimen (más margen e iteraciones = menos choques)
    resolverColisiones(elementosOrbita, 26, 6);

    // 3) aplica posición final + profundidad (según el ángulo original, no el ajuste)
    elementosOrbita.forEach((item) => {
      const profundidad = (Math.sin(item.angulo) + 1) / 2;
      const escala = 0.75 + profundidad * 0.5;
      const opacidad = cfgOrbita.opacidadBase + profundidad * cfgOrbita.opacidadBase;

      item.el.style.left = item.x + "px";
      item.el.style.top = item.y + "px";
      item.el.style.transform = `translate(-50%, -50%) scale(${escala})`;
      item.el.style.opacity = opacidad;
      item.el.style.zIndex = Math.round(profundidad * 10) + 2;
      item.el.style.fontSize = (13 + profundidad * 6) + "px";
    });

    requestAnimationFrame(animarOrbita);
  };
  requestAnimationFrame(animarOrbita);
}

/* ================= BOTÓN DE MÚSICA ================= */
const musica = document.getElementById("musica");
const btnMusica = document.getElementById("btnMusica");
let sonando = false;

musica.volume = 0.3;

btnMusica.addEventListener("click", () => {
  if (sonando) {
    musica.pause();
    btnMusica.textContent = "🔇";
  } else {
    musica.play()
      .then(() => {
        btnMusica.textContent = "🔊";
      })
      .catch((err) => {
        console.error("No se pudo reproducir el audio:", err);
      });
  }
  sonando = !sonando;
});

/* ================= INTRO Y ANTESALA: transición al tocar el botón ================= */
const intro = document.getElementById("intro");
const btnEntrar = document.getElementById("btnEntrar");
const escena = document.querySelector(".escena");
const antesala = document.getElementById("antesala");

const simbolosAntesala = ["🌻", "🌼", "💛", "💕", "✨"];

function lanzarRayosAntesala() {
  const intervalo = setInterval(() => {
    for (let i = 0; i < 3; i++) {
      const rayo = document.createElement("div");
      rayo.className = "rayo-antesala";
      rayo.textContent = simbolosAntesala[Math.floor(Math.random() * simbolosAntesala.length)];

      const angulo = Math.random() * Math.PI * 2;
      const distancia = Math.random() * 500 + 300;
      const giro = (Math.random() - 0.5) * 720;

      rayo.style.setProperty("--dx", Math.cos(angulo) * distancia + "px");
      rayo.style.setProperty("--dy", Math.sin(angulo) * distancia + "px");
      rayo.style.setProperty("--giro", giro + "deg");

      document.body.appendChild(rayo);
      setTimeout(() => rayo.remove(), 1800);
    }
  }, 80);
  return intervalo;
}

btnEntrar.addEventListener("click", () => {
  intro.classList.add("oculto");

  antesala.classList.add("activa");
  const intervaloRayos = lanzarRayosAntesala();

  musica.play()
    .then(() => {
      btnMusica.textContent = "🔊";
      sonando = true;
    })
    .catch((err) => {
      console.error("No se pudo reproducir el audio:", err);
    });

  setTimeout(() => intro.remove(), 600);

  setTimeout(() => {
    clearInterval(intervaloRayos);
    antesala.classList.add("saliendo");
    escena.classList.add("mostrar");
    btnParaTi.classList.add("visible"); // recién ahora aparece el botón "Para ti"

    setTimeout(() => {
      antesala.remove();
    }, 500);
  }, 1800);
});

/* ================= MODAL "PARA TI" ================= */
// Reemplaza al alert() feo del navegador por una tarjeta propia, con el
// mismo estilo dorado/espacial del resto de la página.
const btnParaTi = document.getElementById("btnParaTi");
const modalParaTi = document.getElementById("modalParaTi");
const cerrarParaTi = document.getElementById("cerrarParaTi");
const aceptarParaTi = document.getElementById("aceptarParaTi");

function abrirModalParaTi() {
  modalParaTi.classList.add("activo");
  // el requestAnimationFrame deja que el navegador aplique "display:flex"
  // antes de animar la opacidad/escala, para que la transición se vea
  requestAnimationFrame(() => modalParaTi.classList.add("mostrar"));
}

function cerrarModalParaTi() {
  modalParaTi.classList.remove("mostrar");
  setTimeout(() => modalParaTi.classList.remove("activo"), 300);
}

btnParaTi.addEventListener("click", abrirModalParaTi);
cerrarParaTi.addEventListener("click", cerrarModalParaTi);
aceptarParaTi.addEventListener("click", cerrarModalParaTi);
modalParaTi.addEventListener("click", (e) => {
  if (e.target === modalParaTi) cerrarModalParaTi(); // clic fuera de la tarjeta
});
