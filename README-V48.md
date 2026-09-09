# V48 · Pagos y comprobantes

Cambios:
- El administrador global ahora ve solicitudes con estado `pending` y `pending_transfer`.
- La tabla muestra referencia, observación y enlace al comprobante si existe (`proofUrl`, `receiptUrl`, `comprobanteUrl` o `proof`).
- El organizador ve `PAGO REALIZADO · EN REVISIÓN` inmediatamente después de enviar la transferencia/comprobante.
- La cuenta del organizador se actualiza en tiempo real con Firebase, por lo que pasa automáticamente a `PAGO CONFIRMADO` cuando el administrador aprueba.
- Se mantiene `paymentConfig` como configuración global única.
