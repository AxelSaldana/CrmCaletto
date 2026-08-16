/* Panorama Ejecutivo - app web instalable, solo lectura.
   Consume /api/proxy, una función serverless que vive en este mismo
   proyecto de Vercel. Ese proxy es el que sabe la URL real del CRM
   interno y el token de acceso (guardados como variables de entorno
   de Vercel, nunca en este código) — así el navegador nunca ve el
   token. Abre directo, sin login ni configuración. */

var API_URL = "/api/proxy";

var DATA = null;
var ultimaActualizacion = null;
// Preventa abierta por default (es la que se revisa mas seguido); Venta y
// Firmas colapsadas para no pintar cientos de tarjetas de golpe si hay
// muchos registros reales -- se expanden con un toque si hacen falta.
var kbFaseColapsada = { venta: true, firmas: true };
var ONBOARDING_KEY = "ccVistoBienvenida";
var ccTabActiva = "resumen";
var ccPeriodoInicializado = false;

/* ----- Tabs (Resumen / Kanban) ----- */

function ccCambiarTab(tab) {
  ccTabActiva = tab;
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.classList.toggle("activo", btn.getAttribute("data-tab") === tab);
  });
  document.getElementById("vistaResumen").style.display = (tab === "resumen") ? "" : "none";
  document.getElementById("vistaKanban").style.display = (tab === "kanban") ? "" : "none";
  // El Kanban no se repinta en cada ccRender() mientras esta oculto (ver mas
  // abajo), asi que al entrar a su pestaña lo refresca con el filtro actual.
  if (tab === "kanban" && DATA) ccRenderKanban(ccDatosFiltrados());
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

var ccCargando = false;
var ccBuscarTimeout = null;

function ccBuscarDebounced() {
  // Evita reconstruir todas las listas en cada tecla mientras escribes --
  // solo re-renderiza 200ms despues de la ultima tecla.
  clearTimeout(ccBuscarTimeout);
  ccBuscarTimeout = setTimeout(ccRender, 200);
}

// Preventa (Primer contacto, Cita realizada, Negociación) sigue siendo
// datos de ejemplo hardcodeados en el backend, no conectados a la BD real
// -- se quitan por completo aqui para que la app nunca mezcle numeros
// falsos con los reales.
function ccQuitarDatosDeEjemplo() {
  if (!DATA) return;
  DATA.clientes = (DATA.clientes || []).filter(function (d) {
    var info = DATA.etapas.filter(function (e) { return e.clave === d.etapa; })[0];
    return !info || info.fase !== "preventa";
  });
  DATA.fases = (DATA.fases || []).filter(function (f) { return f.clave !== "preventa"; });
  DATA.etapas = (DATA.etapas || []).filter(function (e) { return e.fase !== "preventa"; });
}

