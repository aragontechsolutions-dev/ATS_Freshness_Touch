# 27 — Las listas de verificación de un trabajo

Qué hay que hacer en cada estancia de la casa, marcado a medida que se hace.
Es lo que el equipo mira al llegar y lo que coordinación mira cuando un
cliente llama diciendo que algo se quedó sin hacer.

> ## ✅ El catálogo tiene contenido desde el 1/11/2026
>
> **59 tareas**, transcritas de la lista que escribió la dueña para la app del
> equipo de limpieza. Estuvo vacío desde la Etapa 2 a propósito, y el aviso
> que había aquí decía por qué: _una lista de limpieza verosímil pero que no
> es la de esta empresa es peor que ninguna lista, porque alguien la daría por
> buena y quedaría registrado que se hizo un trabajo que nadie pidió._
>
> Lo que hay que saber de la transcripción:
>
> | Dato                        | Valor                                                                       |
> | --------------------------- | --------------------------------------------------------------------------- |
> | Tareas en el catálogo       | 59                                                                          |
> | Estándar                    | 39 (cocina 12, baños 10, habitaciones 8, sala/comedor/pasillos/escaleras 9) |
> | Profunda                    | las 39 anteriores **más 11**                                                |
> | Entrada o salida de mudanza | las 50 anteriores **más 4**                                                 |
> | Solo con el extra pagado    | 5, que **no** entran en ninguna limpieza                                    |
>
> **Lo que todavía no está, y está en la lista de la dueña:** los tres estados
> (Completada / Pendiente / **No aplica**) y el motivo cuando una tarea queda
> pendiente. Hoy una tarea solo está marcada o no. Eso es la Etapa 2 y pide
> **una migración**: ver §11.

---

## 1. La decisión que sostiene todo: se guarda lo marcado, no la lista

La base de datos **no guarda una copia de la lista por cada trabajo**. Guarda
**una fila por tarea marcada**, con su código, quién la marcó y cuándo. La
lista que se pinta sale del catálogo, que vive en el código.

La alternativa era copiar las cuarenta tareas sobre cada reserva al
crearla —una «fotografía», como se hace con el precio—. Se descartó, y
conviene tener escrito por qué:

| Motivo                                           | Detalle                                                                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El precio se fotografía porque es un acuerdo** | Lo que se pactó con el cliente no puede cambiar porque alguien toque la pantalla de Tarifas. Una lista de tareas **no es un acuerdo con nadie**: es cómo trabaja esta empresa, y cuando cambia, cambia para todos |
| **Cuarenta filas por reserva, vacías**           | Con mil trabajos al año son cuarenta mil filas que casi siempre dicen «no marcada», que es exactamente lo mismo que no tener fila                                                                                 |
| **Habría que escribirlas al reservar**           | Dentro del camino del dinero. Ese camino ya hace demasiado; cualquier cosa que se le añada es una forma nueva de que **una reserva pagada falle**                                                                 |

### 1.1 El precio de esa decisión, y cómo se paga

Si la lista sale del catálogo, cambiar el catálogo cambia lo que se ve en un
trabajo de hace tres meses. Eso se acota con **una sola regla**:

> **Un código de tarea no se borra nunca ni se reutiliza.** Se retira con
> `retired: true` y se queda en el catálogo para siempre.

Es la misma regla que ya siguen los servicios retirados y las zonas `D` y `E`
(`docs/21` §2 y §3): su código está escrito en reservas que ya existen, y
borrarlo dejaría el histórico ilegible.

Una tarea retirada **deja de ofrecerse** en los trabajos nuevos y **sigue
leyéndose** en los viejos donde se marcó, señalada como «esto ya no se pide».
Si se dejara fuera, un trabajo de hace tres meses parecerían siete tareas
cuando se hicieron nueve, y la lista estaría mintiendo justo cuando se
consulta por un motivo.

---

## 2. Las cinco estancias

`KITCHEN`, `BATHROOM`, `BEDROOM`, `COMMON_AREAS` y `WHOLE_HOUSE`, **en ese
orden**, que es el de la lista de la dueña y el del recorrido de la casa. Se
respeta al pintar: una lista que salta de la cocina al baño y vuelve al salón
obliga a leerla entera varias veces para no dejarse nada.

