# 28 — Los ajustes de campo

Lo que el equipo encuentra al llegar no siempre es lo que el cliente reservó:
una casa de «900 pies» que son 1.300, un «limpiar la nevera» que son tres
neveras. No siempre es mala fe —mucha gente no sabe cuántos pies cuadrados
tiene su casa— pero **el trabajo es otro**, y hasta la Etapa 3.6 no había
forma de decirlo.

---

## 1. El dato que condiciona todo el diseño

**Hasta esta etapa no existía en todo el sistema un solo sitio capaz de
cambiar lo contratado de una reserva.** Ni el panel. El panel cambia el
estado, asigna equipo, cobra y libera el depósito, pero `serviceCents`,
`totalCents` y `lines` estaban congelados desde que se reservaba
(`docs/21-modelo-de-operaciones.md`).

O sea: la PWA del responsable sería **lo primero capaz de mover un precio ya
acordado**, y lo haría la persona con menos contexto comercial, de pie en una
puerta. Por eso va en dos tiempos.

---

## 2. El responsable propone. La reserva no se toca.

Lo que el líder manda es **lo que encontró**, no un precio nuevo. Queda como
una propuesta colgada de la reserva, con la diferencia ya calculada, y **la
reserva sigue intacta** hasta que coordinación la aprueba desde el panel.

Las tres razones, por orden de peso:

|                                         | Por qué                                                                                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El cero de más**                      | Teclear 13000 donde iban 1300 es el error más probable de esa pantalla, y se teclea de pie, con una mano. Si re-tarifara solo, ese error sería la factura del cliente |
| **Nadie ha hablado con el cliente**     | Subirle el precio sin avisar es la forma más rápida de perderlo, y de que la discusión acabe costando más que la diferencia                                           |
| **El precio pactado es una fotografía** | Que el primero en poder moverla sea el móvil de quien está en la puerta, sin revisión, sería invertir el orden de las cautelas                                        |

**El trabajo, mientras tanto, se hace igual.** El ajuste no bloquea nada.

---

## 3. Qué se puede corregir, y qué no

|        |                                                                            |
| ------ | -------------------------------------------------------------------------- |
| **Sí** | Pies cuadrados, habitaciones, baños y la cantidad de cada extra contratado |
| **No** | El tipo de servicio, la fecha, la dirección, el cliente y el precio        |

**El tipo de servicio no está, y no es un olvido.** Convertir una estándar en
profunda es el cambio más caro del catálogo —de 120 a 250 $ o más— y además
**cambiaría la lista de tareas bajo los pies del equipo** a media limpieza,
porque la lista sale del servicio de la reserva
(`docs/27-listas-de-verificacion.md`). Esa conversación la tiene coordinación
con el cliente, no se decide en una puerta.

> **Lo que todavía no se puede:** añadir un extra que el cliente **no**
> contrató. La PWA no tiene el catálogo de extras, y escribir la lista a mano
> en la aplicación la dejaría desincronizada de la configuración de precios en
> cuanto alguien tocara la pantalla de Tarifas. Los dos casos del enunciado
> —el tamaño y las tres neveras— sí están cubiertos.

---

## 4. Quién puede, y cuándo

| Acción                 | Quién                               | Condición                           |
| ---------------------- | ----------------------------------- | ----------------------------------- |
| **Proponer**           | Solo el **responsable** del trabajo | Haber fichado **su propia** llegada |
| **Aprobar / rechazar** | ADMIN y coordinación                | La propuesta sigue abierta          |

**Un trabajo ajeno responde 404; no ser el responsable responde 403**, y la
diferencia es deliberada: quien no es responsable **ya sabe que el trabajo
existe** —lo tiene en su pantalla—, así que esconderlo no protege nada y en
cambio le dejaría sin entender por qué no puede.

**«Solo se ajusta lo que se ha visto».** Se exige un fichaje de llegada **de
esa misma persona**, no de cualquiera del equipo: lo que respalda la propuesta
es que quien la firma estuvo en la casa. Cada propuesta queda así con un
fichaje detrás, con su hora y su distancia (`docs/25-fichaje-con-ubicacion.md`).

