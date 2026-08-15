/*
 * Función serverless de Vercel: intermediario entre la app pública y la API
 * real del CRM interno. El token y la URL viven como variables de entorno
 * de Vercel (Project Settings → Environment Variables) — nunca en el código,
 * así que nunca quedan expuestos en este repo público.
 *
 * Variables necesarias en Vercel:
 *   CRM_API_URL   → ej. https://tu-tunel.trycloudflare.com/Nueva%20carpeta%20(2)/public_html/api/crmejecutivo.php
 *   CRM_API_TOKEN → el token de crmejecutivo.env.php en el sistema principal
 */

module.exports = async function handler(req, res) {
  var apiUrl = process.env.CRM_API_URL;
  var apiToken = process.env.CRM_API_TOKEN;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!apiUrl || !apiToken) {
    res.status(500).json({ error: "Faltan CRM_API_URL o CRM_API_TOKEN en las variables de entorno de Vercel." });
    return;
  }

  try {
    var respuesta = await fetch(apiUrl, {
      headers: { Authorization: "Bearer " + apiToken },
    });
    var texto = await respuesta.text();

    // Cachea en el edge de Vercel las respuestas buenas por 60s (hasta 120s
    // adicionales sirviendo la version en cache mientras refresca en segundo
    // plano). Asi, aunque varios celulares abran la app o cambien de pestaña
    // seguido, el CRM interno (el que corre en tu maquina via el tunel) no
    // recibe una consulta pesada por cada una -- como mucho una por minuto.
    // Los errores (401, 500, caida del tunel) nunca se cachean.
    if (respuesta.ok) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    } else {
      res.setHeader("Cache-Control", "no-store");
    }

    res.status(respuesta.status).send(texto);
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "No se pudo conectar con el CRM interno.", detalle: String(err) });
  }
};