### 2.1 Dos cambios respecto a lo que había, y los dos son suyos

- **Las habitaciones tienen lista propia.** Antes entraban en áreas comunes,
  porque las plantillas antiguas no las separaban. Su lista sí las separa, y
  tiene tareas que no están en ningún otro sitio: **cambiar las sábanas** y
  **tender las camas**.
- **`WHOLE_HOUSE` no es una estancia**, y por eso va la última. Es donde caen
  las tareas de la limpieza profunda y de mudanza que no pertenecen a una
  habitación concreta: zócalos, puertas, rejillas, ventiladores. Su lista las
  escribe así, en bloque y después de las estancias, porque es como se hacen:
  recorriendo la casa entera una vez.

> **Cambiar esta lista es seguro.** La estancia **no se guarda en la base de
> datos**: allí solo está el código de la tarea. La estancia sale del catálogo
> cada vez que se pinta.

### 2.2 Una lista por tipo de estancia, no por habitación

Una casa con tres baños tiene **diez** tareas de baño, no treinta. Es lo que
dice la lista de la dueña —una sola lista de baños— y es lo que se puede
marcar de pie con una mano.

---

## 3. Qué se puede marcar, y qué no

| Pregunta                         | Respuesta                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| ¿Quién marca?                    | **Solo quien está asignado** a ese trabajo. Se comprueba en el servidor, no por rol |
| ¿Puede marcar coordinación?      | **No**, ni siquiera ADMIN, salvo que esté asignada al trabajo                       |
| ¿Se puede desmarcar?             | **Sí**                                                                              |
| ¿Bloquea terminar el trabajo?    | **Nunca**                                                                           |
| ¿En qué estados se puede marcar? | `CONFIRMED`, `IN_PROGRESS` y `COMPLETED`                                            |

### 3.1 Se puede desmarcar, y es deliberado

Esta pantalla se usa de pie, con una mano y a veces con guantes: **los toques
equivocados son la norma, no la excepción**.

Una lista que no se puede corregir tiene un resultado predecible: la primera
vez que alguien marque sin querer «horno limpiado», aprenderá que la lista
miente y dejará de usarla. Y una lista en la que nadie confía no sirve para lo
único que tiene que servir: responder a un cliente que llama diciendo que algo
se quedó sin hacer.

### 3.2 No bloquea terminar el trabajo

Es la misma regla que el fichaje (`docs/25` §2): el botón de «he terminado» es
lo que **registra la salida**, y negarlo porque falta un toque deja a la
empleada en la puerta de una casa sin poder cerrar su trabajo.

Lo que sí hace es **avisar**: «te quedan 3». Y coordinación lo ve después.

### 3.3 `COMPLETED` admite marcar, y no es un descuido

Lo normal es acabar de marcar la última tarea **justo después** de pulsar «he
terminado». Negarlo convertiría el último toque de cada trabajo en un fallo
delante de alguien que acaba de hacer bien su trabajo.

Los que quedan fuera son `CANCELLED` —a esa casa no fue nadie—, `NO_SHOW` —el
cliente no estaba— y `PENDING_PAYMENT`, que es una reserva que todavía no
existe de verdad. Marcar tareas en cualquiera de los tres solo podría crear un
registro que contradice al estado.

La lista de estados está **en el contrato**
(`CHECKLIST_EDITABLE_STATUSES`) y no en cada lado: el servidor la usa para
rechazar y la pantalla para decidir si pinta las casillas. Con dos listas, la
pantalla acabaría ofreciendo casillas que el servidor rechaza, y cada toque
daría un error que nadie sabría explicar.

### 3.4 La tarea de un extra no existe si ese extra no se pagó

Cinco tareas del catálogo llevan `requiresAddOn`:

| Tarea                    | Extra que exige        | ¿Se vende hoy?              |
| ------------------------ | ---------------------- | --------------------------- |
| `ADDON_INSIDE_OVEN`      | `INSIDE_OVEN`          | **Sí**                      |
| `ADDON_INSIDE_FRIDGE`    | `INSIDE_FRIDGE`        | **Sí**                      |
| `ADDON_INSIDE_CABINETS`  | `WINDOWS_AND_CABINETS` | No (`OFFERED_ADD_ON_CODES`) |
| `ADDON_INTERIOR_WINDOWS` | `WINDOWS_AND_CABINETS` | No                          |
| `ADDON_LAUNDRY`          | `LAUNDRY`              | No                          |

