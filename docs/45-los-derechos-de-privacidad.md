# 45 — Los derechos de privacidad: copia, corrección y borrado

> Etapa 3.29. Tapa el hueco **A2** de `docs/43-los-huecos-que-quedan.md`, que
> era el más incómodo de la lista **porque lo abrió el documento que nosotros
> mismos redactamos**.
>
> Código: `packages/types/src/privacy.ts`, `apps/api/src/privacy/`,
> `apps/admin/src/pages/Privacidad.tsx`, migración
> `20261029100000_los_derechos_de_privacidad`.

---

## 1. El problema: una promesa sin nada detrás

La Política de Privacidad dice que cualquiera puede pedir una copia de lo que
tenemos sobre él, corregirlo o borrarlo, y que **se responde en 30 días**.

Al auditarlo apareció que eso no se podía cumplir:

- No había herramienta, ni pantalla, ni endpoint, ni proceso.
- **Borrar un cliente era imposible.** `Booking.customer` y
  `RecurringSeries.customer` son `onDelete: Restrict`, así que la base lo
  impide — y hace bien: una reserva sin cliente no significa nada.
- No había nadie designado para leer el buzón.

Prometer por escrito un derecho que el sistema no puede ejercer es peor que no
prometerlo: es una afirmación falsa en un documento público, que es justo lo
que persigue la Sección 5 de la FTC Act.

---

## 2. Borrar es anonimizar, y la política ya lo decía

No es una excusa técnica. El documento ya decía: _«lo haremos salvo en lo que
estemos obligados a conservar: registros fiscales y contables, y lo necesario
para una reclamación abierta»_.

Una contabilidad con huecos no es una contabilidad. Lo que se va es **lo que
identifica a la persona**; lo que se queda es que el 4 de marzo se limpió una
casa de 1.600 pies cuadrados en el 30132 por 185 dólares.

| Se va                                               | Se queda                                           |
| --------------------------------------------------- | -------------------------------------------------- |
| Nombre, apellido, correo, teléfono                  | Referencia, importes, fechas y estado de cada cita |
| Calle, piso, **instrucciones de acceso**            | Ciudad y código postal                             |
| **Las coordenadas de la casa**                      | La marca y los cuatro últimos de la tarjeta        |
| Las indicaciones que escribió y el pin de la puerta | El rastro de quién hizo qué                        |
| A quién se mandó cada aviso                         | Que el aviso se mandó                              |
| Su nombre y dirección en los permisos de imagen     | Que hubo un permiso y cuándo se firmó              |

**Las coordenadas se van con la calle**: un punto en el mapa _es_ la casa, con
o sin el nombre de la vía delante. Es el error fácil de cometer.

El correo no se puede vaciar —es único y obligatorio— así que se sustituye por
uno que no enruta a ninguna parte y que no puede chocar con el de otra
persona.

> La lista exacta vive en `ANONYMIZED_FIELDS` y `ANONYMIZED_KEPT`, **en el
> contrato y no escondida en un servicio**. Es lo que se le contesta a alguien
> que pregunta qué se borró: si alguien añade una columna con datos personales
> y no la pone ahí, el borrado deja de ser completo y nadie se entera.

### Las fotos se retiran a la vez

Es la interacción que no se ve venir. Si el permiso de imagen sólo se
anonimizara, **las fotos seguirían publicadas y el permiso que las ampara se
quedaría sin nombre**: lo peor de los dos mundos — se sigue enseñando su casa
y ya no se puede demostrar que lo autorizó.

Así que anonimizar **revoca primero** los permisos vivos y después borra el
nombre. Quien pide que se borren sus datos está pidiendo también esto, aunque
no lo diga.

---

## 3. La copia: lo peligroso es que sobre, no que falte

Es un archivo que se le entrega a una persona. Un `select` demasiado generoso
metería dentro los identificadores del proveedor de pago, el personal que
atendió cada reserva o las notas internas del equipo, y eso ya no es su copia:
**es una filtración con su nombre en la portada**.

Por eso `PrivacyExportSchema` es un `strictObject`: un campo de más no se
cuela, revienta en una prueba antes de llegarle a nadie. Hay una prueba que
comprueba expresamente que `pi_…` no aparece en la salida.

Se **descarga**, no se pinta. Un expediente completo en pantalla se queda
abierto encima de una mesa; un archivo se adjunta a la respuesta y se cierra.

### Se audita la lectura

Es lo contrario de la regla general del proyecto —las lecturas no se auditan
porque llenarían el registro— y por el mismo motivo por el que la ficha de una
reserva **sí** se audita: llevarse el expediente completo de una persona no es
consultar una pantalla.

Se registra el hecho y el recuento, **nunca el contenido**: lo que decía no se
vuelve a escribir en otro sitio.

---

## 4. Lo que impide borrar a quien no era

El error que hay que evitar no es borrar: es **borrar a la persona de la fila
de al lado**. Es irreversible y no hay deshacer — no se puede reconstruir un
nombre que ya no está.

