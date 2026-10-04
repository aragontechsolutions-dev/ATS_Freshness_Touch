# 25. Fichaje con ubicación

> Etapa 3.3. Cuando alguien marca que ha llegado a una casa, se registra a qué
> distancia de ella estaba. **Su ubicación no se guarda en ningún sitio**, y
> **el fichaje nunca se bloquea.**

---

## 1. La pregunta que responde

«¿Estaba esta persona en la casa cuando dijo que había llegado?»

Marcar la llegada y la salida ya existía desde la Etapa 2.11. Lo que no había
era forma de saber desde dónde se marcaba: el botón se podía pulsar desde el
sofá de casa, y el sistema lo registraba igual de contento.

## 1 bis. Fichar es de cada persona, no del trabajo

**Esto fue un fallo real y llegó a producción.** Se vio en una captura: el
aviso decía «marca primero _He llegado_» justo debajo de un botón que ponía
**«He terminado»**.

La causa estaba repartida en dos sitios que cometían el mismo error —decidir
por el **estado de la reserva** algo que es **de cada persona**:

- **El servidor** exigía una transición de estado válida para poder fichar.
- **La pantalla** elegía el botón mirando solo `job.status`.

Un trabajo pasa a EN CURSO cuando ficha **la primera** persona del equipo. La
segunda se encontraba `IN_PROGRESS → IN_PROGRESS`, que no es una transición, y
**su llegada no se podía registrar nunca**. Lo mismo al salir, una vez que la
primera marcaba terminado. Pasa también cuando coordinación mueve el estado
desde el panel.

No era un caso raro: **ocurre siempre que van dos personas a una casa**. Y
desde la Etapa 3.6 dejó de ser solo un hueco en el registro de horas: sin
fichaje de llegada propio tampoco se puede avisar de que la casa no es la
contratada (`docs/28-ajustes-de-campo.md`), así que la responsable se quedaba
sin poder hacer su trabajo.

**Ahora hay dos caminos y el fichaje se registra en los dos:**

|                         | Qué pasa                                                                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cambia el estado**    | Es la primera persona: el trabajo pasa a EN CURSO o TERMINADO, con su hora y su entrada de auditoría                                                                                                                                                  |
| **No cambia el estado** | Esta persona ficha lo suyo. No se vuelve a tocar `startedAt` —esa es la hora a la que empezó el trabajo, no la de cada cual— ni se escribe auditoría: no ha cambiado nada que auditar, y la fila del fichaje ya lleva quién, cuándo y a qué distancia |

Lo que **sigue siendo imposible**: fichar dos veces lo mismo, fichar en una
cancelada, y cualquier transición que no esté en la tabla.

El contrato gana `iHaveArrived` e `iHaveLeft`, calculados en el servidor, para
que la pantalla decida con **la misma regla** que la API.

> **La prueba que lo fija no comprueba un botón ni un texto por separado:
> comprueba que los dos cuentan la misma historia.** Si el aviso dice «marca
> primero He llegado», el botón tiene que decir «He llegado». Eso era
> exactamente lo que estaba roto, y ninguna prueba de las dos piezas por
> separado lo habría visto.

## 2. La decisión que sostiene todo: solo se guarda la distancia

**Las coordenadas de quien ficha no se guardan en ninguna parte.** Llegan al
servidor, se convierten en un número de metros, y se descartan en el mismo
método que las recibió. No van a la base de datos, no van al registro de
auditoría y no van al registro del servidor.

El motivo es que la pregunta del negocio es «¿estaba en la casa?», y para eso
la distancia sobra. Guardar el punto construiría, sin que nadie lo decidiera,
un historial de por dónde anda cada empleada: dónde vive, a qué hora sale,
dónde come.

> Un dato que no se guarda **no se puede filtrar en una brecha, ni citar en un
> juicio, ni pedir por una orden judicial.** La única forma de garantizar eso
> es no tenerlo.

Esto se comprueba, no solo se dice: hay una prueba que **recorre todas las
columnas de texto y numéricas de todo el esquema** buscando las coordenadas
que se enviaron. Ver §8.

## 3. El fichaje nunca se bloquea

Sin ubicación se ficha igual. Es deliberado y no es una concesión:

- Los sótanos y los interiores de hormigón no tienen GPS.
- Hay zonas rurales de Georgia sin cobertura.
- Y un móvil se queda sin batería a media mañana.

> Un fichaje que se niega a registrar la llegada porque el GPS no responde **no
> protege a la empresa: deja a la empleada sin poder demostrar que fue**, que
> es exactamente lo contrario de lo que se pretende.

