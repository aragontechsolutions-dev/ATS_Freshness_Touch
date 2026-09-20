# 10 — Modelo de datos

Esquema de la base de datos (PostgreSQL en Supabase, gestionado con Prisma).
Vive en `apps/api/prisma/schema.prisma`.

> **Estado:** esquema, migración inicial y conexión de la API listos. La base
> de datos es **opcional en tiempo de ejecución**: si no está configurada o se
> cae, el cotizador sigue funcionando.

## Las cinco reglas del esquema

1. **Dinero en centavos enteros.** Ningún importe es decimal; los campos
   terminan en `Cents`. Hay un test que lo comprueba: si alguien añade una
   columna de dinero como decimal, la CI se pone en rojo.

2. **Fotografía del precio, no referencia.** Una reserva guarda el precio que
   se pactó, no un enlace a la tarifa vigente. Si mañana suben los precios, las
   reservas de ayer deben seguir mostrando lo que el cliente aceptó. Se guarda
   además `pricingVersion`, para poder reproducir el cálculo tal cual.

3. **Fechas con zona horaria** (`timestamptz`). Georgia cambia de hora dos
   veces al año; guardar la hora sin zona desplazaría citas una hora. También
   hay un test que lo verifica.

4. **Reserva como invitado.** Un cliente existe sin cuenta de usuario. El campo
   `authUserId` solo se rellena si más adelante crea contraseña.

5. **Borrado controlado.** Un cliente con historial no se puede borrar en
   cascada por accidente: esas relaciones usan `RESTRICT`.

## Tablas

| Tabla                 | Para qué                                               |
| --------------------- | ------------------------------------------------------ |
| `customers`           | Clientes, con o sin cuenta                             |
| `addresses`           | Direcciones de servicio, con la distancia ya calculada |
| `quotes`              | Cotizaciones emitidas (antes no se guardaba ninguna)   |
| `bookings`            | Citas y trabajos, con el precio pactado congelado      |
| `recurring_series`    | Series recurrentes como objeto propio                  |
| `payments`            | Reflejo local de cada movimiento en Stripe             |
| `webhook_events`      | Eventos de Stripe ya procesados (idempotencia)         |
| `staff`               | Personal, lo mínimo para asignar trabajos              |
| `booking_assignments` | Qué persona atiende qué trabajo                        |
| `business_settings`   | Configuración editable desde el panel                  |
| `audit_logs`          | Quién hizo qué                                         |

### Por qué `quotes` existe ahora

En la Etapa 1 el cotizador era sin estado: quien pedía precio y se iba no
dejaba rastro. Guardar la cotización permite medir cuántas terminan en reserva
y recuperar al cliente que no reservó. Como el cotizador público solo pide el
código postal, `customerId` es nulo hasta que la persona deja sus datos.

### Por qué `webhook_events` es crítica

Stripe reenvía el mismo evento si no recibe un `2xx` a tiempo. Sin esta tabla,
un reintento podría **capturar dos veces el mismo depósito**. Su clave primaria
es el identificador del evento, así que procesarlo dos veces es imposible.

### Por qué las series recurrentes son un objeto propio

Una serie semanal no son 52 citas sueltas copiadas. Siendo un objeto de primer
nivel se puede pausar, reprogramar o cambiar de precio toda la serie de una vez,
que es como lo pide el negocio.

## Datos sensibles

`addresses.accessNotes` guarda códigos de puerta, dónde está la llave o si hay
perro en el jardín. Es el dato más delicado del sistema: debe verlo solo el
equipo asignado a ese trabajo y administración, nunca un listado general. Al
implementar los permisos hay que tratarlo como caso aparte.

`payments` **nunca** guarda números de tarjeta, solo marca y últimos cuatro
dígitos para mostrarlos. La tarjeta la custodia Stripe.

## Cómo se verifica

`apps/api/src/database/migrations.test.ts` aplica todas las migraciones sobre
un **PostgreSQL real compilado a WebAssembly** (PGlite). No hace falta servidor
ni credenciales, así que se ejecuta también en la integración continua.

Comprueba que el SQL es válido y congela las reglas de integridad: correo único
por cliente, no hay direcciones huérfanas, no se procesa dos veces un evento de
Stripe, no se borra un cliente con historial, todo el dinero es entero y todas
las fechas llevan zona horaria.

## Cómo aplicar la migración

Las credenciales **no están en el repositorio ni las conoce nadie más que la
empresa**. La migración se aplica desde tu máquina:

**Windows (PowerShell)** — `export` no existe en PowerShell, se usa `$env:`:

