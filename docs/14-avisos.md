# 14. Avisos por correo y Telegram

> Etapa 2.5. Código: `apps/api/src/notifications/`,
> `packages/types/src/notifications.ts`,
> `apps/admin/src/components/NotificationSettingsForm.tsx`.

Hasta ahora un cliente reservaba, pagaba y **no recibía nada**. Ni confirmación
ni rastro escrito de su cita. Y la empresa se enteraba de las reservas nuevas
entrando al panel a mirar.

---

## 1. Dos destinatarios que no se deben confundir

|                   | Cliente                             | Empresa                      |
| ----------------- | ----------------------------------- | ---------------------------- |
| Canal             | Correo                              | Telegram, y copia por correo |
| Qué recibe        | Confirmación y cancelación          | «Ha entrado una reserva»     |
| ¿Se puede apagar? | Sí, pero con aviso en el formulario | Sí, sin reparos              |

El correo al cliente es **transaccional**: confirma algo que acaba de pedir. No
necesita consentimiento comercial, y por eso el `marketingOptIn` del cliente no
se consulta en ningún punto de este módulo. Apagarlo es posible, pero el
formulario dice en voz alta lo que significa: _«quien acaba de pagar no recibe
nada por escrito»_.

El aviso a la empresa interrumpe a una persona concreta, así que esa persona
decide. Nace **apagado** —sin chat configurado— mientras que los correos al
cliente nacen encendidos.

---

## 2. La regla que protege el dinero del cliente

Ésta es la decisión más importante de la etapa:

> **Los avisos se envían DESPUÉS de consolidar la transacción. Nunca dentro.**

El despachador se llama justo después de que una reserva queda confirmada, y en
ese momento **el depósito ya está retenido en la tarjeta del cliente**. Si el
envío ocurriera dentro de la transacción, un proveedor de correo caído desharía
esa confirmación: el cliente se quedaría con el dinero bloqueado y sin cita, y
en el sistema no constaría ninguna reserva.

De ahí salen tres compromisos que cumple `NotificationsService`:

1. **Ningún método público lanza.** Pase lo que pase. Quien llama no tiene que
   acordarse de envolverlo en un `try`.
2. **Los adaptadores devuelven el fallo como dato**, no como excepción. Y aun
   así el despachador los envuelve, porque el compromiso es suyo y no puede
   depender de que todos los adaptadores se porten bien.
3. **Todo intento queda registrado**, también los que no se envían.

```
webhook del proveedor de pago
        │
        ├─ TRANSACCIÓN ─────────────────────────┐
        │   idempotencia del evento             │
        │   estado del pago                     │
        │   PENDING_PAYMENT → CONFIRMED         │
        │   marcar evento como procesado        │
        └───────────────────────────────────────┘
        │  (consolidada: la reserva ya es firme)
        ▼
   avisos ── correo al cliente
          ── copia interna
          ── Telegram
```

---

## 3. No se avisa dos veces

El proveedor de pago **reenvía el mismo evento** si no recibe respuesta a
tiempo. Sin protección, cada reenvío sería otro correo al cliente por la misma
reserva.

La tabla `notifications` lleva un **índice único parcial** sobre
`(bookingId, event, channel, audience)` limitado a `status = 'SENT'`. El segundo
intento choca con él, y el despachador se traga ese error concreto en silencio:
no es una avería, es la restricción haciendo su trabajo.

Que sea **parcial** importa tanto como que sea único: un intento fallido u
omitido debe poder repetirse cuando se arregle la configuración. Si cubriera
todos los estados, un fallo del proveedor dejaría a ese cliente sin correo para
siempre.

---

## 4. Qué NO sale nunca en un correo

Dos exclusiones deliberadas, ambas con una prueba que las vigila:

**Las instrucciones de acceso.** El cliente da el código de su puerta al
reservar. Devolvérselo por correo no le aporta nada —ya lo sabe— y multiplica
los sitios donde ese código existe: su buzón, el del proveedor de correo y
cualquier servidor por el que pase. La consulta que alimenta los avisos pide
calle y ciudad, y `accessNotes` no está en la lista.

**El motivo de la cancelación.** Lo escribe el equipo en el panel y es una nota
interna («el cliente discutió el precio»). Un correo automático que se lo
reenvíe al cliente es un incidente, no una funcionalidad.

---

## 5. Credenciales fuera de la base de datos

| Dato                          | Dónde vive                     | Por qué                                    |
| ----------------------------- | ------------------------------ | ------------------------------------------ |
| Clave del proveedor de correo | `RESEND_API_KEY` (entorno)     | Es una credencial                          |
| Token del bot de Telegram     | `TELEGRAM_BOT_TOKEN` (entorno) | **Es** el bot: quien lo tiene, lo controla |
| Chat de Telegram              | Panel                          | Sin el token no sirve para enviar nada     |
| Buzón interno, interruptores  | Panel                          | Configuración, no secretos                 |

