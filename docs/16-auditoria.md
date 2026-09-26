# 16 — Registro de auditoría

> Etapa 2.15. Quién hizo qué, desde dónde y cuándo. Amplía la tabla que
> existía desde la etapa 2.3 (`docs/13-panel-y-permisos.md`) hasta cubrir el
> acceso al panel, las reservas del sitio público y las lecturas de datos
> sensibles, y añade por fin una forma de leerla que no sea abrir la base de
> datos.

---

## 1. Qué faltaba

La tabla `audit_logs` existía desde la etapa 2.3 y ya guardaba los cambios
importantes: cambios de estado, capturas de depósito, ediciones de la ficha de
personal. Lo que no había era todo lo demás:

| Hueco                                          | Por qué importa                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| No constaba **quién entró al panel ni cuándo** | Ante una sospecha, no había forma de saber si esa cuenta se había usado |
| No constaba **desde dónde** se hizo algo       | Coordinación marca trabajos desde la oficina y desde la calle           |
| Las reservas del sitio **aparecían sin más**   | El movimiento más frecuente del sistema no dejaba rastro                |
| Una **mirada** no dejaba ninguna huella        | Es justo lo que hace quien fisgonea: abrir fichas y no tocar nada       |
| **Nadie podía leerlo** sin acceso al servidor  | En una empresa pequeña, esa persona es de la que menos falta protegerse |

---

## 2. Las cuatro reglas del módulo

Todo lo demás se deriva de estas cuatro. Cuando haya que decidir algo nuevo
sobre auditoría, se decide mirándolas.

### 2.1 Solo se inserta y se lee

No hay `UPDATE` ni `DELETE` en ningún servicio, ni endpoint que los ofrezca.
El único borrado del módulo es la purga por antigüedad (§7), que corre sola y
**no elige filas**.

Un registro que se puede modificar no prueba nada, y el día que haga falta
será justo cuando alguien tenga motivos para quererlo cambiar.

### 2.2 Consultar la auditoría también deja rastro

Abrir la pantalla escribe una entrada `audit.queried` **con los filtros
usados**. «Consulté la auditoría» no informa de nada; «consulté todo lo que
hizo esta persona el mes pasado» sí.

Esa escritura es la **única bloqueante** de todo el módulo: si no se puede
dejar constancia de que alguien miró, no se le enseña. Al revés —responder
primero y anotar después sin esperar— dejaría una ventana en la que se
consulta sin rastro, y bastaría provocar fallos de escritura para tener barra
libre. Aquí sí es preferible fallar: quedarse un minuto sin ver la auditoría
no rompe ninguna operación del negocio.

El aviso de que esto ocurre está **siempre visible en la pantalla**, no
escondido en una ayuda. Es lo que convierte el registro en una garantía y no
en vigilancia silenciosa.

### 2.3 Aquí no se guardan datos sensibles

Ni tarjetas, ni contraseñas, ni códigos de puerta, ni datos de contacto del
cliente, ni identificadores de sesión.

Que alguien miró las instrucciones de acceso de una casa **se registra**;
cuáles eran, **no**. Si no, el propio registro se convierte en el sitio más
jugoso del sistema: la lista de códigos de puerta de todos los clientes, en
una sola tabla, sin las protecciones de la ficha original.

Hay una prueba de punta a punta que abre una ficha con código de puerta y
comprueba que ni el código, ni el correo, ni el teléfono del cliente aparecen
en ninguna fila.

### 2.4 Solo administración puede leerlo

Coordinación mueve la agenda y asigna equipos; eso no le da derecho a revisar
la actividad de sus compañeros. La API responde `403` a cualquier otro rol
**y anota el intento** como `session.denied`.

---

## 3. El catálogo: por qué las acciones no son cadenas libres

`packages/types/src/audit.ts` define a mano las acciones y los tipos de
entidad. No se generan solos, a propósito: una acción nueva obliga a pasar por
ahí y a pensar si de verdad hace falta.