## 4. «Sin ubicación» son tres cosas distintas

No es un nulo con adornos. El motivo se guarda aparte, y la distinción importa:

| Estado        | Qué pasó                               | De quién es |
| ------------- | -------------------------------------- | ----------- |
| `RECORDED`    | Hay distancia                          | —           |
| `DENIED`      | La persona no dio permiso al navegador | Suya        |
| `UNAVAILABLE` | El GPS no pudo dar una posición        | De nadie    |
| `NO_HOUSE`    | La casa todavía no tiene coordenadas   | **Nuestro** |

Meter las tres en el mismo cajón señalaría a una empleada por un fallo de
nuestra geocodificación. Cada una tiene su propio texto en pantalla.

**El móvil puede decir «no pude», nunca «sí pude».** El contrato acepta del
cliente solo `DENIED` y `UNAVAILABLE`: `RECORDED` afirmaría que se comprobó
algo que nadie comprobó, y `NO_HOUSE` es un hecho de nuestra base de datos que
el móvil no puede conocer. Los pone el servidor.

## 5. Un registro por persona, no por trabajo

Es una tabla propia (`booking_clock_ins`), no columnas en `bookings`.

Si van dos personas a una casa, cada una ficha su llegada. El `startedAt` de la
reserva se pone una vez, pero la distancia es de cada cual: **una puede estar
en la puerta y la otra todavía en el coche a dos manzanas.** Con columnas en la
reserva solo cabría una de las dos, y la segunda persona que fichara borraría
el dato de la primera.

La hora es la del **servidor**, no la del móvil: un reloj de teléfono se cambia
a mano, y la hora del fichaje es justo el dato que alguien tendría interés en
mover.

## 6. El margen de error, y por qué un GPS malo no acusa a nadie

Se guarda también la precisión que reporta el navegador (`coords.accuracy`), y
**sin ese número la distancia no se puede interpretar**:

- «A 250 metros» con un margen de 30 dice que no estaba en la puerta.
- «A 250 metros» con un margen de 2000 **no dice absolutamente nada**.

Por eso lo que se compara con el umbral de «lejos de la casa» no es la
distancia, sino **la distancia mínima posible según la propia lectura**
(`distancia − margen`). Solo se marca cuando el móvil mismo dice que esa
persona no puede estar en la casa.

**El umbral es de 250 metros**, y el número viene de una limitación real: el
geocodificador del Censo no da la posición del portal, sino un punto
interpolado sobre el tramo de calle (`docs/24-geocodificacion.md` §4). En una
manzana rural larga de Georgia ese punto puede quedar a cientos de metros de la
puerta con todo correcto. Un umbral de veinte metros marcaría como sospechosos
a la mitad de los fichajes legítimos del campo.

## 7. Lo que ve cada quien

**Quien ficha** ve, justo después de pulsar: «Registrado a 60 pies de la casa.
Tu ubicación no se guarda.»

Fue una decisión explícita: **no hay un expediente secreto sobre nadie.** Ve
exactamente el mismo dato que verá coordinación, y si está mal puede decirlo en
el momento en vez de enterarse en una revisión tres meses después.

**Coordinación** ve, en el detalle del trabajo, la hora y la distancia de cada
persona del equipo, con un aviso ámbar en los que quedaron lejos.

**Sin avisos automáticos y sin destacado en la agenda**, que también se decidió
expresamente: solo queda registrado. Con una precisión interpolada de cientos
de metros en zonas rurales, una alarma avisaría de cosas que no son, y a la
tercera vez nadie la miraría.

### Las unidades son pies y millas, no metros

La empresa opera en Georgia y el resto de la interfaz ya habla en millas. Pero
millas a secas no sirve: los 60 metros de estar en la puerta son «0,04 millas».
Por eso hay dos escalas, con el corte en **1000 pies** (unos 300 m).

**La API guarda metros**, que es lo correcto para un dato: una unidad sin
ambigüedad y sin decimales. La traducción a pies ocurre solo en la capa que se
ocupa de cómo se lee algo.

> En español se leen **a la americana** (`15.5 millas`, con punto). El proyecto
> usa `es-US`, no `es-ES`: quien habla español en Georgia lee los precios del
> supermercado y los límites de velocidad con punto decimal. Hay una prueba
> para que nadie lo «arregle».

## 8. Seguridad

- **La tabla no tiene columna para una coordenada.** La decisión hecha
  estructura: no hay manera de guardar la posición de nadie porque no hay
  dónde. Lo mismo en el contrato: `ClockInRecord` no tiene esos campos.
