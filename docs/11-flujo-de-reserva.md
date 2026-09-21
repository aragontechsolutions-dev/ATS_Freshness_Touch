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

El **horario comercial** ya no está en esta tabla: se guarda en
`business_settings` y se edita desde el panel, y el motor de agenda lo lee en
cada petición (ver `docs/13-panel-y-permisos.md` §12). El resto de valores
sigue en el código a propósito: cambiarlos altera lo que el sistema le promete
al cliente.

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

---

## El formulario del sitio web (bloque 2.2b)

> **Estado:** terminado y verificado en navegador real con el proveedor de pago
> simulado. La ruta de Stripe está implementada pero **no probada con
> credenciales reales** (ver `docs/12-pagos-y-deposito.md`, sección 8).

### Por qué tres pasos y no uno

El formulario completo tiene más de quince campos. En un móvil eso es una
pared. Se parte en tres pantallas con una barra de progreso, porque saber
cuánto queda reduce el abandono más que cualquier otro detalle:

| Paso | Qué pide                         | De dónde sale lo que no pregunta  |
| ---- | -------------------------------- | --------------------------------- |
| 1    | Día y hora                       | El trabajo viene del cotizador    |
| 2    | Dirección completa y contacto    | El código postal viene precargado |
| 3    | Tarjeta (retención del depósito) | El importe lo calcula el servidor |

Nada de lo que el cliente ya respondió en el cotizador se vuelve a preguntar.

### `<dialog>` nativo, no un `div` a medida

El navegador ya trae atrapado del foco, cierre con `Escape` e inercia del
fondo. Reimplementarlo a mano sale casi siempre mal para quien navega con
teclado o con lector de pantalla.

Verificado en Chromium: intentar enfocar o escribir en un campo de la página de
detrás no hace nada, y el foco nunca sale del diálogo por más que se tabule.

### El trabajo se congela al abrir

Si el cliente tocara el cotizador con el diálogo abierto, la franja que ya
eligió podría dejar de encajar en la nueva duración y acabaría reservando algo
distinto de lo que vio. El servicio, el tamaño y los extras se copian al abrir
y no cambian hasta cerrar.

### Franjas ocupadas: se muestran, no se esconden

Una franja que no se puede reservar aparece igualmente, tachada y con el motivo
(sin equipo libre, demasiado pronto, no da tiempo ese día). Ocultarla dejaría un
hueco inexplicable en la rejilla y la sensación de que la empresa no trabaja a
esa hora, cuando lo que pasa es que ya está ocupada.

El motivo va en el nombre accesible del botón, no solo en el color: quien usa
lector de pantalla no ve el tachado.

### Los extras viajan en la URL en formato compacto

`?addOns=INSIDE_OVEN:1,LAUNDRY:2`

Express 5 analiza la cadena de consulta en **modo simple** y no entiende la
notación con corchetes (`addOns[0][code]=...`). Un array de objetos se perdía
en silencio: la duración estimada salía corta y se ofrecían franjas en las que
el trabajo no cabe, dejando al equipo trabajando fuera de horario.

Hay un test que compara la duración con y sin extras, y otro que comprueba que
un extra inexistente se **rechaza** en vez de ignorarse.

### Validación: para el usuario, no para la seguridad

La del navegador avisa antes de enviar; la que cuenta es la del servidor, que
vuelve a validar todo con el mismo esquema estricto. Todos los campos que
faltan se señalan **a la vez**: avisar de uno en uno obliga a enviar el
formulario cinco veces.

El teléfono se formatea mientras se escribe (`(404) 555-0123`), así el propio
campo enseña cuántos dígitos faltan. Se exigen 10 dígitos (u 11 con prefijo de
país) porque el error más común es dejarse uno, y sin teléfono correcto la
empresa no puede avisar de un retraso.

El correo se valida de forma **deliberadamente permisiva**: rechazar una
dirección válida pierde un cliente, y aceptar una dudosa como mucho rebota.

### Tres desenlaces, y ninguno se disfraza de otro

| Desenlace     | Qué pasó                                   | Qué ve el cliente                                  |
| ------------- | ------------------------------------------ | -------------------------------------------------- |
| **Confirmed** | Depósito retenido                          | Referencia, fecha, dirección e importes            |
| **Pending**   | La reserva existe, la retención no arrancó | Que no está confirmada y el teléfono para cerrarla |
| **Declined**  | El banco rechazó la tarjeta                | Que la franja quedó libre y puede reintentar       |

> **No se promete ningún correo de confirmación.** Los avisos automáticos son
> de la Etapa 2.5. Anunciar un correo que no llega genera llamadas de clientes
> preocupados, así que el texto dice lo que la empresa sí puede cumplir hoy:
> que llamará al teléfono indicado.

### Carga diferida

El diálogo (con el componente de pago dentro) se descarga solo cuando alguien
pulsa «Reservar»: son 31 KB que la mayoría de las visitas nunca necesita. La
portada abre antes para todo el mundo.