Por eso hay que **escribir el correo a mano** y tiene que coincidir. Un botón
con un «¿seguro?» se pulsa dos veces seguidas sin leer; copiar el correo
obliga a mirar a quién se está borrando. El servidor lo vuelve a comprobar y
responde `PRIVACY_CONFIRM_MISMATCH`, con código propio: el formato era
correcto, lo que no cuadra es la persona.

Y el motivo es obligatorio, como al cancelar una reserva.

---

## 5. Seguridad

| Qué                    | Cómo                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quién entra            | **Sólo `ADMIN`**. Es la restricción más fácil de justificar del panel: aquí se descarga el expediente de una persona y se borra                                                                                                                                     |
| Cómo se busca          | Por correo **exacto**. Con búsqueda parcial, escribir «@gmail» sacaría media cartera en la pantalla que exporta y borra                                                                                                                                             |
| Límite de peticiones   | 5 cada 15 minutos, **aunque sea una ruta interna**. Una cuenta de administración comprometida recorriendo la base es el peor escenario del sistema; un límite bajo convierte «en diez minutos» en «en varios días», que es tiempo de sobra para que alguien lo note |
| El rastro              | `customer.exported`, `customer.updated` y `customer.anonymized`, agrupadas como **sensibles** en el filtro de la auditoría                                                                                                                                          |
| Qué NO va en el rastro | Ni el correo ni el nombre que había. Si la auditoría los guardara, **borrar a una persona dejaría su correo escrito justo en la tabla que no se borra**                                                                                                             |
| Atomicidad             | Todo en una transacción. A medias es el peor resultado: el nombre fuera de la ficha y dentro del permiso de imagen, o al revés                                                                                                                                      |

---

## 6. Se retira `customers.internalNotes`

La auditoría la encontró sin uso: cero apariciones en todo el repositorio
fuera del esquema. La otra salida era empezar a usarla, y no se hace **por
esta misma etapa**:

Unas notas internas _sobre una persona_ son datos personales suyos, y la
política promete entregarle una copia de todo lo que tenemos. Habría que
exportarlas. **Un campo libre pensado para que el equipo escriba «clienta
difícil» y que después hay que enseñarle a esa persona es un pasivo, no una
función.**

No hubo nada que migrar: estaba vacía en todas las filas porque ningún código
escribió nunca en ella.

---

## 7. La política se vuelve concreta (versión 2)

Dos frases dejan de ser vagas, y eso **sube la versión del documento** — que
es la regla de `docs/44` §7:

| Antes                                                             | Ahora                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| El registro de auditoría «se conserva como registro de seguridad» | «**Un año**, y después se borra solo», que es lo que `AUDIT_RETENTION_DAYS` hace de verdad |
| «Borrar, salvo lo que estemos obligados a conservar»              | La lista exacta de lo que se quita y lo que se queda                                       |

Decir el número que el sistema ya cumple es mejor que una vaguedad, y no
cuesta nada.

---

## 8. Qué está probado

`apps/api/src/privacy/privacy.e2e.test.ts`, contra PostgreSQL real (PGlite,
puerto **55498**), 12 pruebas sobre una clienta con todo lo que puede colgar
de ella —dirección con instrucciones y coordenadas, reserva con notas y pin,
pago, aviso y permiso de imagen con fotos—:

| Grupo        | Qué                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quién entra  | Coordinación recibe 403 en las tres rutas; sin sesión, 401                                                                                                |
| Buscar       | Encuentra por correo exacto; **un trozo del correo no saca a nadie**                                                                                      |
| La copia     | Lleva lo suyo; **no lleva los identificadores del proveedor**; queda escrito quién se la llevó                                                            |
| El borrado   | Se lleva lo que identifica, **deja la contabilidad en pie**, retira las fotos y borra el nombre del permiso, y la auditoría no contiene el correo borrado |
| Las defensas | Con el correo equivocado no se toca nada (409); sin motivo, 400                                                                                           |

> Las del borrado van **en una sola prueba**, y es el propio código probado el
> que lo obliga: la ruta está limitada a cinco peticiones cada cuarto de hora.
> Una prueba por aserción gastaba ese presupuesto y respondía 429. Subir el
> límite para las pruebas sería dejar de probar lo que corre de verdad, que es
> justo lo que aquí más importa.

---

## 9. Lo que sigue sin estar

- **Stripe guarda su copia.** Anonimizar aquí no borra nada allí, y con la
  clave restringida que usamos no se puede: no tiene permiso de escritura
  sobre clientes. Hay que hacerlo a mano en el panel de Stripe, y la política
  ya dice que compartimos datos con ellos. **Queda como paso manual.**
- **Quién lee el buzón** sigue siendo la decisión 7 de `docs/40` §6. La
  herramienta existe; la persona la tiene que poner la dueña.
- **No hay plazo automático.** La política promete 30 días y nada vigila que
  se cumplan. Un aviso en la bandeja cuando una petición lleva 20 días
  abierta exigiría registrar las peticiones, no sólo atenderlas; hoy la
  petición vive en el correo de la dueña.
- **Los permisos de imagen se enlazan por correo**, porque la tabla no cuelga
  del cliente —un permiso lo puede firmar quien vive en la casa sin ser quien
  contrató—. Si alguien firmó con otra dirección, ese permiso no se encuentra
  en el borrado. Está dicho aquí para que se sepa.
