# 44 — Publicar los textos legales y exigir que se acepten

> Etapa 3.28. Tapa el hueco **A1** de `docs/43-los-huecos-que-quedan.md`:
> los documentos estaban escritos y no estaban publicados, y el sitio cobraba
> sin que nadie aceptara nada.
>
> Código: `packages/types/src/legal.ts`, `apps/landing/src/legal/`,
> `apps/landing/src/components/PaginaLegal.tsx`, migración
> `20261028150000_lo_que_el_cliente_acepto`.

---

## 1. Qué había y qué hay

| Antes                                               | Ahora                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| Los textos vivían en `docs/legal/*.md`              | Son páginas del sitio: `/terms` y `/privacy`                         |
| El pie no enlazaba nada, con las claves ya escritas | Las dos, en todas las páginas                                        |
| Se podía reservar sin aceptar nada                  | **Sin marcar la casilla no hay reserva**, y lo comprueba el servidor |
| No quedaba constancia                               | Cada reserva guarda **qué versión** aceptó y cuándo                  |

---

## 2. La página es el documento

Durante un rato hubo **dos copias** de cada texto: el Markdown de `docs/legal/`
y la que renderiza la aplicación. Es exactamente la clase de duplicado que se
separa solo —se corrige una, la otra se queda mintiendo— y la que el cliente
acepta es la que nadie corrigió.

Así que los cuatro `.md` **se retiraron**. El original es
`apps/landing/src/legal/*.ts`: listas de bloques con el texto dentro, que se
leen sin saber programar. Y el abogado revisa **la página publicada**, que es
lo que de verdad importa.

El formato tiene siete tipos de bloque y ni uno más (`documento.ts`). En
particular, `partirNegritas()` **no es un intérprete de Markdown y no debe
llegar a serlo**: en cuanto admita enlaces o HTML, el texto de un documento
pasa a poder inyectar cosas en la página. Hoy sólo hay negrita, y lo que
devuelve son cadenas que React pinta como texto.

---

## 3. Los datos de la empresa no están en el texto

Razón social, dirección postal, teléfono, correo y condado salen de **Datos
del negocio**. Si estuvieran escritos dentro del documento, cambiar un
teléfono exigiría tocar código y desplegar — la lección que el sitio ya
aprendió con los números de relleno (`docs/13` §12).

Se añadieron tres campos nuevos al ajuste: `legalName`, `mailingAddress` y
`county`. Los tres **nulos por defecto**, y nulo significa «todavía no se ha
configurado».

**Lo que falta no se pinta.** Un «[RAZÓN SOCIAL]» publicado dentro de un
contrato es peor que una fila que no está. En la prosa, donde omitir no es
posible, se sustituye por una frase que sigue teniendo sentido:

| Hueco                    | Si falta                                         |
| ------------------------ | ------------------------------------------------ |
| `{{company}}`            | «Freshness Touch», el nombre comercial           |
| `{{phone}}`, `{{email}}` | «los datos de contacto del final de esta página» |
| `{{county}}`             | «el condado donde está nuestra empresa»          |

---

## 4. Tres rutas, y por qué sigue sin haber enrutador

`App.tsx` decía _«el día que haya tres, se mete»_ un enrutador. Hay tres. Y
sigue sin meterse, porque al llegar el momento **la cuenta no salió**: un
enrutador aporta rutas con parámetros, navegación sin recargar e historial, y
estas tres son direcciones fijas a las que se llega **desde fuera** —un
correo, el pie, una pestaña nueva— y de las que no se vuelve. Pagar cuarenta
kilobytes en el sitio que genera los ingresos por un `switch` de tres casos no
es una decisión técnica, es una costumbre.

**La línea que sí lo cambia** queda escrita en el código: el día que una de
estas pantallas necesite enlazar a otra sin recargar, o lleve un identificador
dentro de la ruta.

Las dos legales llevan cabecera y pie; la de retirar fotos no. Quien lee las
condiciones puede querer volver al sitio o llamar; quien retira sus fotos vino
a una sola cosa.

---

## 5. La casilla

Tres decisiones, y las tres salen de lo que tumba un _clickwrap_ en un
tribunal (`docs/40` §5):

1. **Nace sin marcar**, y no hay forma de que nazca marcada: hay una prueba
   que lo comprueba. Una casilla premarcada no es un acto de nadie, y es el
   fallo más frecuente.
2. **Los enlaces abren en pestaña nueva**, con `rel="noopener noreferrer"`
   —hay una prueba del proyecto que lo exige en todo lo que abre pestaña—.
   Leer las condiciones no puede costar perder la reserva a medio rellenar.
3. **El error sale debajo de la casilla**, no arriba del formulario. Es el
   mismo arreglo que el motivo de cancelación en el panel: un aviso que no
   está donde está el problema no es un aviso.

