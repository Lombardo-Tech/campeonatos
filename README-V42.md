# Plataforma Multi-Torneos V42 — pagos por transferencia + Payphone opcional

Base: V41 SaaS Ecuador.

## Nuevo flujo de cobro
- Transferencia bancaria activa por defecto.
- El administrador global registra banco, tipo y número de cuenta, titular, identificación, contacto e instrucciones.
- El organizador crea su torneo por $20 y entra a `pago.html?tid=...` para ver las opciones.
- El organizador puede registrar la referencia de una transferencia. La solicitud queda pendiente.
- El administrador global ve las transferencias pendientes y puede aprobarlas; al aprobar, el torneo pasa a `paymentStatus=paid` y `status=active`.
- Payphone/pago con tarjeta aparece desactivado por defecto.
- El administrador puede habilitar Payphone desde Administración → Pagos, ingresando Token y Store ID.
- Las credenciales Payphone están separadas de la configuración pública; no se exponen en el directorio público.

## Seguridad
- `paymentConfig/public` contiene únicamente datos públicos de cobro y el indicador de Payphone activo.
- `paymentConfig/payphone` solo puede ser leído/escrito por el administrador global.
- `paymentRequests` puede ser creada por el propietario del torneo y aprobada por el administrador global.
- La activación por transferencia requiere aprobación administrativa.

## Importante
Payphone todavía requiere configuración real de cuenta, dominio y despliegue de Cloud Functions para producción. La opción queda apagada mientras no esté configurada.


## Corrección V43
- Los apartados ACCESOS y PAGOS son exclusivos del administrador global.
- Usuarios organizadores no suscriben datos de Payphone ni solicitudes globales.
- Los torneos SaaS de organizadores solo aparecen públicamente cuando están activos y pagados.
- Índices Firebase para ownerUid y solicitudes por uid.
- Service Worker ignora esquemas no HTTP/HTTPS.
