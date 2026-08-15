/* Panorama Ejecutivo - app web instalable, solo lectura.
   Consume /api/proxy, una función serverless que vive en este mismo
   proyecto de Vercel. Ese proxy es el que sabe la URL real del CRM
   interno y el token de acceso (guardados como variables de entorno
   de Vercel, nunca en este código) — así el navegador nunca ve el
   token. Abre directo, sin login ni configuración. */

var API_URL = "/api/proxy";

var DATA = null;
var ultimaActualizacion = null;
var kbFaseColapsada = {};
var ONBOARDING_KEY = "ccVistoBienvenida";
var MODO_DEMO = false;

/* ----- Modo demo: datos de prueba en memoria, sin llamar a la API -----
   Sirve para probar/mostrar la app sin depender del túnel/servidor real,
   y permite "mover" tarjetas de etapa libremente porque nada de esto se
   guarda en ningún lado — es puro estado local del navegador. */

function ccFechaHace(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().substring(0, 10);
}

function ccFechaEn(dias) {
  var d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().substring(0, 10);
}

function ccConstruirDatosDemo() {
  var fases = [
    { clave: "preventa", nombre: "Preventa", color: "#2a78d6", icono: "fa-bullseye" },
    { clave: "venta", nombre: "Venta", color: "#00a65a", icono: "fa-briefcase" },
    { clave: "firmas", nombre: "Firmas", color: "#4a3aa7", icono: "fa-gavel" },
    { clave: "cancelado", nombre: "Cancelado / Perdido", color: "#dd4b39", icono: "fa-times-circle" }
  ];

  var etapas = [
    { clave: "primer_contacto", nombre: "Primer Contacto", color: "#2a78d6", icono: "fa-phone", fase: "preventa" },
    { clave: "segundo_contacto", nombre: "Segundo Contacto", color: "#eb6834", icono: "fa-phone-square", fase: "preventa" },
    { clave: "cita", nombre: "Cita", color: "#1baf7a", icono: "fa-calendar", fase: "preventa" },
    { clave: "prospecto", nombre: "Prospecto", color: "#eda100", icono: "fa-star", fase: "preventa" },
    { clave: "cliente", nombre: "Cliente", color: "#e87ba4", icono: "fa-user", fase: "venta" },
    { clave: "expediente_completo", nombre: "Expediente Completo", color: "#008300", icono: "fa-check-circle", fase: "venta" },
    { clave: "documentos", nombre: "Documentos", color: "#8e7cc3", icono: "fa-file-text-o", fase: "firmas" },
    { clave: "avaluo", nombre: "Avalúo", color: "#5b8def", icono: "fa-search", fase: "firmas" },
    { clave: "fondeo", nombre: "Fondeo", color: "#00b8d9", icono: "fa-money", fase: "firmas" },
    { clave: "firma", nombre: "Firma", color: "#6554c0", icono: "fa-pencil-square-o", fase: "firmas" },
    { clave: "escrituras", nombre: "Escrituras", color: "#403294", icono: "fa-book", fase: "firmas" },
    { clave: "expediente_fisico", nombre: "Expediente Físico", color: "#a54800", icono: "fa-archive", fase: "firmas" },
    { clave: "visto_bueno", nombre: "Visto Bueno", color: "#ff991f", icono: "fa-thumbs-o-up", fase: "firmas" },
    { clave: "finalizado", nombre: "Finalizado", color: "#00875a", icono: "fa-flag-checkered", fase: "firmas" },
    { clave: "cancelado", nombre: "Cancelado / Perdido", color: "#dd4b39", icono: "fa-times-circle", fase: "cancelado" }
  ];

  var vendedores = ["Ana López", "Carlos Ruiz", "Diana Torres", "Marco Peña"];
  var vendedorColores = { "Ana López": "#3c8dbc", "Carlos Ruiz": "#f39c12", "Diana Torres": "#00a65a", "Marco Peña": "#dd4b39" };
  var plazaPorFraccionamiento = { "Villas del Sol": "Victoria", "Los Encinos": "Victoria", "Real del Valle": "San Luis Potosí" };

  var clientes = [
    { id: 1, etapa: "primer_contacto", docs: { avaluo: false, expediente: false }, nombre: "Roberto Salinas", telefono: "834 123 4501", lote: "Lote 12", fraccionamiento: "Villas del Sol", vendedor: "Ana López", monto: 480000, ultimoSeguimiento: ccFechaHace(0), seguimientos: [{ fecha: ccFechaHace(0), autor: "Ana López", canal: "Llamada", texto: "Contacto inicial por teléfono, interesado en modelo de 2 recámaras." }] },
    { id: 2, etapa: "primer_contacto", docs: { avaluo: false, expediente: false }, nombre: "Laura Domínguez", telefono: "834 123 4502", lote: "Lote 3", fraccionamiento: "Real del Valle", vendedor: "Carlos Ruiz", monto: 520000, ultimoSeguimiento: ccFechaHace(4), seguimientos: [{ fecha: ccFechaHace(4), autor: "Carlos Ruiz", canal: "WhatsApp", texto: "Llamada inicial, pidió información por WhatsApp." }] },
    { id: 3, etapa: "segundo_contacto", docs: { avaluo: false, expediente: false }, nombre: "Jorge Herrera", telefono: "834 123 4503", lote: "Lote 8", fraccionamiento: "Los Encinos", vendedor: "Diana Torres", monto: 610000, ultimoSeguimiento: ccFechaHace(1), seguimientos: [{ fecha: ccFechaHace(6), autor: "Diana Torres", canal: "Llamada", texto: "Primer contacto, mostró interés en crédito Infonavit." }, { fecha: ccFechaHace(1), autor: "Diana Torres", canal: "Llamada", texto: "Segunda llamada, confirmó ingresos y envió documentos." }] },
    { id: 4, etapa: "cita", docs: { avaluo: false, expediente: false }, nombre: "Fernando Cantú", telefono: "834 123 4505", lote: "Lote 15", fraccionamiento: "Real del Valle", vendedor: "Ana López", monto: 545000, fechaCita: ccFechaEn(2), ultimoSeguimiento: ccFechaHace(2), seguimientos: [{ fecha: ccFechaHace(2), autor: "Ana López", canal: "Llamada", texto: "Cita agendada para el sábado a las 11am en sala de ventas." }] },
    { id: 5, etapa: "prospecto", docs: { avaluo: false, expediente: false }, nombre: "Miguel Ángel Soto", telefono: "834 123 4507", lote: "Lote 9", fraccionamiento: "Villas del Sol", vendedor: "Diana Torres", monto: 470000, ultimoSeguimiento: ccFechaHace(3), seguimientos: [{ fecha: ccFechaHace(9), autor: "Diana Torres", canal: "Visita", texto: "Visitó la casa muestra, le gustó la ubicación." }, { fecha: ccFechaHace(3), autor: "Diana Torres", canal: "Llamada", texto: "Está comparando con otro fraccionamiento, dar seguimiento." }] },
    { id: 6, etapa: "cliente", docs: { avaluo: true, expediente: false }, nombre: "Ricardo Elizondo", telefono: "834 123 4509", lote: "Lote 18", fraccionamiento: "Los Encinos", vendedor: "Ana López", monto: 530000, ultimoSeguimiento: ccFechaHace(1), seguimientos: [{ fecha: ccFechaHace(1), autor: "Ana López", canal: "Correo", texto: "Ya es cliente, se solicitó el avalúo del lote." }] },
    { id: 7, etapa: "cliente", docs: { avaluo: false, expediente: false }, nombre: "Alejandra Morales", telefono: "834 123 4510", lote: "Lote 4", fraccionamiento: "Villas del Sol", vendedor: "Carlos Ruiz", monto: 505000, ultimoSeguimiento: ccFechaHace(5), seguimientos: [{ fecha: ccFechaHace(5), autor: "Carlos Ruiz", canal: "Llamada", texto: "Se convirtió en cliente, pendiente de subir documentos." }] },
    { id: 8, etapa: "expediente_completo", docs: { avaluo: true, expediente: true }, nombre: "Eduardo Guzmán", telefono: "834 123 4513", lote: "Lote 2", fraccionamiento: "Villas del Sol", vendedor: "Ana López", monto: 500000, ultimoSeguimiento: ccFechaHace(1), seguimientos: [{ fecha: ccFechaHace(1), autor: "Ana López", canal: "Visita", texto: "Expediente completo, listo para pasar a firmas." }] },
    { id: 9, etapa: "documentos", docs: { avaluo: true, expediente: true }, nombre: "Sofía Reyes", telefono: "834 123 4516", lote: "Lote 5", fraccionamiento: "Villas del Sol", vendedor: "Ana López", monto: 500000, metaExtra: "Checklist de documentos en revisión", ultimoSeguimiento: ccFechaHace(1), seguimientos: [{ fecha: ccFechaHace(1), autor: "Ana López", canal: "Correo", texto: "Pasó a firmas, se está revisando el checklist de documentos." }] },
    { id: 10, etapa: "avaluo", docs: { avaluo: true, expediente: true }, nombre: "Daniel Cabrera", telefono: "834 123 4517", lote: "Lote 22", fraccionamiento: "Real del Valle", vendedor: "Carlos Ruiz", monto: 610000, ultimoSeguimiento: ccFechaHace(2), seguimientos: [{ fecha: ccFechaHace(2), autor: "Carlos Ruiz", canal: "Llamada", texto: "Documentos aprobados, se solicitó el avalúo formal." }] },
    { id: 11, etapa: "fondeo", docs: { avaluo: true, expediente: true }, nombre: "Cynthia Reséndez", telefono: "834 123 4518", lote: "Lote 14", fraccionamiento: "Los Encinos", vendedor: "Diana Torres", monto: 575000, ultimoSeguimiento: ccFechaHace(0), seguimientos: [{ fecha: ccFechaHace(0), autor: "Diana Torres", canal: "Correo", texto: "Avalúo listo, en trámite de fondeo con Notaría 3." }] },
    { id: 12, etapa: "firma", docs: { avaluo: true, expediente: true }, nombre: "Óscar Villegas", telefono: "834 123 4519", lote: "Lote 7", fraccionamiento: "Villas del Sol", vendedor: "Marco Peña", monto: 495000, fechaFirma: ccFechaEn(7), ultimoSeguimiento: ccFechaHace(1), seguimientos: [{ fecha: ccFechaHace(1), autor: "Marco Peña", canal: "Llamada", texto: "Fondeo confirmado, se agendó fecha de firma." }] },
    { id: 13, etapa: "escrituras", docs: { avaluo: true, expediente: true }, nombre: "Paola Siller", telefono: "834 123 4520", lote: "Lote 31", fraccionamiento: "Real del Valle", vendedor: "Ana López", monto: 640000, ultimoSeguimiento: ccFechaHace(2), seguimientos: [{ fecha: ccFechaHace(2), autor: "Ana López", canal: "Visita", texto: "Firma realizada, se subió la escritura al sistema." }] },
    { id: 14, etapa: "expediente_fisico", docs: { avaluo: true, expediente: true }, nombre: "Rubén Garza", telefono: "834 123 4521", lote: "Lote 10", fraccionamiento: "Los Encinos", vendedor: "Carlos Ruiz", monto: 520000, ultimoSeguimiento: ccFechaHace(3), seguimientos: [{ fecha: ccFechaHace(3), autor: "Carlos Ruiz", canal: "Correo", texto: "Escritura lista, falta confirmar expediente físico." }] },
    { id: 15, etapa: "visto_bueno", docs: { avaluo: true, expediente: true }, nombre: "Marisol Uribe", telefono: "834 123 4522", lote: "Lote 25", fraccionamiento: "Villas del Sol", vendedor: "Diana Torres", monto: 505000, ultimoSeguimiento: ccFechaHace(1), seguimientos: [{ fecha: ccFechaHace(1), autor: "Diana Torres", canal: "Correo", texto: "Expediente físico confirmado, en espera de visto bueno." }] },
    { id: 16, etapa: "finalizado", docs: { avaluo: true, expediente: true }, nombre: "Álvaro Peña", telefono: "834 123 4523", lote: "Lote 17", fraccionamiento: "Real del Valle", vendedor: "Marco Peña", monto: 630000, ultimoSeguimiento: ccFechaHace(4), seguimientos: [{ fecha: ccFechaHace(4), autor: "Marco Peña", canal: "Visita", texto: "Visto bueno de Contraloría recibido, proceso finalizado." }] },
    { id: 17, etapa: "cancelado", docs: { avaluo: false, expediente: false }, nombre: "Ramiro Cantú", telefono: "834 123 4524", lote: "Lote 24", fraccionamiento: "Villas del Sol", vendedor: "Carlos Ruiz", monto: 470000, motivoCancelacion: "Se fue con la competencia", ultimoSeguimiento: ccFechaHace(5), seguimientos: [{ fecha: ccFechaHace(9), autor: "Carlos Ruiz", canal: "Llamada", texto: "Interesado, comparando opciones de crédito." }, { fecha: ccFechaHace(5), autor: "Carlos Ruiz", canal: "Llamada", texto: "Se cancela: el cliente ya compró en otro fraccionamiento." }] }
  ];

  clientes.forEach(function (c) { c.etapaDesde = c.ultimoSeguimiento; });

  return {
    fases: fases, etapas: etapas, vendedores: vendedores, vendedorColores: vendedorColores,
    plazaPorFraccionamiento: plazaPorFraccionamiento, slaProspectoDias: 2, clientes: clientes
  };
}

