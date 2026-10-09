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

| Tabla                       | Para qué                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `customers`                 | Clientes, con o sin cuenta                                                                                   |
| `notifications`             | Cada aviso enviado, con su resultado                                                                         |
| `addresses`                 | Direcciones de servicio, con la distancia ya calculada                                                       |
| `quotes`                    | Cotizaciones emitidas (antes no se guardaba ninguna)                                                         |
| `bookings`                  | Citas y trabajos, con el precio pactado congelado y el pin de la puerta, que se borra a las 24 h (`docs/29`) |
| `recurring_series`          | Series recurrentes como objeto propio                                                                        |
| `payments`                  | Reflejo local de cada movimiento de dinero                                                                   |
| `webhook_events`            | Eventos del proveedor de pago (idempotencia)                                                                 |
| `staff`                     | Personal, lo mínimo para asignar trabajos                                                                    |
| `booking_assignments`       | Qué persona atiende qué trabajo                                                                              |
| `booking_clock_ins`         | Entrada y salida de cada persona, **solo la distancia a la casa** (`docs/25`)                                |
| `booking_checklist_items`   | Las tareas **marcadas** de cada trabajo: qué, quién y cuándo (`docs/27`)                                     |
| `booking_field_adjustments` | Lo que el equipo encontró en la casa, si se cobró, y si el importe lo tecleó una persona (`docs/28`)         |
| `pricing_tables`            | Versiones de tarifas, de solo añadir (`docs/20`)                                                             |
| `business_settings`         | Configuración editable desde el panel (ver más abajo)                                                        |
| `audit_logs`                | Quién hizo qué                                                                                               |

> `booking_checklist_items` guarda **lo marcado, no la lista**: la lista de
> tareas vive en el código, no copiada sobre cada reserva. El porqué completo
> —y la regla que lo hace seguro, que un código de tarea no se reutiliza
> nunca— está en `docs/27-listas-de-verificacion.md` §1.

### Por qué `business_settings` guarda una sola fila

La tabla es de clave y valor (`key`, `value` JSON, `updatedAt`, `updatedBy`),
pero hoy solo se usa **una clave**: `business`, con el teléfono, el correo y el
horario juntos.

No es pereza. Los tres cambian a la vez desde la misma pantalla, y **una
escritura de una fila no puede quedarse a medias**. Repartidos en tres filas,
un fallo entre la segunda y la tercera dejaría el negocio con el horario nuevo
y el teléfono viejo, sin que nadie se enterara.

El formato de clave y valor se conserva porque lo que viene después (textos del
sitio, zona de servicio) sí son bloques independientes que se editarán por
separado.

Lo guardado se valida contra el contrato **al leerlo**, no solo al escribirlo:
una fila de una versión anterior del contrato no debe tumbar el sitio público.

### Por qué `quotes` existe ahora

En la Etapa 1 el cotizador era sin estado: quien pedía precio y se iba no
dejaba rastro. Guardar la cotización permite medir cuántas terminan en reserva
y recuperar al cliente que no reservó. Como el cotizador público solo pide el
código postal, `customerId` es nulo hasta que la persona deja sus datos.

### Por qué `webhook_events` es crítica

El proveedor de pago reenvía el mismo evento si no recibe un `2xx` a tiempo.
Sin esta tabla, un reintento podría **capturar dos veces el mismo depósito**.

Un evento se considera procesado solo cuando tiene `processedAt`, no por el
mero hecho de existir la fila: si el procesamiento falla, la transacción se
deshace y el reintento vuelve a intentarlo de verdad. El razonamiento completo
está en `docs/12-pagos-y-deposito.md`.

### Por qué `payments` no menciona a Stripe

La tabla nació con columnas `stripePaymentIntentId` y `stripeCustomerId`. Con
el módulo de pagos por adaptadores eso dejó de ser cierto: el simulador también
guarda movimientos ahí, y escribir sus identificadores en una columna que dice
«stripe» sería guardar un dato que miente sobre su origen.

Hoy son `provider`, `providerPaymentIntentId` y `providerCustomerId`, con
unicidad del **par** `(provider, providerPaymentIntentId)`. Un test falla si
alguna columna vuelve a llamarse `stripe*`.

### Por qué las series recurrentes son un objeto propio

Una serie semanal no son 52 citas sueltas copiadas. Siendo un objeto de primer
nivel se puede pausar, reprogramar o cambiar de precio toda la serie de una vez,
que es como lo pide el negocio.

## Al añadir una tabla nueva

La migración que la crea **debe** activar la seguridad a nivel de fila:

