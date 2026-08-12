/*
 * Función serverless de Vercel: sirve el pipeline de ventas de ejemplo.
 * Vive junto a la app (mismo proyecto de Vercel), así la app no depende
 * de ningún servidor externo para funcionar.
 *
 * Datos de prueba — mismos que vistas/js/crmventas.js y api/crmejecutivo.php
 * en el CRM interno. Cuando haya datos reales, aquí es donde se reemplaza
 * el arreglo `clientes` por una consulta a la base de datos real, y ahí sí
 * hay que agregar autenticación de verdad (hoy no tiene, porque son datos
 * de prueba y no protege nada real).
 */

function fechaHace(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().substring(0, 10);
}

function fechaEn(dias) {
  var d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().substring(0, 10);
}

var fases = [
  { clave: "preventa", nombre: "Preventa", color: "#2a78d6", icono: "fa-bullseye" },
  { clave: "venta", nombre: "Venta", color: "#00a65a", icono: "fa-briefcase" },
  { clave: "firmas", nombre: "Firmas", color: "#4a3aa7", icono: "fa-gavel" },
  { clave: "cancelado", nombre: "Cancelado / Perdido", color: "#dd4b39", icono: "fa-times-circle" },
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
  { clave: "cancelado", nombre: "Cancelado / Perdido", color: "#dd4b39", icono: "fa-times-circle", fase: "cancelado" },
];

var vendedores = ["Ana López", "Carlos Ruiz", "Diana Torres", "Marco Peña"];

var vendedorColores = {
  "Ana López": "#3c8dbc",
  "Carlos Ruiz": "#f39c12",
  "Diana Torres": "#00a65a",
  "Marco Peña": "#dd4b39",
};

var plazaPorFraccionamiento = {
  "Villas del Sol": "Victoria",
  "Los Encinos": "Victoria",
  "Real del Valle": "San Luis Potosí",
};

var slaProspectoDias = 2;

