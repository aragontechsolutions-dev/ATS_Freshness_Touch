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
(`docs/02-motor-de-precios.md` §5): **35 USD fijos**, y lo único que lo puede
bajar es que el trabajo entero cueste menos que eso.

Desde la Etapa 2.23 **no depende de la distancia**. La dependía —una base de
30 USD más las millas a la tarifa del IRS— y se separó en dos cosas que son
dos cosas: la garantía, que es igual para todos, y el traslado, que es una
línea del precio y se cobra por milla (`docs/21-modelo-de-operaciones.md`
§1.3 y §1.4). El depósito se sigue descontando del total: en una estándar
puntual de 185 USD se retienen 35 al reservar, se cobran 150 al terminar, y a
la cuenta llegan 185.

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

## 7. Cómo paga el navegador

### Con Stripe

El navegador recibe `payment.clientSecret` al crear la reserva y confirma la
tarjeta **directamente contra Stripe**, dentro de un marco servido por ellos.
Los datos de la tarjeta no pasan por nuestro código ni por nuestro servidor.

El éxito aquí es `requires_capture`, no `succeeded`: el depósito quedó
**retenido**, no cobrado. Esperar `succeeded` sería esperar algo que no va a
pasar hasta que termine el servicio.

Stripe.js se importa desde **`@stripe/stripe-js/pure`**, no desde la raíz del
paquete. El paquete normal descarga Stripe.js nada más cargarse el módulo,
aunque nunca se llegue a pagar: se detectó contactando con `js.stripe.com` con
el simulador activo y sin clave configurada. Además de innecesario,
contradecía la promesa del sitio de no cargar recursos externos.

La política de seguridad de contenido (`apps/landing/vercel.json`) permite lo
justo para que funcione:

| Directiva     | Añadido                                          | Por qué                                               |
| ------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `script-src`  | `https://js.stripe.com`                          | Stripe no permite alojar su script por nuestra cuenta |
| `connect-src` | `https://api.stripe.com`                         | Ahí envía el navegador los datos de la tarjeta        |
| `frame-src`   | `https://js.stripe.com https://hooks.stripe.com` | Los campos de la tarjeta viven dentro de ese marco    |

`Permissions-Policy` mantiene `payment=()`: solo se acepta tarjeta
(`payment_method_types: ['card']`), no monederos, así que la API de pago del
navegador no hace falta y se deja cerrada.

### Con el simulador

El simulador no tiene servidores, así que la API expone su equivalente:

```
POST /api/v1/payments/mock/confirm   { clientSecret, outcome }
```

Hace exactamente lo que haría Stripe: construye el evento y lo mete por el
**mismo** procesamiento que los webhooks auténticos, con su idempotencia y su
sincronización de la reserva. Lo que se prueba es el camino de verdad, no un
atajo. Admite `outcome: 'DECLINE'` para simular también el rechazo del banco,
que es el caso que nunca se prueba y siempre falla.

> 🔒 Con `PAYMENT_PROVIDER=stripe` esta ruta responde **404**, indistinguible
> de una ruta que no existe: no revela siquiera que el sistema tiene un modo
> simulado. Hay un test dedicado que lo comprueba
> (`mock-payments-disabled.e2e.test.ts`), porque si algún día respondiera sería
> una puerta para confirmar reservas sin pagar.

La interfaz avisa de que el pago es simulado con un aviso imposible de pasar
por alto: nadie debe creer que ha pagado algo.

---

## 8. Devolver dinero ya cobrado

> Etapas 3.21 y 3.24.

### Devolver y liberar no son lo mismo, y confundirlos se nota en el extracto

| Operación    | Sobre qué                    | Qué ve el cliente                |
| ------------ | ---------------------------- | -------------------------------- |
| **Liberar**  | Una retención **no** cobrada | Nada: los fondos se desbloquean  |
| **Devolver** | Un cobro ya hecho            | Un abono junto al cargo que hubo |

