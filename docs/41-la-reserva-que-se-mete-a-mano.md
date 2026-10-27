# 41 — La reserva que se mete a mano

> Etapa 3.26. Código: `packages/types/src/booking.ts` (contrato),
> `apps/api/src/bookings/bookings.service.ts`,
> `apps/api/src/admin/bookings-admin.controller.ts`,
> `apps/api/src/scheduling/slots.ts`,
> `apps/admin/src/components/NuevaReserva.tsx`.

---

## 1. De dónde sale: la agenda estaba mintiendo

La pregunta que lo abrió fue de la dueña: _«¿cómo agendo a mis clientas de
siempre? Todas me escriben a mí y me pasan día y hora, y el sistema no se
entera.»_

Al mirarlo en el código la respuesta fue peor de lo que parecía. **La única
escritura pública del sistema era `POST /bookings`**, y no existía ninguna
forma de crear una reserva desde el panel. Así que esos trabajos no es que
quedaran sin facturar: es que **no existían para la agenda**.

Y `findOccupied` solo cuenta reservas de la base:

```ts
where: {
  scheduledStart: { lt: dayEnd },
  scheduledEnd: { gt: dayStart },
  OR: [{ status: { in: [CONFIRMED, IN_PROGRESS] } }, …],
}
```

**Un martes a las nueve comprometido por teléfono seguía ofreciéndose en el
cotizador público.** Dos clientas, un equipo, la misma hora. No era un riesgo
teórico: era el resultado normal de tener media agenda fuera del sistema.

Por eso esto no es «apuntar un recordatorio». Es crear una reserva de verdad
—con su precio, su equipo asignable, su lista de tareas, su fichaje y su
factura— y sobre todo **ocupar la franja**.

---

## 2. Un solo camino de creación, no dos

La decisión estructural: **el panel usa el mismo `BookingsService.create()`
que el sitio público**, con un parámetro más.

```ts
create(request, now, ip, admin: OpcionesDeAdministracion | null)
```

La alternativa —un servicio paralelo para el panel— habría duplicado el
cálculo del precio, el bloqueo por día, la reutilización del cliente, la
geocodificación y el rastro de auditoría. Y el día que uno de los dos
cambiara, el otro no. El `BookingsService` se exporta ahora desde
`BookingsModule` y `AdminModule` lo importa.

El contrato va **anidado** y no fundido:

```ts
AdminBookingRequestSchema = z.strictObject({
  booking: BookingRequestSchema, // exactamente el mismo que el sitio
  overrides: AdminBookingOverridesSchema,
});
```

Así el contrato público sigue siendo **el mismo objeto, sin un solo campo
más**. Un `allowOverlap` que viajara en la misma forma que usa el sitio
público es un campo que algún día se acepta por descuido.

---

## 3. Qué puede saltarse el panel, y por qué el formulario no

Las reglas del sitio protegen de un desconocido. Quien entra al panel no es un
desconocido: es quien conoce su agenda, sus equipos y a sus clientas.

| Regla pública                | ¿La salta el panel?                      | Por qué                                                                                                                                                       |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retención de 35 $ en tarjeta | **Siempre**                              | La clienta de siempre paga como siempre. Pedirle la tarjeta por teléfono para retener un dinero que se le descuenta igual es un obstáculo sin problema detrás |
| 24 h de antelación y horario | Con `allowOutsideHours`                  | Las 24 h existen para que dé tiempo a organizar al equipo. Es una suposición razonable sobre un desconocido y ninguna sobre quien mira su propia agenda       |
| «La franja está llena»       | Con `allowOverlap`, **y avisando antes** | El límite de equipos sale de la configuración, y la configuración puede estar desactualizada un martes en que entra alguien a echar una mano                  |
| El precio del motor          | Con `priceOverrideCents`, **solo ADMIN** | Una clienta antigua puede tener una tarifa de hace dos años                                                                                                   |
| Fuera del área de servicio   | Si hay precio pactado                    | Hay clientas de siempre que viven más lejos de lo que el cotizador atiende solo                                                                               |