function ccCargarDatos() {
  // Evita que toques repetidos del boton de refrescar (o un cambio de
  // pestaña que llegue mientras ya hay una peticion en curso) disparen
  // varias peticiones encimadas hacia el CRM interno.
  if (ccCargando) return;
  ccCargando = true;

  var btn = document.getElementById("btnRefrescar");
  if (btn) btn.classList.add("girando");
  if (!DATA) ccMostrarPantalla("cargando");

  // Si el tunel/servidor real no responde, que la app falle rapido en vez de
  // quedarse en "Cargando..." para siempre. Dos capas: el AbortController
  // cancela el fetch a los 15s (limpio, libera la conexion), y ademas un
  // timeout "duro" independiente a los 20s que fuerza el error sin importar
  // si la cancelacion del fetch realmente llega a rechazar la promesa en
  // ese entorno/red -- por si acaso.
  var controlador = new AbortController();
  var timeoutId = setTimeout(function () { controlador.abort(); }, 15000);
  var timeoutDuro = new Promise(function (_, reject) {
    setTimeout(function () { reject({ tipo: "timeout" }); }, 20000);
  });

  Promise.race([fetch(API_URL, { signal: controlador.signal }), timeoutDuro])
    .then(function (res) {
      clearTimeout(timeoutId);
      if (!res.ok) { throw { tipo: "http", status: res.status }; }
      return res.json();
    })
    .then(function (json) {
      DATA = json;
      ccQuitarDatosDeEjemplo();
      ultimaActualizacion = new Date();
      ccAsignarColoresVendedores();
      ccPoblarFiltros();
      ccPoblarPeriodosRapidos();
      if (!ccPeriodoInicializado) {
        ccPeriodoInicializado = true;
        ccAplicarPeriodo("mes");
      } else {
        ccActualizarPeriodoUI();
        ccRender();
      }
      ccMostrarPantalla("app");
    })
    .catch(function (err) {
      clearTimeout(timeoutId);
      var msg = "No se pudo conectar. Revisa tu internet e intenta de nuevo.";
      if (err && err.tipo === "http") msg = "El servidor respondió con un error (" + err.status + ").";
      else if (err && (err.name === "AbortError" || err.tipo === "timeout")) msg = "El servidor tardó demasiado en responder. Intenta de nuevo.";
      document.getElementById("errorTexto").textContent = msg;
      ccMostrarPantalla("error");
    })
    .finally(function () {
      ccCargando = false;
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

var CC_VENDEDOR_COLORES_PALETA = ["#3c8dbc", "#f39c12", "#00a65a", "#dd4b39", "#605ca8", "#00c0ef", "#f56954", "#008d4c"];
var ccVendedorColoresExtra = {};

// vendedorColores del API solo trae unos cuantos nombres fijos; cualquier
// vendedor real que no este ahi le toca color dinamico de una paleta, para
// que no se vean todos igual de azules en el Ranking/Kanban.
function ccAsignarColoresVendedores() {
  ccVendedorColoresExtra = {};
  var conocidos = Object.keys(DATA.vendedorColores || {});
  var coloresUsados = conocidos.map(function (v) { return DATA.vendedorColores[v]; });
  var faltantes = ccValoresUnicos(function (d) { return d.vendedor; }).filter(function (v) {
    return conocidos.indexOf(v) === -1;
  });

  var idx = 0;
  faltantes.forEach(function (v) {
    // brinca cualquier color de la paleta que ya este en uso por un vendedor
    // conocido, para que nunca se repita el color con alguien mas -- pero
    // como maximo el tamaño de la paleta: si hay mas vendedores que colores
    // (muy real con datos reales), ya no hay de otra mas que repetir color,
    // NUNCA quedarse en un while sin salida.
    var intentos = 0;
    while (coloresUsados.indexOf(CC_VENDEDOR_COLORES_PALETA[idx % CC_VENDEDOR_COLORES_PALETA.length]) !== -1 && intentos < CC_VENDEDOR_COLORES_PALETA.length) {
      idx++;
      intentos++;
    }
    var color = CC_VENDEDOR_COLORES_PALETA[idx % CC_VENDEDOR_COLORES_PALETA.length];
    ccVendedorColoresExtra[v] = color;
    coloresUsados.push(color);
    idx++;
  });
}

function ccVendedorColor(nombre) {
  if (DATA.vendedorColores && DATA.vendedorColores[nombre]) return DATA.vendedorColores[nombre];
  return ccVendedorColoresExtra[nombre] || "#3c8dbc";
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

/* ----- Periodos rapidos ----- */

var CC_PERIODOS = [
  { clave: "hoy", nombre: "Hoy" },
  { clave: "semana", nombre: "Esta semana" },
  { clave: "mes", nombre: "Este mes" },
  { clave: "mesPasado", nombre: "Mes pasado" },
  { clave: "anio", nombre: "Este año" },
  { clave: "todo", nombre: "Todo" }
];
var CC_PERIODO_ACTIVO = "mes";

function ccRangoPeriodo(clave) {
  var hoy = new Date();
  function iso(d) { return d.toISOString().substring(0, 10); }
  function inicioSemana(d) {
    var dia = d.getDay(); // 0 = domingo
    var diff = dia === 0 ? 6 : dia - 1; // dias desde el lunes
    var l = new Date(d);
    l.setDate(d.getDate() - diff);
    return l;
  }
  if (clave === "hoy") return { desde: iso(hoy), hasta: iso(hoy) };
  if (clave === "semana") return { desde: iso(inicioSemana(hoy)), hasta: iso(hoy) };
  if (clave === "mes") return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)) };
  if (clave === "mesPasado") return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)), hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)) };
  if (clave === "anio") return { desde: iso(new Date(hoy.getFullYear(), 0, 1)), hasta: iso(new Date(hoy.getFullYear(), 11, 31)) };
  return { desde: "", hasta: "" };
}

function ccPoblarPeriodosRapidos() {
  var cont = document.getElementById("periodosRapidos");
  if (!cont || cont.children.length) return;
  cont.innerHTML = CC_PERIODOS.map(function (p) {
    return '<button type="button" class="periodo-chip" data-periodo="' + p.clave + '" onclick="ccAplicarPeriodo(\'' + p.clave + '\')">' + p.nombre + '</button>';
  }).join("");
}