Al escribir el catálogo aparecieron **dos errores reales que llevaban meses en
producción sin que nadie los notara**, porque los resultados siempre parecían
plausibles:

| Error                                                                                                                              | Consecuencia                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `entityType` tenía tres o cuatro grafías: `booking`, `Booking`, `Staff`, `BusinessSetting`                                         | Filtrar «todo lo que le pasó a esta reserva» devolvía **la mitad** de las filas                  |
| El cambio de estado se escribía como `booking.status.<estado>` desde el panel y como `booking.status_changed` desde «Mis trabajos» | Filtrar «todas las completadas» **se saltaba exactamente las que marcaba el equipo de limpieza** |

Los dos están corregidos en el código y **el histórico está normalizado** por
la migración `20260926140000_audit_surface`, que además de añadir la columna
`surface` reescribe las grafías antiguas y convierte
`booking.status_changed` en la acción por estado que corresponde.

Sin catálogo, una errata (`bokking.created`) crea en silencio una acción que
no aparece en ningún filtro y que nadie echa de menos hasta que la busca.

### Formato

`entidad.pasado`, en minúsculas y en singular. En pasado porque describe algo
que **ya ocurrió**: la auditoría no registra intenciones.

### La superficie

`PANEL`, `SITE`, `SYSTEM` y `FIELD`. **No se deduce del rol ni de la acción**:
coordinación puede marcar un trabajo desde el panel en la oficina o desde el
móvil en la calle, y para investigar un problema esa diferencia importa.

`FIELD` está declarado y **hoy no lo usa nadie** — el equipo de limpieza entra
al mismo panel, pantalla «Mis trabajos». Se deja para que el día que exista la
aplicación de campo no haya que migrar la tabla.

El campo es **obligatorio y sin valor por defecto** en `AuditEntry`. Un
defecto significaría que el día que alguien olvide indicarlo, la fila dice
«panel» aunque viniera de un barrido nocturno. Se prefiere que no compile.

---

## 4. Quién entró y cuándo

Esto parece un `INSERT` y no lo es. El problema está en **dónde engancharlo**.

La API **no ve el inicio de sesión**: el panel pide el token directamente a
Supabase desde el navegador, y aquí solo llega ese token ya emitido. Lo único
observable es «esta petición trae una sesión que antes no habíamos visto».

Y ahí está la trampa: `/admin/session` se llama al cargar el panel **y cada
vez que la pestaña recupera el foco**. Registrar sin más produciría cien filas
al día por persona por cambiar de pestaña, y el registro dejaría de servir
para lo único que se le pide.

**La solución** es deduplicar por el identificador de sesión del token
(`session_id`), no por el token ni por la persona: ese identificador dura lo
que dura la sesión aunque el token se refresque cada hora.

Se recuerda **en memoria** (`TtlCache`, 12 horas, 2000 sesiones como máximo),
no consultando la base de datos: comprobar en la tabla en cada petición
añadiría una consulta al camino crítico de todas las llamadas del panel para
no escribir nada el 99,9 % de las veces.

| Decisión                                        | Precio que se acepta                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| Deduplicar en memoria                           | Al reiniciar el servidor se escribe **una fila de más por sesión viva**    |
| El proveedor local no emite `session_id`        | En desarrollo **no se registra el acceso**; en producción (Supabase) sí    |
| Se marca la caché **antes** de escribir la fila | Si la escritura falla se pierde esa fila, en vez de reintentarla mil veces |

El identificador de sesión **no se guarda en la fila**, ni como `entityId` ni
en la metadata: es un secreto de una sesión en vigor, y quien leyera el
registro tendría material para intentar suplantarla. Solo vive en memoria.

### Accesos denegados