**Lo que no se salta nunca**: que haya equipo libre se comprueba igual; lo que
cambia es que se puede insistir. Y el rango de fechas (de hoy a 90 días) sigue
aplicando, porque una cita fuera de ese rango casi siempre es un dedo que se
equivocó de año.

### El choque avisa, no prohíbe

Es la decisión de interfaz que más importa. La casilla «reservar igualmente»
**no aparece hasta que la primera petición choca**. Ofrecerla desde el
principio sería invitar a marcarla «por si acaso», y entonces el aviso deja de
avisar.

```
1ª petición  →  409 SLOT_UNAVAILABLE  →  aparece la casilla
2ª petición  →  allowOverlap: true    →  201, y queda en la auditoría
```

### El depósito a cero no es un detalle

Si quedara en 35, la factura diría que la clienta ya adelantó un dinero que
nadie le retuvo, y el día del servicio se le cobraría de menos. Por eso
`ajustarParaElPanel()` pone el depósito a cero **y** deja
`balanceDueAtServiceCents` igual al total. Hay una prueba que lo vigila.

### El precio pactado entra como una línea, no sobrescribe el total

La diferencia con lo que dice el motor se añade al desglose como `DISCOUNT` o
`SURCHARGE` con el código `AGREED_PRICE`. Así `lines` **sigue sumando**
`totalCents` —que es lo que la factura y el correo dan por hecho— y además se
ve de dónde sale la diferencia, que es justo lo que alguien querrá entender
dentro de un año.

---

## 4. Seguridad

| Qué                                       | Cómo                                                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quién puede crear**                     | `@Roles('ADMIN', 'DISPATCHER')`. Limpieza no: su pantalla es «Mis trabajos»                                                                                                                  |
| **Quién puede pactar precio**             | **Solo `ADMIN`**, comprobado en el controlador con un 403. Coordinación agenda; cambiar lo que se cobra es la misma línea que ya separa «mover una cita» de «mover dinero»                   |
| **El motivo**                             | Obligatorio **en cuanto se salta algo**, en el contrato (`.refine`) y no solo en el formulario. Lo que rompe una norma se explica en el momento, no se reconstruye medio año después         |
| **El rastro**                             | Acción propia `booking.created_manually`, con `surface: 'PANEL'`, quién fue, y **cada salto por separado** en la metadata: `outsideHours`, `overlapped`, `agreedPrice`, `source` y el motivo |
| **Sin sesión**                            | 401, como todo lo que cuelga de `/admin`                                                                                                                                                     |
| **El precio sigue saliendo del servidor** | El motor recalcula igual; lo único que el navegador puede imponer es un importe explícito, de un ADMIN, con motivo y auditado                                                                |

La acción de auditoría es **distinta** y no `booking.created` con otra
superficie, porque responde a una pregunta distinta: no «quién reservó» sino
«quién metió esto a mano y qué normas se saltó». Es la fila que se mira cuando
una franja aparece doblada o cuando un precio no cuadra con la tarifa vigente.

---

## 5. Los avisos: esta reserva no tiene webhook que la confirme

La reserva del sitio nace `PENDING_PAYMENT` y quien avisa es **el webhook**
cuando el depósito queda retenido, que es cuando hay algo que contar.

Ésta nace `CONFIRMED` y **no hay pago**, así que no hay webhook. El aviso sale
de `avisarDeLaReservaManual()` o no sale:

- **Al cliente**, salvo que se desmarque `notifyCustomer`. Encendido por
  defecto: tener la cita por escrito evita la mitad de las llamadas después.
  Una clienta que acaba de colgar el teléfono ya lo sabe, y para eso está la
  casilla.