La pantalla usa **las mismas dos condiciones que el servidor**, calculadas
allí (`iAmLead`, `iHaveArrived`). Con reglas propias acabaría ofreciendo un
botón que la API rechaza.

> `iHaveArrived` **no se deduce del estado del trabajo**, que era lo que
> parecía obvio y habría estado mal: un trabajo pasa a EN CURSO cuando ficha
> la **primera** persona del equipo, así que mirar el estado diría que ha
> llegado alguien que todavía está en el coche.

---

## 5. Limpieza no ve ni un importe

`MyJob` tiene prohibido llevar cifras de dinero desde la Etapa 2, y **este es
el sitio donde más falta hace**: si la responsable viera «+40 $» al reportar
que la casa es más grande, la frase previsible en esa puerta es _«esto le va a
costar cuarenta dólares más»_ —dicha por quien no decide los precios y antes
de que nadie lo haya aprobado—.

El contrato lo hace imposible: `MyJobAdjustment` **no tiene dónde poner la
cifra**. El endpoint de proponer devuelve **el trabajo**, no el ajuste, por lo
mismo.

> **Esto fue un fallo real.** La primera versión devolvía el `FieldAdjustment`
> entero —con la diferencia y el total— desde el endpoint que llama el móvil,
> y la prueba solo miraba el `GET`. Vivió en `main` hasta que se escribió la
> pantalla y hubo que mirar qué devolvía. Ahora la prueba comprueba **las dos
> puertas**.

**Lo que sí llega al equipo es el motivo del rechazo**, y es lo más importante
de esa pantalla: un rechazo mudo enseña a no volver a reportar nada, y
entonces se pierde el dato de verdad. Por eso **rechazar sin motivo es un
400**.

---

## 6. Aprobar re-tarifica con la tabla de la reserva, no con la de hoy

Es **la línea que más dinero protege de toda la etapa**. Si se usara la tabla
vigente, aprobar el ajuste de un trabajo contratado en marzo le aplicaría los
precios de hoy — **no solo a los 400 pies de más, sino a todo el trabajo**—.
El cliente vería subir una cifra que nadie tocó y nadie sabría explicar de
dónde salió.

Se usa `PricingConfigService.atVersion(booking.pricingVersion)`. La prueba de
punta a punta monta **dos versiones y la vigente es el doble de cara**:
cambiando una línea a `current()`, se pone en rojo.

**La distancia tampoco se vuelve a resolver**: la casa no se ha movido.

### 6.1 Lo que se aplica es lo que se aprobó

Al aprobar se vuelve a tarificar y **se compara con lo propuesto**. Si no
coincide —porque cambió el motor o la fila de tarifas— **no se aplica nada**:
aplicar en silencio un importe distinto del que alguien vio y aceptó es
exactamente lo que no puede pasar con el dinero de un cliente.

### 6.2 Lo que NO se toca al aprobar

- **La agenda.** El equipo ya está en la casa: alargar la cita no puede
  desreservar el trabajo siguiente, y la guardia de solapamiento solo
  conseguiría bloquear la aprobación. Si hace falta mover la agenda, lo hace
  coordinación a mano.
- **El depósito.** Ya está retenido en el proveedor de pago con un importe
  concreto; cambiar aquí el número no mueve esa retención. Lo que se recalcula
  es lo que queda por cobrar.
- **La versión de tarifas.** El trabajo se sigue tarifando con la tabla que
  tenía al contratarse.

> **Un caso conocido sin resolver:** si el ajuste deja el total **por debajo**
> del depósito ya retenido, lo que queda por cobrar es cero y además se le
> debe dinero al cliente. Se deja la cifra honesta —cero— y se anota en el
> registro del servidor, porque **las devoluciones son el hueco conocido de la
> Etapa 2** y todavía no existen.