`session.denied` —credenciales válidas, rol insuficiente— **no se deduplica**.
Es la señal más útil del módulo para seguridad: el personal no anda probando
puertas que sabe cerradas, así que varias seguidas significan o una cuenta
comprometida o alguien fisgoneando. Su repetición **es** la información.

### Lo que no se registra: los intentos fallidos de contraseña

Hoy **no quedan anotados**, y hay que ser claro con el motivo: la comprobación
de la contraseña ocurre entera dentro de Supabase y esta API no la ve.

Supabase ofrece un _Password Verification Hook_: una función de PostgreSQL que
se invoca en cada intento, con `user_id` y `valid`, tanto si acierta como si
falla. Es la única forma de registrarlos. Se ha dejado **fuera de esta etapa a
propósito**, por tres limitaciones que conviene conocer antes de activarlo:

1. Solo se dispara para usuarios que **existen**. Un intento contra un correo
   inventado no genera nada.
2. Una función con un error **puede bloquear todos los inicios de sesión** del
   proyecto, incluido el de quien iba a arreglarla.
3. Hay que crearla y activarla a mano en el proyecto de Supabase; no se
   despliega con este repositorio.

Si algún día se activa, su sitio natural es una acción nueva del catálogo
(`session.failed`) alimentada desde la propia base de datos.

---

## 5. Las lecturas que sí se registran

Auditar cada consulta convertiría el registro en un listado de agendas donde
lo importante queda enterrado. Se registra **una sola lectura**, y hace falta
explicar por qué es distinta.

El detalle de una reserva (`GET /admin/bookings/:id`) es la pantalla que
enseña el nombre, el teléfono, el correo, la dirección completa y —sobre
todo— las instrucciones de acceso a la casa de un cliente. El código de una
puerta.

**Un cambio deja rastro solo. Una mirada no deja ninguno**, y es justo lo que
hace alguien que fisgonea: abrir fichas y no tocar nada. Sin esto, ese
comportamiento es indistinguible de no haber pasado.

Dos detalles de cómo está montado:

- La acción **depende de si la ficha lleva instrucciones de acceso**:
  `access_notes.viewed` si las lleva, `booking.viewed` si no. Así «quién ha
  visto códigos de puerta este mes» es un filtro y no una lectura de todas las
  filas mirando dentro de la metadata.
- Se anota **después** de comprobar que la reserva existe, y **fuera de
  transacción y sin esperar**. Una lectura no puede fallar porque no se pueda
  anotar: se prefiere perder una fila a devolver un error a alguien que solo
  quería mirar.

Las llamadas internas no se auditan. Las acciones que cambian algo vuelven a
leer el detalle para devolverlo actualizado, y esas **ya dejan su propio
rastro**; anotar además una «lectura» por cada cambio duplicaría las filas sin
añadir nada.

---

## 6. Leerlo: `GET /admin/audit`

`ADMIN` únicamente. Solo lectura: no hay `POST`, ni `PATCH`, ni `DELETE`, y
hay una prueba que lo comprueba.

| Filtro       | Qué responde                                           |
| ------------ | ------------------------------------------------------ |
| `actorId`    | Todo lo que hizo una persona                           |
| `action`     | Una acción concreta **del catálogo** (otra da `400`)   |
| `surface`    | Desde dónde                                            |
| `entityType` | Todo lo que le pasó a una reserva, a una ficha…        |
| `entityId`   | A cuál                                                 |
| `from`, `to` | Rango de fechas                                        |
| `limit`      | Tamaño de página. Por defecto 50, **tope duro de 100** |
| `before`     | Cursor de paginación                                   |

### Por qué cursor y no número de página

La tabla crece por el extremo nuevo constantemente. Con `?page=3`, una entrada
que llega mientras se lee empuja a las demás y se acaba **viendo dos veces la
misma fila y saltándose otra**. El cursor es el instante de la última fila
leída, así que eso no puede pasar.

Se pide **una fila de más** que el límite para saber si queda más sin hacer un
`count`, que en una tabla que solo crece obliga a recorrerla entera.