El interior del horno, el del refrigerador, los gabinetes por dentro, los
vidrios y doblar la ropa **no entran en ninguna limpieza**, ni siquiera en la
profunda o en la de mudanza: se pagan aparte. La lista de la dueña lo dice dos
veces, en la sección de extras y otra vez en las aclaraciones.

> **Las tres últimas filas no aparecerán en ninguna casa todavía**, porque sus
> extras no están a la venta. Es correcto y está escrito a propósito: el día
> que se ofrezcan, la tarea ya funciona sin tocar nada.

**Sin esto habría que elegir entre dos cosas malas**, y las dos cuestan
dinero de verdad: ofrecer la tarea siempre, y que el equipo limpie un horno
que nadie pagó; u omitirla siempre, y que alguien lo pague y no aparezca en la
lista.

**La comprobación está en el servidor, no en la pantalla.** El móvil manda el
código de la tarea, y quien tenga sesión de limpieza puede mandar el que
quiera. Sin la comprobación en `esTareaDelTrabajo`, quedaría escrito en la
base de datos que se limpió por dentro un horno que nadie contrató — y eso es
exactamente lo que coordinación lee cuando un cliente reclama, y lo que
sostiene el cobro de un extra.

**Si un ajuste de campo quita el extra después de marcar la tarea**, la tarea
sale de la lista de hoy y **se sigue leyendo señalada**, por el mismo camino
que una tarea retirada (§1.1). No se pierde el registro de un trabajo que se
hizo de verdad.

**Los extras se releen del JSON con el contrato** (`extrasContratados`, que
usa el mismo `ExtrasGuardadosSchema` que el precio y los ajustes de campo).
Una lista ilegible cuenta como «sin extras», y que el fallo caiga de ese lado
es lo correcto aquí: una lista a la que le falta la tarea del horno **se
nota** —el equipo pregunta— y no deja rastro falso; una lista con la tarea del
horno que nadie pagó **se marca**, y entonces la base de datos afirma que se
hizo un trabajo que no se vendió.

---

## 4. Marcar es idempotente, y hace falta que lo sea

Dos toques seguidos no dejan dos filas: lo impide un índice único sobre
`(bookingId, itemCode)` en la base de datos. No es una optimización, es lo que
hace falta con una conexión mala en la puerta de una casa, donde el doble
toque y el reintento son la norma.

**Y el segundo toque de otra persona no le roba la autoría al primero.** El
`upsert` lleva el `update` **vacío** a propósito: si volviera a escribir el
autor y la hora, el segundo toque de una compañera convertiría «lo hizo Cleo»
en «lo hizo Darío», borrando a quien de verdad lo hizo.

Desmarcar borra la fila, con `deleteMany` y no `delete`: desmarcar algo que no
estaba marcado **no es un error**, es el resultado que se pedía.

---

## 5. No hay auditoría por cada toque, y es deliberado

Una lista estándar son treinta y nueve tareas —cincuenta y cuatro en una
mudanza con extras—, y un trabajo de dos personas con sus correcciones pasa
del centenar de escrituras. Auditarlas enterraría bajo
miles de líneas al mes lo que coordinación de verdad busca en la auditoría:
quién cambió un precio, quién canceló una reserva, quién entró al panel.

**Y no se pierde nada:** la propia fila **es** el registro. Lleva quién la
marcó y a qué hora, que es exactamente lo que una entrada de auditoría
guardaría. La auditoría de este proyecto guarda **qué cambió**, no un volcado
de todo lo que pasa (`docs/16-auditoria.md`).

---

## 6. Un solo componente para las dos pantallas

`JobChecklist` lo usan la pantalla de limpieza —donde se marca— y el detalle
del panel —donde solo se lee—. La diferencia es un parámetro: sin `onToggle`,
las tareas se pintan como texto y no como casillas.

**No es ahorro de código:** es que coordinación y limpieza vean **la misma
lista del mismo trabajo**. Dos componentes acabarían divergiendo —un orden
distinto, una tarea retirada que uno esconde y el otro no— y esa es la clase
de discrepancia que convierte «yo lo marqué» en una discusión sin árbitro.

