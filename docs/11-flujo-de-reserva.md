# 11 — Flujo de reserva

Cómo una cotización se convierte en una cita. Corresponde al bloque 2.2 de la
Etapa 2.

> **Estado:** la API está terminada y probada, incluido el depósito
> (`docs/12-pagos-y-deposito.md`). Falta el formulario del sitio web.

## Endpoints

| Método | Ruta                   | Para qué                                          |
| ------ | ---------------------- | ------------------------------------------------- |
| `GET`  | `/api/v1/availability` | Franjas libres de un día para un trabajo concreto |
| `POST` | `/api/v1/bookings`     | Crear la reserva                                  |

### Por qué la disponibilidad necesita los datos del trabajo

No basta con la fecha: **la duración decide qué huecos caben**. Una limpieza
profunda de 2.600 pies cuadrados ocupa cinco horas y no entra donde sí entra
una rotación de Airbnb de hora y media. Por eso la consulta lleva servicio,
habitaciones, baños, pies cuadrados y extras.

## Reglas del flujo

### 1. El precio se recalcula siempre en el servidor

Del navegador llegan las **características del trabajo**, nunca importes. El
precio sale del motor. Los esquemas son estrictos: si alguien añade un campo
`totalCents` a la petición, se rechaza entera. Hay un test que lo comprueba.

### 2. La distancia se recalcula con la dirección completa

El cotizador público solo conoce el código postal. Al reservar hay calle, así
que la distancia se calcula hasta el portal y **el depósito puede diferir** de
lo que vio el visitante. Es correcto: aquel era un estimado y así se le dijo.

La dirección detallada forma parte de la clave de la caché de distancias: la
distancia hasta un portal concreto no es la misma que hasta el centro del
código postal, y mezclarlas daría depósitos incorrectos.

### 3. La franja se vuelve a comprobar al reservar

Entre que el cliente ve los huecos y pulsa "reservar" pueden pasar minutos.

### 4. La reserva nace pendiente de pago

`PENDING_PAYMENT`. **No está confirmada**: solo retiene la franja 30 minutos.
Pasado ese plazo el hueco vuelve a ofrecerse, porque un formulario abandonado
no puede bloquear la agenda para siempre.

La respuesta incluye `payment.clientSecret`, con el que el navegador confirma
la tarjeta directamente contra el proveedor. La reserva pasa a `CONFIRMED`
cuando el proveedor avisa por webhook de que el depósito quedó retenido —nunca
porque lo diga el navegador, que puede cerrarse a mitad o mentir. El detalle
está en `docs/12-pagos-y-deposito.md`.

## Cómo se evita que dos personas reserven el mismo hueco

Tres capas, porque una sola no basta:

| Capa                                                        | Qué resuelve                                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Comprobación de disponibilidad                              | El caso normal: el hueco ya estaba ocupado                                                                 |
| **Bloqueo transaccional por día** (`pg_advisory_xact_lock`) | La carrera real: dos peticiones simultáneas que pasan las dos la comprobación antes de que ninguna escriba |
| Índice único parcial `(customerId, scheduledStart)`         | El doble envío del formulario: doble clic, reintento del navegador, pulsar "atrás" y reenviar              |

El bloqueo serializa solo las reservas **del mismo día**, que son pocas, sin
afectar al resto del sistema.

El índice deja fuera las canceladas: tras cancelar, el cliente debe poder
volver a reservar esa misma hora.

Una violación de ese índice se traduce a un `409 DUPLICATE_BOOKING`, no a un
error interno: hacer doble clic es previsible y la culpa no es del cliente.

## Horario y capacidad

En `apps/api/src/scheduling/scheduling.config.ts`:

| Ajuste              | Valor              |
| ------------------- | ------------------ |
| Zona horaria        | `America/New_York` |
| Lunes a viernes     | 08:00 – 18:00      |
| Sábado              | 09:00 – 16:00      |
| Domingo             | cerrado            |
| Franjas cada        | 30 minutos         |
| Equipos simultáneos | 2                  |
| Antelación mínima   | 24 horas           |
| Reserva máxima      | 90 días            |
| Retención sin pago  | 30 minutos         |

Pasa a la tabla `business_settings` en el bloque 2.3, para que la empresa
cambie su horario sin desplegar.

### El cambio de hora no es un detalle

Georgia cambia de hora dos veces al año. El horario comercial se interpreta en
hora **local** y se convierte a UTC para guardarlo. Hay tests que lo fijan: la
apertura sigue siendo a las 08:00 locales antes y después del cambio, pero el
instante real en UTC se desplaza una hora. Si se hubiera usado un desfase fijo,
todas las citas del día siguiente al cambio estarían mal.

## Duración estimada

`estimateDurationMinutes` (paquete de precios) calcula el tiempo en el
domicilio a partir del servicio, el tamaño y los extras, y **redondea siempre
hacia arriba** a bloques de 30 minutos: reservar de más y terminar antes es
preferible a encadenar retrasos durante todo el día.

> Las cifras iniciales son estimaciones. El sector recomienda medir los tiempos
> reales durante 4-6 semanas y ajustarlas con la media móvil.

El servicio comercial devuelve 0 y no se puede agendar desde la web: requiere
visita previa.

## Cómo se verifica

`apps/api/src/bookings/bookings.e2e.test.ts` levanta un **PostgreSQL real**
(compilado a WebAssembly y expuesto por TCP), le aplica las migraciones del
repositorio y arranca la aplicación completa. Sin Docker ni servidor externo,
así que también corre en la integración continua.

Prueba lo que ningún test unitario alcanza: que migraciones, cliente de base de
datos, transacciones, índices y rutas HTTP encajan entre sí. Entre otras cosas
confirma que **la API se conecta pese a estar activada la seguridad a nivel de
fila**, que era una afirmación pendiente de demostrar.
