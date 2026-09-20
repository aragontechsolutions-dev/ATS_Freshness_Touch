# 12 — Pagos y depósito de traslado

> Etapa 2.4. Implementado y probado de punta a punta con el proveedor
> simulado. Para activar cobros reales, ver `docs/08-variables-de-entorno.md`,
> sección 5.

---

## 1. Qué es el depósito y qué no es

El depósito **se autoriza, no se cobra**. Es una retención en la tarjeta del
cliente que:

- protege a la empresa si cancela con el equipo ya en camino (combustible y
  tiempo de traslado ya gastados);
- se **acredita íntegramente** contra la factura final si el servicio se
  presta con normalidad;
- **caduca a los 7 días**, que es el máximo que permiten las redes de
  tarjetas. Pasada esa fecha ya no se puede capturar y hay que volver a pedir
  la tarjeta.

El importe lo calcula el motor de precios en el servidor
(`docs/02-motor-de-precios.md`): base de 30 USD más las millas que excedan el
radio libre de 20, ida y vuelta, a la tarifa vigente del IRS, con un tope de
120 USD.

> **El navegador nunca envía importes.** Manda las características del
> trabajo; el precio y el depósito salen del motor. Aceptar una cifra del
> cliente sería regalar dinero.

---

## 2. El flujo completo

```
1. Cliente rellena el formulario y elige franja
        ↓
2. POST /api/v1/bookings
     · se recalcula el precio en el servidor
     · se recalcula la distancia con la dirección completa
     · se vuelve a comprobar que la franja sigue libre
     · se guarda la reserva con estado PENDING_PAYMENT
        ↓
3. Se pide la retención al proveedor  (FUERA de la transacción)
     · se guarda la fila en `payments` con kind = DEPOSIT_HOLD
     · la respuesta incluye `payment.clientSecret`
        ↓
4. El navegador confirma la tarjeta DIRECTAMENTE contra el proveedor
     · los datos de la tarjeta no pasan por nuestro servidor
        ↓
5. El proveedor nos avisa por webhook
     · POST /api/v1/payments/webhook
     · se verifica la firma
     · payments.status → REQUIRES_CAPTURE
     · bookings.status → CONFIRMED
```

### Por qué la retención va fuera de la transacción

Crear la reserva toma un bloqueo sobre la agenda del día
(`pg_advisory_xact_lock`). Llamar al proveedor de pago **dentro** de esa
transacción mantendría el bloqueo abierto mientras se espera a un servidor
ajeno, y bloquearía al resto de clientes que intentan reservar ese mismo día.

La contrapartida es que la retención puede fallar con la reserva ya creada. Es
el orden correcto de todas formas: **perder una reserva ya aceptada es peor que
tener que pedir la tarjeta después.** Si el proveedor falla, la respuesta lleva
`payment: null`, la reserva queda en `PENDING_PAYMENT` y hay un error en los
registros con la referencia.

### Por qué la confirmación llega por webhook y no del navegador

El navegador puede cerrarse justo después de confirmar la tarjeta, perder la
conexión, o simplemente mentir. El aviso firmado del proveedor es la **única**
fuente fiable de que el dinero quedó retenido.

---

## 3. Estados

### Del pago (`payments.status`)

| Estado                    | Significado                                          |
| ------------------------- | ---------------------------------------------------- |
| `REQUIRES_PAYMENT_METHOD` | Falta la tarjeta                                     |
| `REQUIRES_CONFIRMATION`   | Hay tarjeta y falta confirmarla                      |
| `REQUIRES_ACTION`         | El banco pide verificar al titular (3D Secure)       |
| `PROCESSING`              | El banco aún está decidiendo                         |
| `REQUIRES_CAPTURE`        | **Autorizado.** Fondos retenidos, pendiente de cobro |
| `SUCCEEDED`               | Capturado (cobrado)                                  |
| `CANCELED`                | Retención liberada sin cobrar                        |
| `FAILED`                  | Rechazado                                            |

`REQUIRES_ACTION` y `PROCESSING` existen porque colapsarlos en
`REQUIRES_CONFIRMATION` haría que soporte leyera una situación distinta de la
real: «esperando al cliente» y «esperando al banco» no son lo mismo.

### De la reserva, según el depósito

| Evento del depósito              | Reserva                                      |
| -------------------------------- | -------------------------------------------- |
| `REQUIRES_CAPTURE` o `SUCCEEDED` | `PENDING_PAYMENT` → `CONFIRMED`              |
| `CANCELED` o `FAILED`            | `PENDING_PAYMENT` → `CANCELLED` (por SYSTEM) |

Solo se avanza **desde `PENDING_PAYMENT`**. Una reserva que ya empezó, se
completó o se canceló a mano no cambia porque llegue un aviso antiguo: los
eventos pueden llegar desordenados.

---

## 4. Seguridad del webhook

Es el punto más delicado del sistema: un endpoint **público y sin sesión que
puede confirmar reservas**. Si su firma no se verificase bien, cualquiera
podría reservar sin pagar.

| Medida                                           | Qué impide                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| Firma sobre el **cuerpo crudo**                  | Falsificar avisos. Sin el secreto compartido no se puede calcular la firma |
| Comprobación **antes** de tocar la base de datos | Que un evento no autenticado provoque escrituras                           |
| Comparación en tiempo constante                  | Deducir la firma correcta midiendo cuánto tarda la respuesta               |
| Respuesta siempre idéntica                       | Descubrir qué identificadores de pago existen probando eventos             |
| Idempotencia por `processedAt`                   | Que un reenvío duplique movimientos de dinero                              |
| Límite propio de peticiones                      | Inundar el endpoint, sin cortar las ráfagas legítimas del proveedor        |
| Techo de 64 KB en el cuerpo                      | Saturar el servidor con eventos enormes                                    |