Por el mismo motivo, la lista se monta en **un solo sitio del servidor**
(`montarChecklist`, en `apps/api/src/admin/job-checklist.helper.ts`), y las dos
respuestas de la API la traen ya montada.

### 6.1 Detalles de la pantalla que no son decoración

- **Una casilla de verdad (`<input type="checkbox">`)**, no un `div` con
  `onClick`: se marca con el teclado, el lector de pantalla dice «marcada /
  sin marcar», y el área pulsable es toda la línea. Medido en el navegador:
  **entre 48 y 60 px de alto**, por encima de los 44 px que es el mínimo que
  se acierta de pie.
- **La casilla se mueve en el acto, antes de que el servidor conteste**, y si
  el servidor dice que no vuelve a su sitio exactamente como estaba. No es un
  adorno: en una casa con mala cobertura pasan dos segundos entre el toque y
  el movimiento, y esa espera no se lee como «está guardando», se lee como
  «no me ha cogido el toque». Se vuelve a pulsar, y así es como una lista de
  cuarenta tareas acaba marcada a medias.
- **Sin reloj de espera y sin deshabilitar la casilla.** El movimiento ya es
  la confirmación, y deshabilitarla mientras se guarda impediría corregir un
  toque equivocado justo en el segundo en que uno se da cuenta.
- **Sin aviso al acertar, y sí al fallar.** Es lo contrario que al fichar
  (`docs/25` §6), y la diferencia está razonada: fichar ocurre una vez y hay
  que quedarse tranquilo de que quedó registrado; marcar tareas ocurre
  cuarenta veces en una casa, y cuarenta avisos seguidos tapan la
  pantalla. **La casilla marcándose ya es la confirmación.** Lo que sí avisa
  es el fallo, porque una casilla que vuelve sola a su sitio sin explicación
  se lee como que la pantalla va mal.
- **La lista va debajo de la dirección y encima de los botones.** La dirección
  y el teléfono son lo que se necesita **antes** de llegar; las tareas,
  después de entrar. Puesta arriba empujaría hacia abajo lo primero que hay
  que mirar conduciendo.
- **Una tarea retirada se pinta apagada, no en verde.** En la pantalla de
  limpieza convive con casillas azules marcables, y en verde se leería como
  «está más hecha que las demás». Es lo contrario: es historia, no trabajo de
  hoy.
- **El mismo número se dice de dos formas.** «Te quedan 3» para quien está en
  la casa; «3 tareas sin marcar» para coordinación, que lee un trabajo ya
  cerrado. No es lo mismo ni se actúa igual.

---

### 6.2 La carrera que desmarcaba tareas ya marcadas

**Esto fue un fallo real, de datos, y estuvo en `main`.** Merece contarse
entero porque la clase de fallo se repite.

Cada respuesta de marcar trae **el trabajo entero** tal como estaba el
servidor al atenderla —así es como aparece lo que haya marcado una
compañera—. Marcando dos tareas seguidas, que es exactamente como se usa,
hay dos peticiones en vuelo a la vez. Y **la red no garantiza el orden de
llegada**: si la respuesta de la primera llega la última, trae una foto
**sin** la segunda marca, y repintar con ella **desmarca en pantalla algo que
en la base de datos está marcado**.

La base nunca estuvo mal. Lo que mentía era la pantalla, que es peor: quien
limpia ve la tarea sin marcar, la vuelve a marcar, y acaba desconfiando de la
lista.

**No se ve probando.** Hace falta que dos respuestas se crucen, y en un
portátil con fibra no se cruzan nunca. Se encontró releyendo el código, y la
prueba que lo fija (`MyJobs.test.tsx`) resuelve las dos promesas al revés a
propósito.

La corrección es una regla de una línea: **solo se adopta la foto del
servidor cuando la respuesta viene de la última petición enviada.** Las demás
se descartan, porque son viejas por construcción. Lo que está pintado en
local ya es correcto para las marcas propias.

> **Y una advertencia sobre las pruebas de esto.** La primera versión del
> archivo de pruebas ponía `input.checked` a mano antes de lanzar el evento.
> React lleva su propio rastreador del valor de cada campo y **suprime el
> evento de cambio cuando el valor que encuentra ya coincide**: el manejador
> no llegaba a ejecutarse nunca y **las seis pruebas pasaban sin probar
> nada**. Se pulsa con `input.click()`, como lo haría un dedo.