### El nombre de quien actuó

Se resuelve **al leer**, con una sola consulta para toda la página, y **no se
copia en la fila**. Dos consecuencias buscadas:

- Si alguien se cambia el apellido, el historial entero pasa a mostrarlo bien.
- La auditoría **no tiene relación declarada** con `staff`, y no la tiene a
  propósito: una clave foránea con borrado en cascada haría desaparecer el
  rastro de alguien al darle de baja, que es exactamente cuando más falta
  hace. Si la ficha ya no existe queda `null` y el identificador sigue ahí.

### Un fallo encontrado escribiendo las pruebas

El esquema de validación estaba puesto con `@UsePipes()` **a nivel de
método**. Nest aplica esas tuberías a _todos_ los parámetros que puede
validar, decoradores propios incluidos: `@CurrentStaff()` pasaba por
`AuditQuerySchema`, que al no ser estricto se queda con los campos que conoce
y descarta el resto, y `staff` llegaba convertido en `{ limit: 50 }`.

El resultado era el peor posible para un registro de auditoría: **la consulta
se anotaba igual, con un `200` y sin ningún error, pero sin quién la hizo**.
El esquema va ahora en el parámetro `@Query()`. Es el mismo error que ya
estaba documentado en los controladores de reservas; la prueba que comprueba
el autor de la consulta es lo que lo destapó.

---

## 7. La purga: un año y se borra solo

| Variable               | Por defecto | Qué hace                                 |
| ---------------------- | ----------- | ---------------------------------------- |
| `AUDIT_RETENTION_DAYS` | `365`       | Cuánto se guarda. `0` desactiva la purga |
| `AUDIT_PURGE_HOURS`    | `24`        | Cada cuánto se busca. `0` desactiva      |

Un año: lo bastante para cubrir una reclamación, una devolución de cargo o una
discusión sobre quién hizo qué la temporada pasada, y lo bastante corto para
no acumular indefinidamente direcciones IP y movimientos del personal.
**Guardar más de lo que hace falta no es más seguro: es más superficie que
proteger.**

### Suelo de seguridad

Un cero apaga la purga; **un uno borraría casi todo el registro**. Los dos son
un dígito y están pegados en el teclado, pero solo uno es irreversible. Por
eso cualquier retención distinta de cero tiene suelo: **menos de 30 días y la
aplicación no arranca**. El error tipográfico que se paga caro no debe llegar
a producción.

### Cómo corre

- **Hay una pasada al arrancar**, un minuto después. No es impaciencia: el
  intervalo son 24 horas y este proceso se reinicia en cada despliegue. Con
  solo el intervalo, en una semana de varios despliegues diarios la purga no
  llegaría a ejecutarse **nunca** y la retención sería una promesa escrita en
  la documentación y en ningún sitio más.
- **Borra por lotes** de 1000 filas, hasta 50 lotes por pasada. Un borrado de
  cien mil filas en una sola sentencia mantiene la transacción abierta durante
  segundos y bloquea las inserciones; con la auditoría escribiéndose dentro de
  las transacciones de negocio, eso no es una consulta lenta, es el panel
  entero parado. Lo que no entre hoy se recoge mañana.
- **Nunca lanza.** La invoca un temporizador sin nadie escuchando: una
  excepción aquí sería un rechazo de promesa sin capturar, que en Node puede
  tumbar el proceso. La API no se cae por un fallo al borrar filas viejas.

### La purga se cuenta a sí misma

Cuando borra algo escribe una entrada `audit.purged` con cuántas y hasta qué
fecha. Sin ella, un hueco en el historial es indistinguible de un borrado a
mano, que es justo la duda que la auditoría existe para despejar.

No escribe nada cuando no borra nada: una fila diaria diciendo «cero» durante
un año solo sería ruido.

---

## 8. La pantalla

