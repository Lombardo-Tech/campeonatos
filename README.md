# Plataforma Multi-Torneos — V37 estable (base V35)

Base para crear y administrar múltiples torneos con Firebase Realtime Database y publicar con GitHub Pages.

## Primer administrador global
1. En Firebase Authentication, copia el UID de la cuenta principal.
2. En Realtime Database > Data crea `globalAdmins` > `UID` = `true`.
3. Actualiza las reglas usando `firebase-rules.json`.

Solo los administradores globales pueden crear/modificar/eliminar torneos y asignar administradores. Los administradores asignados pueden operar únicamente equipos, partidos y eventos de su torneo.

## GitHub Pages
Sube el contenido de esta carpeta a la raíz del repositorio, con `index.html` en la raíz, y activa Settings > Pages > Deploy from a branch > main > /(root).

V33: gestión de primer tiempo, descanso, segundo tiempo y tiempo adicional en partidos en vivo.


## Generación de fechas — V37 estable

- **Generar siguiente fecha:** crea la próxima jornada de la fase de grupos, respetando las jornadas ya existentes.
- **Generar todas las fechas:** crea de una sola vez las jornadas restantes hasta completar el todos-contra-todos.
- Los cruces se comparan sin importar local/visitante para impedir partidos repetidos.
- Cada equipo aparece como máximo una vez por jornada.
- La Jornada 1 existente se conserva y no se sobrescribe.
- Para 8 equipos por grupo se generan 7 jornadas y 28 partidos por grupo.
