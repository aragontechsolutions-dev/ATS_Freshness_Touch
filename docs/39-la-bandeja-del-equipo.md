# 39 — La bandeja del equipo

> Etapa 3.24. Código: `packages/types/src/staff-notification.ts`,
> `apps/api/src/staff-notifications/`,
> `apps/admin/src/components/NotificationsBell.tsx`,
> `apps/admin/src/pages/Notifications.tsx`,
> `apps/admin/src/lib/notificacion.ts`.
>
> Hasta aquí, enterarse de algo dentro del sistema dependía de un grupo de
> Telegram o de un correo. **Las dos cosas se archivan, se silencian y se
> pierden**, y ninguna de las dos está donde se trabaja. Esto es una bandeja
> dentro del panel: al entrar, cada puesto ve lo suyo.

---

## 1. Lo que resolvía y lo que no resolvía Telegram

Los avisos de `docs/14-avisos.md` siguen ahí y siguen siendo necesarios:
**interrumpen**. Un grupo de Telegram suena en el bolsillo de alguien a las
siete de la mañana y eso es exactamente lo que se quiere para «ha entrado una
reserva».

Lo que no hace un grupo de Telegram:

| Lo que falta en un grupo                       | Lo que hace la bandeja                      |
| ---------------------------------------------- | ------------------------------------------- |
| Saber qué queda **sin atender**                | Lleva la cuenta de lo no leído, por persona |
| Que cada puesto vea **solo lo suyo**           | Cada aviso va dirigido a un puesto          |
| Que el aviso lleve **a la ficha**              | Botón «abrir la reserva» en el propio aviso |
| Que siga ahí dentro de un mes                  | Es una fila en la base, no un mensaje       |
| Que no se vea desde el móvil de un ex-empleado | Vive detrás de la sesión del panel          |

Son complementarios: Telegram avisa, la bandeja recuerda.

---

## 2. Por qué NO es la tabla `notifications` que ya existía

Es la pregunta obligada, porque el nombre ya estaba ocupado.

`notifications` es el **registro de envíos al cliente**: qué correo salió, a
qué dirección, si falló, y cuelga de una reserva. Mira **hacia fuera**.

La bandeja mira **hacia dentro**. Mezclarlas habría obligado a una de las dos
a fingir que es la otra:

- la del cliente habría tenido que admitir filas **sin reserva** (un permiso
  de imagen retirado no cuelga de ninguna);
- la del equipo habría arrastrado un `bookingId` **obligatorio** que no
  significa nada en «un cliente retiró sus fotos».

Así que son dos tablas: `notifications` (la de siempre) y
`staff_notifications` (ésta).

---

## 3. Van a un puesto, no a una persona — salvo cuando sí

Ésta es la decisión que da forma al resto.

«Hay una reserva nueva» le toca a **coordinación**, sea quien sea quien entre
ese día. Dirigirla a una persona concreta significaría que si esa persona
libra, **nadie la ve**.

Pero «te han asignado un trabajo» es de quien lo tiene asignado y de nadie
más.

De ahí las dos columnas:

```
audience  StaffRole   -- el puesto al que le toca. Siempre.
staffId   UUID NULL   -- NULL = la ve todo el puesto.
                      -- Con valor = la ve sólo esa persona.
```

Y la consulta de la bandeja es siempre la misma:

```ts
where: {
  audience: staff.role,
  OR: [{ staffId: null }, { staffId: staff.staffId }],
}
```

**Lo de mi puesto, más lo mío.** Nada más. Un `DISPATCHER` no puede ver la
bandeja de administración ni pidiéndola por identificador (§8).

### El catálogo: qué clase va a qué puesto

`NOTIFICATION_AUDIENCE` en `@freshness/types` es el único sitio donde se
decide, para que no lo decida cada punto que emite:

| Clase                        | Puesto       | Cuándo se emite                                              |
| ---------------------------- | ------------ | ------------------------------------------------------------ |
| `booking.confirmed`          | `DISPATCHER` | El webhook confirma el depósito: hay que asignar equipo      |
| `booking.hold_open`          | `ADMIN`      | Se cancela una reserva y la retención sigue viva             |
| `payment.refund_failed`      | `ADMIN`      | El proveedor acabó rechazando una devolución                 |
| `media_consent.self_revoked` | `ADMIN`      | Un cliente retiró sus fotos desde el enlace de su correo     |
| `job.assigned`               | `CLEANER`    | Se asigna equipo a una reserva — **dirigida a cada persona** |

