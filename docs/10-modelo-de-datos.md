# 10 — Modelo de datos

Esquema de la base de datos (PostgreSQL en Supabase, gestionado con Prisma).
Vive en `apps/api/prisma/schema.prisma`.

> **Estado:** el esquema y su migración inicial están escritos y verificados,
> pero **la aplicación todavía no se conecta a la base de datos**. Eso llega en
> el siguiente incremento, para no romper el despliegue actual de la API, que
> hoy funciona sin ninguna base de datos. Ver "Cómo aplicar la migración".

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

```bash
cd apps/api
export DIRECT_URL="postgresql://...:5432/postgres"   # conexión DIRECTA, no la agrupada
pnpm db:status     # qué migraciones faltan
pnpm db:deploy     # aplicarlas
```

Se usa la conexión **directa** (puerto 5432) y no la agrupada (6543) porque el
agrupador en modo transacción no admite las sentencias preparadas que necesita
Prisma Migrate.

## Nota sobre Prisma 7

Este proyecto usa Prisma 7, que cambió dónde va la configuración: las cadenas
de conexión **ya no se escriben en `schema.prisma`**, sino en
`apps/api/prisma.config.ts`, y la aplicación se conecta mediante un adaptador.
Mucha documentación y muchos tutoriales todavía muestran el formato antiguo con
`url = env("DATABASE_URL")` dentro del esquema: eso ya no es válido y produce
un error de validación.
