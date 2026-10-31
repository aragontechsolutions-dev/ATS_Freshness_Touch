# 49 — Nuestra historia

> Etapa 3.33. La carta de la fundadora en la portada.
>
> Código: `apps/landing/src/sections/About.tsx`, bloque `about` en
> `packages/i18n/src/en.ts` y `es.ts`.
>
> **No hay migración, no hay endpoint y no hay variable de entorno.** Es una
> sección de la web y nada más.

---

## 1. Qué se añadió

La historia de Carmen, fundadora de Freshness Touch, tal y como la escribió
ella: diez párrafos en primera persona, el cierre y la firma.

Va entre **«Por qué Freshness Touch»** y el **antes y después**, con entrada
propia en el menú (`#about`).

Ese sitio no es casual. «Por qué nosotros» son cuatro promesas cortas; esto es
**quién las hace**. Puesta antes, el visitante lee una carta personal de
alguien que todavía no le ha dicho a qué se dedica. Puesta al final, después de
las preguntas frecuentes, no la lee nadie. Ahí cierra el argumento de confianza
justo antes de que las fotos lo demuestren.

---

## 2. Por qué el texto NO es editable desde el panel

Es la decisión de esta etapa, y tiene una mitad técnica y otra de criterio.

**La técnica:** los textos editables (`docs/22`) topan en
`SITE_COPY_LONG_MAX` = 600 caracteres y el contrato **rechaza los saltos de
línea**, porque se pintan dentro de una tarjeta donde un salto no se respeta
pero sí rompe el cálculo de altura. La carta son unas **1.900 letras en diez
párrafos**. No es que quepa apretada: no cabe.

**La de criterio**, que es la que manda: en los textos editables van las
**promesas de operación** —la póliza, el plazo para cancelar, cómo se explica
el depósito— porque cambian cuando cambia el negocio, no cuando se despliega.
El titular de la portada no está ahí por ser identidad de marca, y esto es
exactamente lo mismo. Cambiar la historia de la fundadora es una decisión, no
un ajuste.

**Qué haría falta para hacerla editable**, el día que se quiera: un tipo de
campo nuevo que acepte párrafos, con su propio límite y su propia pantalla. No
es añadir una clave a `SITE_COPY_KEYS`.

---

## 3. Cada párrafo es una clave

En vez de un texto largo con `\n` dentro:

```ts
about: {
  p1: 'My name is Carmen, and I am the founder of…',
  p2: 'Ten years ago, I came to the United States from Cuba…',
  …
}
```

Dos razones:

1. **El inglés y el español se comparan párrafo a párrafo.** Con un solo texto
   gigante por idioma, media traducción perdida no se ve.
2. **La prueba de i18n ya vigila que las claves existan en los dos idiomas.**
   Un párrafo que falte en español deja de compilar, porque `es.ts` se declara
   como `typeof en`.

Y el componente **recorre una lista**, no escribe diez `<p>` a mano. Diez
líneas casi iguales son diez sitios donde olvidarse de una al añadir la
siguiente.

---

## 4. Las dos pruebas, y el fallo que vigila cada una

### `la-carta-no-pierde-parrafos.test.ts`

Si mañana se añade `p11` al texto y nadie lo mete en la lista del componente,
**ese párrafo no sale en la web y no hay ningún error en ninguna parte**. La
carta se queda a medias y nadie lo denuncia, porque nadie sabe que falta. Es el
mismo modo de fallo que las clases `ft-` inventadas.

La prueba comprueba las dos direcciones (escrito y no pintado, pintado y no
escrito), el orden, y que **el español esté de verdad traducido**: la prueba de
recursos de i18n compara claves, no contenido, y el atajo clásico al añadir un
texto largo es copiar el inglés en `es.ts` para que compile y traducirlo
«luego». Ese «luego» se publica.

La firma se exceptúa a propósito: un nombre no se traduce, y hay una
comprobación que lo fija para que nadie «traduzca» a Carmen.

### `el-menu-lleva-a-algun-sitio.test.ts`

Nació aquí pero **vigila las siete entradas del menú**.

Un enlace a un `id` que no existe **no da error**: el navegador no va a ninguna
parte y la página se queda donde estaba. Quien lo pulsa no piensa «este enlace
está roto», piensa que no ha pulsado bien. Pasa de dos maneras y ninguna se ve
al revisar un cambio: una errata al añadir la entrada, y renombrar el `id` de
una sección olvidando el enlace que apuntaba a ella.

Las dos pruebas se comprobaron **al revés** —quitando `p10` de la lista y
apuntando el menú a `#nuestra-historia`— para verificar que fallan de verdad.

---

## 5. Decisiones de maquetación

**Texto corrido en una columna estrecha, no tarjetas.** `WhyUs` ya hace lo de
las tarjetas y lo hace bien. Partir esta historia en tarjetas la convertiría en
lo mismo otra vez, y aquí convence lo contrario: que se lea del tirón, en
primera persona, con el nombre de quien la firma debajo.

`max-w-prose` deja la línea en unos 65 caracteres. Sin ese tope, en un monitor
ancho cada párrafo es una línea de 200 caracteres y el ojo pierde el renglón al
volver a la izquierda.

**La frase larga va de subtítulo, no de título.** «Freshness Touch Cleaning
Service — A Family Dream Built with Love, Dedication & Hard Work» es un `h2` de
catorce palabras: no se lee en un móvil y pelea con el resto de los rótulos. El
`h2` es «Our Story», que es además lo que dice el menú.

**La firma va aparte, con una línea encima.** No es un párrafo más: es el cierre
de una carta y se lee como tal.

**El rótulo del menú en español es «Historia», no «Nuestra historia».** Con esta
entrada el menú pasa a siete, y en la cabecera las etiquetas compiten por sitio
con el logotipo, el teléfono, el idioma y el tema. Es la regla que ya estaba
escrita en `nav` (`en.ts`): la etiqueta corta en el menú, la frase entera en el
título. Hay una prueba que lo fija.

---

## 6. Seguridad

Poca cosa, y conviene decir por qué:

| Riesgo                       | Por qué no aplica                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| HTML inyectado en el texto   | Se pinta con las llaves de React, que escapan solas. No hay `dangerouslySetInnerHTML`         |
| Texto que entra desde fuera  | No entra: vive en el código, no en la base. Nadie lo escribe desde una pantalla               |
| Datos personales publicados  | Es la fundadora contando su propia historia, con su consentimiento: es ella quien la escribió |
| Una promesa nueva sin querer | La carta **no promete** nada medible. Las promesas siguen en `WhyUs` y en las FAQ (`docs/22`) |

Ese último punto se revisó frase a frase, porque es el único riesgo real de
esta etapa: «siete años de experiencia» y «diez años en Estados Unidos» son
hechos de su biografía, no compromisos de servicio. «Creemos en la honestidad»
es un valor, no una garantía con plazo. Nada de lo que dice la carta crea una
obligación que las condiciones no cubran ya.

---

## 7. Lo que queda fuera

- **Una foto de Carmen.** Haría más por esta sección que cualquier ajuste de
  tipografía, y no se inventa ninguna. El día que haya una, entra en la columna
  de la izquierda en pantallas grandes sin tocar el texto.
- **El nombre completo de la empresa.** La carta dice «Freshness Touch Cleaning
  Service» y el resto del sitio dice «Freshness Touch» (`common.companyName`).
  Se dejó tal cual porque es su voz y es el nombre con el que firma; no se
  interpola.
- **Hacerla editable desde el panel.** Ver §2.
