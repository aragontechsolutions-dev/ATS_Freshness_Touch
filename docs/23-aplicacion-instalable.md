# 23 — El panel se instala como aplicación

El panel de Freshness Touch es una **PWA**: se añade a la pantalla de inicio de
un móvil y se abre como cualquier otra aplicación, a pantalla completa y sin la
barra del navegador.

No es un adorno. Quien limpia trabaja **de pie en la puerta de una casa, con el
móvil en una mano**. Abrir el navegador, buscar la pestaña y desplazarse hasta
el trabajo son tres pasos que sobran cuando se tienen las manos ocupadas.

## 1. La regla que gobierna todo: la API no se cachea nunca

Esta es la decisión más importante del documento, y la única que no se puede
relajar.

El panel sirve datos con sesión: **direcciones de clientes, teléfonos, códigos
de puertas, importes**. Un service worker que guardara respuestas de la API las
dejaría en el disco del móvil, **fuera de la sesión**:

- seguirían ahí después de cerrar sesión;
- en un móvil compartido, las vería la siguiente persona;
- y el equipo de limpieza vería trabajos que ya no son suyos.

Por eso **no hay `runtimeCaching`**. Se guarda exclusivamente el armazón:
JavaScript, CSS, fuentes e iconos, que son idénticos para todo el mundo y no
dicen nada de nadie.

Hay una **prueba que falla** si alguien añade `runtimeCaching`, amplía el patrón
de archivos o quita la lista que impide responder a `/api/` con el HTML del
panel: `apps/admin/src/lib/service-worker.test.ts`. Se comprobó que tiene
dientes añadiendo un `runtimeCaching` a propósito.

> Si algún día hace falta que los trabajos se vean sin cobertura, la respuesta
> correcta es **guardarlos a propósito y borrarlos al cerrar sesión**, no dejar
> que el service worker los recoja de paso.

## 2. Por qué se usa una librería, contra la costumbre del proyecto

Este proyecto evita dependencias: los iconos son SVG escritos a mano, los mapas
no usan servicio de pago, y las pruebas de los iconos se hicieron sin añadir
nada. Aquí se hace una **excepción deliberada** con `vite-plugin-pwa`.

Un service worker escrito a mano tiene que conocer los nombres con huella que
genera el compilador, invalidar la caché vieja en cada despliegue y limpiar lo
que sobra. Equivocarse ahí **no da un error**: deja el panel sirviendo una
versión antigua **para siempre**, en el móvil de alguien, sin forma de avisarle.

Eso no es «unos pocos símbolos». Es el problema que esa librería existe para
resolver.

## 3. La versión nueva se ofrece, no se impone

`registerType: 'prompt'`, con `skipWaiting: false` y `clientsClaim: false`.

Cuando hay una versión nueva aparece una barra abajo: **«Hay una versión nueva
del panel» · Actualizar · Ahora no**. Hasta que se pulse Actualizar, el service
worker nuevo **espera sin activarse** y el viejo sigue mandando.

El motivo es concreto: recargar solo en cuanto hay versión nueva **le borra a
alguien el formulario que está rellenando**, de pie en casa de un cliente.
Pulsar «Ahora no» no pierde nada: la versión nueva entra la próxima vez que se
abra la aplicación.

El aviso **no es uno de los avisos emergentes** que ya tenía el panel: aquellos
se van solos a los pocos segundos y no llevan botón. Este pide una acción, así
que se queda. Va en `role="status"` y no `role="alert"`, porque es información
útil, no un problema que corregir.

### Cómo se comprobó

Con **dos despliegues seguidos** en un navegador real, con perfil persistente:

1. Primera visita: el service worker se instala, **sin** aviso. Correcto.
2. Se recompila el panel con un cambio real y se sirve.
3. Se vuelve a abrir: **aparece el aviso** con sus dos botones, y
   `registration.waiting` es verdadero mientras el viejo sigue activo — la
   prueba de que la versión se ofrece y no se impone.
4. «Ahora no» cierra el aviso.

> **Una trampa que costó un intento.** El primer ensayo usó un comentario como
> «cambio» de la versión B. La minificación borra los comentarios, el paquete
> salió byte a byte idéntico, con el mismo hash, y no había versión nueva que
> detectar. Que no avise ante un compilado idéntico es correcto; para probar el
> caso positivo hay que cambiar algo que **sobreviva a la minificación**.

## 4. Los iconos

| Archivo                | Uso                                              |
| ---------------------- | ------------------------------------------------ |
| `pwa-192.png`          | Icono normal                                     |
| `pwa-512.png`          | Icono grande, el que Android exige para instalar |
| `pwa-maskable-512.png` | El que Android recorta a círculo o cuadrado      |
| `apple-touch-icon.png` | iOS, que **no lee el manifiesto**                |

Generados en el navegador desde `logo-mark.webp`, que es el método que ya
documenta `docs/09` para los derivados de la marca: este entorno no tiene
ninguna librería de imagen.

**El enmascarable lleva el isotipo al 72% sobre el blanco roto de la marca.**
Android recorta hasta un 10% por lado; con el logotipo a tamaño completo, el
recorte se lo comería. Se comprobó visualmente contra las dos máscaras que usan
los móviles —círculo y cuadrado redondeado— y el logotipo queda entero en las
dos.

**iOS necesita etiquetas propias en el HTML**, porque no lee el manifiesto: sin
`apple-touch-icon` sale una captura borrosa de la página en vez del isotipo, y
sin `apple-mobile-web-app-capable` se abre con la barra de Safari encima.

### Limitación conocida

El único original cuadrado disponible es de **256×256**, así que el icono de 512
está **ampliado ×2 y sale algo blando**. Si aparece el original del diseñador a
512 o más, se sustituye el archivo y mejora sin tocar código.

## 5. Qué se guarda, y qué se decidió no guardar

**20 entradas, 994 kB.** Dos exclusiones deliberadas, que ahorran 652 kB en el
móvil de cada persona:

**Los iconos del manifiesto, una sola vez.** El plugin ya los precachea por su
cuenta; el patrón `**/*.png` los volvía a coger y entraban **dos veces** —490 kB
de iconos contados por duplicado—.

**Leaflet no se guarda.** Son 146 kB de librería de mapas que **sin conexión no
puede funcionar**: las teselas vienen de OpenStreetMap por internet, así que
guardar el código solo conseguiría pintar un rectángulo gris. Además los dos
mapas del panel son de configuración —zonas y sede—, pantallas que se abren unas
pocas veces al año y nunca desde la calle. Se siguen cargando bajo demanda.

## 6. En desarrollo está apagado

`devOptions.enabled: false`. Un service worker vivo mientras se programa sirve
archivos viejos y hace perder tardes persiguiendo cambios que sí estaban hechos.

## 7. Pendiente, y conviene no perderlo de vista

`apps/admin/vercel.json` lleva:

```
"Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=()"
```

**`geolocation=()` bloquea la geolocalización por completo, incluido el propio
sitio.** No afecta al PWA, pero el **fichaje con ubicación** no funcionará en
producción hasta que eso pase a `geolocation=(self)`, y el navegador no dará un
error claro: simplemente denegará el permiso.

Lo mismo valdrá para `camera=()` el día que se hagan las fotos de antes y
después.