Una credencial guardada en la base de datos acaba en **cada copia de
seguridad** y al alcance de cualquiera con acceso a ella. Van donde van la
clave de Stripe y la de Google: en el entorno del servidor.

El esquema del panel es **estricto** y rechaza cualquier campo que no conozca,
así que un token no puede colarse en esa tabla ni por descuido. Hay una prueba
que lo intenta y comprueba que la API responde `400`.

El formulario además lo **dice**, en un recuadro visible. Sin ese aviso, lo
lógico es buscar dónde se pega el token, no encontrarlo y abrir una incidencia.

---

## 6. Permisos

| Acción                    | ADMIN | DISPATCHER | CLEANER |
| ------------------------- | :---: | :--------: | :-----: |
| Ver los ajustes de avisos |  ✅   |     ❌     |   ❌    |
| Cambiarlos                |  ✅   |     ❌     |   ❌    |

Quien controla esto se entera de todo lo que entra, o deja a la empresa sin
enterarse de nada apagándolo. Coordinación mueve la agenda; no decide a qué
teléfono llegan los avisos.

---

## 7. El registro de envíos

Cada intento deja una fila con su resultado:

| Estado    | Significa                                  |
| --------- | ------------------------------------------ |
| `SENT`    | Salió. Bloquea reenvíos de ese mismo aviso |
| `FAILED`  | Se intentó y falló. Se puede reintentar    |
| `SKIPPED` | Estaba apagado o sin configurar            |

`SKIPPED` es tan informativo como `FAILED`: es la respuesta correcta a la mitad
de los «no me ha llegado nada», y sin registro sería indistinguible de una
avería.

El destino se guarda entero (hace falta para atender una reclamación) pero el
panel lo **enmascara**: `an…@example.com`. El equipo necesita saber a qué buzón
salió; no necesita la lista de correos de los clientes a la vista en una
pantalla que se consulta a diario.

---

## 8. Proveedores

Mismo patrón que los pagos y la distancia: el resto del sistema no sabe quién
envía.

| Variable             | Valor               | Qué hace                                                           |
| -------------------- | ------------------- | ------------------------------------------------------------------ |
| `EMAIL_PROVIDER`     | `log` (por defecto) | Escribe el correo en el registro. Permite probarlo todo sin cuenta |
|                      | `resend`            | Envío real                                                         |
| `TELEGRAM_BOT_TOKEN` | sin definir         | El aviso queda anotado como fallido, con motivo                    |
|                      | definido            | Envío real                                                         |

Con `EMAIL_PROVIDER=log` en producción, la API lo grita en los registros al
arrancar: los clientes no reciben nada y nadie se entera hasta que uno llama
preguntando si su reserva existe.

Ambos adaptadores reales tienen **tiempo límite**. Sin él, un proveedor que no
responde deja colgada la petición del webhook del proveedor de pago, que
entonces la reintenta.

---

## 9. Qué está probado

**Contra PostgreSQL real** (21 pruebas): el correo sale al cliente en **su**
idioma; confirmar dos veces la misma reserva manda **un** solo correo; un
proveedor que revienta no hace fallar nada y queda anotado como `FAILED`; un
envío fallido se puede repetir; una reserva que ya no existe no provoca ningún
error; con el aviso apagado queda constancia del motivo; la copia interna
recibe exactamente el mismo correo; coordinación recibe `403`; se rechazan un
token junto a los ajustes y un chat que no es un número; el cambio queda en la
auditoría.

**De la migración** (4 pruebas): la restricción impide el envío duplicado, un
intento fallido sí se puede repetir, el mismo hecho por otro canal no choca, y
borrar una reserva se lleva sus avisos.

**Del contrato** (20 pruebas): el identificador de chat rechaza
`123/sendDocument`, `../getUpdates` y demás; el enmascarado nunca devuelve el
correo entero.

**En navegador real**, el ciclo completo:

```
Coordinación ve la configuración?   false     Administración?  true
Campo para pegar un token?          ninguno
"123/sendDocument" como chat        rechazado antes de enviarse
Reserva creada (sin pagar)          0 avisos de Telegram
Pago confirmado                     1 aviso, al chat 987654321
Correos simulados                   cliente (en español) + copia interna
¿El aviso filtra el código de puerta?  false
```

---

## 10. Lo que queda fuera

**Reintentos automáticos.** Un envío fallido queda anotado y se puede repetir,
pero nadie lo repite solo. Con el volumen actual es más sensato verlo en el
panel y decidir; una cola de reintentos es infraestructura que todavía no se
justifica.

**Ver los avisos en el detalle de la reserva.** La tabla ya lo registra todo y
el contrato del panel existe; falta la pantalla que lo muestre.

---

## 11. El recordatorio de la víspera

