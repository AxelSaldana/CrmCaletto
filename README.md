# Panorama Ejecutivo — CrmCaletto

Web app instalable (PWA) de **solo lectura** para que dirección vea el pipeline
de ventas desde el celular.

No requiere compilar ni publicarse en App Store / Play Store: es una página
web que se agrega a la pantalla de inicio desde el navegador (Safari en iOS,
Chrome en Android) y se abre como una app normal. Se abre directo, sin login
ni pantalla de configuración.

## Cómo funciona

Todo vive en el mismo proyecto de Vercel — la app y sus datos:

```
index.html, app.js, style.css   → la app
api/crmejecutivo.js             → función serverless que sirve el pipeline
```

`app.js` hace `fetch('/api/crmejecutivo')` (mismo dominio, sin configurar
nada) y con eso pinta todo: KPIs, distribución por fase, atención requerida,
próximas citas y firmas, ranking de vendedores, por plaza/fraccionamiento,
motivos de cancelación y dónde se atora el proceso.

Por ahora `api/crmejecutivo.js` sirve **datos de prueba** (los mismos que usa
el CRM interno). Cuando haya datos reales, ese archivo es lo único que hay
que cambiar — reemplazar el arreglo `clientes` por una consulta a la base de
datos real.

## ⚠️ Antes de conectar datos reales del negocio

Hoy la función no tiene autenticación porque no protege nada real (son datos
de prueba). En cuanto `api/crmejecutivo.js` sirva información real de ventas,
hay que agregar un login de verdad antes de publicar — por ejemplo, que el
CRM interno emita una sesión/token al dueño de la app, y que la función
valide ese token en cada request. No reactivar el esquema anterior de "token
fijo en el código": cualquier token embebido en `app.js` es visible para
cualquiera que abra las herramientas de desarrollador del navegador, así que
no protege nada por sí solo — la validación real tiene que vivir del lado
del servidor.

## Cómo instalarla en el celular

- **iPhone (Safari):** abrir la URL → botón compartir → *Agregar a pantalla
  de inicio*.
- **Android (Chrome):** abrir la URL → Chrome ofrece automáticamente
  *Instalar app*, o desde el menú → *Agregar a pantalla de inicio*.

## Publicar / actualizar

Cada `git push` a `main` redeploya automáticamente en Vercel
(`https://crm-caletto.vercel.app`) — no hay paso manual de build.

## Estructura

```
index.html           Pantallas: carga / error / app / detalle de cliente
style.css             Estilos (mismo lenguaje visual que el CRM interno)
app.js                Fetch a /api/crmejecutivo + render de todas las secciones
api/crmejecutivo.js   Función serverless: sirve el pipeline (hoy, datos de prueba)
manifest.json         Metadatos de instalación para Android
sw.js                 Service worker: cachea el shell de la app, nunca /api/
icons/                Íconos de la app (192, 512, apple-touch-icon) con el
                       logo real de Grupo Caletto sobre el mismo degradado
                       oscuro que usa la pantalla de inicio de sesión del CRM
```
