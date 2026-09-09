# V61 · Invitaciones por correo

Base: V60.

Novedades:
- Nuevo módulo 📩 Invitaciones en Administración.
- Envío real de invitaciones mediante Firebase Functions + Resend.
- Registro de invitación en `invitaciones/{torneoId}`.
- Página pública `/invitacion?token=...`.
- El delegado puede aceptar la invitación.
- Al aceptar, se crea automáticamente una inscripción pendiente.
- El organizador mantiene la decisión final de aprobar o rechazar.
- Se conservan Inscripciones como solicitudes y Invitaciones como flujo de invitación.

Requisito de despliegue: configurar `RESEND_API_KEY`, `MAIL_FROM` e `INVITE_BASE_URL` en Firebase Functions.
