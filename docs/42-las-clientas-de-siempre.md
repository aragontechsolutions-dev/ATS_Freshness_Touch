# 42 — Las clientas de siempre

> Etapa 3.27. Código: `packages/types/src/recurring-series.ts`,
> `apps/api/src/series/`, `apps/admin/src/components/RepetirReserva.tsx`,
> `apps/admin/src/pages/Series.tsx`.
>
> Continuación directa de `docs/41-la-reserva-que-se-mete-a-mano.md`. Allí se
> dijo que las series iban después **porque una serie genera reservas y la
> reserva manual tenía que existir antes**. Aquí están.

---

## 1. La tabla llevaba un año esperando

`recurring_series` existe desde la etapa 1 y hasta hoy **no la usaba nadie**:
ningún servicio la leía ni la escribía. Elegir «semanal» en el cotizador sólo
aplicaba un descuento al precio de una cita suelta.

Es el patrón que `docs/36` ya describió con las zonas: un trozo de modelo que
describe un negocio que el código no hace. Ahora lo hace.

---

## 2. Una serie no es una cita larga: es una fábrica de citas

No existe «la cita recurrente». Existe una serie que va creando **citas
normales**, cada una con su equipo, su lista de tareas, su fichaje y su
factura. Si una semana hay que moverla, se mueve esa y la serie sigue.

Eso evita de golpe toda una familia de problemas que tienen los sistemas que
modelan la recurrencia como una entidad: qué pasa si una semana se cancela,
cómo se asigna un equipo distinto un día, cómo se factura una visita que duró
más. Aquí no hay nada que resolver: cada visita es una reserva y ya sabíamos
hacer reservas.

---

## 3. Se crea desde una reserva, no con un formulario propio

Un formulario de serie pediría otra vez la clienta, la dirección, el servicio,
el tamaño y la hora: **exactamente lo que se acaba de escribir al meter la
primera cita**. Dos formularios que piden lo mismo se separan solos —uno valida
el código postal y el otro se olvida— y además obligan a teclear dos veces.

Así que el camino es el natural:

```
Agenda → Añadir una reserva  (docs/41)
       → abrir esa reserva
       → «¿Esto se repite?» → cada cuánto, hasta cuándo, a qué precio
```

El día de la semana, la hora y la duración **salen de la cita**. La ruta lo
dice: `POST /admin/bookings/:bookingId/series`. Y la cita que la origina pasa a
ser la primera de la serie, no se duplica.

**Una reserva pertenece a una serie como mucho.** Dejar crear una segunda
desde la misma cita duplicaría a la clienta en la agenda cada semana, y el
fallo no se vería hasta que aparecieran dos equipos el mismo día. Responde 409,
y el panel ni siquiera ofrece el formulario porque el detalle ahora trae
`seriesId`.

---

## 4. Mensual son cuatro semanas

Una serie se define por su **día de la semana** —los martes— y «el 15 de cada
mes» cae en un día distinto cada vez, lo que rompe la ruta del equipo.

| Frecuencia | Días   |
| ---------- | ------ |
| `WEEKLY`   | 7      |
| `BIWEEKLY` | 14     |
| `MONTHLY`  | **28** |

Está escrito como `Record<SeriesFrequency, number>` y no como
`Record<string, number>`: así añadir una frecuencia al enumerado sin ponerle
intervalo **no compila**, en vez de devolver `undefined` en producción.

### La cuenta empieza en `startDate`, no en hoy

Es la decisión que más fácil se escribe mal. Si las fechas se contaran desde el
principio de la ventana que se está mirando, cada pasada del barrido empezaría
en un día distinto y **una serie quincenal acabaría cayendo en semanas alternas
distintas según cuándo se ejecutara el barrido**.

Contando siempre desde el principio, el martes que toca es el mismo lo mire
quien lo mire. Hay una prueba dedicada a esto: una serie que empezó el 2 de
enero de 2024 cae el 10 y el 24 de marzo de 2026, no el 17 y el 31, porque del
2 de enero de 2024 al 10 de marzo de 2026 hay 798 días, que son 57 quincenas
exactas.

Para que eso no cueste caro, `seriesOccurrences` **salta de golpe** hasta la
ventana en vez de avanzar día a día: una serie semanal que empezó hace tres
años son ciento cincuenta vueltas de bucle cada hora, por cada clienta, para no
encontrar nada.

---

## 5. El horizonte: seis semanas

Un barrido mantiene creadas las citas de las próximas seis semanas de cada
serie activa.

