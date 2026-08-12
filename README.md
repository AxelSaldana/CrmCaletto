# Panorama Ejecutivo — CrmCaletto

Web app instalable (PWA) de **solo lectura** para que dirección vea el pipeline de
ventas desde el celular, sin entrar al sistema administrativo interno.

No requiere compilar ni publicarse en App Store / Play Store: es una página web
que se agrega a la pantalla de inicio desde el navegador (Safari en iOS, Chrome
en Android) y se abre como una app normal.

## Cómo funciona

Esta app no tiene datos propios. En cada apertura (y al volver a primer plano)
pide la información a una API de solo lectura que vive en el CRM interno:

```
vistas/api/crmejecutivo.php   (en el repo del sistema principal, no en este)
```

La comunicación es: `GET` con header `Authorization: Bearer <token>` → responde
un JSON con el pipeline completo. Esa API por ahora sirve los mismos datos de
prueba que usa el CRM interno (vista de ejemplo); cuando el CRM se conecte a
base de datos real, esta app no necesita cambios — solo cambia lo que la API
devuelve.

## Configuración (una sola vez, en el celular del usuario)

Al abrir la app por primera vez pide dos datos:

1. **Dirección de la API** — la URL pública donde quede publicado
   `crmejecutivo.php`, por ejemplo `https://tudominio.com/api/crmejecutivo.php`.
2. **Código de acceso** — el token que autoriza la lectura.

Esos datos se guardan en el propio celular (`localStorage`) y no hay que
volver a escribirlos. "Cambiar configuración" al final de la pantalla los borra.

## Cómo instalarla en el celular

- **iPhone (Safari):** abrir la URL → botón compartir → *Agregar a pantalla
  de inicio*.
- **Android (Chrome):** abrir la URL → Chrome ofrece automáticamente
  *Instalar app*, o desde el menú → *Agregar a pantalla de inicio*.

## Publicar esta app

Es un sitio 100% estático (`index.html`, `app.js`, `style.css`) — se puede
publicar en GitHub Pages, Netlify, Vercel o cualquier hosting estático. No
necesita servidor propio, solo la API que ya vive en el sistema principal.

## Seguridad — pendiente antes de usar con datos reales

- El token de la API está embebido en texto plano en `crmejecutivo.php`
  (`vistas/api/crmejecutivo.php` en el repo principal). Antes de conectar
  datos reales, mover ese token a una variable de entorno y rotarlo.
- `Access-Control-Allow-Origin` está en `*` para facilitar pruebas. Una vez
  definido el dominio final donde se publique esta app, restringir el CORS
  a ese dominio específico.
- Es de solo lectura por diseño: esta app nunca modifica nada en el CRM.

## Estructura

```
index.html      Pantallas: configuración / carga / error / app / detalle de cliente
style.css       Estilos (mismo lenguaje visual que el CRM interno)
app.js          Fetch a la API + render de todas las secciones
manifest.json   Metadatos de instalación para Android
sw.js           Service worker: cachea el shell de la app, nunca la API
icons/          Íconos de la app (192, 512, apple-touch-icon)
```
