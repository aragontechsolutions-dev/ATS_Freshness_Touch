# 22 — Los textos de la web, editables desde el panel

Las promesas que la empresa hace en su web y las preguntas frecuentes se
cambian desde **Configuración → Textos de la web**, sin tocar código y sin
desplegar nada.

No son adornos: son **compromisos**. «Estamos asegurados», «todo el equipo
pasa verificación de antecedentes», «si no quedas conforme volvemos en 24
horas». Lo que se escriba ahí es lo que un cliente va a reclamar, y por eso
esta pantalla está tratada con el mismo cuidado que las tarifas.

## 1. Qué se puede cambiar, y qué no

| Bloque                   | Textos                     | Dónde sale                                |
| ------------------------ | -------------------------- | ----------------------------------------- |
| **Nuestras promesas**    | 4 títulos + 4 cuerpos      | Las tarjetas de «Por qué Freshness Touch» |
| **Preguntas frecuentes** | 6 preguntas + 6 respuestas | El acordeón del final de la página        |

Veinte textos, cada uno en inglés y en español: **cuarenta campos**.

**Qué NO es editable, y por qué.** El titular de la portada es identidad de
marca, no dato de operación, y dejarlo editable invita a tocarlo sin criterio.
Los nombres y descripciones de los servicios ya se gobiernan desde el catálogo
y las tarifas, que es donde deben estar. Los rótulos de sección («Servicios»,
«Preguntas frecuentes») tampoco: no prometen nada.

## 2. La decisión que sostiene todo el diseño

> **La clave que se guarda ES la clave de traducción.**

`whyUs.insured.title` es a la vez la clave con la que se guarda el texto
editado y la que el sitio busca en su diccionario. No es una coincidencia
aprovechada: es lo que hace que **el respaldo no necesite tabla de
correspondencias**.

```ts
texto: (key) => siteCopyText(copy, key, locale) ?? t(key);
```

Esa línea es todo el mecanismo. Si la empresa no ha escrito nada para esa
clave en ese idioma, se pide la misma clave al diccionario y sale lo que salía
antes. Una tabla que emparejara «clave guardada» con «clave de traducción»
sería una segunda lista que mantener sincronizada, y el día que se
desincronizara el sitio enseñaría la clave en crudo.

**El respaldo vive dentro de la función**, no en cada sitio de llamada. Quien
pinta un texto escribe `texto('whyUs.insured.title')` y ya está. Si el hook
devolviera «el texto configurado o `null`», tarde o temprano alguien pintaría
el `null` y la portada saldría con un hueco.

## 3. Los dos idiomas, y el fallo que evita

El sitio está traducido entero. Si solo se pudiera editar un idioma, la web
acabaría diciendo **24 horas en inglés y 48 en español**, y nadie se enteraría
hasta que un cliente reclamara con la versión que le conviene.

Por eso cada texto tiene los dos idiomas y **cada uno puede quedarse sin
configurar por separado**:

- Idioma vacío → ese idioma sigue con el texto del código.
- Los dos escritos → la web dice lo mismo en los dos.
- **Uno sí y otro no** → la pantalla avisa, arriba y en el propio campo.

Ese aviso es el que de verdad importa. Nadie deja una promesa a medias a
propósito: se escribe la nueva en inglés, se deja el español para luego y se
olvida.

**Avisar no impide guardar.** Un idioma a medias es una situación válida
—quizá se está a mitad de la traducción—, solo arriesgada. El sistema informa;
la decisión es de quien edita.

### El recorte del idioma

`toSiteCopyLocale()` recorta `en-US`, `es-419` o `es-MX` a `en` o `es`. Sin
ese recorte la búsqueda fallaría **siempre**: el sitio seguiría enseñando los
textos del código, el panel parecería no servir para nada y nadie sabría por
qué. Lo desconocido cae en inglés.

## 4. Vacío es «sin configurar», nunca cadena vacía

