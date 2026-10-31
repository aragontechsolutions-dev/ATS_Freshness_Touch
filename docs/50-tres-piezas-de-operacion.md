# 50 — Tres piezas de operación

> Etapa 3.34. Tres cosas pequeñas que salieron de una misma conversación: qué
> hacer con las fotos de las clientas de siempre, y cómo enterarse antes de lo
> que hay que hacer.
>
> **Ninguna cambia una regla.** Las tres hacen que las reglas que ya había se
> puedan cumplir sin depender de que alguien se acuerde.

| Pieza                                    | Qué tapa                                                          |
| ---------------------------------------- | ----------------------------------------------------------------- |
| **A.** Alta rápida de permiso antiguo    | Archivar un permiso verbal convertido en escrito cuesta 10 campos |
| **B.** Aviso de piezas sin permiso       | Una foto sin permiso no se publica **y no se queja**              |
| **C.** Correo a quien asigna los equipos | La reserva entra y nadie con el correo delante se entera          |

---

## 0. La pregunta que lo originó: ¿cómo se enlaza un permiso con el cliente?

**No hay UID, y es deliberado.** `media_consents` no tiene clave foránea a
`customers` ni a `bookings`. Lo que ata la ficha es un conjunto de datos
copiados: la referencia de la reserva, el nombre, el correo, la dirección de
la propiedad y la fecha del servicio.

```
apps/api/src/privacy/privacy.service.ts

  LOS PERMISOS DE IMAGEN SE BUSCAN POR CORREO y no por relacion: la tabla
  no cuelga del cliente, porque un permiso lo puede firmar quien vive en
  la casa sin ser quien contrato.
```

El permiso es **de esa casa y de ese día**, no del cliente en general. Con una
relación a `Customer`, el caso del dueño que alquila no tendría dónde encajar:
ahí hacen falta dos permisos y uno de los dos no es cliente de nadie.

Cuando alguien reserva online y marca la casilla, no se guarda «dijo que sí»:
se rellena la misma ficha que se teclearía a mano, con `evidenceKind:
'WEB_FORM'`, `channels: ['WEBSITE']` —el texto del formulario autoriza la web
y nada más—, `occupantConsent: false` —quien reserva no puede dar el permiso
de quien vive allí— y **sin piezas atadas**, porque el vídeo todavía no
existe. Y se le manda constancia con un enlace que lo retira al momento.

---

## A. Alta rápida de permiso antiguo

### El caso

La empresa lleva años limpiando las mismas casas y tiene fotos de ese trabajo
con el permiso dado **de palabra**.

> **Un permiso verbal no vale.** No porque sea inválido en todos los casos,
> sino porque no se puede demostrar, y el día que haga falta es precisamente
> el día en que el cliente dice que no lo dio. — `docs/38` §2

Eso **no cambia**, y no se añadió ningún tipo de prueba «VERBAL»: sería
escribir en el registro que hay una prueba donde no la hay, y convertiría el
módulo entero en decorativo.

Lo que sí se puede es **convertirlo en escrito**, que cuesta un WhatsApp. El
contrato ya admitía `MESSAGE` y `EMAIL` como clases de prueba desde el
principio; lo que faltaba era que archivarlo no costara diez decisiones.

### Qué hace el atajo

Un segundo botón —«Clienta de siempre (permiso por mensaje)»— que abre **el
mismo formulario** con lo que en este caso tiene una sola respuesta ya puesto:

| Campo            | Qué propone | Por qué                                           |
| ---------------- | ----------- | ------------------------------------------------- |
| `evidenceKind`   | `MESSAGE`   | Es lo que se tiene: un mensaje con el «sí» dentro |
| `signedAt`       | Hoy         | El permiso nace cuando se da por escrito          |
| `coversInterior` | sí          | El mensaje pide fotos del trabajo                 |
| `coversExterior` | sí          | Ídem                                              |
| `channels`       | Solo la web | Es lo que dice el mensaje que se le manda         |

Y esconde lo que en este caso no se toca: ocupación por terceros, qué cubre,
canales y notas. **Es el mismo formulario**, no otro: dos formularios que
guardan la misma ficha se separan solos, y el día que el contrato cambie habría
que acordarse de los dos.

### Lo que el atajo NO hace, y es lo que más importa

- **No marca el «antes».** Es la parte sensible —la casa sucia de una persona
  concreta— y un atajo que la diera por marcada publicaría eso sin que nadie lo
  hubiera decidido. Hay una prueba.
- **No rellena la fecha del servicio.** Es de cada clienta, y una fecha
  inventada es justo el dato que no sirve el día que importa.