function ccAplicarPeriodo(clave) {
  CC_PERIODO_ACTIVO = clave;
  var rango = ccRangoPeriodo(clave);
  document.getElementById("fFechaDesde").value = rango.desde;
  document.getElementById("fFechaHasta").value = rango.hasta;
  ccActualizarPeriodoUI();
  ccRender();
}

function ccFechaEditadaManualmente() {
  // si el usuario toca las fechas a mano, ya no corresponde a ningun chip
  CC_PERIODO_ACTIVO = "personalizado";
  ccActualizarPeriodoUI();
  ccRender();
}

function ccActualizarPeriodoUI() {
  var etiqueta = document.getElementById("filtrosPeriodoActual");
  if (!etiqueta) return;
  var info = CC_PERIODOS.filter(function (p) { return p.clave === CC_PERIODO_ACTIVO; })[0];
  etiqueta.textContent = info ? info.nombre : "Personalizado";
  document.querySelectorAll(".periodo-chip").forEach(function (btn) {
    btn.classList.toggle("activo", btn.getAttribute("data-periodo") === CC_PERIODO_ACTIVO);
  });
}

function ccLimpiarFechas() {
  ccAplicarPeriodo("todo");
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

function ccAlternarFiltros() {
  var panel = document.getElementById("filtrosPanel");
  var chevron = document.getElementById("filtrosChevron");
  var abierto = panel.style.display !== "none";
  panel.style.display = abierto ? "none" : "block";
  chevron.classList.toggle("rotado", !abierto);
}

function ccActualizarFiltrosBadge() {
  // El periodo (fechas) ya tiene su propia etiqueta junto al boton de
  // Filtros, asi que aqui solo se cuentan los demas filtros para no duplicar
  // la señal.
  var activos = 0;
  if (document.getElementById("fBuscar").value.trim()) activos++;
  if (document.getElementById("fPlaza").value) activos++;
  if (document.getElementById("fFracc").value) activos++;
  if (document.getElementById("fVendedor").value) activos++;

  var badge = document.getElementById("filtrosBadge");
  badge.textContent = activos;
  badge.style.display = activos ? "inline-flex" : "none";
}

var CC_NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// La meta y el comparativo siempre son del mes de calendario actual contra
// el anterior -- a proposito NO usan el filtro de periodo de arriba, para
// que "meta de agosto" no cambie de significado segun que chip este activo.
function ccRenderMetaMes() {
  var card = document.getElementById("cardMeta");
  var cont = document.getElementById("metaMes");
  if (!card || !cont || !DATA) return;

  function iso(d) { return d.toISOString().substring(0, 10); }
  var hoy = new Date();
  var inicioMes = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  var inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  var finMesAnterior = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0));
  var nombreMesAnterior = CC_NOMBRES_MES[inicioMesAnterior.getMonth()] + " " + inicioMesAnterior.getFullYear();

  var cerrados = DATA.clientes.filter(function (d) { return CC_FIRMAS_ETAPA_FINAL.indexOf(d.etapa) !== -1; });
  var montoEsteMes = cerrados.filter(function (d) { return d.etapaDesde >= inicioMes; })
    .reduce(function (s, d) { return s + d.monto; }, 0);
  var montoMesAnterior = cerrados.filter(function (d) { return d.etapaDesde >= iso(inicioMesAnterior) && d.etapaDesde <= finMesAnterior; })
    .reduce(function (s, d) { return s + d.monto; }, 0);

  var metaHtml;
  if (DATA.metaMensual && DATA.metaMensual > 0) {
    var pct = Math.round((montoEsteMes / DATA.metaMensual) * 100);
    var pctBarra = Math.min(pct, 100);
    metaHtml =
      '<div class="meta-cifras"><span class="meta-monto">' + ccMoneda(montoEsteMes) + '</span><span class="meta-de"> de ' + ccMoneda(DATA.metaMensual) + '</span></div>' +
      '<div class="barra-pista meta-barra"><div class="barra-fill" style="width:' + pctBarra + '%;background:' + (pct >= 100 ? "#00a65a" : "#2a78d6") + '">' + pct + '%</div></div>';
  } else {
    metaHtml = '<div class="meta-cifras"><span class="meta-monto">' + ccMoneda(montoEsteMes) + '</span><span class="meta-de"> cerrado este mes</span></div>';
  }

  var cambioHtml = "";
  if (montoMesAnterior > 0) {
    var pctCambio = Math.round(((montoEsteMes - montoMesAnterior) / montoMesAnterior) * 100);
    var subeBaja = pctCambio >= 0 ? "sube" : "baja";
    var icono = pctCambio >= 0 ? "fa-caret-up" : "fa-caret-down";
    cambioHtml = '<span class="meta-comparativo ' + subeBaja + '"><i class="fa ' + icono + '"></i> ' + Math.abs(pctCambio) + '% vs ' + nombreMesAnterior + '</span>';
  } else if (montoEsteMes > 0) {
    cambioHtml = '<span class="meta-comparativo sube"><i class="fa fa-caret-up"></i> vs ' + nombreMesAnterior + ' (sin cierres)</span>';
  }

  card.style.display = "";
  cont.innerHTML = metaHtml + cambioHtml;
}