function ccActualizarIndicadorDemo() {
  var sub = document.getElementById("appMarcaSub");
  var btn = document.getElementById("btnDemo");
  if (!sub || !btn) return;
  if (MODO_DEMO) {
    sub.textContent = "Modo demo · datos de prueba, no se guardan cambios";
    sub.classList.add("modo-demo-texto");
    btn.classList.add("activo");
    btn.title = "Salir del modo demo";
  } else {
    sub.textContent = "Grupo Caletto · vista de solo lectura";
    sub.classList.remove("modo-demo-texto");
    btn.classList.remove("activo");
    btn.title = "Modo demo";
  }
}

function ccActivarModoDemo() {
  MODO_DEMO = true;
  DATA = ccConstruirDatosDemo();
  ultimaActualizacion = new Date();
  ccPoblarFiltros();
  ccRender();
  ccActualizarIndicadorDemo();
  ccMostrarPantalla("app");
}

function ccSalirModoDemo() {
  MODO_DEMO = false;
  DATA = null;
  ccActualizarIndicadorDemo();
  ccCargarDatos();
}

function ccAlternarModoDemo() {
  if (MODO_DEMO) {
    ccSalirModoDemo();
  } else {
    ccActivarModoDemo();
  }
}

/* ----- Tabs (Resumen / Kanban) ----- */

function ccCambiarTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.classList.toggle("activo", btn.getAttribute("data-tab") === tab);
  });
  document.getElementById("vistaResumen").style.display = (tab === "resumen") ? "" : "none";
  document.getElementById("vistaKanban").style.display = (tab === "kanban") ? "" : "none";
}

/* ----- Bienvenida (primera vez, o bajo demanda con el botón de ayuda) ----- */

function ccCerrarBienvenida() {
  localStorage.setItem(ONBOARDING_KEY, "1");
  if (DATA) {
    ccMostrarPantalla("app");
  } else {
    ccCargarDatos();
  }
}

function ccMostrarBienvenida() {
  ccMostrarPantalla("bienvenida");
}

/* ----- Estados de pantalla ----- */

function ccMostrarPantalla(nombre) {
  ["Bienvenida", "Cargando", "Error"].forEach(function (n) {
    document.getElementById("pantalla" + n).style.display = (n.toLowerCase() === nombre) ? "flex" : "none";
  });
  document.getElementById("app").style.display = (nombre === "app") ? "block" : "none";
}

/* ----- Carga de datos ----- */

function ccCargarDatos() {
  var btn = document.getElementById("btnRefrescar");
  if (btn) btn.classList.add("girando");
  if (!DATA) ccMostrarPantalla("cargando");

  fetch(API_URL)
    .then(function (res) {
      if (!res.ok) { throw { tipo: "http", status: res.status }; }
      return res.json();
    })
    .then(function (json) {
      MODO_DEMO = false;
      DATA = json;
      ultimaActualizacion = new Date();
      ccPoblarFiltros();
      ccRender();
      ccActualizarIndicadorDemo();
      ccMostrarPantalla("app");
    })
    .catch(function (err) {
      var msg = "No se pudo conectar. Revisa tu internet e intenta de nuevo.";
      if (err && err.tipo === "http") msg = "El servidor respondió con un error (" + err.status + ").";
      document.getElementById("errorTexto").textContent = msg;
      ccMostrarPantalla("error");
    })
    .finally(function () {
      if (btn) btn.classList.remove("girando");
    });
}

/* ----- Helpers de datos (equivalentes a crmventas.js) ----- */

var CC_CANALES = [
  { clave: "Llamada", icono: "fa-phone" },
  { clave: "WhatsApp", icono: "fa-comments" },
  { clave: "Correo", icono: "fa-envelope" },
  { clave: "Visita", icono: "fa-home" },
  { clave: "SMS", icono: "fa-mobile" }
];

function ccCanalInfo(clave) {
  for (var i = 0; i < CC_CANALES.length; i++) if (CC_CANALES[i].clave === clave) return CC_CANALES[i];
  return { clave: clave || "Otro", icono: "fa-comment-o" };
}

