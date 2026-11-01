# 53 — El sitio se puede encontrar

> Auditoría de SEO del sitio público y las tres etapas que se construyeron el
> 1/11/2026. Dominio canónico: `https://freshnesstouchcleaning.com` (sin
> `www`), detrás de `VITE_SITE_URL`.
>
> No es una guía de SEO. Es qué faltaba en **este** sitio, qué se hizo, qué
> queda y qué depende de la dueña y no del código.

---

## 1. Cómo se hizo la auditoría

Leyendo el código, no una lista de buenas prácticas:

- `apps/landing/index.html` — qué se sirve de verdad al navegador.
- `apps/landing/public/` — qué ficheros hay (y cuáles no).
- `apps/landing/vercel.json` — cabeceras, reescrituras y CSP.
- `apps/landing/src/i18n.ts` — cómo se decidía el idioma.
- `apps/landing/src/lib/rutas.ts` — qué direcciones existen.
- Las diez secciones de la portada — estructura de encabezados y textos alt.
- `apps/landing/dist/` compilado — pesos reales, y si las fuentes se descargan
  todas o solo las que hacen falta.

El sitio real (`freshnesstouchcleaning.com`) **no se pudo inspeccionar**: la
política de red de la sesión no resuelve ese dominio. Todo lo de aquí sale del
repositorio, que es lo que se despliega.

---

## 2. Lo que ya estaba bien

Conviene decirlo antes, porque evitó trabajo:

|                                                                  |                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Un solo `<h1>`** en el Hero, `<h2>` por sección, `<h3>` dentro | Estructura correcta. No se tocó nada.                                                                                                                                                                                                          |
| **Textos alternativos** en las imágenes (logotipo, galería)      | Ya estaban.                                                                                                                                                                                                                                    |
| **Fuentes propias**, servidas desde nuestro dominio              | Sin peticiones a Google Fonts: ni CSP floja ni la visita compartida con terceros.                                                                                                                                                              |
| **Las fuentes NO son un problema de rendimiento**                | Hay 12 ficheros `.woff2` (404 KB en total, incluido cirílico y griego) y parecía peso muerto. **No lo es:** el CSS lleva `unicode-range`, así que un visitante latino descarga solo los subconjuntos latinos. Se comprobó en el CSS compilado. |
| **Leaflet y el diálogo de reserva ya van en trozos aparte**      | 149 KB y 46 KB que no cargan hasta que se usan.                                                                                                                                                                                                |
| **Cabeceras de seguridad y CSP estrictas**                       | Y el JSON-LD no las rompe: un bloque `application/ld+json` no es un script ejecutable, así que `script-src` no lo bloquea.                                                                                                                     |

---

## 3. Lo que faltaba

### Lo que se cerró en estas tres etapas

| #     | Hueco                                                | Consecuencia real                                                                                                                                                                                                                                    |
| ----- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Sin `robots.txt` ni `sitemap.xml`                    | Ningún buscador tenía una lista de las páginas del sitio. En un sitio nuevo, sin enlaces de fuera, eso es la diferencia entre descubrirse en días o en meses.                                                                                        |
| **2** | Sin `canonical`                                      | Con Vercel el sitio es alcanzable en el dominio propio, en `*.vercel.app` y con cualquier `?utm_...` detrás. Tres direcciones para la misma página.                                                                                                  |
| **3** | **Sin Open Graph ni imagen de compartir**            | Pegar el enlace en WhatsApp daba una línea azul: ni nombre, ni descripción, ni foto. En una empresa de limpieza, compartir el enlace por WhatsApp es como llega buena parte de la clientela. **Era el hueco de más valor práctico y el más barato.** |
| **4** | Sin datos estructurados                              | Nada le decía a Google que esto es una empresa local, dónde está, a qué hora abre ni hasta dónde va. Es lo que alimenta el paquete local, que es donde de verdad compite.                                                                            |
| **5** | Las cuatro pantallas compartían título y descripción | Las condiciones de servicio se anunciaban en Google como la portada de una empresa de limpieza.                                                                                                                                                      |
| **6** | **El idioma no estaba en la URL**                    | Una dirección servía dos idiomas según `localStorage` y `navigator.language`. El contenido en español **no estaba mal posicionado: no existía**. No había ninguna dirección que indexar con él.                                                      |
| **7** | El 404 se anunciaba como la portada                  | Y sin `noindex`, cualquier dirección mal escrita podía acabar indexada.                                                                                                                                                                              |
| **8** | `/retirar-fotos` sin `noindex` ni `Disallow`         | Una pantalla de trámite en los resultados de búsqueda.                                                                                                                                                                                               |