**Por qué por adelantado y no una a una al terminar la anterior:** porque el
objetivo no es acordarse de la próxima, es **que la agenda diga la verdad**. Si
la cita del martes que viene no existe hasta que termine la de esta semana, el
cotizador público sigue ofreciendo ese martes y lo vende. Es exactamente el
agujero que `docs/41` vino a tapar.

**Y por qué no hasta el infinito:** un año de citas generadas es un año de
citas que hay que cancelar una a una el día que la clienta se va, y una agenda
llena de compromisos que nadie ha confirmado.

| Env                    | Valor | Por qué                                                                                                                                                    |
| ---------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SERIES_SWEEP_MINUTES` | 60    | Lo que crea son citas de dentro de semanas: que aparezcan una hora más tarde no cambia nada, y cada pasada recorre todas las series activas. Cero lo apaga |

### Qué cuenta como «esa cita ya existe»

**La ocurrencia, no el día en que se hace.** La diferencia no existía cuando se
escribió esto y apareció al poder mover una cita (etapa 3.32).

El barrido compara las fechas del calendario con las de las citas que ya hay.
Mientras nadie mueve nada, «qué día le tocaba» y «cuándo se hace» son el mismo
día, y la comparación funciona con cualquiera de los dos. Desde que se puede
mover una cita dejan de serlo: comparando por `scheduledStart`, mover la del
**martes 3** al **jueves 5** deja el martes 3 sin cubrir, y a la hora siguiente
este barrido **crea otra cita el martes 3**. La clienta acaba con dos citas esa
semana.

`bookings.seriesOccurrenceDate` guarda el día que le tocaba y **no se mueve
nunca**. Detalle completo y la prueba que lo demuestra —comprobada al revés, sin
la columna, para ver que de verdad caza el fallo— en `docs/48-mover-la-cita.md`
§4.

---

## 6. Lo que el barrido NO hace: pisar nada

Si la franja está llena **no crea la cita y no dobla el equipo por su cuenta**:
avisa a coordinación y sigue con las demás fechas. Un barrido que decide doblar
turnos es un barrido que un lunes por la mañana sorprende a alguien con dos
trabajos a la vez.

El aviso es una clase nueva de la bandeja (`docs/39`),
**`series.slot_taken`**, dirigida a coordinación. Y se manda **una sola vez por
fecha**: el barrido pasa cada hora, así que sin recordar de qué fecha ya se
avisó, la misma franja llena generaría un aviso cada hora hasta que alguien la
arreglara — y entonces la bandeja deja de servir para nada.

Por eso la columna `conflictNotifiedFor` guarda **la fecha** y no un booleano:
si se resuelve y más adelante choca otra distinta, ésa sí merece un aviso
nuevo. Al reanudar una serie pausada se borra, porque si la franja sigue llena
es una noticia otra vez.

### Qué sí se salta

| Regla                             | ¿La salta el barrido? | Por qué                                                                                                                                                             |
| --------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retención de 35 $                 | **Sí**, siempre       | Igual que la reserva manual: nace `CONFIRMED`                                                                                                                       |
| Horario y 24 h de antelación      | **Sí**                | Esta cita la pactó la dueña hace meses, no la acaba de pedir un desconocido                                                                                         |
| Franja llena                      | **No**                | Un barrido no decide doblar un equipo                                                                                                                               |
| Correo de confirmación al cliente | **No se manda**       | Seis citas generadas de golpe serían seis correos de algo que ya se pactó por teléfono. El recordatorio de la víspera (`docs/14` §11) es el aviso que sirve de algo |

---

## 7. El precio vive en la serie

`priceOverrideCents` está en `recurring_series`, no en cada cita.

Si el precio se recalculara en cada cita generada, **el día que se suban las
tarifas se le subirían a ella también**, sin que nadie lo decidiera y sin que
nadie se enterara hasta verlo en la factura. Guardado en la serie, una subida
de tarifas no alcanza a la clienta de siempre salvo que una persona lo decida.

Nulo = manda el motor, que es lo normal. Y se hereda de la reserva de la que
nace la serie, que ya comprobó que **sólo administración** puede pactar un
precio.

---

## 8. Un solo camino de creación, ahora tres veces

El barrido crea las citas con **el mismo `BookingsService.create()`** que el
sitio público y que el panel. Son tres entradas y un solo camino:

```
POST /bookings                         → admin: null        → PENDING_PAYMENT
POST /admin/bookings                   → admin.staff: Ada   → CONFIRMED, auditoría PANEL
barrido de series                      → admin.staff: null  → CONFIRMED, auditoría SYSTEM
```

`OpcionesDeAdministracion.staff` pasa a admitir `null`, y con `null` el rastro
dice **SYSTEM** con la acción `booking.created_from_series`. Poner a la última
persona que tocó la serie diría que lo hizo ella hoy, y esa persona ese día
puede no haber entrado al panel.

---

## 9. Pausar no cancela lo que ya está en la agenda

Es lo contrario de lo que cualquiera espera de un botón llamado «pausar», así
que **la pantalla lo dice en voz alta**, con el número exacto de visitas
afectadas.

Pausar porque la clienta se va de viaje **no es** cancelar las tres citas que
ya están en la agenda con su equipo asignado: es dejar de crear más. Lo que ya
existe lo cancela una persona, mirándolo. Un barrido que cancela citas con
equipo asignado es un barrido que deja a alguien sin trabajo un martes sin
avisar.

**Una serie terminada no se revive.** Reanudarla meses después volvería a
contar las fechas desde su `startDate` original y generaría la cita de un
martes que ya pasó o de una clienta que ya no está. Responde 409 y se crea otra.

---

## 10. Seguridad

| Qué                          | Cómo                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quién ve y toca las series   | `ADMIN` y `DISPATCHER`. Una serie es agenda, y limpieza no ve la agenda completa por lo mismo que no ve el listado de reservas                           |
| Quién pacta el precio        | Sólo `ADMIN`, heredado de la reserva de origen, que ya lo comprueba                                                                                      |
| El rastro                    | `series.created` y `series.updated` en el panel, con el estado de antes y el de después; `booking.created_from_series` como SYSTEM en cada cita generada |
| Qué va en el aviso de choque | **La fecha y la hora, nada de la clienta**. La bandeja se mira en una pantalla compartida; quien abra la serie verá de quién es                          |
| Un fallo del barrido         | Se registra y no tumba nada. Las citas que no se crearon se intentan en la pasada siguiente                                                              |

---

## 11. Qué está probado

| Archivo                                                 | Qué comprueba                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/types/src/las-fechas-de-la-serie.test.ts` (8) | Semanal, quincenal y mensual caen donde deben y **siempre en el mismo día de la semana**; la cuenta empieza en `startDate` y no en la ventana; la fecha de fin corta; una fecha ilegible no revienta                                                                                                                                                                                                                                                                               |
| `apps/api/src/series/series.e2e.test.ts` (12)           | La cita de origen pasa a ser la primera; una reserva no puede estar en dos series; limpieza no ve nada; **el barrido rellena el horizonte**; **una segunda pasada no duplica**; las generadas nacen confirmadas, sin pago y colgando de la serie; el precio pactado manda; la fecha de fin corta; una serie pausada no genera; pausar no toca lo ya creado; una terminada no se revive; **con la franja llena no crea nada, avisa una vez y la segunda pasada no repite el aviso** |