function construirClientes() {
  var clientes = [
    { id: 1, etapa: "primer_contacto", docs: { avaluo: false, expediente: false }, nombre: "Roberto Salinas", telefono: "834 123 4501", lote: "Lote 12", fraccionamiento: "Villas del Sol", vendedor: "Ana López", monto: 480000, ultimoSeguimiento: fechaHace(0), seguimientos: [{ fecha: fechaHace(0), autor: "Ana López", canal: "Llamada", texto: "Contacto inicial por teléfono, interesado en modelo de 2 recámaras." }] },
    { id: 2, etapa: "primer_contacto", docs: { avaluo: false, expediente: false }, nombre: "Laura Domínguez", telefono: "834 123 4502", lote: "Lote 3", fraccionamiento: "Real del Valle", vendedor: "Carlos Ruiz", monto: 520000, ultimoSeguimiento: fechaHace(4), seguimientos: [{ fecha: fechaHace(4), autor: "Carlos Ruiz", canal: "WhatsApp", texto: "Llamada inicial, pidió información por WhatsApp." }] },
    { id: 3, etapa: "segundo_contacto", docs: { avaluo: false, expediente: false }, nombre: "Jorge Herrera", telefono: "834 123 4503", lote: "Lote 8", fraccionamiento: "Los Encinos", vendedor: "Diana Torres", monto: 610000, ultimoSeguimiento: fechaHace(1), seguimientos: [
      { fecha: fechaHace(6), autor: "Diana Torres", canal: "Llamada", texto: "Primer contacto, mostró interés en crédito Infonavit." },
      { fecha: fechaHace(1), autor: "Diana Torres", canal: "Llamada", texto: "Segunda llamada, confirmó ingresos y envió documentos." },
    ] },
    { id: 4, etapa: "segundo_contacto", docs: { avaluo: false, expediente: false }, nombre: "Patricia Nuñez", telefono: "834 123 4504", lote: "Lote 21", fraccionamiento: "Villas del Sol", vendedor: "Marco Peña", monto: 495000, ultimoSeguimiento: fechaHace(7), seguimientos: [{ fecha: fechaHace(7), autor: "Marco Peña", canal: "Correo", texto: "Sigue interesada, pidió tiempo para revisar presupuesto familiar." }] },
    { id: 5, etapa: "cita", docs: { avaluo: false, expediente: false }, nombre: "Fernando Cantú", telefono: "834 123 4505", lote: "Lote 15", fraccionamiento: "Real del Valle", vendedor: "Ana López", monto: 545000, fechaCita: fechaEn(2), ultimoSeguimiento: fechaHace(2), seguimientos: [{ fecha: fechaHace(2), autor: "Ana López", canal: "Llamada", texto: "Cita agendada para el sábado a las 11am en sala de ventas." }] },
    { id: 6, etapa: "cita", docs: { avaluo: false, expediente: false }, nombre: "Gabriela Ríos", telefono: "834 123 4506", lote: "Lote 6", fraccionamiento: "Los Encinos", vendedor: "Carlos Ruiz", monto: 590000, fechaCita: fechaEn(1), ultimoSeguimiento: fechaHace(0), seguimientos: [{ fecha: fechaHace(0), autor: "Carlos Ruiz", canal: "WhatsApp", texto: "Confirmó asistencia a recorrido de la casa muestra." }] },
    { id: 7, etapa: "prospecto", docs: { avaluo: false, expediente: false }, nombre: "Miguel Ángel Soto", telefono: "834 123 4507", lote: "Lote 9", fraccionamiento: "Villas del Sol", vendedor: "Diana Torres", monto: 470000, ultimoSeguimiento: fechaHace(3), seguimientos: [
      { fecha: fechaHace(9), autor: "Diana Torres", canal: "Visita", texto: "Visitó la casa muestra, le gustó la ubicación." },
      { fecha: fechaHace(3), autor: "Diana Torres", canal: "Llamada", texto: "Está comparando con otro fraccionamiento, dar seguimiento." },
    ] },
    { id: 8, etapa: "prospecto", docs: { avaluo: false, expediente: false }, nombre: "Sandra Villareal", telefono: "834 123 4508", lote: "Lote 30", fraccionamiento: "Real del Valle", vendedor: "Marco Peña", monto: 615000, ultimoSeguimiento: fechaHace(6), seguimientos: [{ fecha: fechaHace(6), autor: "Marco Peña", canal: "Llamada", texto: "Ya calificó para crédito, esperando ver más opciones de lote." }] },
    { id: 9, etapa: "cliente", docs: { avaluo: true, expediente: false }, nombre: "Ricardo Elizondo", telefono: "834 123 4509", lote: "Lote 18", fraccionamiento: "Los Encinos", vendedor: "Ana López", monto: 530000, ultimoSeguimiento: fechaHace(1), seguimientos: [{ fecha: fechaHace(1), autor: "Ana López", canal: "Correo", texto: "Ya es cliente, se solicitó el avalúo del lote." }] },
    { id: 10, etapa: "cliente", docs: { avaluo: false, expediente: false }, nombre: "Alejandra Morales", telefono: "834 123 4510", lote: "Lote 4", fraccionamiento: "Villas del Sol", vendedor: "Carlos Ruiz", monto: 505000, ultimoSeguimiento: fechaHace(5), seguimientos: [{ fecha: fechaHace(5), autor: "Carlos Ruiz", canal: "Llamada", texto: "Se convirtió en cliente, pendiente de subir documentos." }] },
    { id: 11, etapa: "cliente", docs: { avaluo: true, expediente: true }, nombre: "Hugo Alanís", telefono: "834 123 4511", lote: "Lote 27", fraccionamiento: "Real del Valle", vendedor: "Diana Torres", monto: 640000, ultimoSeguimiento: fechaHace(2), seguimientos: [
      { fecha: fechaHace(11), autor: "Diana Torres", canal: "Visita", texto: "Cerró como cliente, se le pidió avalúo y expediente." },
      { fecha: fechaHace(2), autor: "Diana Torres", canal: "Correo", texto: "Ya subió avalúo y expediente completos, listo para pasar a expediente completo." },
    ] },
    { id: 12, etapa: "cliente", docs: { avaluo: false, expediente: true }, nombre: "Karla Mendoza", telefono: "834 123 4512", lote: "Lote 11", fraccionamiento: "Los Encinos", vendedor: "Marco Peña", monto: 575000, ultimoSeguimiento: fechaHace(8), seguimientos: [{ fecha: fechaHace(8), autor: "Marco Peña", canal: "Correo", texto: "Subió el expediente, falta el avalúo." }] },
    { id: 13, etapa: "expediente_completo", docs: { avaluo: true, expediente: true }, nombre: "Eduardo Guzmán", telefono: "834 123 4513", lote: "Lote 2", fraccionamiento: "Villas del Sol", vendedor: "Ana López", monto: 500000, ultimoSeguimiento: fechaHace(1), seguimientos: [{ fecha: fechaHace(1), autor: "Ana López", canal: "Visita", texto: "Expediente completo, listo para pasar a firmas." }] },
    { id: 14, etapa: "expediente_completo", docs: { avaluo: true, expediente: true }, nombre: "Verónica Castillo", telefono: "834 123 4514", lote: "Lote 33", fraccionamiento: "Real del Valle", vendedor: "Carlos Ruiz", monto: 620000, ultimoSeguimiento: fechaHace(0), seguimientos: [{ fecha: fechaHace(0), autor: "Carlos Ruiz", canal: "Visita", texto: "Avalúo y expediente completos, en trámite de escrituración." }] },
    { id: 15, etapa: "expediente_completo", docs: { avaluo: true, expediente: true }, nombre: "Iván Ochoa", telefono: "834 123 4515", lote: "Lote 19", fraccionamiento: "Los Encinos", vendedor: "Diana Torres", monto: 555000, ultimoSeguimiento: fechaHace(3), seguimientos: [{ fecha: fechaHace(3), autor: "Diana Torres", canal: "Visita", texto: "Expediente completo y listo para pasar a firmas." }] },
    { id: 16, etapa: "documentos", docs: { avaluo: true, expediente: true }, nombre: "Sofía Reyes", telefono: "834 123 4516", lote: "Lote 5", fraccionamiento: "Villas del Sol", vendedor: "Ana López", monto: 500000, metaExtra: "Checklist de documentos en revisión", ultimoSeguimiento: fechaHace(1), seguimientos: [{ fecha: fechaHace(1), autor: "Ana López", canal: "Correo", texto: "Pasó a firmas, se está revisando el checklist de documentos." }] },
    { id: 17, etapa: "avaluo", docs: { avaluo: true, expediente: true }, nombre: "Daniel Cabrera", telefono: "834 123 4517", lote: "Lote 22", fraccionamiento: "Real del Valle", vendedor: "Carlos Ruiz", monto: 610000, metaExtra: "Avalúo formal solicitado a la notaría", ultimoSeguimiento: fechaHace(2), seguimientos: [{ fecha: fechaHace(2), autor: "Carlos Ruiz", canal: "Llamada", texto: "Documentos aprobados, se solicitó el avalúo formal." }] },
    { id: 18, etapa: "fondeo", docs: { avaluo: true, expediente: true }, nombre: "Cynthia Reséndez", telefono: "834 123 4518", lote: "Lote 14", fraccionamiento: "Los Encinos", vendedor: "Diana Torres", monto: 575000, metaExtra: "Notaría 3 · Fondeo parcial en proceso", ultimoSeguimiento: fechaHace(0), seguimientos: [{ fecha: fechaHace(0), autor: "Diana Torres", canal: "Correo", texto: "Avalúo listo, en trámite de fondeo con Notaría 3." }] },
    { id: 19, etapa: "firma", docs: { avaluo: true, expediente: true }, nombre: "Óscar Villegas", telefono: "834 123 4519", lote: "Lote 7", fraccionamiento: "Villas del Sol", vendedor: "Marco Peña", monto: 495000, metaExtra: "Firma programada", fechaFirma: fechaEn(7), ultimoSeguimiento: fechaHace(1), seguimientos: [{ fecha: fechaHace(1), autor: "Marco Peña", canal: "Llamada", texto: "Fondeo confirmado, se agendó fecha de firma." }] },
    { id: 20, etapa: "escrituras", docs: { avaluo: true, expediente: true }, nombre: "Paola Siller", telefono: "834 123 4520", lote: "Lote 31", fraccionamiento: "Real del Valle", vendedor: "Ana López", monto: 640000, metaExtra: "Escritura subida, pendiente expediente físico", ultimoSeguimiento: fechaHace(2), seguimientos: [{ fecha: fechaHace(2), autor: "Ana López", canal: "Visita", texto: "Firma realizada, se subió la escritura al sistema." }] },
    { id: 21, etapa: "expediente_fisico", docs: { avaluo: true, expediente: true }, nombre: "Rubén Garza", telefono: "834 123 4521", lote: "Lote 10", fraccionamiento: "Los Encinos", vendedor: "Carlos Ruiz", monto: 520000, metaExtra: "Expediente físico en revisión por Contabilidad", ultimoSeguimiento: fechaHace(3), seguimientos: [{ fecha: fechaHace(3), autor: "Carlos Ruiz", canal: "Correo", texto: "Escritura lista, falta confirmar expediente físico." }] },
    { id: 22, etapa: "visto_bueno", docs: { avaluo: true, expediente: true }, nombre: "Marisol Uribe", telefono: "834 123 4522", lote: "Lote 25", fraccionamiento: "Villas del Sol", vendedor: "Diana Torres", monto: 505000, metaExtra: "En revisión final de Contraloría", ultimoSeguimiento: fechaHace(1), seguimientos: [{ fecha: fechaHace(1), autor: "Diana Torres", canal: "Correo", texto: "Expediente físico confirmado, en espera de visto bueno." }] },
    { id: 23, etapa: "finalizado", docs: { avaluo: true, expediente: true }, nombre: "Álvaro Peña", telefono: "834 123 4523", lote: "Lote 17", fraccionamiento: "Real del Valle", vendedor: "Marco Peña", monto: 630000, metaExtra: "Proceso de firmas finalizado", ultimoSeguimiento: fechaHace(4), seguimientos: [{ fecha: fechaHace(4), autor: "Marco Peña", canal: "Visita", texto: "Visto bueno de Contraloría recibido, proceso finalizado." }] },
    { id: 24, etapa: "cancelado", docs: { avaluo: false, expediente: false }, nombre: "Ramiro Cantú", telefono: "834 123 4524", lote: "Lote 24", fraccionamiento: "Villas del Sol", vendedor: "Carlos Ruiz", monto: 470000, metaExtra: "Perdido: compró en otro fraccionamiento", motivoCancelacion: "Se fue con la competencia", ultimoSeguimiento: fechaHace(5), seguimientos: [
      { fecha: fechaHace(9), autor: "Carlos Ruiz", canal: "Llamada", texto: "Interesado, comparando opciones de crédito." },
      { fecha: fechaHace(5), autor: "Carlos Ruiz", canal: "Llamada", texto: "Se cancela: el cliente ya compró en otro fraccionamiento." },
    ] },
    { id: 25, etapa: "cancelado", docs: { avaluo: false, expediente: false }, nombre: "Lucía Farías", telefono: "834 123 4525", lote: "Lote 29", fraccionamiento: "Real del Valle", vendedor: "Diana Torres", monto: 540000, metaExtra: "Perdido: no se presentó a la cita, dejó de responder", motivoCancelacion: "Dejó de responder", ultimoSeguimiento: fechaHace(8), seguimientos: [
      { fecha: fechaHace(12), autor: "Diana Torres", canal: "WhatsApp", texto: "Cita agendada para visitar la casa muestra." },
      { fecha: fechaHace(8), autor: "Diana Torres", canal: "Llamada", texto: "Se cancela: no se presentó a la cita y ya no responde llamadas ni mensajes." },
    ] },
  ];

  clientes.forEach(function (c) {
    if (!c.etapaDesde) c.etapaDesde = c.ultimoSeguimiento;
  });

  return clientes;
}

module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  res.status(200).json({
    fases: fases,
    etapas: etapas,
    vendedores: vendedores,
    vendedorColores: vendedorColores,
    plazaPorFraccionamiento: plazaPorFraccionamiento,
    slaProspectoDias: slaProspectoDias,
    clientes: construirClientes(),
    generadoEn: new Date().toISOString(),
  });
};