- **No se salta nada.** Es el mismo contrato, el mismo servidor y las mismas
  validaciones. Y hay una puerta para ver todos los campos sin perder lo
  escrito: el día que la casa la habite otra persona, el atajo no puede ser una
  trampa.

### El procedimiento, de principio a fin

1. Mandarle un mensaje y conseguir el «sí» por escrito.
2. Captura de pantalla.
3. Atajo → rellenar nombre, casa, fecha del servicio y referencia (texto libre:
   `WA-2026-ANA` vale).
4. **Adjuntar la captura.** Va al almacén privado, que no se abre pegando una
   dirección en el navegador.
5. Enlazar las fotos y los vídeos. En ese momento empiezan a publicarse.

Con correo, el sistema manda sola la constancia con el enlace de retirada. **Sin
correo la ficha vale igual**, pero retirar dependerá de que alguien lea un
mensaje.

---

## B. Las fotos que se quedan en el limbo

### El fallo es silencioso por diseño

La galería pública es una **lista blanca**: solo sale lo que tiene un permiso
firmado y en pie. Esa regla es la que impide publicar la casa de alguien sin su
permiso y no se toca.

Lo que trae de serie es que una pieza sin permiso **no da error**. Se sube, se
guarda, se ve en el panel, y no aparece en la web. Quien la subió cree que ya
está puesta; nadie recibe nada; la foto se queda ahí para siempre.

La pantalla de la galería ya lo dice —«hay N piezas que no se están
publicando»— pero hay que abrirla para leerlo, y justamente no se abre cuando
se cree que el trabajo ya está hecho. **Es la misma historia que el log que
nadie leía** (`docs/47`): el motivo tiene que venir a buscarte.

### Cómo funciona

Un barrido diario cuenta las piezas sin permiso y, si alguna lleva más de
**tres días**, deja un aviso en la bandeja de administración.

**No avisa el primer día**, y es deliberado: el orden normal de trabajo es subir
la foto y anotar el permiso después, a veces al día siguiente, cuando el
cliente contesta. Avisar el mismo día convertiría el aviso en parte del
procedimiento, y lo que suena siempre se deja de leer.

**No repite.** Esto no avisa de un hecho, avisa de un **estado**, y un estado
sigue siendo verdad mañana. Antes de dejar nada en la bandeja se mira si ya hay
un aviso de esa clase en la ventana actual — y se mira **en la tabla**, no en
memoria, para que un reinicio no vuelva a avisar de todo.

### `addedAt`, y las dos decisiones que lleva dentro

Las piezas no tenían fecha de alta. Ahora sí, en el JSON de la galería (sin
migración).

1. **La pone el servidor, no el navegador.** Es el dato con el que se decide a
   quién molestar, y eso no puede venir del cliente. Al reguardar se conserva la
   que la pieza ya tenía, así que **corregir un título no reinicia el reloj** —
   hay una prueba, porque sin ella bastaría con tocar un título para que una
   foto olvidada volviera a parecer recién subida.
2. **`null` cuenta como VIEJA.** Es lo contrario de lo que parece prudente, y es
   lo correcto: las piezas que hay hoy sin permiso son exactamente las que hay
   que mirar, y tratarlas como recién llegadas dejaría el aviso mudo justo para
   ellas.

### Un fallo que encontró una prueba

El antirrebote usaba el reloj que se le pasa a la pasada. En producción da
igual —son el mismo— pero en una prueba que adelanta el reloj una semana para
envejecer una foto, se estaba preguntando «¿hay avisos de dentro de una
semana?» contra filas que la base sella con la hora real: no encontraba
ninguno y **el aviso se repetía en cada pasada**.

Ahora `ahora` mide **solo la edad de las piezas**; lo que ya se avisó no se
simula, porque está escrito en la tabla con la hora del servidor.

---

## C. El correo a quien asigna los equipos

### Lo que ya había, y por qué no bastaba

Cuando entra una reserva confirmada salían dos avisos hacia dentro: un mensaje
de Telegram al chat de operaciones y **una copia del correo del cliente** al
buzón interno.

La copia interna es útil cuando el cliente llama —se ve exactamente lo que
tiene delante— y no sirve para repartir trabajo: está escrita para él, lleva el
precio, y no dice lo único que importa aquí, que **esa reserva no tiene equipo
todavía**.

### Qué se añade

Un destinatario nuevo en Ajustes → Avisos: **«Avisar a quien asigna los
equipos»**. Vacío = apagado, igual que la copia interna y que los chats de
Telegram: el interruptor es la propia dirección, y así no hay forma de tener un
buzón puesto y el aviso apagado sin darse cuenta.

