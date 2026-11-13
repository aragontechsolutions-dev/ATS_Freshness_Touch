# 54 — Las fotos del sitio público

Hasta el 13/11/2026 el sitio público no tenía **ni una sola fotografía**. La
portada, los servicios, «qué incluye» y la carta de la fundadora eran texto,
iconos y una tarjeta de precio inventada. Este documento recoge qué foto entró
en cada sitio, de dónde sale y qué queda pendiente.

---

> ## 🚨 ANTES DE DESPLEGAR: cuatro fotos están dentro de casas de clientes
>
> **`servicio-estandar`, `servicio-profunda`, `servicio-mudanza` e
> `incluye-banda` están tomadas dentro de viviendas de clientes reales.**
> Publicarlas en la web es exactamente lo que `docs/38` regula, y el sistema
> tiene un registro de consentimientos (`media_consents`) que estas cuatro
> **no atraviesan**: son archivos estáticos del repositorio, no fotos subidas
> desde el panel.
>
> `docs/38` §2 es explícito: el permiso es **de esa casa**, enumera dónde se
> publica, va firmado y fechado, y **«un permiso verbal no vale»**.
>
> **Qué hay que hacer antes de que esto llegue a producción**, y es de la
> dueña, no del código:
>
> 1. Confirmar que hay **permiso por escrito** de los dueños de esas tres
>    viviendas, con la web enumerada como destino.
> 2. Registrarlo en el panel, como cualquier otra foto. Si el permiso llegó
>    por WhatsApp, vale el atajo de «clienta de siempre» (`docs/50` §A).
> 3. Si de alguna no hay permiso, **sustituir esa foto**. El código no se
>    rompe: un servicio sin entrada en `FOTO_POR_SERVICIO` pinta la tarjeta
>    sin cabecera, igual que hará el comercial el día que vuelva.
>
> **Las dos de la fundadora (`hero-carmen` y `sobre-carmen`) no tienen este
> problema:** son fotos posadas de ella misma, no de casa de nadie.

---

## 1. Qué foto hay en cada sitio

| Sección          | Archivo           | Qué se ve                      | ¿Casa ajena? |
| ---------------- | ----------------- | ------------------------------ | ------------ |
| Portada (`Hero`) | `hero-carmen-*`   | Carmen con el uniforme         | No           |
| Servicios ×3     | `servicio-*`      | Aspirando · grifería · sábanas | **Sí**       |
| Qué incluye      | `incluye-banda-*` | Manos puliendo una grifería    | **Sí**       |
| Nuestra historia | `sobre-carmen-*`  | Carmen en su escritorio        | No           |

Todas en **WebP**, con dos anchos y `srcset`: un móvil descarga la pequeña.

| Archivo         | Móvil    | Escritorio |
| --------------- | -------- | ---------- |
| `hero-carmen`   | 28 KB    | 66 KB      |
| `sobre-carmen`  | 30 KB    | 79 KB      |
| `incluye-banda` | 15 KB    | 33 KB      |
| `servicio-*`    | 10–12 KB | 22–32 KB   |

---

## 2. Dos almacenes distintos, y la diferencia no es un descuido

|                | **`public/fotos/`** (este documento)  | **Almacén de Supabase** (`docs/38`)  |
| -------------- | ------------------------------------- | ------------------------------------ |
| Quién las pone | Un desarrollador, en un despliegue    | La empresa, desde el panel           |
| Qué son        | **Parte del diseño** de la página     | **Contenido** que la empresa publica |
| Cambiarlas     | Requiere desplegar                    | En caliente, sin tocar código        |
| Consentimiento | **No hay registro** (ver el aviso)    | `media_consents`, con firma          |
| Las vigila     | `las-fotos-del-sitio-existen.test.ts` | El panel y el barrido de retirada    |

La galería **no cambia**: sigue saliendo del almacén. Si la portada cambia, es
que ha cambiado la página; si la galería cambia, es que la empresa publicó un
trabajo nuevo. Son dos cosas distintas y por eso entran por sitios distintos.

---

## 3. La portada: por qué se fue la tarjeta de precio

La columna derecha llevaba un desglose **inventado** —«limpieza estándar
$185», «horno $35»—. Se quitó por dos motivos:

1. **El cotizador, doscientos píxeles más abajo, enseña ese mismo desglose con
   los números de verdad** de quien lo usa. Un ejemplo inventado al lado de un
   cálculo real no aporta: compite.