Son dos botones distintos y miran estados distintos: liberar exige
`REQUIRES_CAPTURE`, devolver exige `SUCCEEDED`. Si se pudiera «devolver» una
retención viva, el cliente vería un cargo y un abono por un dinero que nunca
salió de su cuenta, y llamaría a preguntar — con razón.

### Qué se puede devolver

**Los dos cobros de una reserva**, y son dinero distinto:

| Movimiento                    | Qué es                                             | Cuándo se devuelve                               |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| **Depósito** (`DEPOSIT_HOLD`) | Los 35 $ del viaje, cobrados porque algo salió mal | Se resolvió a favor del cliente                  |
| **Saldo** (`FINAL_CHARGE`)    | Los 150 $ del trabajo, cobrados al terminar        | La limpieza no quedó bien, un descuento acordado |

La petición lleva un `target` (`DEPOSIT` por defecto, que es lo único que se
podía devolver antes de la etapa 3.24), y cada uno queda auditado con **su
propia acción**: `payment.refunded` y `payment.balance_refunded`. No es
puntillismo: «te devolvemos el viaje» y «te devolvemos la limpieza» son dos
conversaciones distintas, y a fin de mes se preguntan por separado. Con una
sola acción habría que leer importes para distinguirlas.

Las reglas son **las mismas para los dos** —el motivo obligatorio, el límite
contra lo que queda, que un rechazo no se apunta—, y por eso es un método y
no dos.

### Hasta dónde se puede devolver

Lo decide **`refundableCents`**, en `packages/types/src/payment.ts`:

```
devolvible = SUCCEEDED ? max(0, cobrado − ya devuelto) : 0
```

Vive en el contrato compartido porque **lo usan los dos lados**: el panel para
apagar el botón y el servidor para rechazar la petición. Escrito dos veces,
acabarían discrepando y el síntoma sería un botón que no hace nada.

El límite se mide contra **lo que queda**, no contra lo cobrado: con dos
devoluciones de 20 $ sobre un cobro de 35 $, la segunda falla aunque 20 sea
menor que 35.

### Dónde se apunta: en la misma fila, no en una nueva

`amountRefundedCents` del depósito, con **`increment` de la base de datos** y
no con una suma calculada en el servidor: dos devoluciones a la vez leerían el
mismo valor y la segunda pisaría a la primera, dejando dinero que se podría
devolver otra vez.

**No se crea una fila `payments` por devolución**, igual que no se crea al
cobrar ni al liberar. El panel lee `payments[0]` del depósito; una fila nueva
se colaría en ese primer puesto y la pantalla dejaría de contar lo que pasó.
Por eso `PaymentKind.REFUND` sigue en el enumerado **sin usarse**: se dejó ahí
en la etapa 2.4 y tendrá sentido el día que se cobre el importe final, que sí
es otro movimiento.

**No hay migración**: `amountRefundedCents` existe desde la etapa 2.4. El
cuándo y el quién los responde la auditoría.

### La clave de idempotencia, que es la pieza delicada

Tiene que cumplir dos cosas que tiran en direcciones opuestas:

- **Un reintento no puede devolver dos veces.** Si la petición llegó al
  proveedor y la respuesta se perdió, el segundo intento debe recibir la misma
  devolución.
- **Dos devoluciones parciales distintas sí son dos.** Con una clave que solo
  mirase (pago, importe), devolver 10 $ hoy y otros 10 $ mañana haría que la
  segunda se convirtiera en silencio en la primera: el cliente recibiría 10 y
  nuestra tabla diría 20.

Lo que las distingue es **cuánto se había devuelto ya**, y por eso entra en la
clave: `sha256("refund:" + intentId + ":" + importe + ":" + yaDevuelto)`.

### Tres decisiones del lado de Stripe

- **Se manda siempre `requested_by_customer`.** Stripe solo admite tres
  motivos enlatados, y marcar una devolución como `fraudulent` alimenta sus
  modelos de riesgo y puede acabar bloqueando tarjetas de clientes que no han
  hecho nada.