## 7. Seguridad

Lo que se revisó al cerrar la etapa:

- **El filtro por asignación va en la consulta, no después.** Un trabajo
  ajeno responde **404 y no 403**, por el mismo motivo que en el resto de la
  pantalla: un 403 enseñaría que esa reserva existe, y probando
  identificadores se podría ir dibujando la agenda de la empresa. Hay prueba
  de punta a punta, **validada quitando el filtro a propósito** para
  comprobar que la prueba se pone en rojo.
- **El código de tarea se comprueba contra el catálogo del servicio.** Es una
  comprobación de seguridad, no de forma: sin ella, cualquiera con sesión
  podría escribir una fila por cada cadena que se le ocurriera y usar la lista
  como **un almacén de texto libre colgado de una reserva**. También
  validada quitándola a propósito: cuatro pruebas se ponen en rojo.
- **Y se comprueba contra los extras que esa reserva pagó** (§3.4). Es la
  misma comprobación y el mismo sitio, pero protege otra cosa: que no quede
  registrado un trabajo que no se vendió. Tiene prueba de punta a punta, que
  verifica el 400 **y que no se escribió ninguna fila**: un 400 con la fila
  puesta sería peor que no tener la comprobación, porque parecería correcto.
- **El contrato acota el código a 64 caracteres.** Sin el tope, cada toque
  podría escribir en la base una cadena de un megabyte.
- **El cuerpo es estricto.** `doneAt` y `doneByStaffId` los pone el servidor
  —la hora porque el reloj de un móvil se cambia a mano, el autor porque sale
  de la **sesión**— y mandarlos desde el cliente es un 400.
- **La tabla tiene RLS activado**, como todas (lo comprueba
  `migrations.test.ts`). Aquí lo que protege no es un dato del cliente: es el
  ritmo de trabajo de personas concretas, a qué hora marcó cada cual cada
  tarea en cada casa.
- **Una tarea marcada no se borra al dar de baja a quien la marcó**
  (`ON DELETE RESTRICT`), igual que un fichaje: es el registro de un trabajo
  hecho, y que desaparezca es justo lo que no debe pasar, porque es cuando más
  falta hace poder mirarlo.
- **No hay ningún dato nuevo del cliente en esta etapa.** La lista no toca
  importes, ni teléfonos, ni códigos de puerta.

---

## 8. El catálogo entra por la puerta de delante

`JOB_CHECKLIST_CATALOG_TOKEN` es un proveedor de NestJS, igual que el de pagos
o el de geocodificación. En producción **siempre** es el catálogo real; lo
único que lo sustituye son las pruebas.

No es un capricho de diseño, y el motivo **cambió al llenarse el catálogo**.
Cuando estaba vacío, sin el token el camino de escritura no se podía probar en
absoluto. Ahora que tiene 59 tareas con códigos largos
—`KITCHEN_APPLIANCE_FRONTS`—, el motivo es otro: una prueba que use esos
códigos deja de verificar el endpoint y pasa a verificar **que ese código
sigue existiendo**. El día que la dueña reordene su lista se caerían las
pruebas de marcar, desmarcar y rechazar un trabajo ajeno, por un motivo que no
tiene nada que ver con lo que comprueban.

Con el token, la prueba de punta a punta pasa un catálogo de cinco tareas de
mentira y recorre **el mismo código** que producción.

Y queda un tercer motivo, para después: **el día que el catálogo salga del
código y lo edite coordinación desde el panel, el sitio por donde entra ya
está hecho.**

---

## 9. Dónde está cada cosa