Se representa con `null`. Con la cadena vacía, borrar un texto dejaría un
hueco en blanco en la portada en vez de volver al texto de partida, y no
habría forma de distinguir «lo quiero vacío» de «no lo he tocado».

La conversión se hace **una sola vez**, al guardar. El borrador del formulario
usa cadenas porque viene de inputs; si guardara `null`, habría que decidir en
cada tecla si lo escrito cuenta como vacío, y esa decisión repartida es como
se cuelan las cadenas vacías en la base.

Al guardar, una clave sin nada escrito en ningún idioma **no se guarda**: si
no, la fila iría acumulando restos de cada edición y nadie podría distinguir
lo que la empresa cambió de lo que borró hace un año.

## 5. Los límites de largo

| Campo                | Tope | Más largo hoy |
| -------------------- | ---- | ------------- |
| Títulos y preguntas  | 120  | 44            |
| Cuerpos y respuestas | 600  | 222           |

**Medidos sobre los textos que ya había**, en los dos idiomas, no elegidos a
ojo. Dejan casi el triple de holgura, que sobra para reescribir una promesa
con calma. Lo que impiden es que un pegado accidental de tres páginas entre en
la base y reviente la maquetación, o que alguien con acceso al panel convierta
la portada en un muro de texto.

También se rechazan **saltos de línea y caracteres invisibles**: el salto no
se respeta dentro de una tarjeta pero sí descuadra la altura, y los
invisibles son la forma clásica de que un texto diga una cosa y se lea otra.

## 6. Seguridad

Esta es la primera vez en el proyecto que **texto escrito en el panel se
publica literalmente en la web pública**. Merece detalle.

### Quién puede tocarlo

`GET` y `PUT /admin/site-copy` son **solo ADMIN, también para leer**.
Coordinación recibe 403 en las dos; sin sesión, 401. Hay prueba de las tres
salidas.

Que solo administración pueda escribir es lo evidente: quien pueda cambiar
esto hace que la empresa prometa por escrito, a todo el que entre en la web,
algo que quizá no piensa cumplir — o borra una promesa que sí cumple y pierde
ventas. Eso no tiene nada que ver con coordinar una agenda.

Que solo administración pueda **leer** es menos evidente, porque el texto es
público. La diferencia es lo que lo acompaña: esta pantalla dice además quién
lo escribió y cuándo. Quien solo necesita el texto lo tiene en el endpoint
público, sin sesión.

### El texto se pinta como texto, nunca como HTML

React escapa el contenido que va entre llaves, así que un `<script>` guardado
desde el panel **sale impreso en la página en vez de ejecutarse**.

Esa defensa se pierde con una sola línea: la prop de React que inyecta HTML en
crudo. El día que alguien quiera poner una promesa en negrita, esa es la forma
obvia y equivocada de conseguirlo, y a partir de ahí una cuenta de
administración comprometida puede inyectar lo que quiera en la portada.

Hay una **prueba sobre el código fuente** que falla si aparece en cualquier
archivo del sitio público. Busca el _uso_ de la prop (`=` o `:` detrás), no la
palabra, para que se pueda seguir explicando la regla en los comentarios.

> Si algún día hace falta formato de verdad, la respuesta correcta es un campo
> con formato acotado que el sitio convierta a elementos, **no abrir el HTML**.

El contrato **no rechaza** el símbolo `<`: hacerlo impediría escribir
«limpiezas de menos de \<2 horas». La defensa está en el pintado, que es donde
tiene que estar.

### Auditoría

Acción propia, `site_copy.updated`, y no `settings.updated`: ante una
reclamación la pregunta es «qué prometía la web cuando este cliente reservó», y
mezclada con los cambios de teléfono esa pregunta no se responde.

La metadata guarda **qué claves cambiaron y el texto nuevo de cada una**. Sin
el texto, el registro diría «se cambió la garantía», que no responde a lo único
que importa: a qué se cambió. Aquí no hay nada secreto — es texto escrito para
publicarse.