- **El motivo escrito por administración no sale de aquí.** Es texto libre y
  puede nombrar al cliente o contar lo que pasó en su casa. Vive en nuestra
  auditoría.
- **`pending` cuenta como devuelto.** Con algunas tarjetas el abono tarda días
  en aparecer, pero el proveedor ya se ha comprometido y el dinero sale de la
  cuenta de la empresa igual. Tratarlo como fallo llevaría a devolverlo dos
  veces. Queda anotado en la auditoría para que soporte sepa explicar por qué
  el cliente aún no lo ve.
- **Una devolución rechazada (`FAILED`) no se apunta** y responde `409`.
  Apuntarla dejaría a la empresa creyendo que devolvió un dinero que sigue en
  su cuenta, y al cliente esperando un abono que no va a llegar.

### Seguridad

- **Solo `ADMIN`.** Coordinación mueve la agenda, no el dinero. Que vaya en la
  dirección contraria no lo hace inocuo: sale de la empresa.
- **Motivo obligatorio** (3 a 500 caracteres), y la acción queda en la
  auditoría como `payment.refunded`, con importe, motivo y si quedó pendiente.
- **Ni el identificador del cobro ni el de la devolución entran en la
  auditoría ni en los registros del servidor**, igual que en el resto del
  módulo: son credenciales, no información. Hay una prueba que lo comprueba
  buscando `pi_mock` y `re_mock` en todo lo auditado.
- **La llamada al proveedor va fuera de la transacción**, como el cobro y la
  liberación: mantener filas bloqueadas esperando a un servidor ajeno es lo
  que convierte un día con incidencias en una base de datos atascada.

### Qué se comprueba

**11 pruebas del contrato** (`packages/types/src/payment.test.ts`), **7 de la
conversión del importe** (`apps/admin/src/lib/devolucion.test.ts`), **3 del
simulador** y **11 contra PostgreSQL real** (`admin-access.e2e.test.ts`):

| Prueba                                                           | Qué protege                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Una retención sin cobrar no se devuelve (`409`)                  | Que no aparezca un abono por un dinero que no salió                 |
| Coordinación recibe `403`                                        | Quién puede devolver dinero                                         |
| No se puede devolver más de lo cobrado (`400`)                   | Lo obvio                                                            |
| **La segunda devolución se suma, no pisa a la primera**          | El fallo que más cuesta ver: dinero devolvible dos veces            |
| El límite se mide contra lo que queda                            | Lo mismo, por el otro lado                                          |
| Sin importe se devuelve todo lo que quede                        | El caso más habitual                                                |
| Después ya no queda nada (`409`)                                 | Que no se pueda devolver en bucle                                   |
| La auditoría no contiene `pi_mock` ni `re_mock`                  | Que una credencial no acabe en una pantalla                         |
| La devolución **no crea filas de pago nuevas**                   | Que el panel siga leyendo el depósito en `payments[0]`              |
| «12abc» y «1,5» no se interpretan a medias                       | `parseFloat` daría 12 y 1: el segundo devolvería 1 $ en vez de 1,50 |
| **El saldo se devuelve en SU movimiento, sin tocar el depósito** | Etapa 3.24: son dos cobros distintos                                |
| El saldo queda con su propia acción en la auditoría              | Que se puedan contar por separado                                   |
| Un destino inventado se rechaza                                  | El contrato es estricto también aquí                                |

### Lo que NO hace

- **No avisa al cliente por correo desde nuestro sistema.** Un aviso propio
  exigiría un valor nuevo en el enumerado de avisos —y con él una migración— y
  se decidió dejarlo para cuando haga falta de verdad.

  **Y NO SE PUEDE DAR POR HECHO QUE LO AVISE STRIPE.** Manda su propio recibo
  de devolución solo si está encendido en _Settings → Customer emails → Email
  customers about → **Refunds**_, y **en modo de prueba no manda ninguno**
  (ahí se envía a mano desde su panel). Con ese ajuste apagado, hoy el cliente
  no recibe nada: se le dice por teléfono o por WhatsApp. Conviene encenderlo
  antes de devolverle dinero a alguien de verdad.