`CLEANER` también tiene bandeja, y hay una prueba que lo exige. Era fácil
construir esto pensando sólo en oficina y dejar a limpieza sin nada.

---

## 4. El texto no se guarda, se guardan los datos

En la fila van `kind` y `params`. La frase la compone el panel, en el idioma
de quien mira.

Guardar la frase ya escrita tendría dos consecuencias malas:

1. una notificación de ayer se vería **en el idioma de quien la provocó**,
   no en el de quien la lee;
2. corregir una errata **no arreglaría las que ya están**.

Las claves de i18n se construyen pegando el `kind` tal cual —
`admin.inbox.kind.booking.confirmed.title` — así que no hay tabla de
equivalencias que mantener. Por eso el objeto `kind` de `en.ts` y `es.ts`
está **anidado** y no tiene claves con punto: i18next separa por puntos y una
clave literal `'booking.confirmed'` no se podría alcanzar. Es la misma razón
y la misma forma que las acciones de auditoría (`docs/16-auditoria.md`).

### Los parámetros se presentan, no se pegan

Lo que viaja en la fila son datos crudos: centavos enteros, fechas en ISO. Es
lo único que se puede guardar sin saber quién va a leerlo. Pegarlos tal cual
daría _«quedan 3500 retenidos»_ y _«el 2026-10-27T14:00:00.000Z»_: correcto y,
para quien lo lee, inútil.

`apps/admin/src/lib/notificacion.ts` hace la conversión:

| En la fila       | En la frase | Cómo                         |
| ---------------- | ----------- | ---------------------------- |
| `amountCents`    | `amount`    | `formatCents(…, locale)`     |
| `scheduledStart` | `when`      | `formatTimestamp(…, locale)` |
| `expiresAt`      | `expiresAt` | `formatTimestamp(…, locale)` |

Lo que no reconoce **pasa tal cual**, a propósito: una clase nueva añadida en
la API, cuyo panel todavía no se ha desplegado, enseña su texto con los datos
en crudo en vez de no enseñar nada.

---

## 5. Quién ha leído qué, en su propia tabla

`staff_notification_reads`, clave compuesta `(notificationId, staffId)`.

**Y no un booleano `read` en la notificación**, porque una notificación de
puesto la ven varias personas: con un booleano, la primera que la abriera la
haría desaparecer del globo de las demás.

La clave compuesta es además lo que hace inofensivo marcar como leída dos
veces —dos pestañas abiertas, un doble clic—: se escribe con `createMany` y
`skipDuplicates`, y la segunda choca con la primera en vez de duplicar la
fila o de dar un error que haya que enseñar.

---

## 6. El globo se para en «+9»

Lo pide el contrato, no el componente, y está probado aparte
(`packages/types/src/el-globo-de-la-campana.test.ts`):

```ts
export function notificationBadge(unread: number): string {
  if (unread <= 0) return '';
  return unread > NOTIFICATION_BADGE_MAX ? `+${String(NOTIFICATION_BADGE_MAX)}` : String(unread);
}
```

- **Cero no pinta nada.** Un globo con un cero dentro es ruido que pide
  atención para decir que no pasa nada.
- **Del uno al nueve, el número.**
- **A partir de diez, «+9».** El número exacto no cambia ninguna decisión:
  con diez sin leer y con cuarenta se hace lo mismo —abrirlas—, y un «47» en
  un globo de dieciséis píxeles no se lee, sólo ensucia.

El número exacto sí está en el `aria-label` del botón
(`admin.inbox.badgeLabel`, con plural), porque un lector de pantalla no tiene
problema de espacio. Y el globo va con `aria-hidden` para que no se lea dos
veces.

### El contador cuenta todas, no las de la página

`unreadCount` se calcula con un `count` aparte, no contando lo que viene en la
respuesta. Un globo que dice «5» porque sólo se pidieron cinco es un globo que
miente en cuanto hay una sexta.

---

## 7. Las dos pantallas

### El desplegable de la campana (cinco)

Cinco es `NOTIFICATION_PREVIEW_COUNT`: lo que cabe sin tapar la pantalla en un
móvil y lo suficiente para que lo de hoy se vea sin abrir nada.

- **Se refresca al abrir, no en bucle.** Nada de un temporizador preguntando
  cada pocos segundos: esto corre en el móvil de quien trabaja y la batería y
  los datos son suyos. Se pide al montar y cada vez que se abre.