Cuarta pestaña dentro de **Configuración**, y no una pestaña principal del
panel. No es una pantalla de trabajo diario: se abre cuando hay algo que
aclarar, y ponerla junto a la agenda invitaría a pasarse el día mirando lo que
hacen los demás.

Tres decisiones que no son de maquetación:

1. **No recarga al teclear**, al revés que la agenda. Cada consulta deja su
   propia fila, así que refrescar en cada pulsación llenaría el registro de
   consultas sobre sí mismo. Los filtros se aplican al pulsar el botón.
2. **El aviso de que esto se registra está siempre visible.**
3. **La metadata se pinta como texto, nunca como marcado.** Su contenido
   depende de cada acción y parte de él llega de fuera (el motivo que escribe
   alguien al cancelar). Va dentro de un `<pre>` con el texto ya serializado,
   que React escapa.

Las etiquetas de cada acción viven en `packages/i18n` anidadas igual que la
acción (`admin.audit.action.booking.status.confirmed`), así que la clave se
construye pegando la acción tal cual y no hay tabla de equivalencias que
mantener. Hay una prueba que falla si se añade una acción al catálogo sin su
etiqueta en los dos idiomas: sin ella, la fila saldría en pantalla como
`admin.audit.action.lo.que.sea` y solo se descubriría cuando alguien esté
investigando algo, que es el peor momento posible.

Si llega una acción que la pantalla no conoce —una versión del servidor más
nueva— se enseña el código tal cual. Es feo y es correcto: mejor
`booking.refunded` que una fila en blanco.

---

## 9. Qué se comprueba

`apps/api/src/audit/audit.e2e.test.ts`, contra PostgreSQL real (PGlite), con
todas las migraciones aplicadas:

| Bloque           | Qué demuestra                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quién puede leer | `ADMIN` entra; coordinación y limpieza reciben `403` **y su intento queda anotado**; sin sesión, `401`; `POST`/`PATCH`/`DELETE` no existen                                                              |
| Deja rastro      | La consulta se anota con los filtros usados, con su autor, y **ya está escrita cuando llega la respuesta**                                                                                              |
| Qué se guarda    | La lectura con instrucciones de acceso se distingue; **el código de puerta, el correo y el teléfono no aparecen en ninguna fila**; el acceso se anota una vez por sesión y sin guardar su identificador |
| Filtros          | Filtra por acción; rechaza una acción fuera del catálogo; rechaza una página mayor que el tope; la segunda página continúa sin repetir; el nombre se resuelve al leer                                   |
| Purga            | Borra lo caducado, deja lo reciente, deja constancia; no anota nada cuando no borra nada                                                                                                                |

Además:

- `apps/api/src/bookings/bookings.e2e.test.ts` comprueba que la reserva del
  sitio público deja rastro con `surface: SITE`, `actorType: CUSTOMER` y **sin
  datos del cliente** en la metadata.
- `apps/api/src/common/config/env.test.ts` comprueba el suelo de la retención.
- `packages/i18n/src/i18n.test.ts` comprueba que todo el catálogo tiene
  etiqueta en inglés y en español.

---

## 10. Lo que queda fuera

- **Intentos fallidos de contraseña** (§4). Requiere un _hook_ en Supabase que
  hay que crear a mano y que, mal escrito, bloquea todos los accesos.
- **Exportar el registro** a CSV. No se ha pedido, y una exportación es
  justamente la forma de sacar de la aplicación algo que dentro está
  controlado; si llega, se audita también.
- **Alertas automáticas** ante varios `session.denied` seguidos. La señal ya
  se guarda y se puede filtrar; avisar sola es otra etapa.
- **Firmar las entradas** para detectar manipulación directa en la base de
  datos. Con `RLS` activada y sin `UPDATE`/`DELETE` desde la aplicación, quien
  pueda alterarlas ya tiene acceso al servidor; encadenar firmas protegería de
  ese caso y todavía no compensa la complejidad.