### 6.3 Y cuando el motor no puede dar precio, lo teclea administración

Esto salió de un caso real: **un ajuste en una casa de Gainesville no se podía
resolver**. Ni aprobar ni, en la práctica, dejar de aprobar — la propuesta se
quedaba colgada para siempre, con el equipo ya en la casa.

**El tamaño nunca fue el problema**, que es lo que decía el panel. La tabla de
tarifas llega hasta 6.900 pies cuadrados; aquella casa entraba de sobra. Lo
que pasaba es que **Gainesville está a unas 50 millas de Atlanta**, fuera de
las 35 millas de la zona A, y en la zona C **Georgia entera se atiende sin
precio automático por diseño** (`docs/17-area-de-servicio.md`). O sea: el
hueco no era un caso raro de casas enormes, era **casi todo el estado fuera
del área metropolitana**.

Así que ahora el importe se puede teclear. Con dos condiciones:

|                                                        | Por qué                                                                                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Solo ADMIN.** Coordinación no ve ni el campo         | El número que calcula el motor lo aprueba quien lleva la agenda; un número que sale de la cabeza de una persona lo pone quien responde del dinero. Es la frontera que ya separa mover una cita de cobrar una tarjeta |
| **Solo cuando el motor no puede.** Si puede, es un 400 | Dejar teclear un importe encima del calculado convertiría la tabla de precios en una sugerencia, y dos casas iguales costarían cosas distintas según quién aprobara el ajuste                                        |

**La fila queda marcada (`manualPrice`), y la auditoría también.** Un total
calculado y uno tecleado valen lo mismo en la factura y **no** valen lo mismo
al revisar las cuentas de un mes: ante un importe raro, lo primero que se
pregunta es si lo puso el sistema o alguien, y esa columna lo contesta. Hay un
`CHECK` en la base que además impide marcarlo en una propuesta que no se
aplicó.

**El desglose sigue cuadrando.** No se puede recalcular `lines` —no hay precio
automático, que es todo el motivo de estar aquí— así que se conserva el
desglose que tenía la reserva y **se le añade una línea** con la diferencia
(`quote.line.fieldAdjustment`, «On-site correction»). Sin ella el desglose
sumaría una cosa y el total diría otra, que es justo lo que nadie sabe
explicar al revisar una factura. Va como recargo **incluso cuando es
negativa**: `DISCOUNT` significa una rebaja que se concede, y esto no lo es,
es una corrección de lo que se contrató.

`serviceCents` y la versión de tarifas no se tocan: el importe tecleado no es
una tarifa, es una corrección encima de la que había. Dejar `serviceCents`
como estaba es lo que permite ver después cuánto se puso a mano.

> **La guardia de §6.1 no aplica aquí, y no puede.** «Lo que se aplica es lo
> que se aprobó» compara el recálculo con lo propuesto; en un trabajo sin
> precio automático las dos cifras son `null`, así que no hay nada que
> comparar. Lo que protege este camino es otra cosa: que el importe lo escribe
> la misma persona que lo aprueba, en el mismo gesto, y queda marcado como
> suyo.

### 6.4 Decir POR QUÉ no hay precio automático

El motor se niega a dar precio por **siete razones distintas**: zona lejana,
fuera de Georgia, casa por encima de la tabla, cadencia que ese servicio no
ofrece, comercial, fuera del área de servicio y propiedad grande. El panel las
juntaba todas en _«este tamaño no tiene precio automático»_, que casi siempre
era mentira y mandaba a buscar el problema donde no estaba.

Ahora el motivo se **guarda con la propuesta** (`noPriceReasonKey`) en vez de
recalcularse al mirarla, porque es el motivo que había **con la tabla de
tarifas de esa reserva**: un cambio de zonas posterior no debe reescribir la
historia de por qué aquel trabajo se quedó sin precio.