---

## 6. Obligatoria en el sitio, inexistente en el panel

Es la única parte del contrato que depende de **quién** reserva, así que la
regla vive en el servicio y no en el esquema:

```
POST /bookings        sin `legal` → 400 LEGAL_NOT_ACCEPTED
POST /admin/bookings  sin `legal` → se crea, y la ficha dice «no consta»
barrido de series     sin `legal` → igual
```

Una clienta que llama por teléfono no marca ninguna casilla. **Inventarle una
aceptación sería escribir que hizo algo que no hizo**, y eso es peor que no
tener el dato.

Si el campo fuera obligatorio en el esquema, el panel tendría que fabricar una
aceptación falsa. Si tuviera valor por defecto, un fallo del formulario
reservaría sin que nadie aceptara nada y la fila diría que sí.

### El error tiene código propio

`LEGAL_NOT_ACCEPTED`, y no un `VALIDATION_ERROR`. El caso realista no es un
formulario mal rellenado: es **una pestaña abierta de antes del despliegue**. A
esa persona hay que decirle que recargue — y que no se le ha cobrado nada, que
es lo primero que piensa.

---

## 7. Se guarda la versión, no el texto

Tres columnas nuevas en `bookings`: `termsVersion`, `privacyVersion` y
`legalAcceptedAt`, escritas **dentro de la misma transacción** que la reserva.

**La regla que lo sostiene, y la única que no se puede romper:** corregir un
texto publicado no es editar el archivo, **es publicar una versión nueva**. Si
se edita sin subir el número, lo guardado apunta a un texto que ya no es el que
esa persona aceptó, y el registro deja de servir para lo único que existe.

Las tres columnas admiten nulo y **no llevan valor por defecto**: un defecto
convertiría «no consta» en «aceptó la versión 1». Nulo significa algo concreto
—nadie marcó nada— y el panel lo dice con esas palabras.

En la ficha de la reserva se ve qué aceptó y cuándo, y **si eso ya no es lo
publicado hoy sale un aviso**: ante una reclamación, lo primero que hay que
saber no es qué aceptó, sino si la conversación va sobre el texto viejo.

---

## 8. Qué está probado

| Dónde                                                    | Qué                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/bookings/legal-acceptance.e2e.test.ts` (3) | Sin aceptación, 400 con código propio y **ninguna fila creada**; con aceptación se crea y la versión queda guardada; una versión que no es un entero positivo se rechaza |
| `apps/landing/src/lib/booking-validation.test.ts` (+2)   | Sin aceptar no se puede enviar; **la casilla nace sin marcar**                                                                                                           |
| `se-escribe-no-se-llama.test.ts`                         | Ya existía: exige `rel="noopener noreferrer"` en todo lo que abre pestaña. Pilló que mis enlaces sólo llevaban `noreferrer`                                              |

El archivo de extremo a extremo es **suyo propio** (puerto 55497). Metidas en
`bookings.e2e.test.ts`, estas pruebas gastaban un presupuesto ya consumido:
`POST /bookings` admite cinco por minuto y ese límite está puesto para
producción. Bajarlo en las pruebas sería dejar de probar lo que corre de
verdad.

> **Un fallo preexistente que salió de camino.** `booking-media-consent.e2e`
> empezó a fallar hoy sin que nadie lo tocara: elegía la franja `[contador-1]`
> del día, `proximoDiaLaborable()` suma tres días, el 28 de octubre eso cayó en
> **sábado** —que abre de 09:00 a 16:00 en vez de 08:00 a 18:00— y a la cuarta
> reserva ya no quedaban huecos. El fallo no estaba en el código ni en la
> prueba: estaba en el calendario, que es la peor clase de fallo intermitente.
> Ahora coge siempre la primera libre.

---

## 9. Lo que falta para que esto sirva de algo

1. **Rellenar los tres datos legales** en el panel. Sin ellos las páginas se
   publican igual, pero sin razón social, sin dirección y con el condado en
   genérico.
2. **Que lo revise un abogado de Georgia.** Sigue siendo un borrador y los
   documentos lo dicen.
3. **Decidir las tres cláusulas abiertas** de `docs/40` §6.

## 10. Al desplegar

Hay migración: `20261028150000_lo_que_el_cliente_acepto`.

**El orden importa, y por una vez conviene decirlo.** Desde que la API exige
la aceptación hasta que el sitio nuevo llega al navegador de alguien, una
pestaña vieja que intente reservar recibe un 400. Por eso ese error dice que
recargue y que no se ha cobrado nada, en vez de «petición inválida». Desplegar
las dos cosas desde el mismo _merge_ reduce esa ventana a los minutos que
tarden los dos despliegues.
