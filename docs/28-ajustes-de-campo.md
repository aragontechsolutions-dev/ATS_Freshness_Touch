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

---

## 7. Auditoría: tres acciones, no una

`booking.adjustment.proposed`, `.applied` y `.rejected`. Son tres porque
responden a preguntas distintas: quién dijo que la casa no era lo contratado,
quién decidió cobrarlo, y quién decidió **no** cobrarlo. **La tercera es la
que más se mira cuando las cuentas de un mes no salen.**

La metadata lleva las cifras que cambian —«900 → 1300»— y **ningún dato del
cliente**: ni nombre, ni correo, ni teléfono, ni dirección. Hay prueba de ello.

---

## 8. Seguridad

Las guardias críticas se validaron **rompiéndolas a propósito** y comprobando
que las pruebas se ponen en rojo:

| Guardia                                   | Al quitarla       |
| ----------------------------------------- | ----------------- |
| Solo el responsable propone               | 1 prueba en rojo  |
| Se re-tarifica con la tabla de la reserva | 1 prueba en rojo  |
| El móvil no recibe importes               | 4 pruebas en rojo |

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

## 10. Dónde está cada cosa

| Qué                              | Dónde                                                          |
| -------------------------------- | -------------------------------------------------------------- |
| El contrato                      | `packages/types/src/field-adjustment.ts`                       |
| La tabla                         | `apps/api/prisma/migrations/20261004120000_field_adjustments/` |
| Proponer, aprobar y re-tarificar | `apps/api/src/admin/field-adjustments.service.ts`              |
| Leer un ajuste, en un solo sitio | `apps/api/src/admin/field-adjustment.helper.ts`                |
| Proponer                         | `PATCH /admin/my-jobs/:bookingId/adjustment`                   |
| Resolver                         | `POST /admin/bookings/:bookingId/adjustment/:adjustmentId`     |
| La pantalla del responsable      | `apps/admin/src/components/FieldAdjustmentForm.tsx`            |
| La decisión en el panel          | `apps/admin/src/components/FieldAdjustmentsSection.tsx`        |

---

## 11. Lo que quedó sin resolver

- **Añadir un extra que el cliente no contrató**, por lo dicho en §3.
- **El cliente no se entera de nada automáticamente.** Es consecuencia directa
  de la decisión de §2: coordinación habla con él. El día que se quiera avisar
  por correo, el gancho natural es la aprobación.
- **Un ajuste a la baja por debajo del depósito** deja dinero a devolver y no
  hay forma de devolverlo (§6.2).
- **La agenda no se mueve sola** (§6.2), y un trabajo que resulta ser el doble
  de grande probablemente debería durar más.