La prueba de extremo a extremo levanta PostgreSQL real (PGlite, puerto
**55496**) con el barrido apagado (`SERIES_SWEEP_MINUTES=0`) y lo llama a mano,
igual que el resto de barridos del proyecto.

> De camino, dos fallos que sólo aparecen contra una base real: Prisma exige un
> ISO-8601 completo para una columna `date` y con `'2026-03-03'` responde
> _«premature end of input»_. Pasaba en dos sitios. Se centralizó en
> `comoFecha()`, que fija **mediodía UTC** y no medianoche para que ningún
> desfase horario mueva la fecha al día anterior.

---

## 12. Lo que queda fuera

- **Cambiar una serie.** Hoy sólo se pausa, se reanuda o se termina. Cambiar la
  hora o la frecuencia es terminarla y crear otra desde la siguiente cita. Es
  deliberado de momento: cambiar la hora de una serie plantea qué hacer con las
  seis citas ya creadas, y esa pregunta merece su propia decisión.

  Lo que **sí** se puede desde la etapa 3.32 es **mover una cita suelta de la
  serie** (`docs/48`): la semana que la clienta no puede el martes se resuelve
  sin tocar la serie, y el barrido no vuelve a crear la del martes.

- **Series sin cita previa.** Siempre nacen de una reserva. Es el flujo
  natural y evita el segundo formulario (§3).
- **Saltarse un día concreto** (festivos, vacaciones de la clienta). Hoy se
  cancela esa cita a mano y la serie sigue, que funciona; un calendario de
  excepciones es otra etapa.
- **Cobrar por tarjeta.** Como no hay retención, no hay tarjeta guardada y
  «cobrar el saldo» responde `NO_CARD_ON_FILE`, igual que en la reserva manual.