Y se dice **con palabras de dentro**. Los textos de `quote.review` están
escritos para el cliente —«déjanos tus datos y te llamamos»— y en el panel
sonaban absurdos; `admin.adjustments.reason.*` los traduce a media línea para
quien decide: «the house is outside the priced radius». Si algún día el motor
añade un motivo que no esté traducido, se cae al texto del cliente en vez de
pintar una clave en crudo.

---

## 7. Auditoría: tres acciones, no una

`booking.adjustment.proposed`, `.applied` y `.rejected`. Son tres porque
responden a preguntas distintas: quién dijo que la casa no era lo contratado,
quién decidió cobrarlo, y quién decidió **no** cobrarlo. **La tercera es la
que más se mira cuando las cuentas de un mes no salen.**

La metadata lleva las cifras que cambian —«900 → 1300»— y **ningún dato del
cliente**: ni nombre, ni correo, ni teléfono, ni dirección. Hay prueba de ello.

Cuando el importe se tecleó, la entrada de `.applied` lo dice (`manualPrice`)
y lleva además el motivo por el que no había precio automático. **Es la línea
más importante de esa entrada**: ante un importe raro en las cuentas de un
mes, la primera pregunta es si lo puso el sistema o alguien.

---

## 8. Seguridad

Las guardias críticas se validaron **rompiéndolas a propósito** y comprobando
que las pruebas se ponen en rojo:

| Guardia                                    | Al quitarla       |
| ------------------------------------------ | ----------------- |
| Solo el responsable propone                | 1 prueba en rojo  |
| Se re-tarifica con la tabla de la reserva  | 1 prueba en rojo  |
| El móvil no recibe importes                | 4 pruebas en rojo |
| Solo ADMIN teclea un importe               | 1 prueba en rojo  |
| No se teclea encima de un precio calculado | 1 prueba en rojo  |

Además:

- **Sin fichaje de llegada propio no se propone**, con prueba de que el
  fichaje de una compañera no vale.
- **Limpieza no puede aprobar su propia propuesta** (403). Sería el agujero
  entero: proponer y aprobarse uno mismo es lo que la separación en dos
  tiempos existe para impedir.
- **Una propuesta ya resuelta no se resuelve dos veces.**
- Los topes del contrato son **los mismos que al reservar** (200–20.000 pies):
  sin ellos, un cero de más multiplicaría el precio sin que nada lo parara.
- **RLS activado** en la tabla nueva, y dos `CHECK` de coherencia: una
  propuesta resuelta tiene quién y cuándo, y los dos importes van juntos o no
  va ninguno.
- **Las propuestas sustituidas no se borran.** El líder puede corregirse, y lo
  que creyó ver la primera vez también es información.
- **El importe tecleado tiene tope**: 100.000 $. No es un límite de negocio,
  es el techo de cordura que impide que un cero de más al teclear se convierta
  en la factura. Y no se admite negativo.
- **Un `CHECK` más**: `manualPrice` solo puede estar marcado en una propuesta
  aplicada. Marcarlo en una rechazada —o en una que todavía espera— sería un
  dato que contradice al estado.
- **El campo del importe no le sale a coordinación**, y tampoco se le dice que
  escriba nada: un aviso que manda a un campo que no está es la misma
  contradicción que ya costó un fallo en producción (§12).

---

## 9. Un fallo de textos que solo se vio en el navegador

El bloque de textos quedó en `admin.myJobs.adjustment` y los componentes
pedían `admin.adjustment`: **la pantalla entera del responsable se pintó con
las claves en crudo** —«admin.adjustment.open» en el botón—.

Es el **segundo de la misma familia**: en la Etapa 3.3 salió
«admin.clockIns.no_house». Las dos veces, **los tipos, el lint y más de mil
pruebas estaban en verde**, porque una clave de i18n que no existe no es un
error de TypeScript: es una cadena, y `t()` devuelve la clave cuando no la
encuentra.

Ahora hay una prueba (`textos-de-ajuste.test.ts`) que **lee el código fuente
de los componentes**, saca todas las claves que de verdad piden y comprueba
que existen en los dos idiomas. No es una lista escrita a mano —esa se queda
vieja igual que el componente—. Validada reintroduciendo el fallo: lo caza y
nombra la clave exacta.

