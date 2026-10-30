# 48 — Mover la cita

> Etapa 3.32. Tapa el hueco **B4** de `docs/43-los-huecos-que-quedan.md`: la
> operación que el sitio promete por escrito y que el panel no sabía hacer.
>
> Código: `packages/types/src/reschedule.ts`,
> `BookingActionsService.reschedule`,
> `apps/admin/src/components/MoverCita.tsx`, migraciones
> `20261030100000_mover_la_cita` y `20261030100100_mover_la_cita_avisos`.

---

## 1. Lo que había antes no era un atajo incómodo: era otra cosa

Hasta esta etapa, reprogramar una cita se hacía **cancelando y creando otra**.
Y eso no es mover una cita:

- **Se pierde el historial.** Donde hubo un servicio quedan dos filas, una
  cancelada y una nueva, y la del medio —la que explica por qué— no existe en
  ninguna parte.
- **Cambia la referencia.** El cliente tiene por escrito `FT-2026-0041` y la
  cita que de verdad va a ocurrir es la `FT-2026-0052`. Eso es una llamada de
  teléfono confusa garantizada.
- **Se rehace el precio.** La cita nueva se tarifa con las tarifas de hoy, no
  con las que se pactaron.
- **Hay que decidir qué hacer con la retención.** Cancelar no toca el dinero
  —a propósito, `docs/12`— así que quedan 35 dólares bloqueados en una tarjeta
  y una cita nueva sin depósito.

Y es la operación que más se va a pedir, porque es la que el sitio promete:

> «Contact us at least 24 hours before your appointment and we will move it at
> no cost. Within 24 hours, or once our team is on the way, we charge the $35
> deposit and nothing more.» (`faq.q6`)

A partir de aquí **la fila es la misma y lo que cambia son dos columnas**.

---

## 2. Qué se mueve y qué no

| Cosa                       | Qué le pasa al mover                                         |
| -------------------------- | ------------------------------------------------------------ |
| `scheduledStart` / `End`   | Cambian. La **duración se conserva**                         |
| Referencia                 | La misma                                                     |
| Precio y desglose          | Los mismos. No se re-tarifa nada                             |
| Pagos y retención          | Los mismos. **No se cobra ni se devuelve nada**              |
| Estado                     | El mismo                                                     |
| Equipo asignado            | Se queda. Si ahora choca, se avisa a la bandeja              |
| Recordatorio de la víspera | **Se re-arma**: ver §5                                       |
| Ocurrencia de la serie     | **No se mueve**: ver §4                                      |
| Pin de la puerta           | Caduca 24 h después del final, que se calcula: se mueve solo |

### Desde qué estados

`PENDING_PAYMENT` y `CONFIRMED`, y ninguno más.

**`IN_PROGRESS` no**: el equipo está dentro de la casa. Mover una cita que ya
está pasando no es mover nada, es inventarse que no ha pasado. **Los finales
tampoco**, por el mismo motivo que `BOOKING_TRANSITIONS` los deja sin salida:
el histórico tiene que seguir contando lo que de verdad pasó.

---

## 3. Mover no cobra, y es la frontera entera de la etapa

El servidor **sabe** si el movimiento llega con menos de 24 horas
(`isLateReschedule`), lo **anota** en el registro de actividad (`late: true`) y
**no toca la tarjeta de nadie**.

Son dos decisiones, igual que al cancelar:

| Quién          | Puede                                           |
| -------------- | ----------------------------------------------- |
| Coordinación   | Mover la agenda. Es quien habla con el cliente  |
| Administración | Cobrar el depósito, con el botón que ya existía |

Si mover cobrara, **quien lleva la agenda estaría cobrándole a un cliente sin
pulsar nunca un botón de cobro**, y esa línea de permisos se habría roto sin
que nadie cambiara una sola anotación.

### El aviso se pinta ANTES de mover

Y por eso el cálculo de las 24 horas vive también en el panel. Que el servidor
lo anote no le sirve de nada a quien está al teléfono: para entonces ya está
hecho. Lo que hace falta es saberlo **mientras se decide**, porque cambia lo
que se le dice al cliente en esa llamada.