### Lo que sigue abierto

| Hueco                                             | Por qué no se hizo                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **El HTML servido sigue siendo un `<div>` vacío** | Google ejecuta JavaScript y ve la página entera. WhatsApp y Facebook no lo ejecutan, pero ya tienen lo que necesitan en las etiquetas estáticas de `index.html`. Quien se queda sin ver el contenido es Bing y los rastreadores de los asistentes. Arreglarlo es prerenderizar en el build, y es una etapa propia. |
| **No hay contenido por ciudad**                   | La zona de servicio se expresa en **millas desde la base** («hasta 50 millas»). Nadie busca «limpieza en 50 millas alrededor de Marietta»: busca «house cleaning Smyrna GA». Necesita las ciudades reales de la dueña, así que es contenido antes que código.                                                      |
| **El paquete principal son 218 KB comprimidos**   | Y como la página se pinta entera con JavaScript, nada aparece hasta que se descarga y ejecuta. Afecta al LCP, que es una señal de posicionamiento. Es optimización, no SEO, y merece su propia medición.                                                                                                           |
| **El 404 contesta HTTP 200**                      | `vercel.json` reescribe todo hacia `index.html` —hizo falta para que `/terms` funcionara— así que un sitio estático no puede contestar 404 de verdad. Mitigado con `noindex, follow`, que es lo único que impide que se indexe.                                                                                    |

---

## 4. Etapa 1 — La base técnica

### `robots.txt` y `sitemap.xml`, generados en el build

No están escritos a mano en `public/`, y el motivo importa: los dos llevan el
dominio dentro, y el dominio no está en el código (`VITE_SITE_URL`). Un
`sitemap.xml` escrito a mano con el dominio dentro es la misma trampa que
tenía el teléfono en `config/company.ts` antes de la Etapa 2.3, con el
agravante de que **aquí nadie lo mira nunca**: el día que el dominio cambie, el
sitemap seguiría apuntando al viejo sin ningún síntoma visible.

- `src/lib/seo/ficheros.ts` — funciones puras, probadas.
- `vite-seo.ts` — el enchufe: lee la variable, llama a las dos funciones,
  emite dos ficheros. Solo en `build`.
- `emitFile` y no `writeFileSync`, para que acaben en `outDir` sea cual sea.

`Disallow` y `noindex` **no son lo mismo y hacen falta los dos**: `Disallow`
dice «no lo pidas» y `noindex` dice «no lo listes». Una dirección bloqueada
por `robots.txt` todavía puede aparecer en los resultados si alguien la
enlaza, porque el buscador nunca llegó a leer el `noindex` de dentro. La
pantalla de retirada lleva las dos.

Listarla en `robots.txt` **no revela ningún secreto**: ese fichero es público
por definición, y el testigo de retirada viaja en el fragmento de la
dirección, que nunca sale del navegador.

### Título, descripción y canonical por pantalla

- `src/lib/seo/etiquetas.ts` — **función pura** que devuelve lo que hay que
  poner. No toca el documento.
- `src/lib/seo/aplicar.ts` — la única parte que escribe en la cabecera.
- `src/hooks/useSeo.ts` — el efecto, tres líneas.

Está partido así porque las pruebas del sitio público corren **en Node sin
DOM** a propósito (`vitest.config.mts`), y porque lo que se puede equivocar es
el contenido —un canonical hacia la página equivocada, un `noindex` que
falta— no la llamada a `setAttribute`.

Dos decisiones que no se leen en el código:

- **El `robots` se quita, no se pone a `index`.** `index, follow` es el
  comportamiento por omisión. Lo que importa es que al volver de una pantalla
  sin indexar a una indexable el `noindex` desaparezca.
- **Sin canonical en las pantallas con `noindex`.** Un canonical ahí manda dos
  mensajes contrarios y lo que hacen los buscadores con eso no está definido.

### La vista previa al compartir

`index.html` lleva las etiquetas de la portada **escritas a mano**, y eso no es
una duplicación: es lo único que ve el rastreador de WhatsApp y el de
Facebook, que no ejecutan JavaScript. `useSeo` reescribe esas mismas etiquetas
cuando la pantalla es otra — reescribe, no añade: dos
`<meta name="description">` en un documento no tienen un ganador definido.

Hay una prueba (`el-html-servido-dice-lo-mismo.test.ts`) que comprueba que el
HTML y el paquete de idioma dicen lo mismo. Dos fuentes para el mismo dato se
desincronizan, y aquí el síntoma es invisible desde dentro de la aplicación:
el que se queda viejo es el que solo leen las máquinas.

**La imagen**: `public/brand/og-default.jpg`, 1200×630, hecha con el logotipo
oficial sobre el azul de marca (`#145788`) y la franja amarilla (`#f9c400`).
Se sustituye el fichero y nada más. El tamaño va declarado en las etiquetas
porque Facebook decide si pinta la tarjeta grande o la pequeña **antes** de
descargar la imagen, y la primera impresión queda en su caché.

---

## 5. Etapa 2 — Datos estructurados

Un solo `<script type="application/ld+json">` con un `@graph`:
`LocalBusiness` + `WebSite` (+ `FAQPage` solo en la portada).

### La decisión incómoda: se construye en caliente

El teléfono, el horario, la razón social y la base de operaciones se editan
desde el panel. Había dos formas:

- **A.** Escribirlos al compilar. Los ve cualquier rastreador, y **mienten** el
  día que la dueña cambie el teléfono.
- **B.** Construirlos en el navegador con los datos de verdad. Google ejecuta
  JavaScript y los lee; quien no, se queda con el bloque mínimo.

Se eligió **B**, por el mismo motivo que vació `config/company.ts` en la Etapa
2.3: un dato de contacto escrito en el código acaba siendo falso. Y unos datos
estructurados que **contradicen** a la página son peores que no tenerlos.

`index.html` trae el bloque mínimo (nombre, dirección del sitio, logotipo,
estado) con el **mismo `@id`**, y `DatosEstructurados.tsx` lo reescribe por su
`id`. No son dos negocios: es el mismo con más detalle.

### Lo que NO está, y no es un olvido

- **`aggregateRating`.** No se inventa una valoración. Marcar estrellas sin
  reseñas reales y verificables es motivo de acción manual, y eso no quita las
  estrellas: quita el sitio de los resultados.
- **`priceRange`.** Habría que inventarse un rango: el precio depende del
  tamaño, la frecuencia y la distancia. El cotizador da el número exacto.
- **`sameAs`.** Son los perfiles de redes sociales y no los sé. Es de las
  cosas que más ayudan a que Google entienda que la web, la ficha de Google y
  el Facebook son la **misma** empresa. Está en la lista de la dueña, abajo.
- **Una calle en `address`.** Deliberado: es un negocio que va a casa del
  cliente. Google recomienda que un negocio de área de servicio no publique su
  dirección exacta, y aquí además sería la casa de la dueña. Sí van ciudad,
  estado, código postal, coordenadas y el círculo real de cobertura
  (`GeoCircle`, en metros: no admite millas).

### `LocalBusiness` y no un tipo de limpieza

schema.org **no tiene** un tipo para empresas de limpieza. Existe
`HomeAndConstructionBusiness`, pero mete la limpieza en el cajón de la obra, y
un tipo inventado («CleaningService») simplemente se ignora. `LocalBusiness` es
el que Google documenta para esto.

### Y las preguntas frecuentes no van a sacar el acordeón en Google