- **Seguridad a nivel de fila activada.** Sin ella, cualquiera con la clave
  pública de Supabase podría leer el historial de a qué hora entró y salió cada
  empleada de cada casa. Es información sobre personas y sus rutinas.
- **El contrato rechaza campos de más.** La API de geolocalización del
  navegador da también altitud, rumbo y velocidad; `z.strictObject` los
  rechaza, y el cliente además escribe los tres campos a mano en vez de copiar
  `coords` entero.
- **La auditoría lleva la distancia, nunca las coordenadas.** Ante un «esto se
  cerró sin hacerse», «lo marcó a 30 km de la casa» resuelve la conversación
  sin revelar dónde estaba esa persona: un radio de 30 km son miles de
  kilómetros cuadrados.
- **La posición de la CASA tampoco viaja al móvil.** Se usa para calcular y se
  queda en el servidor. Hay una prueba.
- **Una restricción `CHECK` en la base** obliga a que haya distancia si y solo
  si el estado es `RECORDED`, para que no pueda existir una fila ilegible.
- **`Permissions-Policy: geolocation=(self)`** en `apps/admin/vercel.json`.
  `camera=()` sigue cerrada: se abrirá cuando toquen las fotos, no antes.

### La prueba que lo demuestra

`my-jobs.e2e.test.ts` incluye una comprobación de fuerza bruta que, tras un
fichaje, **recorre todas las columnas de texto y numéricas de todo el esquema**
buscando los valores de latitud y longitud que se enviaron. Si alguien los
guardara en cualquier sitio —una metadata, una nota, un campo nuevo—, la prueba
lo encuentra y **dice en qué tabla y columna**.

Se validó introduciendo la fuga a propósito: la prueba falló señalando
`audit_logs.metadata`.

## 9. Un fallo que solo vio el navegador

La primera versión derivaba la clave de traducción con `estado.toLowerCase()`.
Funcionaba con `DENIED` y `UNAVAILABLE` —palabras sueltas— y se rompía con
`NO_HOUSE`, que daba `no_house` mientras la clave era `noHouse`. En pantalla
aparecía literalmente **«admin.clockIns.no_house»**.

Los tipos estaban bien, el lint limpio y las pruebas verdes: una clave de i18n
que no existe no es un error de TypeScript, es una cadena.

Ahora hay dos cosas que lo impiden: `CLOCK_IN_STATE_TEXT_KEY`, un `Record` del
enumerado que obliga a declarar el texto de cada estado o no compila; y una
prueba que comprueba que ese texto **existe de verdad** en los dos idiomas y en
las dos pantallas.

## 10. Lo que NO se hizo, a propósito

- **Ningún aviso automático** por Telegram o correo. Ver §7.
- **Ningún destacado en la agenda.** Mismo motivo.
- **No se bloquea ni se avisa a quien ficha lejos.** Se registra y ya.
- **No se guarda la altitud, el rumbo ni la velocidad**, que el navegador da.
- **No hay pantalla de informes de fichajes.** Llegará con el módulo de
  nóminas de la Etapa 4; el índice por persona y fecha ya está creado para
  entonces.

## 11. Dónde está

| Qué                   | Dónde                                                      |
| --------------------- | ---------------------------------------------------------- |
| Contrato y umbral     | `packages/types/src/clock-in.ts`                           |
| Migración             | `apps/api/prisma/migrations/20260930120000_clock_ins/`     |
| Cálculo y descarte    | `apps/api/src/admin/my-jobs.service.ts` (`medirDistancia`) |
| Pedir la ubicación    | `apps/admin/src/lib/geolocalizacion.ts`                    |
| Pantalla de limpieza  | `apps/admin/src/pages/MyJobs.tsx`                          |
| Vista de coordinación | `apps/admin/src/components/ClockInsSection.tsx`            |
| Unidades              | `apps/admin/src/lib/format.ts`                             |

## 12. Pendiente para el usuario

- [ ] **Aplicar la migración** `20260930120000_clock_ins`.
- [ ] **Redesplegar el panel en Vercel**, para que la cabecera
      `Permissions-Policy` permita la geolocalización. Hasta entonces el
      navegador la bloquea y todos los fichajes saldrán como `UNAVAILABLE`.
- [ ] Comprobar que las casas tienen coordenadas
      (`docs/24-geocodificacion.md` §12): sin ellas, todos los fichajes salen
      como `NO_HOUSE`.