A quien no es administración se le dice además a quién avisar: el botón de
cobrar no está en su pantalla, y si nadie se lo cuenta, nadie lo cobra.

### El motivo es obligatorio en dos casos, y uno no lo sabe el esquema

`AdminRescheduleSchema` exige el motivo en cuanto se salta una norma —fuera de
horario, doblar un equipo— igual que al crear una cita a mano. Pero el otro
caso, **que el movimiento llegue tarde**, depende de cuándo era la cita vieja,
y eso solo lo sabe el servidor.

Así que esa mitad de la regla vive en el servicio. Es la misma decisión que se
tomó con la aceptación de los textos legales (`docs/44` §4): la regla va donde
está el dato, no donde queda más bonita.

---

## 4. La trampa de la serie, que habría duplicado citas

**Es lo más importante de esta etapa y no tiene nada que ver con mover.**

El barrido de las series decide qué citas faltan comparando las fechas del
calendario con las de las citas que ya existen:

```
yaCreadas = fechas de scheduledStart de las reservas de la serie
```

Con eso, mover la cita del **martes 3** al **jueves 5** hace que el martes 3
deje de estar cubierto. En la siguiente pasada —una hora después— el barrido
**crea otra cita el martes 3**, y la clienta acaba con dos citas esa semana: la
que pidió mover y una recién nacida en el hueco que acababa de dejar.

La causa es confundir dos cosas distintas:

- **qué día le tocaba** en el calendario de la serie, y
- **cuándo se va a hacer** de verdad.

Mientras no se mueve nada son el mismo día, y por eso el error no se veía.

`bookings.seriesOccurrenceDate` guarda la primera, y **es inmutable**: la cita
se puede mover tres veces y sigue siendo la del martes 3.

Hay dos pruebas en `series.e2e.test.ts`, y la primera se comprobó al revés
—volviendo el barrido a comparar por `scheduledStart`— para verificar que de
verdad caza el fallo: **sin la columna, aparece una cuarta cita**.

---

## 5. El recordatorio de la víspera se re-arma

El barrido del recordatorio busca reservas **sin** una fila `BOOKING_REMINDER`
enviada. Si la cita del martes ya recibió su recordatorio y se mueve a la
semana siguiente, esa fila la deja fuera para siempre: el cliente se queda sin
aviso de **la fecha nueva**, que es justo la que no tiene en la cabeza.

Por eso al mover **se borra esa fila**.

**La contrapartida, que hay que saber:** se pierde la constancia de que aquel
recordatorio salió. Se acepta porque un recordatorio de un día que ya no existe
no es prueba de nada útil, mientras que el correo de la fecha nueva —ese sí se
conserva— cuenta lo que de verdad pasó. Queda anotado en la auditoría con
`reminderReset`.

---

## 6. El correo de la fecha nueva

`BOOKING_RESCHEDULED`, y es el más importante de los cuatro que se le mandan a
un cliente. Una confirmación que no llega se nota al día siguiente; un
recordatorio que no llega cuesta una ausencia. **Una cita que cambia de hora
sin que el cliente lo sepa es una casa vacía cuando llega el equipo**, o alguien
esperando una mañana entera.

Tres decisiones:

1. **Lleva las dos fechas.** Decir solo la nueva obliga a quien lo lee a
   recordar la vieja para entender que ha cambiado algo, y lo normal es que no
   la recuerde.
2. **No lleva el motivo.** Lo escribe el equipo para el registro —«el equipo
   está en otro trabajo»— y es una nota interna. Misma regla que la
   cancelación.
3. **No tiene interruptor global.** Los otros tres se pueden apagar en los
   ajustes porque un negocio puede decidir que no quiere mandar
   confirmaciones. Este no: sería una casilla que alguien desmarca una tarde y
   que empieza a costar dinero meses después. Donde sí se decide es en cada
   movimiento (`notifyCustomer`), para la clienta de siempre que lo acaba de
   pactar por teléfono y no usa el correo.

### Y se puede repetir

Una cita se mueve del martes al jueves, y el jueves vuelve a moverse al sábado.
Los dos correos son correctos y el segundo hace más falta que el primero.