El cambio y su auditoría van en la **misma transacción**, y un rechazo del
contrato no deja nada guardado a medias.

## 7. Cómo está montado

| Pieza                                           | Qué hace                                       |
| ----------------------------------------------- | ---------------------------------------------- |
| `packages/types/src/site-copy.ts`               | El contrato: claves, límites, respaldo, avisos |
| `apps/api/src/settings/site-copy.service.ts`    | Lectura con caché, guardado y auditoría        |
| `apps/api/src/settings/site-copy.controller.ts` | `GET /site-copy`, público                      |
| `SiteCopyAdminController`                       | `GET`/`PUT /admin/site-copy`, solo ADMIN       |
| `apps/landing/src/hooks/useSiteCopy.tsx`        | El proveedor y el hook con el respaldo dentro  |
| `apps/admin/src/components/SiteCopyForm.tsx`    | La pantalla                                    |

**Todo vive en una sola fila** de `business_settings`, con la clave
`site_copy`. Las promesas se reescriben en tandas porque se contradicen entre
sí: cambiar la garantía a 48 horas obliga a tocar también la pregunta
frecuente que la menciona. Con una fila por texto, un fallo a mitad dejaría la
web prometiendo 48 horas en la tarjeta y 24 en el FAQ, que es peor que no
haber cambiado nada. Por eso también el endpoint es `PUT` y no `PATCH`.

**No hay migración**: se reutiliza la tabla de configuración que ya existía.

### Añadir o retirar un texto editable en el futuro

El contrato usa un **registro parcial**: una clave que no está significa «sin
configurar». Eso hace que **añadir** un texto editable sea seguro — a la fila
guardada le faltará la clave nueva y no pasa nada.

Las claves desconocidas **sí se rechazan**, para que una mal escrita no se
quede guardada en silencio sin salir nunca en la web. El efecto secundario es
que **retirar** un texto invalidaría la fila entera y la empresa perdería todo
lo escrito; por eso el servicio limpia las claves retiradas **antes** de
validar. Es la misma solución que se usó al retirar `surchargeCents` del área
de servicio.

### La sección y el contrato no se pueden desincronizar

Las secciones del sitio construyen la clave con una plantilla sobre una lista
`as const`, así que TypeScript deriva exactamente las claves del contrato.
**Añadir una séptima pregunta frecuente sin declararla no compila** —
comprobado, no supuesto:

```
error TS2345: Argument of type '"faq.q1.q" | … | "faq.q7.q"' is not
assignable to parameter of type '"whyUs.insured.title" | … | "faq.q6.a"'.
```

## 8. Lo que la pantalla enseña, y por qué

**El texto publicado va siempre encima del campo.** Nadie reescribe bien una
promesa sin leer la que hay, y como el campo vacío significa «deja el de
siempre», sin enseñar cuál es «de siempre» el campo vacío no diría nada.

Esa línea muestra **lo último guardado si lo hay, y el del código si no** —
nunca el borrador. La primera versión enseñaba el borrador en cuanto había
algo escrito, así que la referencia desaparecía justo cuando sirve: al
comparar. La etiqueta decía «ahora en el sitio» y mostraba lo que acababas de
teclear. Hay prueba de regresión.

**Los dos idiomas van juntos**, uno al lado del otro. Separarlos en dos
pestañas es como se acaba escribiendo el inglés y olvidando el español.

**Cada promesa es un bloque** con su título y su cuerpo dentro, encabezado por
el título publicado. Nadie piensa en `whyUs.insured.title`: piensa en «la
promesa del seguro».

## 9. Qué NO cambia al editar

Cambiar un texto **no cambia lo que se le prometió a quien ya reservó**: su
correo de confirmación conserva lo que decía cuando se envió. La pantalla lo
avisa, porque es la primera pregunta de cualquiera antes de tocar algo que
suena a compromiso.