```powershell
cd apps\api
$env:DIRECT_URL = "postgresql://USUARIO:CONTRASENA@HOST:5432/postgres"
pnpm db:status     # qué migraciones faltan
pnpm db:deploy     # aplicarlas
```

**macOS y Linux:**

```bash
cd apps/api
export DIRECT_URL="postgresql://USUARIO:CONTRASENA@HOST:5432/postgres"
pnpm db:status
pnpm db:deploy
```

Dos avisos sobre la contraseña:

- Si contiene caracteres como `@`, `:`, `/`, `#` o `?`, hay que **codificarlos**
  o la cadena se interpretará mal (`@` es `%40`, `#` es `%23`, y así).
- La variable queda en el historial de la terminal. Si se pega una contraseña
  real en un chat, un ticket o una captura, hay que **rotarla** en Supabase
  (Settings → Database → Reset database password): una contraseña que salió de
  la máquina ya no es secreta.

Se usa la conexión **directa** (puerto 5432) y no la agrupada (6543) porque el
agrupador en modo transacción no admite las sentencias preparadas que necesita
Prisma Migrate.

## La base de datos es opcional

`PrismaService` no hereda de `PrismaClient`: lo envuelve. Así la instancia
puede no existir, y eso permite una propiedad valiosa:

> **Si la base de datos falta o se cae, el cotizador sigue dando precios.**

El cotizador es la parte que genera negocio y no necesita base de datos para
calcular. Sería absurdo que una caída de Supabase dejara el sitio sin poder
cotizar. Lo que sí la necesita devuelve un `503` claro, no un error interno.

Dos detalles que se descubrieron probándolo:

- **`$connect()` no comprueba nada.** Con adaptador es perezoso: devuelve éxito
  aunque el servidor esté apagado. Por eso el servicio lanza un `SELECT 1` real
  al arrancar; es la única forma de saber que hay alguien al otro lado.
- **La conexión se recupera sola.** Si la base de datos estaba caída al
  arrancar, la sonda de disponibilidad reintenta la conexión. No hace falta
  reiniciar la API cuando Supabase vuelve.

### Dos sondas distintas

| Ruta            | Qué dice                                        | Quién la usa   |
| --------------- | ----------------------------------------------- | -------------- |
| `/health`       | Que el proceso está en pie                      | Render         |
| `/health/ready` | Qué partes funcionan, incluida la base de datos | Monitorización |

La de Render **no** depende de la base de datos a propósito: si dependiera, una
caída de Supabase provocaría reinicios en bucle de una API que en realidad
sigue dando precios.

## Migraciones automáticas al desplegar

`render.yaml` define un **comando pre-despliegue** que Render ejecuta después de
compilar y **antes** de enviar tráfico a la versión nueva:

```
[ -z "$DIRECT_URL" ] && echo 'omitidas' || pnpm --filter @freshness/api db:deploy
```

Por qué ahí y no en otro sitio:

- **Si la migración falla, el despliegue se aborta** y la versión anterior
  sigue atendiendo. Nunca queda código nuevo contra una base de datos a medio
  migrar. Comprobado: un fallo devuelve código distinto de cero.
- **Las credenciales ya están en Render.** No hay que duplicarlas en GitHub,
  que es lo que exigiría migrar desde la integración continua.
- Si `DIRECT_URL` todavía no existe, el paso se **omite** en vez de fallar, para
  que un despliegue no se caiga por una variable sin rellenar.

`prisma migrate deploy` solo aplica lo pendiente y nunca reinicia la base de
datos; si no hay migraciones nuevas, no hace nada.

### Lo que hay que vigilar

Automatizar las migraciones traslada un riesgo: **una migración destructiva se
aplica sin que nadie la pare**. Dos reglas para convivir con eso:

1. **Nunca borrar en la misma versión que deja de usar algo.** Primero se añade
   la columna nueva y se despliega; cuando ninguna versión viva usa la vieja,
   se borra en una migración posterior. Si se borra a la vez, durante los
   segundos en que conviven ambas versiones la antigua consulta una columna que
   ya no existe.
2. **El SQL de cada migración se revisa en el pull request.** Está en texto
   plano en `prisma/migrations/`, precisamente para poder leerlo antes de
   fusionar.

## Nota sobre Prisma 7

Este proyecto usa Prisma 7, que cambió dónde va la configuración: las cadenas
de conexión **ya no se escriben en `schema.prisma`**, sino en
`apps/api/prisma.config.ts`, y la aplicación se conecta mediante un adaptador.
Mucha documentación y muchos tutoriales todavía muestran el formato antiguo con
`url = env("DATABASE_URL")` dentro del esquema: eso ya no es válido y produce
un error de validación.
