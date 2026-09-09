# Plataforma Multi-Torneos · V62

- Se elimina el módulo de invitaciones por correo y sus Cloud Functions asociadas.
- Se agrega Solicitar participación en la página pública del torneo.
- Las solicitudes públicas se guardan en `inscripciones/{torneoId}` con `status: pending` y `source: public`.
- El administrador recibe las solicitudes en tiempo real y puede aprobar/rechazar.
- Las solicitudes públicas solo pueden CREARSE para torneos activos; no pueden editar ni borrar registros existentes.
- Se conservan los módulos y datos anteriores.
- Service Worker actualizado a V62.