- **No se entera de una devolución hecha desde el panel del proveedor.** Si
  alguien devuelve dinero desde Stripe en vez de desde aquí, nuestra tabla no
  lo sabe. Lo que sí está cubierto es el rechazo: ver §8 bis.
- **No devuelve una propina.** `TIP` sigue en el enumerado sin usarse: no hay
  propinas todavía.

---

## 8 bis. Cuando el proveedor acaba rechazando la devolución

> Etapa 3.22.

Una devolución aceptada **puede caer días después**: tarjeta caducada o
perdida, cuenta cerrada, el banco que la rechaza. Cuando pasa, el dinero se
queda en la cuenta de la empresa y el cliente sigue esperándolo.

Hasta esta etapa, ese aviso entraba y **no hacía nada**: `parseWebhook` solo
traducía objetos `payment_intent` y devolvía `payment: null` para todo lo
demás, así que el webhook respondía 200 y se olvidaba. El resultado era el
peor posible: la empresa creyendo que devolvió un dinero que seguía en su
cuenta.

### Qué llega, y qué hay que suscribir

El evento es **`refund.failed`**. `charge.refund.updated` era el de antes y
está **obsoleto**: desde la versión de API `2024-10-28` los eventos de
devolución son `refund.created`, `refund.updated` y `refund.failed`, y valen
para todas las devoluciones.

> ⚠️ **Paso de configuración, no de código.** En Stripe → Developers →
> Webhooks hay que añadir `refund.failed` a los eventos del endpoint. Sin eso
> el aviso no llega aunque el código sepa procesarlo. Ver `docs/08` §2.

### Qué hace ahora

1. **Deshace el apunte.** `amountRefundedCents` significa «dinero que de
   verdad salió»; si la devolución falló, ese dinero sigue aquí. Dejarlo
   quieto haría que el panel dijera «devuelto 20 $» de algo que no se
   devolvió, y **además impediría volver a intentarlo**, porque de ahí sale lo
   que queda por devolver.
2. **Marca la fila**: `lastErrorCode = 'refund_failed'` y el motivo técnico
   del proveedor en `lastErrorMessage` (columnas de la etapa 2.4: sin
   migración). El panel pinta un aviso en rojo en la tarjeta de pago. La marca
   **se limpia sola** en cuanto una devolución posterior sale bien.
3. **Avisa por Telegram**, que es la parte que de verdad arregla la situación:
   nadie entra en el panel de Stripe un martes por la tarde sin un motivo.

```sql
UPDATE payments
SET "amountRefundedCents" = GREATEST(0, "amountRefundedCents" - $1), ...
```

**Una sola sentencia, con `GREATEST`.** Leer y luego escribir la resta serían
dos pasos, y dos avisos a la vez —que es justo cuando esto ocurre— podrían
leer el mismo número y restar una sola vez. El `GREATEST` evita además que un
importe descuadrado deje el contador en negativo, que haría ofrecer más de lo
que se cobró.

### A quién se avisa, y por qué no al chat técnico

**A operaciones primero; al técnico solo si no hay chat de operaciones.** Es
al revés que la alarma de estado de la etapa 3.12, y a propósito: aquello es
«el sistema está roto» y lo arregla quien programa; esto es «hay que
devolverle 20 dólares a una persona por otra vía», y eso lo hace quien lleva
el negocio.

El importe **sí** va en el mensaje: es un destino interno y sin la cifra el
aviso no sirve para actuar. Lo que no va, aquí tampoco: ni datos de la
tarjeta, ni el identificador del cobro, ni el de la devolución.

El aviso **no puede tumbar el webhook**: va fuera de la transacción y dentro
de un `try`. Si Telegram falla, el apunte ya está hecho y queda en el registro
del servidor.

### Qué se comprueba

**7 pruebas contra PostgreSQL real** y **5 del traductor del simulador**:

