# CAMPEONATOS V41 — Plataforma comercial Ecuador

Base V40 + portal de organizadores + directorio + PWA + arquitectura de cobro por torneo.

## Incluye
- Registro de organizadores con Firebase Authentication.
- Cuenta del organizador.
- Creación de torneos a $20 por torneo.
- Estado de pago: `pending` / `paid`.
- Estado del torneo: `draft` / `active` / `finished`.
- Provincia → cantón → parroquia para Ecuador. El catálogo geográfico se carga desde un JSON público configurable, con fallback de provincias.
- Directorio público que muestra solo torneos `active` + `paid` y permite filtrar por ubicación.
- PWA: manifest + service worker, instalable en PC y móvil.
- El administrador/organizador conserva el motor de partidos, fechas, resultados y eventos de la V40.
- Al finalizar el partido de la etapa marcada como `final`, el torneo pasa a `finished` y no se elimina.
- Reglas Firebase base para que el propietario pueda gestionar su torneo sin poder marcarlo como pagado desde el navegador.
- `functions/` con integración de servidor para generar el enlace PayPhone y endpoint de notificación.

## Pago real
GitHub Pages no debe manejar secretos del proveedor. Para producción se debe desplegar `functions/` en Firebase Functions y configurar:
- `PAYPHONE_TOKEN`
- `PAYPHONE_STORE_ID`

El cliente nunca escribe `paymentStatus=paid`; el backend es el que lo confirma.

## Próximo paso recomendado
1. Crear/validar la cuenta comercial del proveedor de pagos.
2. Desplegar Functions.
3. Configurar notificación externa del proveedor hacia `payphoneNotification`.
4. Probar pago en sandbox/entorno de prueba.
5. Aplicar las reglas definitivas en Realtime Database.
6. Migrar el portal a la URL raíz de la marca cuando esté aprobado.

## Nota geográfica
El catálogo está desacoplado en `js/locations.js`. Si se decide no depender de un JSON remoto, se puede sustituir por un catálogo oficial local sin cambiar los formularios ni los filtros.
