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
      DATA = json;
      ultimaActualizacion = new Date();
      ccPoblarFiltros();
      ccRender();
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
  return DATA.plazaPorFraccionamiento[fraccionamiento] || "";
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

function ccPoblarFiltros() {
  var selPlaza = document.getElementById("fPlaza");
  if (selPlaza.options.length <= 1) {
    var plazasUnicas = Array.from(new Set(Object.values(DATA.plazaPorFraccionamiento)));
    plazasUnicas.forEach(function (p) {
      var op = document.createElement("option");
      op.value = p; op.textContent = p;
      selPlaza.appendChild(op);
    });
  }

  var selVendedor = document.getElementById("fVendedor");
  if (selVendedor.options.length <= 1) {
    DATA.vendedores.forEach(function (v) {
      var op = document.createElement("option");
      op.value = v; op.textContent = v;
      selVendedor.appendChild(op);
    });
  }

  ccFiltrarFraccPorPlaza();
}

function ccFiltrarFraccPorPlaza() {
  var selPlaza = document.getElementById("fPlaza");
  var selFracc = document.getElementById("fFracc");
  var plaza = selPlaza.value;
  var valorActual = selFracc.value;

  var fraccionamientos = Object.keys(DATA.plazaPorFraccionamiento).filter(function (f) {
    return !plaza || DATA.plazaPorFraccionamiento[f] === plaza;
  });

  selFracc.innerHTML = '<option value="">Todos los fraccionamientos</option>';
  fraccionamientos.forEach(function (f) {
    var op = document.createElement("option");
    op.value = f; op.textContent = f;
    selFracc.appendChild(op);
  });
  if (fraccionamientos.indexOf(valorActual) !== -1) selFracc.value = valorActual;
}

function ccDatosFiltrados() {
  var plaza = document.getElementById("fPlaza").value;
  var fraccionamiento = document.getElementById("fFracc").value;
  var vendedor = document.getElementById("fVendedor").value;
  return DATA.clientes.filter(function (d) {
    if (vendedor && d.vendedor !== vendedor) return false;
    if (fraccionamiento && d.fraccionamiento !== fraccionamiento) return false;
    if (plaza && ccPlazaDe(d.fraccionamiento) !== plaza) return false;
    return true;
  });
}

/* ----- Render ----- */