| Prueba                                                     | Qué protege                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Una devolución que va bien no cambia nada                  | Que un `refund.updated` normal no deshaga un apunte correcto         |
| **Una rechazada deshace el apunte y marca la fila**        | El punto de la etapa                                                 |
| **El reenvío del mismo aviso no vuelve a restar**          | El proveedor reenvía; sin idempotencia el contador acabaría negativo |
| Nunca baja de cero                                         | Que `refundableCents` no ofrezca más de lo que se cobró              |
| Un aviso de una devolución que no es nuestra no revienta   | La misma cuenta del proveedor usada por otro sistema                 |
| Sin firma válida no se procesa                             | Es el mismo endpoint público de siempre                              |
| **El aviso de devolución NO cancela la reserva**           | `failed` de una devolución no es `FAILED` de un pago                 |
| Un aviso de devolución no se traduce como pago, y al revés | Lo mismo, en el traductor                                            |

---

## 9. Cobrar el saldo final

> Etapa 3.23.

El depósito son **35 dólares de una limpieza de 185**. Hasta esta etapa los
otros 150 se cobraban **fuera del sistema**: a mano, por otro medio, sin
quedar escritos en ninguna parte. Esta es la etapa que convierte esto en algo
que cobra de verdad.

### Las dos decisiones de producto, y quién las tomó

| Decisión            | Lo elegido                                                      |
| ------------------- | --------------------------------------------------------------- |
| **Cuándo se cobra** | Un **botón de administración**, con el trabajo ya terminado     |
| **Con qué tarjeta** | La que el cliente dejó al reservar, **guardada y avisándoselo** |

Lo decidió la dirección de la empresa. La primera descarta cobrar
automáticamente al marcar COMPLETADA: **nada se cobra sin que una persona lo
mire**, y así los ajustes de campo —que re-tarifican la reserva— están
resueltos antes de tocar la tarjeta.

### Qué cambia al reservar

La retención del depósito pasa a crear un **cliente** en el proveedor y a
pedir `setup_future_usage: 'off_session'`, que es lo que hace que la tarjeta
quede guardada. La referencia (`pm_...`) se guarda en
`payments.providerPaymentMethodId` cuando el cliente confirma, no antes.

**Y se le dice al cliente, en el paso de pago y no en la letra pequeña:**

> «Guardamos esta tarjeta para cobrar los 150 $ restantes cuando terminemos tu
> limpieza. No se le cobra nada más, y puedes pedirnos que la quitemos cuando
> quieras.»

Sin esa línea, el primer cobro del saldo sería una sorpresa en el extracto de
alguien, y una sorpresa en un extracto acaba en una reclamación al banco —que
cuesta dinero y reputación— en vez de en una llamada.

### Las cuatro puertas antes de cobrar

1. **Solo `ADMIN`.** Coordinación mueve la agenda, no el dinero.
2. **Solo con el trabajo `COMPLETED`.** Cobrar antes convierte cualquier
   incidencia en una devolución, que es más cara y más lenta que no haber
   cobrado todavía.
3. **Solo si queda saldo.** `chargeableBalanceCents` lo decide, y vive en el
   contrato compartido como `refundableCents`: el panel apaga el botón con la
   misma función con la que el servidor rechaza la petición. **Un cobro en
   curso (`PROCESSING`) bloquea igual que uno hecho**: el banco todavía no ha
   dicho que sí, pero tampoco que no, y reintentar mientras tanto es la forma
   más fácil de cobrarle dos veces a una persona. **Uno rechazado no bloquea**:
   el saldo se sigue debiendo.
4. **Solo con tarjeta guardada.** Las reservas anteriores a esta etapa no la
   tienen, y el panel lo dice con esas palabras: no es un fallo del sistema,
   es que a esa persona hay que cobrarle por otra vía.

Además, la clave de idempotencia sale de `(reserva, importe)`: pulsar el botón
dos veces porque la pantalla tardó **no cobra dos veces**.