function ccDiasDesde(fechaStr) {
  var ms = new Date().getTime() - new Date(fechaStr + "T00:00:00").getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

function ccMoneda(n) {
  return "$" + Number(n).toLocaleString("es-MX");
}

function ccEtapaInfo(clave) {
  for (var i = 0; i < DATA.etapas.length; i++) if (DATA.etapas[i].clave === clave) return DATA.etapas[i];
  return DATA.etapas[0];
}

function ccPlazaDe(fraccionamiento) {
  var f = (fraccionamiento || "").trim();
  if (DATA.plazaPorFraccionamiento[f] !== undefined) return DATA.plazaPorFraccionamiento[f];
  var claves = Object.keys(DATA.plazaPorFraccionamiento);
  for (var i = 0; i < claves.length; i++) {
    if (claves[i].trim() === f) return DATA.plazaPorFraccionamiento[claves[i]];
  }
  return "";
}

function ccVendedorColor(nombre) {
  return DATA.vendedorColores[nombre] || "#3c8dbc";
}

function ccIniciales(nombre) {
  return nombre.split(" ").map(function (p) { return p[0]; }).join("").substring(0, 2).toUpperCase();
}

function ccChipDias(dias, sla) {
  if (dias <= sla) return "ok";
  if (dias <= sla + 3) return "warn";
  return "bad";
}

/* ----- Filtros ----- */

function ccValoresUnicos(extractor) {
  var vistos = {};
  var lista = [];
  DATA.clientes.forEach(function (d) {
    var v = (extractor(d) || "").toString().trim();
    if (v && !vistos[v]) { vistos[v] = true; lista.push(v); }
  });
  return lista.sort();
}

function ccPlazasDisponibles() {
  if (DATA.plazasApi && DATA.plazasApi.length) return DATA.plazasApi.slice().sort();
  return ccValoresUnicos(function (d) { return ccPlazaDe(d.fraccionamiento); });
}

function ccReconstruirPlazaPorFraccionamiento() {
  if (!DATA.plazaPorFraccionamiento) DATA.plazaPorFraccionamiento = {};
  DATA.clientes.forEach(function (d) {
    var fracc = (d.fraccionamiento || "").trim();
    var plaza = (d.plaza || "").trim();
    if (fracc && plaza && plaza !== "Sin plaza" && !DATA.plazaPorFraccionamiento[fracc]) {
      DATA.plazaPorFraccionamiento[fracc] = plaza;
    }
  });
}

function ccPoblarFiltros() {
  ccReconstruirPlazaPorFraccionamiento();

  var selPlaza = document.getElementById("fPlaza");
  if (selPlaza.options.length <= 1) {
    ccPlazasDisponibles().forEach(function (p) {
      var op = document.createElement("option");
      op.value = p; op.textContent = p;
      selPlaza.appendChild(op);
    });
  }

  ccFiltrarFraccPorPlaza();
  ccFiltrarVendedorPorPlazaFracc();
}

function ccFiltrarVendedorPorPlazaFracc() {
  var selVendedor = document.getElementById("fVendedor");
  var plaza = document.getElementById("fPlaza").value;
  var fraccionamiento = document.getElementById("fFracc").value;
  var valorActual = selVendedor.value;

  var vistos = {};
  var vendedores = [];
  DATA.clientes.forEach(function (d) {
    if (fraccionamiento && (d.fraccionamiento || "").trim() !== fraccionamiento) return;
    if (plaza && ccPlazaDe(d.fraccionamiento) !== plaza) return;
    var v = (d.vendedor || "").trim();
    if (v && !vistos[v]) { vistos[v] = true; vendedores.push(v); }
  });
  vendedores.sort();

  selVendedor.innerHTML = '<option value="">Todos los vendedores</option>';
  vendedores.forEach(function (v) {
    var op = document.createElement("option");
    op.value = v; op.textContent = v;
    selVendedor.appendChild(op);
  });
  if (vendedores.indexOf(valorActual) !== -1) selVendedor.value = valorActual;
}

function ccFiltrarFraccPorPlaza() {
  var selPlaza = document.getElementById("fPlaza");
  var selFracc = document.getElementById("fFracc");
  var plaza = selPlaza.value;
  var valorActual = selFracc.value;

  var fraccionamientos = ccValoresUnicos(function (d) { return d.fraccionamiento; }).filter(function (f) {
    return !plaza || ccPlazaDe(f) === plaza;
  });

  selFracc.innerHTML = '<option value="">Todos los fraccionamientos</option>';
  fraccionamientos.forEach(function (f) {
    var op = document.createElement("option");
    op.value = f; op.textContent = f;
    selFracc.appendChild(op);
  });
  if (fraccionamientos.indexOf(valorActual) !== -1) selFracc.value = valorActual;
}

function ccLimpiarFechas() {
  document.getElementById("fFechaDesde").value = "";
  document.getElementById("fFechaHasta").value = "";
  ccRender();
}

function ccDatosFiltrados() {
  var texto = (document.getElementById("fBuscar").value || "").toLowerCase().trim();
  var plaza = document.getElementById("fPlaza").value;
  var fraccionamiento = document.getElementById("fFracc").value;
  var vendedor = document.getElementById("fVendedor").value;
  var fechaDesde = document.getElementById("fFechaDesde").value;
  var fechaHasta = document.getElementById("fFechaHasta").value;
  return DATA.clientes.filter(function (d) {
    if (vendedor && (d.vendedor || "").trim() !== vendedor) return false;
    if (fraccionamiento && (d.fraccionamiento || "").trim() !== fraccionamiento) return false;
    if (plaza && ccPlazaDe(d.fraccionamiento) !== plaza) return false;
    if (fechaDesde && (d.etapaDesde || "") < fechaDesde) return false;
    if (fechaHasta && (d.etapaDesde || "") > fechaHasta) return false;
    if (texto) {
      var campo = (d.nombre + " " + (d.lote || "") + " " + (d.fraccionamiento || "")).toLowerCase();
      if (campo.indexOf(texto) === -1) return false;
    }
    return true;
  });
}

/* ----- Render ----- */

function ccRender() {
  var datos = ccDatosFiltrados();
  ccRenderBanner(datos);
  ccRenderKpis(datos);
  ccRenderEmbudo(datos);
  ccRenderFirmasDetalle(datos);
  ccRenderAlertas(datos);
  ccRenderProximas(datos);
  ccRenderRanking(datos);
  ccRenderPlaza(datos);
  ccRenderFraccionamiento(datos);
  ccRenderMotivos(datos);
  ccRenderTiempoEtapas(datos);
  ccRenderKanban(datos);
}

function ccRenderBanner(datos) {
  var sla = DATA.slaProspectoDias;
  var vencidos = datos.filter(function (d) {
    return d.etapa !== "finalizado" && d.etapa !== "cancelado" && ccDiasDesde(d.ultimoSeguimiento) > sla;
  }).length;

  var hoy = new Date().toISOString().substring(0, 10);
  var fechasVencidas = datos.filter(function (d) {
    return (d.etapa === "cita" && d.fechaCita && d.fechaCita < hoy) ||
      (d.etapa === "firma" && d.fechaFirma && d.fechaFirma < hoy);
  }).length;

  var total = vencidos + fechasVencidas;
  var clase = total === 0 ? "ok" : total <= 3 ? "warn" : "bad";
  var icono = total === 0 ? "fa-check-circle" : "fa-exclamation-triangle";
  var mensaje = total === 0 ? "Todo bien" : total + " caso(s) necesitan atención";

  var banner = document.getElementById("banner");
  banner.className = "banner " + clase;
  banner.innerHTML =
    '<span class="banner-msg"><i class="fa ' + icono + '"></i> ' + mensaje + '</span>' +
    '<span class="banner-actualizado" id="banActualizado"></span>';

  ccRenderTimestamp();
}

function ccRenderTimestamp() {
  var el = document.getElementById("banActualizado");
  if (!el || !ultimaActualizacion) return;
  var segundos = Math.floor((new Date() - ultimaActualizacion) / 1000);
  var texto;
  if (segundos < 60) texto = "Actualizado justo ahora";
  else if (segundos < 3600) texto = "Hace " + Math.floor(segundos / 60) + " min";
  else texto = "Hace " + Math.floor(segundos / 3600) + " h";
  el.textContent = texto;
}
setInterval(ccRenderTimestamp, 30000);

function ccRenderKpis(datos) {
  var sla = DATA.slaProspectoDias;
  var total = datos.length;
  var montoTotal = datos.reduce(function (s, d) { return s + d.monto; }, 0);
  var cerrados = datos.filter(function (d) { return CC_FIRMAS_ETAPA_FINAL.indexOf(d.etapa) !== -1; });
  var montoCerrado = cerrados.reduce(function (s, d) { return s + d.monto; }, 0);
  var tasa = total ? Math.round((cerrados.length / total) * 100) : 0;
  var vencidos = datos.filter(function (d) {
    return CC_FIRMAS_ETAPA_FINAL.indexOf(d.etapa) === -1 && d.etapa !== "cancelado" && ccDiasDesde(d.ultimoSeguimiento) > sla;
  });

  document.getElementById("kpis").innerHTML =
    '<div class="kpi"><div class="n">' + total + '</div><div class="l">En pipeline</div><div class="s">' + ccMoneda(montoTotal) + '</div></div>' +
    '<div class="kpi verde"><div class="n">' + cerrados.length + '</div><div class="l">Finalizado</div><div class="s">' + ccMoneda(montoCerrado) + '</div></div>' +
    '<div class="kpi naranja"><div class="n">' + tasa + '%</div><div class="l">Conversión</div><div class="s">Global</div></div>' +
    '<div class="kpi coral"><div class="n">' + vencidos.length + '</div><div class="l">Sin seguimiento</div><div class="s">+' + sla + ' días</div></div>';
}

function ccDesglosePorFase(items) {
  return DATA.fases.map(function (fase) {
    var etapasFase = DATA.etapas.filter(function (e) { return e.fase === fase.clave; });
    var itemsFase = items.filter(function (d) {
      return etapasFase.some(function (e) { return e.clave === d.etapa; });
    });
    var monto = itemsFase.reduce(function (s, d) { return s + d.monto; }, 0);
    return { fase: fase, count: itemsFase.length, monto: monto };
  });
}

function ccRenderEmbudo(datos) {
  var filas = ccDesglosePorFase(datos);
  var maxCount = Math.max.apply(null, filas.map(function (f) { return f.count; }).concat([1]));

  document.getElementById("embudo").innerHTML = filas.map(function (f, i) {
    var pct = Math.max(Math.round((f.count / maxCount) * 100), f.count ? 6 : 0);
    var esDemo = f.fase.clave === "preventa";
    var conv = "";
    if (i > 0) {
      var anterior = filas[i - 1];
      if (anterior.fase.clave === "preventa") {
        conv = '<div class="conversion">Preventa aún no está conectada a datos reales — no comparable</div>';
      } else {
        var pctConv = anterior.count ? Math.round((f.count / anterior.count) * 100) : 0;
        conv = '<div class="conversion"><i class="fa fa-long-arrow-up"></i> ' + pctConv + '% vs ' + anterior.fase.nombre + '</div>';
      }
    }
    return conv +
      '<div class="barra-fila">' +
        '<div class="barra-cab"><span class="barra-nombre"><i class="fa ' + f.fase.icono + '" style="color:' + f.fase.color + '"></i>' + f.fase.nombre +
          (esDemo ? ' <span class="etiqueta-demo">ejemplo</span>' : '') + '</span>' +
        '<span class="barra-valor">' + f.count + ' · ' + ccMoneda(f.monto) + '</span></div>' +
        '<div class="barra-pista"><div class="barra-fill" style="width:' + pct + '%;background:' + f.fase.color + '">' + (f.count || "") + '</div></div>' +
      '</div>';
  }).join("");
}

var CC_FIRMAS_ETAPA_FINAL = ["escrituras", "expediente_fisico", "visto_bueno", "finalizado"];

function ccRenderFirmasDetalle(datos) {
  var etapasFirmas = DATA.etapas.filter(function (e) { return e.fase === "firmas" && CC_FIRMAS_ETAPA_FINAL.indexOf(e.clave) === -1; });
  var filas = etapasFirmas.map(function (etapa) {
    var items = datos.filter(function (d) { return d.etapa === etapa.clave; });
    var monto = items.reduce(function (s, d) { return s + d.monto; }, 0);
    return { etapa: etapa, count: items.length, monto: monto };
  });

  var itemsFinal = datos.filter(function (d) { return CC_FIRMAS_ETAPA_FINAL.indexOf(d.etapa) !== -1; });
  var infoFinal = ccEtapaInfo("finalizado");
  filas.push({
    etapa: { nombre: "Finalizado", icono: infoFinal.icono, color: infoFinal.color },
    count: itemsFinal.length,
    monto: itemsFinal.reduce(function (s, d) { return s + d.monto; }, 0)
  });

  var cont = document.getElementById("firmasDetalle");
  var totalFirmas = filas.reduce(function (s, f) { return s + f.count; }, 0);
  if (!totalFirmas) {
    cont.innerHTML = '<div class="vacio"><i class="fa fa-gavel"></i><br>Sin casos en Firmas todavía.</div>';
    return;
  }

  var maxCount = Math.max.apply(null, filas.map(function (f) { return f.count; }).concat([1]));
  cont.innerHTML = filas.map(function (f) {
    var pct = Math.max(Math.round((f.count / maxCount) * 100), f.count ? 6 : 0);
    return '' +
      '<div class="barra-fila">' +
        '<div class="barra-cab"><span class="barra-nombre"><i class="fa ' + f.etapa.icono + '" style="color:' + f.etapa.color + '"></i>' + f.etapa.nombre + '</span>' +
        '<span class="barra-valor">' + f.count + ' · ' + ccMoneda(f.monto) + '</span></div>' +
        '<div class="barra-pista"><div class="barra-fill" style="width:' + pct + '%;background:' + f.etapa.color + '">' + (f.count || "") + '</div></div>' +
      '</div>';
  }).join("");
}

var ccAlertasExpandido = false;

var CC_ALERTAS_PRIORIDAD = ["prospecto", "cita", "cliente"];

function ccRenderAlertas(datos) {
  var sla = DATA.slaProspectoDias;
  var vencidos = datos
    .filter(function (d) { return ccEtapaInfo(d.etapa).fase !== "firmas" && d.etapa !== "cancelado"; })
    .map(function (d) { return { d: d, dias: ccDiasDesde(d.ultimoSeguimiento), prioridad: CC_ALERTAS_PRIORIDAD.indexOf(d.etapa) !== -1 }; })
    .filter(function (x) { return x.dias > sla; })
    .sort(function (a, b) {
      if (a.prioridad !== b.prioridad) return a.prioridad ? -1 : 1;
      return b.dias - a.dias;
    });

  var cont = document.getElementById("alertas");
  if (!vencidos.length) {
    ccAlertasExpandido = false;
    cont.innerHTML = '<div class="vacio"><i class="fa fa-check-circle"></i><br>Sin pendientes, todo al día.</div>';
    return;
  }

  var mostrar = ccAlertasExpandido ? vencidos : vencidos.slice(0, 6);
  var filas = mostrar.map(function (x) {
    var info = ccEtapaInfo(x.d.etapa);
    var clase = x.dias > sla + 3 ? "bad" : "warn";
    return '' +
      '<div class="item clicable' + (x.prioridad ? ' item-prioridad' : '') + '" onclick="ccAbrirDetalle(' + x.d.id + ')">' +
        '<div><div class="item-nombre">' + x.d.nombre + '</div><div class="item-sub">' + info.nombre + ' · ' + x.d.vendedor + '</div></div>' +
        '<span class="item-chip ' + clase + '">' + x.dias + ' d</span>' +
      '</div>';
  }).join("");

  var pie = "";
  if (vencidos.length > 6) {
    pie = ccAlertasExpandido
      ? '<div class="ver-mas" onclick="ccToggleAlertas()">Ver menos</div>'
      : '<div class="ver-mas" onclick="ccToggleAlertas()">+' + (vencidos.length - 6) + ' más — ver todos</div>';
  }

  cont.innerHTML = '<div class="alertas-lista' + (ccAlertasExpandido ? ' expandida' : '') + '">' + filas + '</div>' + pie;
}

function ccToggleAlertas() {
  ccAlertasExpandido = !ccAlertasExpandido;
  ccRenderAlertas(ccDatosFiltrados());
}

function ccRenderProximas(datos) {
  var citas = datos.filter(function (d) { return d.etapa === "cita" && d.fechaCita; })
    .map(function (d) { return { d: d, fecha: d.fechaCita, tipo: "Cita", icono: "fa-calendar" }; });
  var firmas = datos.filter(function (d) { return d.etapa === "firma" && d.fechaFirma; })
    .map(function (d) { return { d: d, fecha: d.fechaFirma, tipo: "Firma", icono: "fa-pencil-square-o" }; });

  var todas = citas.concat(firmas).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  var cont = document.getElementById("proximas");
  if (!todas.length) {
    cont.innerHTML = '<div class="vacio"><i class="fa fa-calendar-o"></i><br>Nada programado.</div>';
    return;
  }

  var hoy = new Date().toISOString().substring(0, 10);
  cont.innerHTML = todas.slice(0, 6).map(function (x) {
    var diasFaltan = Math.round((new Date(x.fecha + "T00:00:00").getTime() - new Date(hoy + "T00:00:00").getTime()) / 86400000);
    var etiqueta = diasFaltan < 0 ? "Vencida" : diasFaltan === 0 ? "Hoy" : diasFaltan === 1 ? "Mañana" : "En " + diasFaltan + " días";
    var clase = diasFaltan < 0 ? "bad" : diasFaltan <= 1 ? "warn" : "ok";
    return '' +
      '<div class="item clicable" onclick="ccAbrirDetalle(' + x.d.id + ')">' +
        '<div><div class="item-nombre"><i class="fa ' + x.icono + '"></i> ' + x.d.nombre + '</div>' +
        '<div class="item-sub">' + x.tipo + ' · ' + x.fecha + '</div></div>' +
        '<span class="item-chip ' + clase + '">' + etiqueta + '</span>' +
      '</div>';
  }).join("");
}

function ccRenderRanking(datos) {
  var filas = ccValoresUnicos(function (d) { return d.vendedor; }).map(function (v) {
    var items = datos.filter(function (d) { return (d.vendedor || "").trim() === v; });
    var monto = items.reduce(function (s, d) { return s + d.monto; }, 0);
    var finalizados = items.filter(function (d) { return d.etapa === "finalizado"; }).length;

    var porPlaza = {};
    items.forEach(function (d) {
      var p = ccPlazaDe(d.fraccionamiento) || "Sin plaza";
      porPlaza[p] = (porPlaza[p] || 0) + 1;
    });
    var plazasTexto = Object.keys(porPlaza)
      .sort(function (a, b) { return porPlaza[b] - porPlaza[a]; })
      .map(function (p) { return p + ": " + porPlaza[p]; })
      .join(" · ");

    return { vendedor: v, monto: monto, finalizados: finalizados, color: ccVendedorColor(v), plazasTexto: plazasTexto };
  }).sort(function (a, b) { return b.monto - a.monto; });

  var maxMonto = Math.max.apply(null, filas.map(function (f) { return f.monto; }).concat([1]));

  document.getElementById("ranking").innerHTML = filas.map(function (f) {
    var pct = Math.max(Math.round((f.monto / maxMonto) * 100), f.monto ? 6 : 0);
    return '' +
      '<div class="barra-fila">' +
        '<div class="barra-cab"><span class="barra-nombre">' + f.vendedor + '</span>' +
        '<span class="barra-valor">' + ccMoneda(f.monto) + ' · ' + f.finalizados + ' fin.</span></div>' +
        '<div class="barra-pista"><div class="barra-fill" style="width:' + pct + '%;background:' + f.color + '"></div></div>' +
        (f.plazasTexto ? '<div class="ranking-plazas">' + f.plazasTexto + '</div>' : '') +
      '</div>';
  }).join("");
}

function ccLeyendaFases() {
  return '<div class="leyenda">' + DATA.fases.map(function (f) {
    return '<span class="leyenda-item"><span class="leyenda-punto" style="background:' + f.color + '"></span>' + f.nombre + '</span>';
  }).join("") + '</div>';
}

function ccFilaApilada(nombre, items) {
  var total = items.length;
  var monto = items.reduce(function (s, d) { return s + d.monto; }, 0);
  if (!total) {
    return '<div class="barra-fila"><div class="barra-cab"><span class="barra-nombre">' + nombre + '</span>' +
      '<span class="barra-valor sin-datos">Sin datos</span></div></div>';
  }
  var segmentos = ccDesglosePorFase(items).filter(function (f) { return f.count > 0; }).map(function (f) {
    var pct = (f.count / total) * 100;
    return '<div class="segmento" style="width:' + pct + '%;background:' + f.fase.color + '">' + (pct >= 14 ? f.count : "") + '</div>';
  }).join("");
  return '' +
    '<div class="barra-fila">' +
      '<div class="barra-cab"><span class="barra-nombre">' + nombre + '</span>' +
      '<span class="barra-valor">' + total + ' · ' + ccMoneda(monto) + '</span></div>' +
      '<div class="barra-pista pista-apilada">' + segmentos + '</div>' +
    '</div>';
}

function ccRenderPlaza(datos) {
  var plazas = Array.from(new Set(Object.values(DATA.plazaPorFraccionamiento)));
  document.getElementById("porPlaza").innerHTML = ccLeyendaFases() + plazas.map(function (p) {
    var items = datos.filter(function (d) { return ccPlazaDe(d.fraccionamiento) === p; });
    return ccFilaApilada(p, items);
  }).join("");
}

function ccRenderFraccionamiento(datos) {
  var fraccs = Object.keys(DATA.plazaPorFraccionamiento);
  document.getElementById("porFracc").innerHTML = ccLeyendaFases() + fraccs.map(function (f) {
    var items = datos.filter(function (d) { return d.fraccionamiento === f; });
    return ccFilaApilada(f, items);
  }).join("");
}

function ccRenderMotivos(datos) {
  var cancelados = datos.filter(function (d) { return d.etapa === "cancelado"; });
  var cont = document.getElementById("motivos");
  if (!cancelados.length) {
    cont.innerHTML = '<div class="vacio"><i class="fa fa-check-circle"></i><br>Sin cancelaciones.</div>';
    return;
  }

  var lista = cancelados.map(function (d) {
    return '<div class="item clicable" onclick="ccAbrirDetalle(' + d.id + ')">' +
      '<div><div class="item-nombre">' + d.nombre + '</div><div class="item-sub">' + d.vendedor + ' · toca para ver el motivo</div></div>' +
      '<span class="item-chip bad">' + ccMoneda(d.monto) + '</span></div>';
  }).join("");

  cont.innerHTML = lista;
}

function ccRenderTiempoEtapas(datos) {
  var filas = DATA.etapas.filter(function (e) { return e.clave !== "cancelado"; }).map(function (etapa) {
    var items = datos.filter(function (d) { return d.etapa === etapa.clave; });
    var promedio = items.length
      ? Math.round(items.reduce(function (s, d) { return s + ccDiasDesde(d.etapaDesde); }, 0) / items.length)
      : null;
    return { etapa: etapa, promedio: promedio, count: items.length };
  }).filter(function (f) { return f.count > 0; }).sort(function (a, b) { return b.promedio - a.promedio; }).slice(0, 6);

  var cont = document.getElementById("tiempoEtapas");
  if (!filas.length) { cont.innerHTML = '<div class="vacio">Sin datos</div>'; return; }

  var maxProm = Math.max.apply(null, filas.map(function (f) { return f.promedio; }).concat([1]));
  cont.innerHTML = filas.map(function (f) {
    var pct = Math.max(Math.round((f.promedio / maxProm) * 100), 6);
    return '<div class="barra-fila"><div class="barra-cab"><span class="barra-nombre"><i class="fa ' + f.etapa.icono + '" style="color:' + f.etapa.color + '"></i>' + f.etapa.nombre + '</span>' +
      '<span class="barra-valor">' + f.promedio + ' d prom. · ' + f.count + '</span></div>' +
      '<div class="barra-pista"><div class="barra-fill" style="width:' + pct + '%;background:' + f.etapa.color + '">' + f.promedio + 'd</div></div></div>';
  }).join("");
}

function ccAlertaSlaKanban(d) {
  var info = ccEtapaInfo(d.etapa);
  if (info.fase !== "preventa") return "";
  var sla = DATA.slaProspectoDias;
  var dias = ccDiasDesde(d.ultimoSeguimiento);
  if (dias <= sla) return "";
  var vencido = dias - sla;
  return '<div class="kb-alerta-sla"><i class="fa fa-exclamation-triangle"></i> Sin seguimiento — ' + vencido + ' día(s) vencido' + (vencido === 1 ? "" : "s") + '</div>';
}

function ccChipDias(dias) {
  if (dias <= 2) return "ok";
  if (dias <= 5) return "warn";
  return "bad";
}

function ccRenderTarjetaKanban(d) {
  var dias = ccDiasDesde(d.ultimoSeguimiento);
  return '' +
    '<div class="kb-tarjeta" style="--col-color:' + ccEtapaInfo(d.etapa).color + '" onclick="ccAbrirDetalle(' + d.id + ')">' +
      '<div class="kb-t-nombre">' + d.nombre + '</div>' +
      '<div class="kb-t-linea"><i class="fa fa-map-marker"></i> ' + d.lote + ', ' + d.fraccionamiento + '</div>' +
      ccAlertaSlaKanban(d) +
      '<div class="kb-t-pie">' +
        '<span class="kb-t-avatar" style="background:' + ccVendedorColor(d.vendedor) + '" title="' + d.vendedor + '">' + ccIniciales(d.vendedor) + '</span>' +
        '<span class="dias-chip ' + ccChipDias(dias) + '"><i class="fa fa-clock-o"></i> ' + dias + ' d</span>' +
        '<span class="kb-t-monto">' + ccMoneda(d.monto) + '</span>' +
      '</div>' +
    '</div>';
}

function ccRenderColumnaKanban(etapa, datos) {
  var claves = etapa.claves || [etapa.clave];
  var items = datos.filter(function (d) { return claves.indexOf(d.etapa) !== -1; });
  var monto = items.reduce(function (s, d) { return s + d.monto; }, 0);
  var cuerpo = items.length
    ? items.map(ccRenderTarjetaKanban).join("")
    : '<div class="kb-col-vacia"><i class="fa fa-inbox"></i><br>Sin tarjetas</div>';

  return '' +
    '<div class="kb-columna">' +
      '<div class="kb-col-cabecera" style="--col-color:' + etapa.color + '">' +
        '<div class="kb-col-titulo"><i class="fa ' + etapa.icono + '" style="color:' + etapa.color + '"></i> ' + etapa.nombre + '</div>' +
        '<div class="kb-col-meta"><span>' + items.length + ' tarjeta(s)</span><span>' + ccMoneda(monto) + '</span></div>' +
      '</div>' +
      '<div class="kb-col-cuerpo">' + cuerpo + '</div>' +
    '</div>';
}

function ccRenderKanban(datos) {
  var cont = document.getElementById("kanbanBoard");
  if (!cont) return;

  var fasesVisibles = DATA.fases.filter(function (f) { return f.clave !== "cancelado"; });

  cont.innerHTML = fasesVisibles.map(function (fase) {
    var etapasFase = DATA.etapas.filter(function (e) { return e.fase === fase.clave; });
    var itemsFase = datos.filter(function (d) {
      return etapasFase.some(function (e) { return e.clave === d.etapa; });
    });
    var montoFase = itemsFase.reduce(function (s, d) { return s + d.monto; }, 0);
    var colapsada = !!kbFaseColapsada[fase.clave];

    var etapasColumnas = etapasFase;
    if (fase.clave === "preventa") {
      etapasColumnas = etapasColumnas.concat(DATA.etapas.filter(function (e) { return e.clave === "cancelado"; }));
    } else if (fase.clave === "firmas") {
      var infoFinal = ccEtapaInfo("finalizado");
      etapasColumnas = etapasColumnas.filter(function (e) { return CC_FIRMAS_ETAPA_FINAL.indexOf(e.clave) === -1; })
        .concat([{ clave: "finalizado", claves: CC_FIRMAS_ETAPA_FINAL, nombre: "Finalizado", icono: infoFinal.icono, color: infoFinal.color }]);
    }
    var columnasHtml = etapasColumnas.map(function (etapa) { return ccRenderColumnaKanban(etapa, datos); }).join("");

    return '' +
      '<div class="kb-fase-grupo">' +
        '<div class="kb-fase-header' + (colapsada ? ' colapsada' : '') + '" style="--fase-color:' + fase.color + '" onclick="ccToggleFaseKanban(\'' + fase.clave + '\')">' +
          '<div class="kb-fase-titulo"><i class="fa ' + fase.icono + '"></i> ' + fase.nombre + '<i class="fa fa-chevron-down kb-fase-chevron"></i></div>' +
          '<div class="kb-fase-resumen">' + itemsFase.length + ' · ' + ccMoneda(montoFase) + '</div>' +
        '</div>' +
        '<div class="kb-columnas' + (colapsada ? ' colapsada' : '') + '">' + columnasHtml + '</div>' +
      '</div>';
  }).join("");
}

function ccToggleFaseKanban(clave) {
  kbFaseColapsada[clave] = !kbFaseColapsada[clave];
  ccRenderKanban(ccDatosFiltrados());
}

/* ----- Detalle de cliente (solo lectura) ----- */

function ccAbrirDetalle(id) {
  var d = DATA.clientes.find(function (x) { return x.id === id; });
  if (!d) return;

  document.getElementById("detTitulo").textContent = d.nombre;
  document.getElementById("detSub").textContent = d.lote + ", " + d.fraccionamiento + " · Vendedor: " + d.vendedor;
  document.getElementById("detGrid").innerHTML =
    '<div><div class="dl">Teléfono</div><div class="dv"><a class="tel-link" href="tel:' + d.telefono.replace(/\s/g, "") + '">' + d.telefono + '</a></div></div>' +
    '<div><div class="dl">Monto estimado</div><div class="dv">' + ccMoneda(d.monto) + '</div></div>' +
    '<div><div class="dl">Lote</div><div class="dv">' + d.lote + '</div></div>' +
    '<div><div class="dl">Fraccionamiento</div><div class="dv">' + d.fraccionamiento + '</div></div>' +
    '<div><div class="dl">Plaza</div><div class="dv">' + ccPlazaDe(d.fraccionamiento) + '</div></div>';

  var info = ccEtapaInfo(d.etapa);
  var badgeEl = document.getElementById("detEtapaBadge");
  badgeEl.innerHTML = '<span class="etapa-badge" style="background:' + info.color + '22;color:' + info.color + '"><i class="fa ' + info.icono + '"></i> ' + info.nombre + '</span>' +
    (d.etapa === "cancelado" ? '<div class="motivo-cancelacion"><i class="fa fa-info-circle"></i> ' + (d.motivoCancelacion || "Sin especificar") + '</div>' : "");

  var docsEl = document.getElementById("detDocs");
  if (d.etapa === "cliente" || d.etapa === "expediente_completo") {
    docsEl.innerHTML =
      '<span class="doc-pill ' + (d.docs.avaluo ? "ok" : "falta") + '"><i class="fa ' + (d.docs.avaluo ? "fa-check" : "fa-times") + '"></i> Avalúo</span>' +
      '<span class="doc-pill ' + (d.docs.expediente ? "ok" : "falta") + '"><i class="fa ' + (d.docs.expediente ? "fa-check" : "fa-times") + '"></i> Expediente</span>';
  } else {
    docsEl.innerHTML = "";
  }

  document.getElementById("detContador").textContent = d.seguimientos.length ? "(" + d.seguimientos.length + ")" : "";
  var hist = document.getElementById("detHistorial");
  if (!d.seguimientos.length) {
    hist.innerHTML = '<div class="vacio">Sin seguimientos todavía</div>';
  } else {
    var ordenados = d.seguimientos.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    hist.innerHTML = ordenados.map(function (s) {
      var canal = ccCanalInfo(s.canal);
      var img = s.imagen ? '<img class="seg-img" src="' + s.imagen + '" alt="Adjunto" onclick="this.classList.toggle(\'seg-img-grande\')">' : '';
      return '<div class="seguimiento-item"><div class="f"><span class="canal-badge"><i class="fa ' + canal.icono + '"></i> ' + s.canal + '</span>' + s.fecha + ' · ' + s.autor + '</div>' +
        '<div class="t">' + s.texto + '</div>' + img + '</div>';
    }).join("");
  }

  document.getElementById("overlayDetalle").classList.add("activo");
}

function ccCerrarDetalle() {
  document.getElementById("overlayDetalle").classList.remove("activo");
}

/* ----- Arranque ----- */

document.addEventListener("DOMContentLoaded", function () {
  if (localStorage.getItem(ONBOARDING_KEY)) {
    ccCargarDatos();
  } else {
    ccMostrarPantalla("bienvenida");
  }
});

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && DATA) ccCargarDatos();
});

/* ----- Atrapar el gesto de "atrás" del sistema -----
   Esta app es una sola pantalla, sin navegación real entre páginas. Si el
   sistema intenta "regresar" y no hay nada a dónde ir, en modo app instalada
   (standalone) muestra pantalla negra en vez de quedarse quieto. Empujamos
   un estado de historial y lo reponemos en cada popstate para que ese gesto
   nunca llegue a sacar a la app de la página — como bonus, si hay un modal
   abierto, lo cierra primero en vez de no hacer nada. */
history.pushState(null, "", location.href);
window.addEventListener("popstate", function () {
  var overlay = document.getElementById("overlayDetalle");
  if (overlay && overlay.classList.contains("activo")) {
    ccCerrarDetalle();
  }
  history.pushState(null, "", location.href);
});