- **Se cierra al pulsar fuera.** Es un desplegable, no una pantalla.
- **«Ver todas» está siempre**, aunque haya menos de cinco: ese botón es la
  única puerta a la lista completa —la bandeja no tiene entrada en el menú— y
  esconderlo cuando hay cuatro dejaría sin forma de volver a mirar las ya
  leídas.
- **Un fallo aquí no molesta a nadie.** Si la API no responde, la campana se
  queda sin globo y el panel sigue funcionando. Sacar un aviso rojo por no
  poder contar notificaciones sería convertir un detalle en una interrupción.
  La única excepción es un 401: eso sí cierra la sesión, como en el resto del
  panel.

La campana va **la primera** del grupo de iconos de la cabecera, y no al final
junto a tema e idioma: esos se tocan una vez y no se vuelven a mirar; esto es
lo que se mira al entrar.

### La lista completa (`pages/Notifications.tsx`)

Trae cincuenta. Más que eso ya no se lee, se busca.

- **El detalle se despliega ahí dentro**, no en otra pantalla. Una
  notificación tiene un título, una frase y una fecha: no da para una pantalla
  propia, y mandar a otra página para leer dos líneas obliga a volver para
  seguir mirando la lista.
- Lo que de verdad lleva a algún lado —la reserva— tiene su botón.
- «Marcar todas como leídas» sólo aparece si hay alguna sin leer.
- **La bandeja se aparta si hay una reserva abierta**: se llega a ella desde
  una notificación, y quedarse en la lista después de pulsar «abrir la
  reserva» sería no haber abierto nada.

### Se marca leída al abrirla, no al verla

Verla de refilón en un desplegable no es enterarse, y marcarla entonces haría
desaparecer del globo cosas que nadie llegó a leer.

Después de marcar, `App.tsx` sube un contador que hace de `key` de la campana,
así que se vuelve a montar y vuelve a contar. Sin eso, «marcar todas como
leídas» dejaría el globo con el número viejo hasta recargar la página.

---

## 8. Seguridad

Esto es una pantalla nueva que lee de la base, así que hay que decir qué la
protege.

### Autorización: a propósito SIN `@Roles`

El controlador **no lleva `@Roles`**, y es deliberado: la bandeja no es de un
puesto, es de **todos**. Lo que cambia no es el permiso sino el contenido, y
eso lo decide la consulta (§3), no el guardia. Poner un rol aquí dejaría a
limpieza sin bandeja.

Lo que sí hay, por estar bajo `ADMIN_ROUTE`, es la **sesión**: sin token no se
ve nada, y hay una prueba que lo comprueba.

### No se puede mirar la bandeja de otro

Las tres rutas filtran por `audience` y `staffId` **en la consulta**, no
después:

- `GET /admin/notifications` sólo devuelve lo del puesto de quien pregunta.
- `POST /admin/notifications/read` **comprueba antes** que los
  identificadores recibidos le tocan a quien llama. Sin eso, cualquiera podría
  marcar como leída la notificación de otro puesto mandando su identificador
  — no es grave, pero es escribir en algo que no es suyo.
- `POST /admin/notifications/read-all` sólo recorre las suyas.

### Qué NO puede ir en `params`

La misma regla que la auditoría (`docs/16-auditoria.md`), y por el mismo
motivo: **esto se mira en una pantalla compartida y se queda meses**.

| Sí                                   | Nunca                                        |
| ------------------------------------ | -------------------------------------------- |
| La referencia de la reserva (`FT-…`) | Nombres de clientes                          |
| Un importe en centavos               | Direcciones                                  |
| Una fecha                            | Correos y teléfonos                          |
| Un booleano (`isLead`)               | Identificadores del proveedor (`pi_`, `re_`) |
|                                      | Instrucciones de acceso o códigos de puerta  |

El nombre y la calle ya están en la ficha del trabajo, que es su sitio y
tiene su propio control de acceso.

### Los registros del servidor tampoco

Cuando `emitir` falla, al log va **la clase** del aviso, nunca los
parámetros: pueden llevar importes y referencias, y los registros del
servidor los ve más gente y se conservan más tiempo de lo que uno cree.

### RLS

Las dos tablas nacen con `ENABLE ROW LEVEL SECURITY` en la propia migración.
Supabase publica por REST todo lo que hay en el esquema `public`: sin eso, la
bandeja interna del equipo sería consultable desde fuera. `migrations.test.ts`
falla si alguien añade una tabla sin ello.

