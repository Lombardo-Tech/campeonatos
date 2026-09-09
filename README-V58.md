# V59 — URLs limpias sin `.html` + actualización de caché

Basado en V58.

## Cambios
- Navegación interna de la plataforma actualizada a URLs sin extensión:
  - `/inicio`
  - `/login`
  - `/registro`
  - `/cuenta`
  - `/crear-torneo`
  - `/pago`
  - `/admin`
- El inicio público continúa en `/` y los torneos usan `/?t=...`.
- Redirecciones JavaScript actualizadas para no enviar al usuario a archivos `.html`.
- Enlaces del menú, botones y accesos entre páginas actualizados.
- Manifest PWA actualizado para iniciar en `/campeonatos/inicio`.
- Service Worker conserva las referencias físicas `.html` internamente, porque esos son los archivos reales que GitHub Pages sirve; esto no afecta las URLs visibles.

## Publicación
Reemplaza el contenido de tu repositorio GitHub Pages por el contenido de este ZIP y publica normalmente.

Las URLs esperadas serán:
- https://lombardo-tech.github.io/campeonatos/
- https://lombardo-tech.github.io/campeonatos/inicio
- https://lombardo-tech.github.io/campeonatos/login
- https://lombardo-tech.github.io/campeonatos/registro
- https://lombardo-tech.github.io/campeonatos/cuenta
- https://lombardo-tech.github.io/campeonatos/crear-torneo
- https://lombardo-tech.github.io/campeonatos/pago?tid=...
- https://lombardo-tech.github.io/campeonatos/admin


## V59
- Se incrementó la versión del Service Worker para invalidar la caché anterior.
- Se añadió activación inmediata (`skipWaiting`) y toma de control inmediata (`clients.claim`) para evitar que queden menús antiguos con enlaces `.html` en caché.
- Los enlaces de navegación ya están en formato limpio: `inicio`, `crear-torneo`, `admin`, `login`, `registro`, `cuenta` y `pago`.