Conviene decirlo para que nadie lo espere: **desde agosto de 2023 Google limita
el resultado enriquecido de `FAQPage` a sitios oficiales de gobierno y de
salud.** Una empresa de limpieza no lo va a ver.

Se pone igual porque Bing sí lo usa, los rastreadores de los asistentes lo leen
para contestar preguntas sobre el negocio, y es la forma de declarar en limpio
la política de cancelación y el depósito, que son las dos cosas que la gente
pregunta antes de reservar.

El texto sale de `useSiteText` —**el mismo que pinta la sección**— porque las
seis preguntas se editan desde el panel. Leer el paquete de idioma declararía
la respuesta vieja en cuanto la dueña reescriba una, y declarar contenido que
no está visible en la página es justo lo que las directrices prohíben. La
lista de preguntas se deduce de `SITE_COPY_KEYS`, y hay una prueba que
comprueba que las declaradas y las que se pintan son las mismas.

---

## 6. Etapa 3 — El español deja de ser invisible

```
/            ->  portada en inglés
/es          ->  portada en español
/terms       ->  condiciones en inglés
/es/terms    ->  condiciones en español
```

**El inglés no lleva prefijo**, y es deliberado: `/terms` ya está en correos
enviados y en el pie de la web. Mover el inglés a `/en/terms` habría roto todo
eso para no ganar nada.

### Lo que decide el idioma, en orden

1. **La dirección manda sobre todo.** `/es` es español y `/` es inglés, siempre.
   Si `/` pudiera servir español según quién entre, los dos idiomas volverían a
   compartir dirección y el español seguiría sin existir para un buscador.
2. **Una elección ya hecha en este sitio sí puede cambiar la dirección.** Quien
   pulsó «Español» antes, al volver a `/` se le lleva a `/es` con
   `replaceState`, así que lo que ve y lo que dice la barra coinciden. Es
   seguro para el SEO porque **un rastreador no tiene `localStorage`**:
   Googlebot siempre ve `/` en inglés.
3. **El idioma del navegador ya no decide en la portada, y se pierde algo.**
   Antes, alguien con el móvil en español que entraba por primera vez en `/`
   veía el sitio en español. Ahora ve inglés hasta que pulsa el selector.

   **Es una pérdida y no se disimula.** Se acepta porque redirigir según el
   idioma del navegador es lo que las guías de Google desaconsejan y reproduce
   el problema de antes por otra puerta; y porque lo que de verdad resuelve ese
   caso es que `/es` **esté indexado**: quien busca «limpieza de casas
   marietta» aterriza directamente en español sin pasar por la portada inglesa.
   Eso era imposible antes.

### El selector no recarga

`pushState` y no `location.assign`. Recargar sería más simple y rompería algo
concreto: alguien a mitad del formulario de reserva —con el tamaño de su casa,
su código postal y su fecha ya puestos— que pulsa el selector para entender una
pregunta, perdería todo lo escrito. **El selector de idioma no puede ser un
botón que borra lo que llevas hecho.**

El precio de no recargar es `useIdiomaDeLaUrl`, que sincroniza el idioma con la
flecha de atrás.

### Un fallo que apareció al probarlo en un navegador de verdad

La primera versión del sincronizador usaba `destinoPara(...).locale`, que para
`/` devuelve `null` porque no lleva prefijo. Resultado, medido con Playwright:

```
al pulsar el selector:   url=/es   lang=es   ✔
tras pulsar atrás:       url=/     lang=es   ✘
```

**La barra decía `/` y la página seguía en español.** Si alguien comparte el
enlace en ese momento, el otro abre algo distinto de lo que se estaba viendo.

La realidad es que `/` **sí** dice su idioma: dice inglés, porque el idioma por
omisión es el que no lleva prefijo. Lo único de verdad indeciso es
`/retirar-fotos`. De ahí `idiomaDeLaUrl`, que contesta la pregunta útil, y una
prueba que lo fija.

### `hreflang`, y por qué tiene que ser recíproco