---

## 10. Dos avisos que decían algo que no era

Los dos fallos de esta etapa son **el mismo fallo**: una pantalla afirmando
algo que no se corresponde con lo que tiene delante quien la lee.

**El primero lo reportó el cliente** mirando el panel: un ajuste que no se
podía resolver y un aviso que culpaba al tamaño de la casa. El tamaño entraba
de sobra en la tabla —el problema era la zona (§6.3)—, así que el aviso mandaba
a buscar donde no era.

**El segundo lo vi al verificar en el navegador**, y era peor: a coordinación
se le decía _«escribe abajo el total nuevo»_ y **debajo no había ningún
campo**, porque teclear importes es solo de ADMIN. Un aviso que manda a algo
que no existe deja a quien lo lee pensando que la aplicación está rota. Ahora
la frase está partida en dos: el motivo lo lee todo el mundo, la instrucción
de teclear solo quien puede teclear.

> Es de la **misma familia que el fallo de producción de la Etapa 3.6**: «marca
> primero He llegado» debajo de un botón que decía «He terminado». Las tres
> veces, el aviso se escribió pensando en un solo lector y lo acabó leyendo
> otro. La lección: **un aviso que menciona una acción tiene que comprobar que
> esa acción le sale a quien lo está leyendo.**

---

## 11. Dónde está cada cosa

| Qué                              | Dónde                                                                |
| -------------------------------- | -------------------------------------------------------------------- |
| El contrato                      | `packages/types/src/field-adjustment.ts`                             |
| La tabla                         | `apps/api/prisma/migrations/20261004120000_field_adjustments/`       |
| El motivo y el importe a mano    | `apps/api/prisma/migrations/20261005090000_adjustment_manual_price/` |
| Proponer, aprobar y re-tarificar | `apps/api/src/admin/field-adjustments.service.ts`                    |
| Leer un ajuste, en un solo sitio | `apps/api/src/admin/field-adjustment.helper.ts`                      |
| Proponer                         | `PATCH /admin/my-jobs/:bookingId/adjustment`                         |
| Resolver                         | `POST /admin/bookings/:bookingId/adjustment/:adjustmentId`           |
| La pantalla del responsable      | `apps/admin/src/components/FieldAdjustmentForm.tsx`                  |
| La decisión en el panel          | `apps/admin/src/components/FieldAdjustmentsSection.tsx`              |

---

## 12. Lo que quedó sin resolver

- **Añadir un extra que el cliente no contrató**, por lo dicho en §3.
- **El cliente no se entera de nada automáticamente.** Es consecuencia directa
  de la decisión de §2: coordinación habla con él. El día que se quiera avisar
  por correo, el gancho natural es la aprobación.
- **Un ajuste a la baja por debajo del depósito** deja dinero a devolver y no
  hay forma de devolverlo (§6.2).
- **La agenda no se mueve sola** (§6.2), y un trabajo que resulta ser el doble
  de grande probablemente debería durar más.
- **Nada ayuda a decidir el importe tecleado.** Administración escribe un total
  y el sistema lo acepta tal cual: no se le ofrece lo que costaría esa casa con
  la tabla —aunque esté fuera de zona, los pies cuadrados sí tienen fila— ni lo
  que cobró un trabajo parecido. Es lo primero que pediría quien use esta
  pantalla más de tres veces.
- **Un importe tecleado no se puede corregir.** Si se escribe 4.200 donde iban
  420, la propuesta ya está aplicada y resuelta, y una resuelta no se resuelve
  dos veces (§8). Hoy se arregla reportando un ajuste nuevo encima; sería mejor
  poder deshacerlo.

> **Se cerró en esta etapa:** _«sin precio automático no se puede aplicar»_
> dejaba sin salida a casi toda Georgia. Ahora lo teclea administración (§6.3).