- **A la bandeja de coordinación, siempre.** Una reserva confirmada sigue
  siendo una reserva **sin equipo asignado**, la haya metido quien la haya
  metido (`docs/39-la-bandeja-del-equipo.md`).

Las dos cosas van **fuera de la transacción** y ninguna tumba nada si falla:
la cita ya está guardada, y perderla porque un servidor de correo no responde
sería exactamente lo que no debe pasar.

---

## 6. El correo es obligatorio, y hay que saber por qué

`Customer.email` es `@unique` y **no admite nulos**, y es lo que identifica a
la clienta: si ya existe, se reutiliza su ficha en vez de crear una segunda.
Por eso el formulario lo pide aunque la clienta no use el correo nunca, y por
eso al lado está la casilla de no escribirle.

Hacerlo opcional es posible —PostgreSQL admite varios nulos en un índice
único— pero es una migración y un repaso de todo lo que da por hecho que hay
una dirección a la que escribir. **No se hizo en esta etapa**, y queda
anotado.

---

## 7. Qué está probado

`apps/api/src/admin/manual-booking.e2e.test.ts`, contra PostgreSQL real
(PGlite, puerto **55495**), 12 pruebas:

| Grupo               | Qué comprueba                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nace distinta       | Queda `CONFIRMED` con `nextStep: NONE` y sin pago; el depósito es cero y queda por cobrar el total entero; la cotización dice `PHONE`                                                 |
| **Ocupa la franja** | Con dos equipos, la tercera reserva a la misma hora choca con 409; con el aviso aceptado, se dobla                                                                                    |
| El precio pactado   | Manda sobre el del motor, y el desglose **sigue sumando** el total con su línea `AGREED_PRICE`; coordinación recibe 403 al intentarlo; coordinación sí puede agendar al precio normal |
| Deja rastro         | La auditoría dice `booking.created_manually`, `PANEL`, quién, y los saltos uno a uno; coordinación la ve en su bandeja                                                                |
| Lo que no se salta  | Sin motivo no se salta nada (400); sin sesión no se crea nada (401)                                                                                                                   |

Más 4 pruebas de `equiposOcupadosEn` en `slots.test.ts`, una de ellas sobre el
caso que se escribe mal siempre: **pegado no es solapado**. Un trabajo que
acaba justo cuando empieza el siguiente deja el equipo libre; con
desigualdades no estrictas, la agenda perdería un hueco de cada dos.

> Una de estas pruebas encontró algo de camino: el primer intento usó 150,00 $
> como precio pactado y falló porque **el motor daba exactamente 150,00 $**
> para ese trabajo, así que la diferencia era cero y no había línea que
> comprobar. Se cambió a 123,45 $. Una prueba que pasa por coincidencia no
> prueba nada.

---

## 8. Lo que queda fuera, y por qué

- **Las series recurrentes.** `RecurringSeries` **existe en el esquema y no la
  usa ningún servicio**. Está diseñada justo para esto —cliente, dirección,
  frecuencia, día de la semana, hora y duración— y es lo que convierte «Ana,
  todos los martes a las nueve» en algo que se genera solo. Va en una etapa
  aparte, y en este orden a propósito: una serie **genera reservas**, así que
  la reserva manual tiene que existir antes.
- **Cobrar por tarjeta una reserva manual.** Como no hay retención, no hay
  tarjeta guardada, y «cobrar el saldo» responderá `NO_CARD_ON_FILE`, que es
  un mensaje que ya existe y dice exactamente lo correcto: _«a esa persona hay
  que cobrarle por otra vía»_.
- **Elegir la zona horaria.** La hora se construye en la del navegador. Es
  correcto mientras el panel se use desde Georgia, igual que el negocio; el
  día que se gestione desde otro huso, hay que elegirla a mano en vez de
  suponerla. Está escrito en el componente.
- **Mover una reserva ya creada a otra hora.** Se cancela y se crea otra.
  Reprogramar de verdad es su propia etapa, porque toca los avisos y el
  dinero.