```sql
ALTER TABLE "nombre_de_la_tabla" ENABLE ROW LEVEL SECURITY;
```

Sin esa línea, Supabase publica la tabla por su API REST y queda accesible con
la clave pública del proyecto. Hay un test que lo impide (falla e imprime la
línea exacta que falta), pero conviene escribirla desde el principio. El
razonamiento completo está en `docs/04-seguridad.md`.

## Datos sensibles

`addresses.accessNotes` guarda códigos de puerta, dónde está la llave o si hay
perro en el jardín. Es el dato más delicado del sistema: debe verlo solo el
equipo asignado a ese trabajo y administración, nunca un listado general. Al
implementar los permisos hay que tratarlo como caso aparte.

`payments` **nunca** guarda números de tarjeta, solo marca y últimos cuatro
dígitos para mostrarlos. La tarjeta la custodia el proveedor de pago: el
navegador se la envía directamente y no pasa por nuestro servidor.

## Cómo se verifica

`apps/api/src/database/migrations.test.ts` aplica todas las migraciones sobre
un **PostgreSQL real compilado a WebAssembly** (PGlite). No hace falta servidor
ni credenciales, así que se ejecuta también en la integración continua.

Comprueba que el SQL es válido y congela las reglas de integridad: correo único
por cliente, no hay direcciones huérfanas, no se procesa dos veces un evento del
proveedor de pago, no se borra un cliente con historial, cada pago declara quién
lo custodia, ninguna columna da por supuesto un proveedor concreto, todo el
dinero es entero y todas las fechas llevan zona horaria.

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

## Deriva entre el esquema y la base, y cómo comprobarla

**El esquema de Prisma y lo que hay realmente en la base pueden separarse sin
que nada falle.** Pasa cuando una migración se escribe a mano —que en este
proyecto es lo normal— y crea algo que el esquema no declara, o lo declara de
otra forma.

> **Por qué importa:** la siguiente vez que alguien ejecute `prisma migrate
dev`, Prisma genera una migración «corrigiendo» la diferencia **a su
> manera**, mezclada con el trabajo que esa persona estuviera haciendo. Un
> cambio de esquema que nadie pidió y que nadie revisa — incluido borrar un
> índice útil.

### Cómo comprobarlo sin tocar ninguna base real

Se levanta un PostgreSQL en memoria, se le aplican **todas** las migraciones
del repositorio, y se le pregunta a Prisma qué diferencia ve:

```js
// Levantar PGlite por TCP y aplicar las migraciones en orden.
const db = await PGlite.create();
const socket = new PGLiteSocketServer({ db, port: 55921, host: '127.0.0.1' });
await socket.start();
for (const m of readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  await db.exec(readFileSync(join(DIR, m.name, 'migration.sql'), 'utf8'));
}
```

```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55921/postgres" \
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:55921/postgres" \
pnpm exec prisma migrate diff --from-config-datasource \
  --to-schema prisma/schema.prisma --script
```

**`-- This is an empty migration.` significa que no hay deriva.** Cualquier
otra cosa es una diferencia real que conviene mirar antes de que Prisma la
«arregle» sola.

> Hacen falta **las dos** variables de entorno: `prisma.config.ts` lee
> `DIRECT_URL` y sin ella el comando falla con `P1013`.

### Lo que Prisma NO ve

- **Las restricciones `CHECK`.** Son invisibles para él: no las introspecciona
  y no intenta reconciliarlas, así que viven solo en el archivo de migración
  **sin causar deriva**. El fichaje con ubicación usa una
  (`docs/25-fichaje-con-ubicacion.md` §8), y se comprobó con este
  procedimiento antes de darla por buena.
- **Los índices parciales** (`CREATE INDEX ... WHERE ...`) sí los ve, y no se
  pueden expresar en el esquema: ahí la deriva es inevitable, y por eso en la
  Etapa 3.2 se decidió no usar ninguno.

### Las dos que había, corregidas en octubre de 2026

Aparecieron con este procedimiento, y llevaban meses:

| Qué                                                                  | Desde      | Cómo se arregló                                                      |
| -------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `pricing_tables_createdAt_idx` existía en la base y no en el esquema | Etapa 2.22 | **Declarándolo**, no borrándolo: acelera «cuál es la tarifa vigente» |
| `notifications_bookingId_fkey` sin `ON UPDATE`                       | Etapa 2.5  | Recreada con `ON UPDATE CASCADE`, como las demás                     |

Ninguna rompía nada: el identificador de una reserva es un UUID que no cambia
nunca, así que la regla de actualización no llegaba a aplicarse. Se alinearon
para que el esquema y la base digan lo mismo.
