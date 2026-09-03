# Plataforma Multi-Torneos — V13

Base para crear y administrar múltiples torneos con Firebase Realtime Database y publicar con GitHub Pages.

## Primer administrador global
1. En Firebase Authentication, copia el UID de la cuenta principal.
2. En Realtime Database > Data crea `globalAdmins` > `UID` = `true`.
3. Actualiza las reglas usando `firebase-rules.json`.

Solo los administradores globales pueden crear/modificar/eliminar torneos y asignar administradores. Los administradores asignados pueden operar únicamente equipos, partidos y eventos de su torneo.

## GitHub Pages
Sube el contenido de esta carpeta a la raíz del repositorio, con `index.html` en la raíz, y activa Settings > Pages > Deploy from a branch > main > /(root).