Cada versión declara **todas** las alternativas, incluida la propia, más
`x-default` apuntando al inglés. La especificación lo exige: si `/terms`
declarase solo a `/es/terms` y al contrario, ninguna confirmaría la relación y
**Google descarta los grupos que no se confirman mutuamente**. El trabajo
entero de esta etapa no serviría de nada y no habría ningún síntoma visible.
Hay una prueba que lo comprueba entrada por entrada.

El `sitemap.xml` lleva **una entrada por página y por idioma** (seis, no tres),
cada una con sus alternativas. Listando solo la inglesa, la española solo se
descubriría si alguien la enlaza desde fuera, que es justo lo que no pasa con
un sitio nuevo.

### Los enlaces de dentro

Cuatro sitios enlazaban a `/terms` y `/privacy` con la ruta escrita tal cual:
el pie, el paso de datos de la reserva y el 404 (dos veces). Con el idioma en
la dirección eso se convirtió en un fallo con una forma concreta: alguien
leyendo `/es` pulsaba «Condiciones del servicio» y aterrizaba en el contrato en
inglés, **justo en la pantalla donde acepta algo**.

Ahora salen de `useEnlacesInternos`. Y para un buscador era la otra mitad del
problema: una página a la que no enlaza nada desde dentro se rastrea mal.

---

## 7. Repaso de seguridad

- **No se añadió ninguna petición a terceros.** La imagen de compartir está en
  nuestro dominio; `img-src 'self'` la cubre sin tocar la CSP.
- **El JSON-LD no afloja la CSP.** `application/ld+json` no es un script
  ejecutable, así que `script-src` no lo bloquea y no hizo falta ningún
  `unsafe-inline`.
- **El bloque estructurado no publica nada que no estuviera ya en la página.**
  Teléfono, correo y horario se pintan en Contacto; ciudad, estado y
  coordenadas de la base están en el mapa de zonas. **Ninguna calle**, y menos
  la de la dueña.
- **`robots.txt` no filtra nada.** El testigo de retirada viaja en el fragmento
  de la dirección, que nunca llega al servidor. Lo que se evita es ruido.
- **`/retirar-fotos` sigue sin indexarse**, ahora por dos caminos, y sigue sin
  tener versión por idioma: su dirección está dentro de correos ya enviados y
  no puede cambiar. `/es/retirar-fotos` devuelve el 404 a propósito, para que
  no exista una segunda dirección a la misma pantalla de trámite.
- **El cambio de idioma conserva el fragmento**, y eso incluye el testigo de
  retirada — aunque en esa pantalla el selector no cambia la dirección,
  precisamente porque `rutaPara` devuelve la misma.
- **Ningún dato nuevo se guarda en el navegador.** `localStorage` sigue
  teniendo solo la elección de idioma, como antes.

---

## 8. Pruebas

| Archivo                                          | Qué vigila                                                                                                                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/seo/el-html-servido-dice-lo-mismo.test.ts`  | Que `index.html` y el paquete de idioma digan lo mismo; que el dominio escrito a mano coincida con el del código; que la imagen de compartir sea absoluta y lleve su tamaño.                                                 |
| `lib/seo/los-ficheros-del-buscador.test.ts`      | `robots.txt`, el sitemap, la reciprocidad de `hreflang`, que ninguna ruta privada se cuele, y que una variable mal escrita caiga en producción en vez de lanzar.                                                             |
| `lib/seo/las-etiquetas-de-cada-pantalla.test.ts` | Que cada pantalla pida su texto; que el canonical sea el del idioma leído; que las no indexables lleven `noindex, follow`, sin canonical y sin alternativas; los límites de largo en los dos idiomas.                        |
| `lib/seo/el-negocio-declarado.test.ts`           | Que sin datos de la API el bloque siga siendo válido (**ni un `null`**); que nunca haya valoraciones; que no se publique una calle; que los días cerrados no se listen; que las preguntas declaradas sean las que se pintan. |
| `lib/rutas.test.ts`                              | El prefijo de idioma, que `/estimate` **no** sea español, que `/es/retirar-fotos` no exista, y `idiomaDeLaUrl` con el caso de la flecha de atrás.                                                                            |

Las tres piezas clave se verificaron **rompiendo el código a propósito** —el
canonical del español apuntando al inglés, los campos faltantes puestos a
`null`, el `hreflang` dejando de ser recíproco— y las tres pruebas fallaron
como debían.

Y se comprobó en un **navegador de verdad** con Playwright, sirviendo `dist`
con las mismas reescrituras que Vercel: las cuatro pantallas, los dos idiomas,
el selector, la flecha de atrás y los enlaces internos.

Los seis pasos de CI en verde. **2.233 pruebas** (antes 2.173).

Un detalle: el `id` del bloque JSON-LD se llama `datos-estructurados` y no
`ft-jsonld` porque la guardia `estilos-que-existen.test.ts` trata cualquier
cadena `'ft-...'` como una clase CSS. Es una guardia que ya ha cazado tres
fallos de verdad, así que se renombró el `id` en vez de debilitarla.

---

## 9. Al desplegar

**Una variable nueva, y opcional:**

| Variable        | Dónde                              | Valor                                |
| --------------- | ---------------------------------- | ------------------------------------ |
| `VITE_SITE_URL` | Vercel, proyecto del sitio público | `https://freshnesstouchcleaning.com` |

