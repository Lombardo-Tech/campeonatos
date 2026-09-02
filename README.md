CAMPEONATO INSTITUCIONAL | EMPRESARIAL — V6\n\n# Campeonato Institucional | Empresarial — Temporada 2026

Sistema de gestión y página pública del campeonato.

## Acceso administrativo seguro

1. En Firebase Console abre **Authentication**.
2. Activa **Sign-in method > Email/Password**.
3. En **Authentication > Users**, crea el usuario o usuarios que tendrán acceso al panel.
4. El administrador entra por `login.html`.
5. `admin.html` redirige automáticamente al login si no existe una sesión autenticada.

## Reglas recomendadas para Realtime Database

Una vez activado Authentication, reemplaza las reglas abiertas de prueba por reglas que exijan usuario autenticado:

```json
{
  "rules": {
    ".read": true,
    ".write": false,
    "equipos": { ".write": "auth != null" },
    "partidos": { ".write": "auth != null" },
    "eventos": { ".write": "auth != null" },
    "configuracion": { ".write": "auth != null" }
  }
}
```

Esto significa: cualquiera puede consultar la página pública, pero solo usuarios autenticados pueden modificar los datos.

## Nombre

El nombre inicial quedó como:

**CAMPEONATO INSTITUCIONAL | EMPRESARIAL**

**TEMPORADA 2026**

También puedes cambiarlo desde Administración > Torneo.


## V3 — Calendario automático y escudos

### Generar las Fechas 2–7
Con 8 equipos activos por grupo, la fase de grupos tiene 7 fechas y 28 partidos por grupo (56 en total).
La Fecha 1 existente se toma como primera jornada y el sistema genera automáticamente los enfrentamientos restantes sin repetir partidos.

En Administración → Resumen:
- Verifica que Fecha 1 tenga 8 partidos.
- Verifica 8 equipos activos en Grupo A y 8 en Grupo B.
- Pulsa **Generar Fechas 2–7**.
- El sistema no modifica la Fecha 1 ni reemplaza partidos existentes.

Las Fechas 2–7 quedan inicialmente con hora **Por definir** para que puedas editarlas desde Partidos.

### Escudos
En Administración → Equipos → editar/crear equipo:
- Pega una URL pública de la imagen del escudo.
- Recomendado: PNG, JPG o WEBP cuadrado, idealmente 512×512 px.
- No necesitas habilitar Firebase Storage.
- La URL queda guardada en Realtime Database junto al equipo.
- El escudo aparece automáticamente en partidos y tablas públicas.

También puedes alojar posteriormente los escudos dentro del propio proyecto en `assets/escudos/` y guardar rutas relativas como `assets/escudos/EQ01.png`.

### Importante
El botón **Cargar Fecha 1** sigue siendo un seed inicial y puede reemplazar equipos/partidos existentes. Una vez cargada la Fecha 1, utiliza **Generar Fechas 2–7** y evita volver a ejecutar el seed salvo que quieras reiniciar esos datos.


### V3 corregida — sin Firebase Storage
Esta versión no utiliza Firebase Storage y, por tanto, no requiere actualizar el plan de precios por los escudos.


## V4 — Jornadas y calendario dinámico
- Cada partido de fase de grupos puede tener `dateValue` con fecha ISO `YYYY-MM-DD`.
- Si no se conoce el día, se muestra **Fecha por definir**.
- Administración permite asignar posteriormente el día real de cada jornada.
- La hora puede permanecer **Por definir** hasta que se conozca.
- El generador se adapta al número de equipos activos de cada grupo y crea descansos cuando el grupo es impar.
- Si ya existe un resultado finalizado, la regeneración automática se bloquea para proteger el historial.
