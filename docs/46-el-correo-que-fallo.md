# 46 — El correo que falló y nadie sabía

> Etapa 3.30. Tapa el hueco **B1** de `docs/43-los-huecos-que-quedan.md`, el
> único de la lista donde **alguien ya había pagado y se quedaba sin nada por
> escrito**.
>
> Código: `apps/api/src/notifications/notification-retry-sweep.service.ts`,
> `NotificationsService.reintentarCorreoAlCliente`, migración
> `20261029160000_reintentar_el_aviso_que_fallo`.

---

## 1. El fallo mudo

`NotificationsService` guardaba la fila con `status: 'FAILED'` y el motivo. Y
hasta ahí.

**No había reintento y no había aviso.** Si el proveedor de correo estaba
caído el minuto en que alguien confirmaba su reserva, esa persona había pagado
y no tenía nada por escrito, y nadie se enteraba hasta que alguien mirase el
registro de envíos — que no tiene pantalla.

Lo que lo hacía fácil de pasar por alto: **el recordatorio de la víspera sí se
reintentaba**, porque lo manda un barrido que vuelve a pasar al día siguiente
(`docs/14` §11.7). La confirmación no vuelve a pasar nunca.

---

## 2. Primero insiste, y solo cuando se rinde molesta a alguien

| Intento | Cuándo                                              |
| ------- | --------------------------------------------------- |
| 1       | Al confirmar la reserva                             |
| 2       | +5 minutos                                          |
| 3       | +30 minutos                                         |
| 4       | +2 horas                                            |
| 5       | +6 horas                                            |
| —       | Se deja de insistir y **se avisa a administración** |

**Corto al principio** porque la mayoría de los fallos de un proveedor de
correo duran segundos: el primer reintento a los cinco minutos resuelve casi
todos sin que el cliente note nada. El barrido corre cada cinco minutos, que
es lo que hace que esa espera sea de verdad de cinco y no de veinte.

**Creciente después** porque si a la media hora sigue fallando no es un hipo:
o el proveedor está caído de verdad o la dirección no existe, y en los dos
casos insistir cada cinco minutos solo gasta cuota.

**Y se acaba.** Un reintento infinito sobre una dirección mal escrita no
entrega nada y esconde el problema para siempre.

### El aviso sale al rendirse, no al primer fallo

Avisar del primer fallo sería avisar de casi todos los hipos de un proveedor
de correo, y **una bandeja que avisa de lo que se arregla solo deja de
leerse**. El aviso (`notification.failed`, a administración) sale cuando de
verdad hay algo que hacer: llamar por teléfono.

Lleva la referencia para poder abrir la reserva, y **nunca la dirección de
correo** — hay una prueba que lo comprueba.

---

## 3. Lo que se reintenta, y lo que no

**Solo el correo al CLIENTE.** Es el único aviso con alguien esperando que no
seamos nosotros.

Los de Telegram son nuestros, los lee el equipo, y cuando fallan suele ser por
configuración —un grupo que no existe—: insistir cuatro veces no arregla eso y
llena el registro. De ésos avisa el estado del sistema.

Y **lo anterior a esta etapa tampoco**: esas filas nacen con `nextAttemptAt`
nulo a propósito. Mandar hoy la confirmación de una reserva de hace tres
semanas no ayuda a nadie y confunde a quien la reciba.

---

## 4. La trampa que casi se cuela: el índice único

`registrar()` inserta con `create` y **se traga el error de clave duplicada**,
porque la tabla tiene un índice único parcial sobre
`(bookingId, event, channel, audience)` limitado a `status = 'SENT'`.

Si el reintento hubiera insertado una fila nueva en lugar de actualizar la que
había, habría pasado esto:

1. El correo sale bien.
2. El `INSERT` choca con el índice y **se traga el error en silencio**.
3. La fila vieja sigue en `FAILED` con su fecha de reintento.
4. El barrido vuelve a intentarlo **a la siguiente pasada. Y a la siguiente.**

**El cliente recibiría un correo cada cinco minutos para siempre**, y el
registro seguiría diciendo que nunca salió.

Por eso el reintento **actualiza la fila**, no la duplica, y hay una prueba
dedicada: _«una segunda pasada ya no manda nada»_. La contrapartida está
escrita en el esquema: `failureReason` guarda el motivo del **último** intento,
no el de todos.

---

## 5. Dos decisiones pequeñas que importan

**Se reenvía solo ese correo, no se vuelve a despachar el aviso entero.**
Llamar otra vez a `despachar` reharía también la copia interna y el aviso de
Telegram, que casi siempre sí salieron.

**El destinatario se vuelve a leer de la reserva** y no del `target` guardado,
porque ese se guarda enmascarado a propósito: el registro de envíos no es una
lista de correos. Tiene un efecto útil de regalo — si entre el fallo y el
reintento alguien corrigió la dirección del cliente, **el reintento va a la
buena**.

---

## 6. Qué está probado

| Archivo                                                         | Qué                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/types/src/el-reintento-del-aviso.test.ts` (4)         | La espera crece en cada intento; al agotarlos ya no programa nada; son cinco envíos en total                                                                                                                                                                                                                                                                                  |
| `apps/api/src/notifications/notification-retry.e2e.test.ts` (7) | Reenvía y la fila queda enviada sin nada programado; **una segunda pasada ya no manda nada**; si todavía no le toca no se toca; una fila sin fecha no se reintenta; al volver a fallar programa el siguiente y **no avisa todavía**; al agotarse deja de insistir y avisa a administración con la referencia y sin el correo; un aviso de Telegram fallido se queda como está |

El archivo de extremo a extremo levanta PostgreSQL real (PGlite, puerto
**55499**) con el barrido apagado y lo llama a mano, y hace fallar el
proveedor con `vi.spyOn`.

---

## 7. Lo que queda fuera

- **No hay botón de reenviar a mano** en el panel. Con cinco intentos
  automáticos y un aviso al final, el caso que queda es una dirección
  equivocada — y eso se arregla corrigiendo el correo (`docs/45`) y llamando,
  no pulsando otra vez el mismo botón.
- **El registro de envíos sigue sin pantalla.** Hoy se mira por la base de
  datos. La bandeja avisa de lo que importa, que era el agujero; una pantalla
  de envíos es otra cosa y nadie la ha pedido.
- **Telegram no se reintenta** (§3).