`notifications_unicidad_envio` lo impedía: el segundo envío chocaba con el
índice **después** de que el correo ya hubiera salido, dejando al cliente
avisado y al registro diciendo que no. La migración `20261030100100` saca este
evento del índice, igual que ya estaba fuera `JOB_ASSIGNED` y por el mismo
motivo.

---

## 7. El hueco se comprueba de verdad

La única comprobación dura es la misma que al crear una cita a mano: **¿hay
equipo libre?** Se salta marcando «aunque todos los equipos estén ocupados»,
que exige escribir por qué. El horario y la antelación mínima no se comprueban,
igual que en la reserva manual: son suposiciones razonables sobre un
desconocido y ninguna lo es sobre quien mira su propia agenda.

### La cita no choca consigo misma

El detalle que no se ve venir, y el que más cerca estuvo de colarse.

Mover la cita de las 9:00 a las 10:00 del mismo día se compara con los
intervalos ocupados de ese día, y uno de esos intervalos **es el suyo viejo**,
que todavía está en la base. Con los equipos justos, el movimiento se
rechazaba por falta de equipo. **El equipo que faltaba era el suyo.**

`findOccupied` admite ahora una reserva que no cuenta como ocupada. Hay una
prueba dedicada.

### Y el cliente no acaba con dos citas a la misma hora

Hay un índice único parcial sobre `(customerId, scheduledStart)` para las no
canceladas (migración `20260920180000`). Sin comprobarlo antes, el movimiento
reventaba contra el índice y salía un **500 genérico** donde lo que hay es un
caso perfectamente entendible: la clienta de siempre ya tenía otra cita ese día
a esa hora.

---

## 8. Repaso de seguridad

| Riesgo                                              | Cómo queda                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Que coordinación acabe cobrando una tarjeta         | Mover no cobra. `@Roles('ADMIN','DISPATCHER')` para mover, `ADMIN` para cobrar             |
| Que limpieza mueva citas                            | 403. Prueba propia                                                                         |
| Que se mueva sin sesión                             | 401. Prueba propia                                                                         |
| Re-tarifar por la puerta de atrás                   | `AdminRescheduleSchema` es estricto y **no** acepta `priceOverrideCents`. Prueba propia    |
| Cambiar el estado, el cliente o la casa al mover    | Mismo esquema estricto: solo pasan cinco campos. Prueba propia                             |
| Mover lo que ya empezó o terminó                    | `canReschedule`, y el servidor lo vuelve a comprobar                                       |
| Mover a una fecha pasada                            | `assertDateInRange`, la misma guardia del cotizador público                                |
| Dos equipos en la misma franja sin que nadie lo vea | Choque de equipos comprobado; saltarlo exige motivo escrito                                |
| Una persona con dos trabajos a la vez, en silencio  | Aviso `booking.team_clash` a coordinación. No se desasigna a nadie                         |
| Que el cliente no se entere                         | Correo encendido por defecto; al apagarlo, aviso en pantalla                               |
| Datos de cliente en la auditoría                    | Solo la referencia y las dos fechas. Prueba que busca nombre, dirección, correo y teléfono |
| Datos de cliente en la bandeja                      | Cuántas personas chocan y la hora. Nada más                                                |
| Movimientos tardíos sin rastro                      | `late: true` y el motivo obligatorio en la fila de auditoría                               |
| Carrera entre dos personas moviendo a la vez        | `pg_advisory_xact_lock` por día, el mismo que usa crear                                    |

---

## 9. Lo que esta etapa NO hace

- **No cobra el depósito en un movimiento tardío.** Lo señala y lo anota; el
  cobro lo decide administración. **Y queda una pregunta de negocio abierta**:
  si se cobra el depósito como penalización, la cita movida se queda sin
  depósito retenido para su nueva fecha. Hoy eso es una decisión de la dueña
  caso por caso; el día que haya una regla, se escribe aquí.
- **No deja al cliente mover su propia cita.** Sigue siendo una llamada o un
  WhatsApp. Eso es **C1** en `docs/43`, y necesita antes que el cliente tenga
  algún sitio donde entrar.
- **No mueve una serie entera.** Mueve una cita de la serie. Pausar o
  reprogramar la serie completa ya se puede desde su propia pantalla
  (`docs/42`).