> Etapa 2.6. Código: `apps/api/src/notifications/reminder-sweep.service.ts`.

Existe para reducir las ausencias, que son el gasto más tonto de este negocio:
el equipo se desplaza, no puede entrar y la franja ya no se puede vender a
nadie.

### 11.1. Un barrido, no un temporizador por reserva

Programar un aviso para dentro de tres días exige que el proceso siga vivo tres
días. **No lo está**: cada despliegue lo reinicia, y una caída se lleva por
delante todos los temporizadores pendientes sin dejar rastro.

En su lugar, cada 15 minutos se hace la misma pregunta a la base de datos:

```
¿Qué reservas están CONFIRMADAS,
   empiezan DESPUÉS de ahora,
   empiezan DENTRO de la ventana (24 h por defecto),
   y NO tienen ya un recordatorio enviado?
```

El barrido **no recuerda, recalcula**. Por eso un reinicio no pierde nada, y
una caída de seis horas se recupera sola en la siguiente pasada: las reservas
que debieron avisarse siguen en la ventana y sin registro, así que entran
solas.

La condición «empieza después de ahora» es la que evita el ridículo de mandar,
al volver de una caída larga, recordatorios de limpiezas que ya se hicieron.

### 11.2. Por qué va dentro de la API

La API corre en el plan `starter` de Render, que **no se suspende** por
inactividad (ver el comentario de `render.yaml`). Un servicio de cron aparte
sería una pieza más que desplegar, vigilar y pagar a cambio de nada.

Si algún día hay varias instancias, tampoco pasa nada: la comprobación previa
al envío y el índice único impiden el correo repetido.

### 11.3. La ventana

Configurable desde el panel, entre 2 y 72 horas. Los dos límites tienen motivo:

- **Mínimo 2 h.** Reservar exige 24 horas de antelación, así que alguien puede
  reservar para mañana mismo. Con un valor muy bajo, el recordatorio le
  llegaría pegado a la confirmación, y dos correos casi idénticos en cinco
  minutos se leen como un fallo del sistema.
- **Máximo 72 h.** Más allá deja de ser un recordatorio: avisar con cuatro días
  no evita que a nadie se le olvide.

Con la ventana por defecto de 24 h y un horario comercial de 08:00 a 18:00, el
recordatorio **siempre cae dentro del horario laboral**. No hace falta ninguna
regla de «horas de silencio»: por construcción no puede salir de madrugada.

### 11.4. Dos topes que evitan sorpresas

**100 reservas por pasada.** Un arranque después de mucho tiempo parado
intentaría enviarlo todo de golpe y agotaría la cuota del proveedor de correo.
Lo que no entre se recoge en la siguiente pasada.

**Sin solapes.** Si una pasada tarda más que el intervalo, la siguiente se
salta en vez de acumularse.

### 11.5. El recordatorio no se copia al buzón interno

Un aviso por cada reserva del día siguiente convierte el buzón interno en ruido
diario, y el equipo ya tiene la agenda del panel. Se copia lo excepcional —una
reserva nueva, una cancelación—, no lo rutinario.

### 11.6. Un fallo corregido de camino

Al empezar esta etapa se descubrió que el envío **sí podía duplicarse**. El
orden era: enviar, y después registrar. El índice único bloqueaba el
_registro_, no el _envío_: el segundo intento mandaba el correo y solo entonces
chocaba con la restricción.

En el flujo del webhook no llegaba a ocurrir, porque el webhook tiene su propia
idempotencia aguas arriba. Pero **el barrido lo habría destapado de la peor
forma**: ve la misma reserva cada 15 minutos, así que un cliente con la
limpieza a 20 horas vista habría recibido unos ochenta correos idénticos.

Ahora se comprueba **antes** de enviar. Queda una carrera abierta, pequeña y
asumida: dos instancias que entren en el mismo milisegundo pueden enviar las
dos, y el índice único limita el daño a un único duplicado. La alternativa
—reservar la fila antes de enviar— cambiaría ese duplicado improbable por algo
peor: una fila que dice «enviado» de un correo que nunca salió, si el proceso
muere entre las dos operaciones.

### 11.7. Qué está probado

**Del barrido, contra PostgreSQL real** (14 pruebas): se avisa a una reserva
confirmada de mañana y **no** a una de dentro de tres días, ni a una cancelada,
ni a una pendiente de pago, ni a una que ya pasó; **cuatro pasadas seguidas
mandan un solo correo**, y la segunda ni siquiera considera la reserva; tras
una caída de seis horas las pendientes entran solas, pero las que ya ocurrieron
no; con el recordatorio apagado no se barre nada; la ventana configurable
decide a quién alcanza; un proveedor caído no rompe el barrido y el
recordatorio se reintenta en la pasada siguiente.

**Del contrato** (10 nuevas): se rechazan 0, 1, −5 y 96 horas, y las medias
horas.