function ccRender() {
  var datos = ccDatosFiltrados();
  ccRenderBanner(datos);
  ccRenderKpis(datos);
  ccRenderEmbudo(datos);
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
  var cerrados = datos.filter(function (d) { return d.etapa === "finalizado"; });
  var montoCerrado = cerrados.reduce(function (s, d) { return s + d.monto; }, 0);
  var tasa = total ? Math.round((cerrados.length / total) * 100) : 0;
  var vencidos = datos.filter(function (d) {
    return d.etapa !== "finalizado" && d.etapa !== "cancelado" && ccDiasDesde(d.ultimoSeguimiento) > sla;
  });

  document.getElementById("kpis").innerHTML =
    '<div class="kpi"><div class="n">' + total + '</div><div class="l">En pipeline</div><div class="s">' + ccMoneda(montoTotal) + '</div></div>' +
    '<div class="kpi verde"><div class="n">' + cerrados.length + '</div><div class="l">Finalizadas</div><div class="s">' + ccMoneda(montoCerrado) + '</div></div>' +
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
    var conv = "";
    if (i > 0) {
      var anterior = filas[i - 1];
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

function ccRenderAlertas(datos) {
  var sla = DATA.slaProspectoDias;
  var vencidos = datos
    .filter(function (d) { return d.etapa !== "finalizado" && d.etapa !== "cancelado"; })
    .map(function (d) { return { d: d, dias: ccDiasDesde(d.ultimoSeguimiento) }; })
    .filter(function (x) { return x.dias > sla; })
    .sort(function (a, b) { return b.dias - a.dias; });

  var cont = document.getElementById("alertas");
  if (!vencidos.length) {
    cont.innerHTML = '<div class="vacio"><i class="fa fa-check-circle"></i><br>Sin pendientes, todo al día.</div>';
    return;
  }

  var top = vencidos.slice(0, 6);
  cont.innerHTML = top.map(function (x) {
    var info = ccEtapaInfo(x.d.etapa);
    var clase = x.dias > sla + 3 ? "bad" : "warn";
    return '' +
      '<div class="item clicable" onclick="ccAbrirDetalle(' + x.d.id + ')">' +
        '<div><div class="item-nombre">' + x.d.nombre + '</div><div class="item-sub">' + info.nombre + ' · ' + x.d.vendedor + '</div></div>' +
        '<span class="item-chip ' + clase + '">' + x.dias + ' d</span>' +
      '</div>';
  }).join("") + (vencidos.length > 6 ? '<div class="item-sub" style="text-align:center;margin-top:6px;">+' + (vencidos.length - 6) + ' más</div>' : "");
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
  var filas = DATA.vendedores.map(function (v) {
    var items = datos.filter(function (d) { return d.vendedor === v; });
    var monto = items.reduce(function (s, d) { return s + d.monto; }, 0);
    var finalizados = items.filter(function (d) { return d.etapa === "finalizado"; }).length;
    return { vendedor: v, monto: monto, finalizados: finalizados, color: ccVendedorColor(v) };
  }).sort(function (a, b) { return b.monto - a.monto; });

  var maxMonto = Math.max.apply(null, filas.map(function (f) { return f.monto; }).concat([1]));

  document.getElementById("ranking").innerHTML = filas.map(function (f) {
    var pct = Math.max(Math.round((f.monto / maxMonto) * 100), f.monto ? 6 : 0);
    return '' +
      '<div class="barra-fila">' +
        '<div class="barra-cab"><span class="barra-nombre">' + f.vendedor + '</span>' +
        '<span class="barra-valor">' + ccMoneda(f.monto) + ' · ' + f.finalizados + ' fin.</span></div>' +
        '<div class="barra-pista"><div class="barra-fill" style="width:' + pct + '%;background:' + f.color + '"></div></div>' +
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

  var conteos = {};
  cancelados.forEach(function (d) {
    var motivo = d.motivoCancelacion || "Sin especificar";
    conteos[motivo] = (conteos[motivo] || 0) + 1;
  });
  var filas = Object.keys(conteos).map(function (m) { return { motivo: m, count: conteos[m] }; })
    .sort(function (a, b) { return b.count - a.count; });
  var maxCount = Math.max.apply(null, filas.map(function (f) { return f.count; }).concat([1]));

  var barras = filas.map(function (f) {
    var pct = Math.max(Math.round((f.count / maxCount) * 100), 6);
    return '<div class="barra-fila"><div class="barra-cab"><span class="barra-nombre">' + f.motivo + '</span>' +
      '<span class="barra-valor">' + f.count + ' caso(s)</span></div>' +
      '<div class="barra-pista"><div class="barra-fill" style="width:' + pct + '%;background:#dd4b39">' + f.count + '</div></div></div>';
  }).join("");

  var lista = cancelados.map(function (d) {
    return '<div class="item clicable" onclick="ccAbrirDetalle(' + d.id + ')">' +
      '<div><div class="item-nombre">' + d.nombre + '</div><div class="item-sub">' + (d.motivoCancelacion || "Sin especificar") + ' · ' + d.vendedor + '</div></div>' +
      '<span class="item-chip bad">' + ccMoneda(d.monto) + '</span></div>';
  }).join("");

  cont.innerHTML = barras + '<div style="font-weight:800;color:var(--tinta-fuerte);margin:14px 0 4px;font-size:0.9em;">Clientes cancelados</div>' + lista;
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

function ccRenderTarjetaKanban(d) {
  return '' +
    '<div class="kb-tarjeta" style="--col-color:' + ccEtapaInfo(d.etapa).color + '" onclick="ccAbrirDetalle(' + d.id + ')">' +
      '<div class="kb-t-nombre">' + d.nombre + '</div>' +
      '<div class="kb-t-linea"><i class="fa fa-map-marker"></i> ' + d.lote + ', ' + d.fraccionamiento + '</div>' +
      '<div class="kb-t-pie">' +
        '<span class="kb-t-avatar" style="background:' + ccVendedorColor(d.vendedor) + '" title="' + d.vendedor + '">' + ccIniciales(d.vendedor) + '</span>' +
        '<span class="kb-t-monto">' + ccMoneda(d.monto) + '</span>' +
      '</div>' +
    '</div>';
}

function ccRenderColumnaKanban(etapa, datos) {
  var items = datos.filter(function (d) { return d.etapa === etapa.clave; });
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
  document.getElementById("detEtapaBadge").innerHTML =
    '<span class="etapa-badge" style="background:' + info.color + '22;color:' + info.color + '"><i class="fa ' + info.icono + '"></i> ' + info.nombre + '</span>';

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
      return '<div class="seguimiento-item"><div class="f"><span class="canal-badge">' + s.canal + '</span>' + s.fecha + ' · ' + s.autor + '</div>' +
        '<div class="t">' + s.texto + '</div></div>';
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