| Qué                                   | Dónde                                                      |
| ------------------------------------- | ---------------------------------------------------------- |
| El contrato y el catálogo (59 tareas) | `packages/types/src/job-checklist.ts`                      |
| El filtro por servicio y por extra    | `checklistForService`, en el mismo archivo                 |
| Los textos de las tareas              | `packages/i18n/src/en.ts` y `es.ts`, en `checklist.items`  |
| Los nombres de las estancias          | los mismos archivos, en `checklist.rooms`                  |
| La tabla                              | `apps/api/prisma/migrations/20261001160000_job_checklist/` |
| Montar la lista y validar el código   | `apps/api/src/admin/job-checklist.helper.ts`               |
| Leer los extras del JSON de la base   | `extrasContratados`, en el mismo archivo                   |
| Marcar y desmarcar                    | `apps/api/src/admin/my-jobs.service.ts`                    |
| El endpoint                           | `PATCH /admin/my-jobs/:bookingId/checklist`                |
| La pantalla, para las dos vistas      | `apps/admin/src/components/JobChecklist.tsx`               |
| La pantalla de limpieza               | `apps/admin/src/pages/MyJobs.tsx`                          |
| El detalle del panel                  | `apps/admin/src/pages/BookingDetail.tsx`                   |

---

## 10. Lo que quedó resuelto al llegar la lista

- **Las tareas, que era todo el contenido.** 59, transcritas el 1/11/2026.
- **Sí cambia la lista dentro de cada servicio**, y era la pregunta abierta.
  Su lista lo dice sin ambigüedad: la profunda es «todo lo de la estándar
  **más** 11 tareas», y la de entrada o salida «todo lo de la profunda **más**
  4». Se expresa con `appliesTo` tarea por tarea, **y no con una jerarquía**:
  es más repetitivo de leer y no tiene el fallo de la herencia, que es cambiar
  la base y mover sin querer lo que incluye un servicio que no se estaba
  tocando. Hay una prueba que comprueba que las 59 declaraciones dicen de
  verdad eso.
- **La de mudanza lleva todas las tareas, aunque la casa esté vacía.** Su
  lista dice «todas las tareas **aplicables**», y en una vivienda vacía hay
  tareas que no aplican —cambiar las sábanas—. **No se decide en el catálogo
  cuáles.** Van todas y el equipo marca «no aplica» en la casa, que es justo
  el estado que ella pidió. Decidirlo aquí sería adivinar desde una oficina lo
  que hay dentro de una casa concreta: hay mudanzas con la cama todavía
  puesta.
- **El alcance de la web ya coincidía con sus aclaraciones.** La sección «qué
  no incluye» del sitio público (`scope`) ya dice: sin ventanas por fuera, sin
  platos, sin refrigerador ni gabinetes con cosas dentro. No hubo nada que
  corregir.

---

## 11. Lo que sigue pendiente

- **LOS TRES ESTADOS Y EL MOTIVO.** Su lista los pide con estas palabras:
  _«Cada tarea debe tener estas opciones: Completada / Pendiente / No aplica.
  Si queda pendiente, debe permitir anotar el motivo.»_ Hoy una tarea está
  marcada o no: la tabla no tiene columna de estado ni de nota, así que **pide
  una migración**, un cambio de contrato (`done: boolean` pasa a ser un
  estado) y tocar la API y la pantalla del móvil. Es la Etapa 2 de este
  trabajo.
- **La revisión antes de salir** (sección 7 de su lista, 10 puntos). Solapa en
  parte con el fichaje de salida y con las fotos, así que antes de añadir nada
  hay que ver qué de eso ya existe.
- **La lista es la del servicio que el cliente contrató en la web.** Quedó
  decidido en la Etapa 3.6. Tiene una consecuencia que conviene tener escrita:
  como la lista sale del servicio de la reserva y no de una copia congelada,
  **cambiar el servicio cambiaría la lista bajo los pies del equipo a media
  limpieza**. Por eso el ajuste de campo no deja cambiarlo
  (`docs/28-ajustes-de-campo.md` §3).
- **Tres de las cinco tareas de extra no se verán todavía**, porque sus extras
  no están a la venta (§3.4).
- **El catálogo vive en el código.** Cambiar una tarea es un despliegue, no una
  pantalla de ajustes. El token de NestJS (§8) es el sitio por donde entraría
  el día que coordinación tenga que editarlo.
- **No hay foto de lo hecho.** Es la siguiente capacidad de la Etapa 3 y
  depende de decidir dónde se almacenan las fotos.
- **No funciona sin conexión.** Cada toque es una petición: en un sótano sin
  cobertura la casilla vuelve a su sitio y avisa. La cola de sincronización es
  otra capacidad pendiente de la Etapa 3, y cuando llegue, esta pantalla es de
  las primeras que debería usarla.