Sin ponerla funciona igual: cae en ese mismo dominio por omisión, que es lo que
se quiere en las vistas previas de Vercel —un canonical hacia producción es lo
que evita que las vistas previas acaben indexadas—. Se pone para que el día que
el dominio cambie no haga falta un despliegue de código.

**Si el dominio cambiara**, hay que cambiar también el que está escrito a mano
en `index.html` (Open Graph exige direcciones absolutas). La prueba
`el-html-servido-dice-lo-mismo` avisa si los dos no coinciden.

Sin migraciones. Sin pasos manuales.

---

## 10. Lo que tiene que hacer la dueña, y no es código

Esto es la mitad del SEO local y no se puede programar:

1. **Google Business Profile.** Es lo que de verdad decide el paquete local, y
   pesa más que todo lo de este documento junto. La ficha tiene que decir
   **exactamente** el mismo nombre, teléfono y horario que la web — el bloque
   estructurado es la mitad web de esa coherencia, y sirve de poco si la otra
   mitad dice otra cosa.
2. **Google Search Console.** Verificar el dominio y **enviar el sitemap**
   (`https://freshnesstouchcleaning.com/sitemap.xml`). Es lo que convierte
   «existe un sitemap» en «Google lo ha leído», y además es donde se ve si
   `hreflang` se aceptó.
3. **Bing Webmaster Tools.** Mismo sitemap. Importa más de lo que parece: Bing
   alimenta a varios asistentes, y es el que **no** ejecuta JavaScript.
4. **Los perfiles de redes sociales.** Hacen falta las direcciones del Facebook
   y el Instagram para añadir `sameAs` al bloque estructurado. Es de lo que más
   ayuda a que Google entienda que las tres cosas son la misma empresa. Cuando
   las tenga, son tres líneas de código.
5. **Las ciudades reales que atiende.** Para el contenido por ciudad (§3). Hoy
   la web dice «hasta 50 millas desde la base» y nadie busca eso.
6. **Reseñas de verdad, en Google.** No en la web: en la web no se pueden
   marcar sin inventarlas. Las de Google salen en el paquete local solas.

---

## 11. Por dónde seguir, si hubiera que elegir

1. **Las tareas de la dueña (§10).** Search Console y Google Business Profile
   valen más que cualquier cosa que quede por programar.
2. **Contenido por ciudad.** Necesita el punto 5 de arriba. Es el siguiente
   salto real de tráfico.
3. **Prerenderizado en el build.** Haría que Bing y los asistentes vieran el
   contenido. Con el Chromium que ya está instalado es factible; es una etapa
   propia porque cambia cómo arranca la aplicación.
4. **El peso del paquete.** 218 KB comprimidos antes de pintar nada. Afecta al
   LCP. Es optimización con medición, no SEO.