function ccRender() {
  ccActualizarFiltrosBadge();
  ccRenderMetaMes();
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
  // El Kanban puede tener cientos de tarjetas con datos reales; si no se
  // esta viendo (pestaña Resumen activa), no vale la pena reconstruir todo
  // ese HTML en cada tecla de busqueda o cambio de filtro. Se repinta solo
  // al entrar a su pestaña (ver ccCambiarTab).
  if (ccTabActiva === "kanban") ccRenderKanban(datos);
}

var CC_ETAPAS_CITA = ["cita", "cita_realizada"];

function ccRenderBanner(datos) {
  var sla = DATA.slaProspectoDias;
  var vencidos = datos.filter(function (d) {
    return CC_FIRMAS_ETAPA_FINAL.indexOf(d.etapa) === -1 && d.etapa !== "cancelado" && ccDiasDesde(d.ultimoSeguimiento) > sla;
  }).length;

  var hoy = new Date().toISOString().substring(0, 10);
  var fechasVencidas = datos.filter(function (d) {
    return (CC_ETAPAS_CITA.indexOf(d.etapa) !== -1 && d.fechaCita && d.fechaCita < hoy) ||
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

function ccDesglosePorFase(items, excluirFinalizadoDeFirmas) {
  return DATA.fases.map(function (fase) {
    var etapasFase = DATA.etapas.filter(function (e) { return e.fase === fase.clave; });
    if (excluirFinalizadoDeFirmas && fase.clave === "firmas") {
      etapasFase = etapasFase.filter(function (e) { return CC_FIRMAS_ETAPA_FINAL.indexOf(e.clave) === -1; });
    }
    var itemsFase = items.filter(function (d) {
      return etapasFase.some(function (e) { return e.clave === d.etapa; });
    });
    var monto = itemsFase.reduce(function (s, d) { return s + d.monto; }, 0);
    return { fase: fase, count: itemsFase.length, monto: monto };
  });
}

function ccRenderEmbudo(datos) {
  var filas = ccDesglosePorFase(datos, true);

  var infoFinal = ccEtapaInfo("finalizado");
  var itemsFinal = datos.filter(function (d) { return CC_FIRMAS_ETAPA_FINAL.indexOf(d.etapa) !== -1; });
  var filaFinalizado = {
    fase: { clave: "finalizado", nombre: "Finalizado", icono: infoFinal.icono, color: infoFinal.color },
    count: itemsFinal.length,
    monto: itemsFinal.reduce(function (s, d) { return s + d.monto; }, 0)
  };
  var idxFirmas = -1;
  for (var i = 0; i < filas.length; i++) { if (filas[i].fase.clave === "firmas") { idxFirmas = i; break; } }
  filas.splice(idxFirmas + 1, 0, filaFinalizado);

  var maxCount = Math.max.apply(null, filas.map(function (f) { return f.count; }).concat([1]));

  document.getElementById("embudo").innerHTML = filas.map(function (f, i) {
    var pct = Math.max(Math.round((f.count / maxCount) * 100), f.count ? 6 : 0);
    var conv = "";
    var anterior = filas[i - 1];
    if (anterior && f.fase.clave !== "cancelado") {
      var pctConv = anterior.count ? Math.round((f.count / anterior.count) * 100) : 0;
      conv = '<div class="conversion"><i class="fa fa-long-arrow-up"></i> ' + pctConv + '% vs ' + anterior.fase.nombre + '</div>';
    }
    return conv +
      '<div class="barra-fila">' +
        '<div class="barra-cab"><span class="barra-nombre"><i class="fa ' + f.fase.icono + '" style="color:' + f.fase.color + '"></i>' + f.fase.nombre + '</span>' +
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

function ccRenderAlertas(datos) {
  var sla = DATA.slaProspectoDias;
  var vencidos = datos
    .filter(function (d) { return ccEtapaInfo(d.etapa).fase !== "firmas" && d.etapa !== "cancelado"; })
    .map(function (d) { return { d: d, dias: ccDiasDesde(d.ultimoSeguimiento) }; })
    .filter(function (x) { return x.dias > sla; })
    .sort(function (a, b) { return b.dias - a.dias; });

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
      '<div class="item clicable" onclick="ccAbrirDetalle(' + x.d.id + ')">' +
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
  var hoy = new Date().toISOString().substring(0, 10);

  var citas = datos.filter(function (d) { return CC_ETAPAS_CITA.indexOf(d.etapa) !== -1 && d.fechaCita; })
    .map(function (d) { return { d: d, fecha: d.fechaCita, tipo: "Cita", icono: "fa-calendar" }; });
  // fecha_firma a veces se captura de antemano (agendada) y a veces de forma
  // retroactiva (ya que se firmó) -- para cuando eso pasa, el cliente ya
  // avanzo a Escrituras/Finalizado y ya no esta en la etapa "Firma". Por eso
  // aqui no se exige una etapa exacta: cualquier fecha de firma que sea hoy
  // o futura cuenta como "proxima", sin importar donde este parado ahora
  // dentro de Firmas.
  var firmas = datos.filter(function (d) {
    return d.fechaFirma && d.fechaFirma >= hoy && ccEtapaInfo(d.etapa).fase === "firmas";
  }).map(function (d) { return { d: d, fecha: d.fechaFirma, tipo: "Firma", icono: "fa-pencil-square-o" }; });

  var todas = citas.concat(firmas).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  var cont = document.getElementById("proximas");
  if (!todas.length) {
    cont.innerHTML = '<div class="vacio"><i class="fa fa-calendar-o"></i><br>Nada programado.</div>';
    return;
  }

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
  var datosActivos = datos.filter(function (d) { return d.etapa !== "cancelado"; });

  var vendedoresVisibles = [];
  var vistosVendedor = {};
  datosActivos.forEach(function (d) {
    var v = (d.vendedor || "").trim();
    if (v && !vistosVendedor[v]) { vistosVendedor[v] = true; vendedoresVisibles.push(v); }
  });
  vendedoresVisibles.sort();

  var filas = vendedoresVisibles.map(function (v) {
    var items = datosActivos.filter(function (d) { return (d.vendedor || "").trim() === v; });
    var monto = items.reduce(function (s, d) { return s + d.monto; }, 0);
    var finalizados = items.filter(function (d) { return CC_FIRMAS_ETAPA_FINAL.indexOf(d.etapa) !== -1; }).length;

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
  var plazas = Array.from(new Set(datos.map(function (d) { return ccPlazaDe(d.fraccionamiento); }).filter(Boolean))).sort();
  document.getElementById("porPlaza").innerHTML = ccLeyendaFases() + plazas.map(function (p) {
    var items = datos.filter(function (d) { return ccPlazaDe(d.fraccionamiento) === p; });
    return ccFilaApilada(p, items);
  }).join("");
}

function ccRenderFraccionamiento(datos) {
  var fraccs = Array.from(new Set(datos.map(function (d) { return (d.fraccionamiento || "").trim(); }).filter(Boolean))).sort();
  document.getElementById("porFracc").innerHTML = ccLeyendaFases() + fraccs.map(function (f) {
    var items = datos.filter(function (d) { return (d.fraccionamiento || "").trim() === f; });
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
  var filas = DATA.etapas.filter(function (e) { return e.clave !== "cancelado" && e.clave !== "finalizado"; }).map(function (etapa) {
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

var CC_REFRESCO_MINIMO_MS = 60000;

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible" || !DATA) return;
  // Evita golpear el CRM interno cada vez que se cambia de app/pestaña y se
  // regresa -- solo refresca solo si ya paso al menos un minuto desde la
  // ultima vez (el boton de refrescar manual sigue funcionando siempre).
  if (ultimaActualizacion && (new Date() - ultimaActualizacion) < CC_REFRESCO_MINIMO_MS) return;
  ccCargarDatos();
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