2. **Esta es una empresa a la que se le abre la puerta de casa.** En ese
   negocio el argumento más fuerte no es un precio de ejemplo: es que detrás
   hay una persona concreta, con nombre y cara. La carta de la fundadora ya
   estaba en el sitio; lo que faltaba era ponerle cara arriba del todo.

La tarjeta con el nombre sobre la foto usa `about.signature`, **no una cadena
suelta**: el nombre ya vivía en la carta, y dos sitios con el mismo nombre
acaban diciendo cosas distintas.

---

## 4. La foto de la portada es el elemento LCP

Es la imagen más grande sobre la línea de flotación, así que es la que Google
cronometra para Core Web Vitals — el informe que ya está en Search Console. De
ahí cada atributo:

- **`fetchPriority="high"` y sin `loading="lazy"`.** Una imagen LCP diferida
  es el fallo clásico que hunde la métrica sin que nada parezca roto.
- **`srcSet` con dos anchos.** 28 KB en móvil en vez de 66.
- **El contenedor fija la proporción y la imagen lo rellena.** Sin eso el
  texto salta al cargar la foto, que es CLS: la otra métrica que mide Google.
- **Las demás sí van con `loading="lazy"`**, porque están por debajo de la
  línea de flotación y pedirlas de inmediato le robaría ancho de banda a esta.

---

## 5. Qué se les hizo a las fotos, y qué no se pudo hacer

**Lo que sí:**

- **Recorte.** La foto de la portada venía con un panel de texto de marketing
  a la derecha; se recortó y quedó limpia.
- **Corrección de luz.** Las de trabajo son de móvil, en interiores y oscuras.
  Se subieron las sombras sin quemar las luces ni falsear el color.
- **Sin EXIF.** Las que van al panel se entregaron con los metadatos quitados.

**Lo que no, y conviene que quede escrito:**

- **Quitar texto incrustado ENCIMA de la foto.** Dos de las piezas que mandó
  la dueña («MEET Carmen» y el flyer con el teléfono) llevan el texto sobre la
  imagen. Sin relleno generativo no se puede quitar. Del flyer no hizo falta
  —la foto de debajo estaba suelta—; de «MEET Carmen» solo hay una captura del
  editor del móvil, así que esa pieza se descartó.
- **Poner el logotipo en las camisetas negras lisas.** Se pidió y **no se
  hizo**, a propósito. Un logotipo compuesto a mano sobre tela con pliegues se
  nota, y en una empresa a la que se le abre la puerta de casa una foto
  obviamente retocada dice que esta gente maquilla las cosas. Esas fotos valen
  **porque son reales**.

---

## 6. Las rutas se escriben enteras, no con plantillas

`'/fotos/servicio-estandar-768.webp'` y no `` `/fotos/${base}-768.webp` ``.

Es más largo de leer y se gana algo que vale más: **la ruta se puede buscar**.
Con la plantilla, ni un `grep` ni la prueba que vigila estas fotos pueden
saber qué archivos pide el sitio, y una foto borrada del disco se descubre en
el navegador. Lo cazó esa misma prueba la primera vez que se escribió.

---

## 7. La prueba que las vigila

`apps/landing/src/las-fotos-del-sitio-existen.test.ts`. Comprueba:

- Que **toda foto que el código pide existe** en `public/fotos`. Vite no mira
  esas rutas: una mal escrita da un 404 y un hueco gris en la portada, sin que
  falle `typecheck`, `lint` ni `build`.
- Que **ninguna foto sobra** en la carpeta. Quitarla del código obliga a
  quitarla del disco.
- Que **cada foto tiene sus dos anchos**. Sin el pequeño, un móvil se baja el
  grande.
- Que **ninguna pasa de 120 KB**. Corta en seco el descuido de arrastrar aquí
  un JPG de cámara renombrado.

Es la misma clase de guardia que `vercel-json-no-lleva-inventos` y
`estilos-que-existen`: adelanta a CI un fallo que si no se descubre abriendo
el navegador.

---

## 8. Lo que queda pendiente

- **El consentimiento de las cuatro fotos de casas ajenas.** Ver el aviso del
  principio. Es lo primero.
- **Faltan fotos de RESULTADO.** Las quince que llegaron son todas
  _trabajando_; no hay ninguna de una habitación **terminada, impecable y sin
  nadie dentro**. En una web de limpieza esa es la foto que convence, porque
  es lo que la clienta compra: no el esfuerzo, sino cómo le va a quedar la
  casa. Bastan cuatro o cinco con el móvil al terminar una casa, con la
  persiana subida.
- **El baño está sobrerrepresentado** en el material disponible: cuatro de las
  quince. Para la galería conviene variedad de estancias.