### Una fila nueva, no un cambio de estado

Al contrario que el cobro del depósito o una devolución, aquí **sí** se crea
una fila `payments` con `kind: 'FINAL_CHARGE'`. Es otro movimiento, con su
propio identificador en el proveedor y su propio estado, y es para lo que ese
valor existía en el enumerado desde la etapa 2.4. El panel las separa por
`kind`, así que el depósito sigue leyéndose donde siempre.

### Cuando la tarjeta no pasa

Cobrar **sin el cliente delante** cambia cómo se falla, y el panel distingue
dos casos porque la salida es distinta:

| Qué pasó                                      | Qué dice el panel                                     |
| --------------------------------------------- | ----------------------------------------------------- |
| `authentication_required` (el banco pide 3DS) | «Mándale un enlace de pago»: no hay a quien preguntar |
| Cualquier otro rechazo                        | «La tarjeta fue rechazada»: habla con el cliente      |

**Un rechazo no es un error del servidor**: responde `409`, no `500`. Y **no
se apunta nada** si el proveedor rechaza, igual que con las devoluciones: la
fila se crea solo cuando el cobro existe de verdad. El mensaje del proveedor
se queda en el registro del servidor, nunca llega al navegador.

### Qué se comprueba

**5 pruebas del contrato** y **7 contra PostgreSQL real**:

| Prueba                                               | Qué protege                                           |
| ---------------------------------------------------- | ----------------------------------------------------- |
| No se cobra un trabajo sin terminar                  | La puerta número 2                                    |
| Coordinación recibe `403`                            | Quién mueve dinero                                    |
| Sin tarjeta guardada se dice **por qué**             | Que no parezca un fallo del sistema                   |
| **No se cobra dos veces**                            | El fallo más caro que puede tener este sistema        |
| Un cobro en curso bloquea; uno rechazado no          | Que ni se cobre doble ni se olvide un saldo pendiente |
| El saldo se guarda como movimiento **aparte**        | Que el depósito siga leyéndose donde siempre          |
| La auditoría no contiene `pi_`, `pm_` ni `cus_`      | Que una credencial no acabe en una pantalla           |
| El detalle dice que hay tarjeta **sin enseñar cuál** | Lo mismo, en la API                                   |

### Lo que NO hace

- ~~**No devuelve el saldo.**~~ Lo hace desde la etapa 3.24: ver §8.
- **No cobra solo.** Es un botón, a propósito (ver arriba).
- **No reclama a quien no se le pudo cobrar.** No hay recordatorios ni
  reintentos automáticos: el saldo se queda pendiente y visible en la reserva.

---

## 10. Lo que NO está verificado

Honestidad sobre el alcance de las pruebas:

- **El pago real con Stripe no se ha probado con credenciales.** El código está
  escrito y compila, y degrada correctamente cuando no hay clave (muestra el
  teléfono en vez de romperse), pero **una confirmación de tarjeta real no se
  ha ejecutado nunca**. Antes de cobrar a un cliente hay que recorrer el flujo
  con las tarjetas de prueba de Stripe (`4242 4242 4242 4242` para el camino
  feliz, `4000 0000 0000 0002` para un rechazo, `4000 0025 0000 3155` para
  3D Secure).
- Todo lo demás de este documento está probado, y la sección 6 dice con qué.

---

## 11. Pendiente

| Tarea                                              | Etapa |
| -------------------------------------------------- | ----- |
| Probar el pago real con credenciales de Stripe     | 2.2c  |
| ~~Captura desde el panel~~ — hecho                 | 2.3   |
| ~~Devolución desde el panel~~ — hecho (§8)         | 3.21  |
| ~~Cobro del saldo final al terminar~~ — hecho (§9) | 3.23  |
| ~~Devolver un cobro final~~ — hecho (§8)           | 3.24  |
| Liberar franjas cuyo `holdExpiresAt` ya venció     | 2.3   |
| Reintentar la retención de una reserva sin pago    | 2.3   |