### Por qué el cuerpo crudo

La firma se calcula sobre los **bytes exactos** que envió el proveedor. Volver
a serializar el JSON cambiaría el orden de las claves o los espacios y la firma
dejaría de cuadrar aunque el contenido fuese idéntico. Por eso la aplicación se
crea con `rawBody: true` y la lectura del cuerpo está centralizada en
`apps/api/src/common/body-parsers.ts`.

Ese archivo registra **dos lectores**, en orden:

1. El del webhook, con techo de 64 KB (un evento de pago trae el objeto
   completo del proveedor y no cabe siempre en el límite general).
2. El general, de 16 KB, que basta de sobra para una cotización (~1 KB).

### Idempotencia: por qué `processedAt` y no la clave primaria

El proveedor reenvía el mismo evento si no recibe un `2xx` a tiempo. La
tentación es usar la clave primaria de `webhook_events` como candado: si el
`INSERT` falla, es un duplicado.

El problema es qué pasa cuando el procesamiento **falla**. Con ese esquema la
fila ya está escrita, así que el reintento se tomaría por duplicado y el evento
se perdería para siempre.

Por eso un evento se considera procesado solo cuando tiene `processedAt`:

- Si ya lo tiene → se responde `200` sin hacer nada.
- Si el procesamiento falla → la transacción se deshace entera y el evento
  queda **sin marcar**, con el motivo anotado en `failureReason` (escrito
  fuera de la transacción), para que el siguiente reintento lo intente de
  verdad.

Dos entregas simultáneas del mismo aviso se serializan con
`pg_advisory_xact_lock`, igual que las reservas del mismo día.

---

## 5. Por qué la tabla no menciona a Stripe

`payments` nació con columnas `stripePaymentIntentId` y `stripeCustomerId`. Al
construir el módulo con adaptadores eso dejó de ser cierto: el simulador
también guarda movimientos ahí.

La migración `20260920190000_payments_provider_agnostic` las renombra a
`providerPaymentIntentId` / `providerCustomerId` y añade `provider`. La
unicidad pasa a ser del **par** `(provider, providerPaymentIntentId)`, porque
el simulador imita el formato `pi_...` de Stripe y el identificador por sí solo
no distingue nada.

Hay un test que falla si alguna columna vuelve a llamarse `stripe*`
(`migrations.test.ts`). Guardar un identificador del simulador en una columna
que dice «stripe» sería guardar un dato que miente sobre su origen.

---

## 6. Qué está probado

`pnpm --filter @freshness/api test` — 98 pruebas, incluidas:

**Contra PostgreSQL real** (PGlite sobre TCP, sin Docker) y peticiones HTTP
reales (`payments.e2e.test.ts`):

- la reserva devuelve sesión de pago y queda pendiente;
- el importe retenido es el que calculó el servidor, no el que mandó el
  navegador;
- el movimiento se guarda como retención (`amountCapturedCents = 0`), no como
  cobro;
- el aviso de depósito autorizado confirma la reserva y guarda marca y últimos
  cuatro dígitos;
- **el reenvío del mismo aviso no se reprocesa** — la prueba ensucia la fila a
  propósito para demostrar que se ignora de verdad, y no que simplemente
  reescribe lo mismo;
- un aviso sin firma → `401`, con firma inventada → `401`, y **no deja rastro
  en la base de datos**;
- no se puede confirmar una reserva ajena conociendo el identificador de pago;
- un aviso firmado sobre un pago desconocido → `200` sin efectos (pasa de
  verdad: la misma cuenta del proveedor usada por otro sistema);
- un depósito rechazado cancela la reserva y libera la franja.

**Del simulador** (`mock-payment.provider.test.ts`): firma válida, sin firma,
con otra clave, cuerpo manipulado después de firmar, y firma de longitud
distinta (que sin comprobación previa haría que `timingSafeEqual` lanzara y el
endpoint devolviera un `500` en vez de un `401`).

**De los límites de tamaño** (`body-parsers.e2e.test.ts`): un cuerpo por encima
del límite devuelve `413` y un JSON roto `400`, no `500`.

> Este último apareció al probar la API **compilada**, no en los tests: el
> error lo lanza el lector de Express y no es una excepción de Nest, así que el
> filtro lo dejaba caer al caso general. Importaba por dos motivos: al cliente
> se le decía que el fallo era del servidor cuando era suyo, y **un proveedor
> de pago que recibe un `500` reintenta para siempre** un evento que nunca
> vamos a aceptar.

También se verificó el flujo completo contra el binario de producción
(`node dist/main.js`) con PostgreSQL real: reserva → retención → firma
falsificada rechazada → firma válida confirma → reenvío ignorado.

---

## 7. Pendiente

| Tarea                                           | Etapa |
| ----------------------------------------------- | ----- |
| Formulario de reserva con el paso de tarjeta    | 2.2b  |
| Captura y devolución desde el panel             | 2.3   |
| Liberar franjas cuyo `holdExpiresAt` ya venció  | 2.3   |
| Reintentar la retención de una reserva sin pago | 2.3   |
| Cobro del importe final al terminar el servicio | 2.5   |
