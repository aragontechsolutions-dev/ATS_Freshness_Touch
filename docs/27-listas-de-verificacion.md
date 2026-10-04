# 27 — Las listas de verificación de un trabajo

Qué hay que hacer en cada estancia de la casa, marcado a medida que se hace.
Es lo que el equipo mira al llegar y lo que coordinación mira cuando un
cliente llama diciendo que algo se quedó sin hacer.

> ## ⚠️ Pendiente de contenido: las tareas todavía no están escritas
>
> **La maquinaria está terminada y el catálogo de tareas está vacío.** Las
> tareas de las plantillas de trabajo del cliente —áreas comunes (11), baños
> (7) y cocina (7)— están pendientes de transcribir **desde la Etapa 2**
> (`docs/21-modelo-de-operaciones.md` §4), y siguen pendientes.
>
> Mientras el catálogo esté vacío, **la sección simplemente no se pinta** en
> ninguna de las dos pantallas. Todo lo demás —la tabla, la API, la pantalla
> de limpieza, la del panel, la seguridad y las pruebas— funciona y está
> probado contra un catálogo de prueba.
>
> **Qué hay que hacer el día que lleguen las capturas**, y nada más:
>
> 1. Rellenar `JOB_CHECKLIST_CATALOG` en
>    `packages/types/src/job-checklist.ts` con un código por tarea.
> 2. Escribir su texto en `checklist.items.<CÓDIGO>` en `en.ts` y en `es.ts`.
> 3. Cambiar la prueba «ESTÁ PENDIENTE DE CONTENIDO» de
>    `job-checklist.test.ts`, que está en rojo a propósito para que nadie
>    rellene el catálogo sin enterarse.
>
> No hay que tocar la base de datos, ni la API, ni ninguna pantalla.
>
> **Por qué no se rellenó con tareas plausibles «de momento»:** una lista de
> limpieza verosímil pero que no es la de esta empresa es **peor que ninguna
> lista**. Alguien la daría por buena, la marcaría entera, y quedaría
> registrado que se hizo un trabajo que nadie pidió.

---

## 1. La decisión que sostiene todo: se guarda lo marcado, no la lista

La base de datos **no guarda una copia de la lista por cada trabajo**. Guarda
**una fila por tarea marcada**, con su código, quién la marcó y cuándo. La
lista que se pinta sale del catálogo, que vive en el código.

La alternativa era copiar las veinticinco tareas sobre cada reserva al
crearla —una «fotografía», como se hace con el precio—. Se descartó, y
conviene tener escrito por qué:

| Motivo                                           | Detalle                                                                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El precio se fotografía porque es un acuerdo** | Lo que se pactó con el cliente no puede cambiar porque alguien toque la pantalla de Tarifas. Una lista de tareas **no es un acuerdo con nadie**: es cómo trabaja esta empresa, y cuando cambia, cambia para todos |
| **Veinticinco filas por reserva, vacías**        | Con mil trabajos al año son veinticinco mil filas que casi siempre dicen «no marcada», que es exactamente lo mismo que no tener fila                                                                              |
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

## 2. Las tres estancias

`COMMON_AREAS`, `BATHROOM` y `KITCHEN`. Son **las tres de las plantillas del
cliente**, ni una más: los dormitorios no tienen lista propia porque en esas
plantillas no la tienen, entran en áreas comunes.

El orden del enumerado es el del recorrido de la casa, y se respeta al pintar:
una lista que salta de la cocina al baño y vuelve al salón obliga a leerla
entera varias veces.

**Una lista por tipo de estancia, no por habitación.** Una casa con tres baños
tiene **siete** tareas de baño, no veintiuna. Es lo que dice la plantilla del
cliente —una sola lista de baños— y es lo que se puede marcar de pie con una
mano.

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

Una lista son veinticinco tareas, y un trabajo de dos personas con sus
correcciones pasa de las cincuenta escrituras. Auditarlas enterraría bajo
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
  veinticinco tareas acaba marcada a medias.
- **Sin reloj de espera y sin deshabilitar la casilla.** El movimiento ya es
  la confirmación, y deshabilitarla mientras se guarda impediría corregir un
  toque equivocado justo en el segundo en que uno se da cuenta.
- **Sin aviso al acertar, y sí al fallar.** Es lo contrario que al fichar
  (`docs/25` §6), y la diferencia está razonada: fichar ocurre una vez y hay
  que quedarse tranquilo de que quedó registrado; marcar tareas ocurre
  veinticinco veces en una casa, y veinticinco avisos seguidos tapan la
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

No es un capricho de diseño: **con el catálogo importado a pelo, el camino de
escritura no se podría probar en absoluto** mientras esté vacío. Toda petición
sería rechazada por «esa tarea no existe», y lo único verificado sería el
rechazo —quedando sin prueba que marcar escribe una fila, que marcar dos veces
no escribe dos, que desmarcar borra y que no se puede marcar en un trabajo
ajeno—.

Con el token, la prueba de punta a punta pasa un catálogo de tres tareas y
recorre **el mismo código** que producción.

---

## 9. Dónde está cada cosa

| Qué                                 | Dónde                                                      |
| ----------------------------------- | ---------------------------------------------------------- |
| El contrato y el catálogo           | `packages/types/src/job-checklist.ts`                      |
| Los textos de las tareas            | `packages/i18n/src/en.ts` y `es.ts`, en `checklist.items`  |
| La tabla                            | `apps/api/prisma/migrations/20261001160000_job_checklist/` |
| Montar la lista y validar el código | `apps/api/src/admin/job-checklist.helper.ts`               |
| Marcar y desmarcar                  | `apps/api/src/admin/my-jobs.service.ts`                    |
| El endpoint                         | `PATCH /admin/my-jobs/:bookingId/checklist`                |
| La pantalla, para las dos vistas    | `apps/admin/src/components/JobChecklist.tsx`               |
| La pantalla de limpieza             | `apps/admin/src/pages/MyJobs.tsx`                          |
| El detalle del panel                | `apps/admin/src/pages/BookingDetail.tsx`                   |

---

## 10. Lo que quedó sin resolver

- **Las tareas, que es todo el contenido.** Ver el aviso del principio.
- **La lista es la del servicio que el cliente contrató en la web.** Quedó
  decidido en la Etapa 3.6. Tiene una consecuencia que conviene tener escrita:
  como la lista sale del servicio de la reserva y no de una copia congelada,
  **cambiar el servicio cambiaría la lista bajo los pies del equipo a media
  limpieza**. Por eso el ajuste de campo no deja cambiarlo
  (`docs/28-ajustes-de-campo.md` §3).
- **Sigue sin saberse si la lista cambia dentro de cada servicio.** El
  catálogo lo admite —cada tarea declara `appliesTo`— pero las plantillas del
  cliente no dicen si una profunda pide más tareas que una estándar. Se
  decidirá al transcribirlas.
- **No hay foto de lo hecho.** Es la siguiente capacidad de la Etapa 3 y
  depende de decidir dónde se almacenan las fotos.
- **No funciona sin conexión.** Cada toque es una petición: en un sótano sin
  cobertura la casilla vuelve a su sitio y avisa. La cola de sincronización es
  otra capacidad pendiente de la Etapa 3, y cuando llegue, esta pantalla es de
  las primeras que debería usarla.