### Límites de peticiones

- `limit` tiene un tope de **100**, para que nadie pida la tabla entera.
- La bandeja está **exenta del limitador de cotizaciones**
  (`SKIP_QUOTE_THROTTLER`): el panel pregunta por el contador cada vez que se
  abre una pantalla, y ese limitador está puesto para el cotizador público.
  Sin la exención, trabajar media hora seguida en el panel acabaría
  devolviendo 429 en la campana. El limitador global sigue aplicando.

### Se valida lo que sale, no sólo lo que entra

`aNotificacion()` pasa la fila por `StaffNotificationSchema.parse` antes de
devolverla: una fila escrita a mano desde una consola no pasó por el
contrato, y así se nota aquí antes de que el panel intente pintarla.

En el panel, `StaffNotificationSchema` es un `z.object` **tolerante** y no un
`z.strictObject`, como todo lo que lee un navegador: el panel y la API se
despliegan por separado y un contrato estricto aquí vaciaría la bandeja entera
el día que la API devuelva un campo de más.

---

## 9. Emitir no puede tumbar lo que lo provocó

Una notificación es un aviso, no el hecho. Si al guardar «hay una reserva
nueva» falla algo, lo que **no** puede pasar es que se caiga la reserva: ya
está pagada.

Por eso `emitir` **se traga sus propios fallos** y los registra. La excepción
es cuando se le pasa una transacción: ahí quien llama ha decidido que el aviso
va con el hecho, y entonces un fallo deshace las dos cosas.

Hoy los cinco puntos que emiten lo hacen **fuera** de la transacción, junto al
resto de los avisos. El `booking.confirmed` del webhook es el caso que lo
explica: un fallo al dejar el aviso no puede deshacer una reserva cuyo
depósito ya está retenido en una tarjeta de alguien.

---

## 10. Baja de personal: `CASCADE`, no `RESTRICT`

Las dos claves ajenas a `staff` borran en cascada. Una notificación no es un
registro que haya que poder demostrar —eso es la auditoría, que nunca se
borra— sino un aviso. Si se da de baja a quien iba dirigido, sus avisos se van
con ella en vez de impedir la baja.

---

## 11. Qué está probado

| Archivo                                                                | Qué comprueba                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/types/src/el-globo-de-la-campana.test.ts` (6)                | Cero no pinta nada, un negativo tampoco, del uno al nueve el número, nueve es «9» y no «+9», diez en adelante «+9»                                                                                                                                                                                                      |
| `apps/admin/src/lib/notificacion.test.ts` (6)                          | La clave se construye pegando el `kind`; los centavos salen como moneda; las fechas salen legibles; lo que no conoce lo deja igual; una fecha que no es una fecha no se convierte; sin parámetros no inventa ninguno                                                                                                    |
| `apps/api/src/staff-notifications/staff-notifications.e2e.test.ts` (8) | Cada puesto ve lo suyo y no lo del otro; una dirigida a una persona no la ven sus compañeras; sin sesión no se ve nada; limpieza también tiene bandeja; marcarla leída no la marca para el resto del puesto; marcarla dos veces no falla; las marca todas de golpe; el contador cuenta todas aunque sólo se pidan cinco |
| `apps/api/src/database/migrations.test.ts`                             | Las dos tablas nuevas tienen RLS                                                                                                                                                                                                                                                                                        |

La prueba de extremo a extremo levanta un PostgreSQL de verdad (PGlite) en el
puerto **55494** y aplica las migraciones, igual que el resto.

Lo que **no** está probado automáticamente: el aspecto del desplegable en un
móvil real. Se verificó a mano.

---

## 12. Lo que queda fuera

- **No hay aviso en tiempo real.** La campana no se enterará de una
  notificación nueva hasta que se abra o se recargue la pantalla. Un
  `EventSource` o un sondeo cada treinta segundos es posible, pero gasta
  batería y datos de quien trabaja en la calle, y ninguno de estos cinco
  avisos es urgente al minuto. El que sí lo es —«hay una reserva nueva»— ya
  suena por Telegram.
- **No se borran solas.** De momento se acumulan; cincuenta en la lista y un
  índice por `(audience, createdAt DESC)` aguantan mucho. Cuando haga falta,
  un barrido que borre las leídas de hace más de noventa días es media hora de
  trabajo.
- **No se puede apagar una clase.** Si una resulta ruidosa se podrá añadir a
  los ajustes de avisos; hoy no hay motivo para suponer cuál será.