El correo lleva **referencia, cuándo (franja de principio a fin), ciudad y
servicio**. Y nada más:

| Qué NO lleva          | Por qué                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| El nombre del cliente | No hace falta para poner un equipo                                             |
| La calle              | Ídem, y una dirección por correo se queda para siempre en un buzón             |
| El importe            | Quien coordina mueve la agenda y no cobra: la factura no entra en esa decisión |

Hay una prueba que busca el nombre, la calle, el correo y el símbolo del dinero
en el cuerpo del mensaje — **con los datos reales de la reserva de prueba**, no
con una lista inventada que pasaría por casualidad.

### Tres decisiones

**Una audiencia nueva, `DISPATCH`, y no reutilizar `INTERNAL`.** El registro de
envíos tiene un índice único sobre `(bookingId, event, channel, audience)`: con
`INTERNAL` los dos correos de la misma reserva serían la misma fila, y el
segundo chocaría con el índice **después** de haberse enviado. Enviado y sin
registrar.

**El idioma se pregunta.** Es el único correo del sistema que no tiene de quién
sacarlo: los del cliente van en el que eligió, los del personal en el de su
ficha, y este va a un **buzón**. Fijarlo en el código era adivinar. No se usa el
del cliente: que el aviso interno llegue en español porque el cliente reservó en
español sería escribirle al equipo en un idioma que eligió otra persona.

**No lleva enlace al panel.** Haría falta una variable de entorno con su
dirección, y una variable mal puesta pone un enlace roto en **todos** los
correos. El día que se quiera, es una línea.

### Y el compilador obligó a decidir una cosa más

Al añadir la audiencia, `telegramChatForAudience` dejó de compilar: su `switch`
es exhaustivo a propósito, para que «¿a dónde va esto?» tenga una sola
respuesta y un solo sitio donde cambiarla.

La respuesta para `DISPATCH` es **ningún chat**: quien asigna sí está en el de
operaciones, pero ese chat **ya recibe** su mensaje por cada reserva nueva, y
dos avisos del mismo hecho enseñan a no leer ninguno. Esta audiencia existe
para el correo, que es el canal que faltaba.

---

## Repaso de seguridad

| Riesgo                                           | Cómo queda                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Convertir el registro de permisos en decorativo  | No se añadió «permiso verbal». El atajo archiva una prueba escrita de verdad    |
| Publicar el «antes» sin que nadie lo decida      | El atajo nunca lo marca. Prueba propia                                          |
| Que el atajo sea una vía para saltarse una regla | Mismo contrato, mismo servidor, mismas validaciones. Y puerta para ver todo     |
| Una foto publicada sin permiso                   | La lista blanca no se tocó: sigue sin servirse nada sin permiso vivo            |
| Datos de cliente en la bandeja                   | Solo cuántas piezas y cuántos días                                              |
| Datos de cliente en el correo de asignación      | Ni nombre, ni calle, ni importe. Prueba con los datos reales de la reserva      |
| Un correo enviado y sin registrar                | Audiencia propia: el índice único no los confunde                               |
| Que la fecha de alta la manipule el navegador    | La sella el servidor y conserva la anterior. Prueba de que reguardar no la toca |
| Que el aviso de la bandeja se vuelva ruido       | Tres días de gracia y un aviso por ventana, con la tabla como memoria           |
| Que un barrido tumbe la API                      | No propaga: registra y sigue                                                    |
| Un botón de copiar que falla en silencio         | Devuelve si pudo; si no, enseña el texto. Prueba sin portapapeles               |

---

## Al desplegar

1. **Una migración**: `20261031100000_el_aviso_al_que_asigna` (`pnpm
db:deploy`). Solo añade el valor `DISPATCH` a la enumeración de audiencias.
2. **Una variable nueva**: `GALLERY_CONSENT_SWEEP_HOURS` = `24`, ya en
   `render.yaml`. Cero lo apaga.
3. **A mano, en el panel**: rellenar «Avisar a quien asigna los equipos» con el
   buzón de quien reparte el trabajo, y elegir el idioma. Sin eso, esa pieza no
   hace nada — a propósito.

## Lo que queda fuera

- **Un enlace al panel en el correo de asignación.** Ver arriba.
- **Avisar por SMS.** Sigue bloqueado por el registro A2P 10DLC (`docs/43`, D).
- **Que el atajo mande el mensaje por WhatsApp.** Lo manda la persona desde su
  teléfono; automatizarlo exigiría la API de WhatsApp Business, que es otra
  etapa y otro proveedor.
