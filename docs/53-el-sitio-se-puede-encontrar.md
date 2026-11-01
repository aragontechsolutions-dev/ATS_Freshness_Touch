# 53 — El sitio se puede encontrar

> Auditoría de SEO del sitio público y las tres etapas que se construyeron el
> 1/11/2026. Dominio canónico: **`https://www.freshnesstouchcleaning.com`**,
> detrás de `VITE_SITE_URL`.
>
> **Corregido el mismo día.** La primera versión usó la raíz sin `www`, porque
> `docs/15` §4.1 decía «marca el de la raíz como principal» — y se
> contradecía con la tabla de su §1, que decía lo contrario. Lo montado de
> verdad es el `www`: en Vercel, la raíz figura como «Redirects to
> www.freshnesstouchcleaning.com». Ver §13.
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
| ~~No hay contenido por ciudad~~                   | **Cerrado el 1/11/2026**, con las veinte ciudades que dio la dueña. Ver §12.                                                                                                                                                                                                                                       |
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
- ~~**`sameAs`.**~~ **Cerrado el 1/11/2026**: ya no se escribe aquí, sale de
  los ajustes del panel. Ver §12.
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

| Variable        | Dónde                              | Valor                                    |
| --------------- | ---------------------------------- | ---------------------------------------- |
| `VITE_SITE_URL` | Vercel, proyecto del sitio público | `https://www.freshnesstouchcleaning.com` |

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
   (`https://www.freshnesstouchcleaning.com/sitemap.xml`). Es lo que convierte
   «existe un sitemap» en «Google lo ha leído», y además es donde se ve si
   `hreflang` se aceptó.
3. **Bing Webmaster Tools.** Mismo sitemap. Importa más de lo que parece: Bing
   alimenta a varios asistentes, y es el que **no** ejecuta JavaScript.
4. ~~**Los perfiles de redes sociales.**~~ Los dio el 1/11/2026. Ya no son
   código: se pegan en **Ajustes → Dónde nos anunciamos**. Ver §12.
5. ~~**Las ciudades reales que atiende.**~~ Las dio el 1/11/2026 y ya están
   publicadas. Ver §12.
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

---

## 12. Las ciudades y las redes sociales (1/11/2026)

La dueña dio las dos cosas que faltaban, así que se cerraron los dos huecos
que dependían de ella: el contenido por ciudad y `sameAs`.

### Dónde viven, y por qué ahí

En `BusinessSettings` (la fila `business` de `business_settings`), junto a la
razón social y la dirección postal. **No en el código**, por la razón de
siempre en este proyecto: un dato que la dueña cambia no puede exigir un
despliegue. Y **no en el área de servicio**, aunque la tentación es obvia: ese
objeto viaja dentro de `PricingConfig` hasta el motor de precios, y una lista
de nombres no decide ni una cifra.

Es una columna JSON, así que **no hizo falta migración**.

### La distinción que hay que mantener clara

|                                           | Qué es               | Qué decide                               |
| ----------------------------------------- | -------------------- | ---------------------------------------- |
| **Las zonas** (`service-area.ts`)         | Millas desde la base | Qué se cobra y dónde sale el precio solo |
| **Las ciudades** (`business-settings.ts`) | Nombres              | Qué se anuncia                           |

Añadir una ciudad **no amplía el área atendida**. Si se añadiera una fuera del
radio, el sitio la anunciaría y el cotizador le diría «fuera de zona» a quien
viva allí. El código no puede comprobarlo —la distancia se mide con el
geocodificador y una lista de nombres no lleva coordenadas— así que el panel
lo advierte en texto, junto al campo.

### La trampa del `strictObject`, otra vez

Los tres campos llevan `.default(...)`. Sin eso, la fila ya guardada deja de
cumplir el contrato, `business-settings.service.ts` la descarta y devuelve
`DEFAULT_BUSINESS_SETTINGS`, que lleva `phone: null`: **el teléfono
desaparecería de toda la web sin un solo error en ninguna pantalla**. Es la
misma caída muda que ya está documentada en ese archivo para `whatsapp`. Hay
una prueba que valida una fila sin los campos nuevos.

Las ciudades llevan como valor por defecto **las veinte de verdad**, igual que
el horario de partida: para que funcionen desde el primer minuto sin que nadie
teclee veinte nombres. Las redes van a `null`, y ahí la asimetría es a
propósito: **una dirección de red social inventada es peor que ninguna**.

### Un fallo que estuve a punto de dejar escrito

`Settings.tsx` no manda el objeto que leyó del servidor: lo **construye de
cero** con sus campos. Un campo del contrato que ese objeto no incluya no
viaja vacío, viaja **ausente** — y como todos tienen `.default(...)`, Zod lo
rellena y el servidor lo guarda encima.

La primera versión tocaba el estado y la pantalla, y dejaba el objeto de envío
sin los tres campos nuevos. **Cualquier guardado desde Ajustes habría devuelto
las ciudades a las de partida y borrado las redes**, diciendo que fue bien.

De ahí `ajustes-no-borran-lo-que-no-ensenan.test.ts`: recorre las claves del
contrato y comprueba que todas aparecen en el objeto que se envía. Se verificó
quitando `cities` a propósito, y falla nombrando el campo.

### Qué se publica

- **En la página**, al final de «Zonas de servicio»: la lista de ciudades como
  `<ul>` de verdad y no un párrafo con comas —con un lector de pantalla,
  «veinte elementos» se puede saltar; una frase de doscientos caracteres hay
  que oírla entera—. Con una línea debajo diciendo que **la lista no es el
  límite**: sin ella, quien vive en una ciudad que no sale da por hecho que no
  vamos y cierra la pestaña.
- **En el JSON-LD**: cada ciudad como `City` con
  `containedInPlace: { State: Georgia }`. Eso no sobra: hay un **Smyrna en
  Tennessee** y otro en Delaware, y un **Dallas** que casi todo el mundo sitúa
  en Texas. Sin el estado, la ciudad más buscada de la lista apunta a dos mil
  kilómetros de aquí.
- **`sameAs`** con las redes configuradas, omitiendo las que no hay:
  `sameAs: [null]` no es «no tengo redes», es un valor inválido que tumba el
  bloque entero.

### Validación, y por qué es más dura de lo que parece

- **Nombres de ciudad**: solo letras, espacios, guiones y apóstrofes. La lista
  entra en el JSON-LD, y un nombre con una comilla lo parte en algo que un
  validador rechaza — se perdería el bloque **entero**, el negocio y el
  horario incluidos, por una ciudad mal escrita.
- **Redes**: se exige `https://` y **el dominio que dice el campo**. `sameAs`
  declara «este otro sitio también somos nosotros»; una dirección pegada mal
  se lo estaría diciendo a Google sobre un sitio ajeno, sin ningún síntoma en
  la página. Se comprueba también que `instagram.com.loquesea.net` no cuele.

### Lo que queda pendiente de ella

**La dirección real de la página de Facebook.** La que dio es un enlace de
compartir (`facebook.com/share/18PkcJEDd3/`), que es un redirector, no la
dirección del perfil. Funciona, pero para `sameAs` conviene la canónica —la
que sale en la barra del navegador al abrir la página—. No pude resolverla:
Facebook rechaza las peticiones desde esta sesión.

Se pega en **Ajustes → Dónde nos anunciamos**, igual que la de Instagram
(limpia, **sin** el `?xtok=...`: ese parámetro es un testigo de compartir y no
tiene por qué acabar en el HTML público).

---

## 13. El `www`, y por qué estuvo mal un rato (1/11/2026)

Todo el trabajo de las etapas 1 a 3 se construyó sobre
`https://freshnesstouchcleaning.com`, **sin `www`**. Está mal. El canónico es
el `www`.

### Cómo se llegó al error

Al empezar pregunté explícitamente cuál era el dominio canónico, precisamente
porque equivocarlo es de las pocas cosas de SEO que hacen daño activo. La
respuesta fue «sin www», y coincidía con `docs/15` §4.1 paso 3:

> «Marca el de la raíz como principal; Vercel configura solo la redirección
> del `www` hacia él.»

Lo que no vi entonces es que **ese paso contradecía la tabla del §1 del mismo
documento**, que decía que el canónico era el `www`. Y lo que está montado es
lo de la tabla, como se ve en Vercel → Domains:

```
freshnesstouchcleaning.com       Redirects to www.freshnesstouchcleaning.com
www.freshnesstouchcleaning.com   → ats-freshness-touch-landing
```

### Por qué importaba

Un `canonical` que apunta a una dirección **que redirige** es una señal
contradictoria: la página dice «la versión buena es esta», y esa versión
contesta con un 308 diciendo «no, es aquella». Y el `sitemap.xml` listaba seis
direcciones de las que ninguna servía contenido.

No es un fallo que se vea: la web funcionaba perfectamente para cualquier
persona. Solo lo habrían notado los buscadores.

### Qué se cambió

| Dónde                                | Qué                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `lib/seo/sitio.ts`                   | `SITIO_POR_OMISION` pasa a llevar `www`                                                |
| `index.html`                         | 14 apariciones: canonical, `hreflang`, Open Graph, Twitter, y el bloque JSON-LD mínimo |
| `.env.example`, `docs/05`, `docs/08` | El valor de `VITE_SITE_URL`                                                            |
| `docs/15` §4.1                       | **El paso que estaba mal**, con nota de la corrección                                  |

La prueba `el-html-servido-dice-lo-mismo` compara el dominio de `index.html`
con `SITIO_POR_OMISION`, así que un cambio a medias —uno de los dos sitios y
no el otro— falla en CI. Es justo para lo que se escribió.

### Lo que hay que revisar fuera del código

Tres variables de entorno pueden tener la raíz escrita, y ninguna da error si
está mal:

| Variable          | Dónde                 | Qué pasa si lleva la raíz                                                                                                                               |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_SITE_URL`   | Vercel, sitio público | Vuelve el problema de los canónicos                                                                                                                     |
| `PUBLIC_SITE_URL` | Render, API           | Los enlaces de **retirar fotos** de los correos pasan por un redirector. Funcionan, pero el testigo va en el fragmento y conviene no hacerle dar saltos |
| `CORS_ORIGINS`    | Render, API           | Si no incluye el origen `www`, **el cotizador no funciona**. Como el sitio sí funciona hoy, tiene que estar ya bien; conviene confirmarlo igualmente    |

---

## 14. Dos cosas que encontró Google, no yo (1/11/2026)

Al verificar Search Console salieron dos fallos que ninguna prueba del
proyecto podía haber encontrado, porque **ninguno de los dos se ve desde
dentro de la aplicación**.

### 14.1. No había ni un enlace hacia `/es`

La ficha de `/es` en la Inspección de URLs decía:

> **Página de referencia:** No se ha detectado ninguna

Y era literalmente cierto. El selector de idioma era un `<button>` que
cambiaba la dirección con `pushState`, así que para un rastreador **la
versión en español no estaba enlazada desde ningún sitio**.

No la dejaba invisible —el `sitemap.xml` y el `hreflang` la anuncian— pero
una página a la que no enlaza nada desde dentro se rastrea tarde y se
posiciona peor. Y tenía un coste que no era de buscadores: un botón no se
puede abrir en una pestaña nueva, ni copiar con el botón derecho, ni abrir
con el botón central.

**Ahora es un `<a href>` de verdad** que sigue sin recargar: se intercepta la
pulsación normal y se deja pasar Ctrl, Cmd, Shift, Alt y el botón central,
porque quien pide «abre esto en otra pestaña» quiere eso. El destino sale de
`rutaPara`, así que desde `/terms` lleva a `/es/terms` y no a la portada.

Vigilado por `el-espanol-esta-enlazado.test.ts`, y comprobado en un navegador
real: desde `/` enlaza a `/es`, desde `/terms` a `/es/terms`, la pulsación
normal no recarga y Ctrl+clic abre pestaña nueva.

### 14.2. El sitemap: «No se ha podido obtener»

Search Console rechazó el sitemap con tipo **«Desconocido»** y **0 páginas**,
aunque el fichero se abre perfectamente en un navegador.

La pista estaba en **cómo lo pintaba el navegador**: el texto salía corrido y
sin etiquetas, que es lo que hace un navegador cuando recibe XML anunciado
como HTML. Un sitemap servido como `text/html` no se parsea: el rastreador lo
descarta sin mirar dentro.

`vercel.json` ahora declara el tipo a mano:

| Ruta           | `Content-Type`                   |
| -------------- | -------------------------------- |
| `/sitemap.xml` | `application/xml; charset=utf-8` |
| `/robots.txt`  | `text/plain; charset=utf-8`      |

Y aquí pesa más de lo normal, porque la regla general pone
**`X-Content-Type-Options: nosniff`** en todo: con `nosniff`, un rastreador no
puede recuperarse de un tipo mal declarado mirando el contenido. Lo que diga
la cabecera es lo que hay.

> **Honestamente:** no pude confirmar qué cabecera estaba enviando Vercel —la
> red de esta sesión no alcanza el dominio— así que esto es la causa **más
> probable**, no una comprobada. «No se ha podido obtener» justo después de
> enviar también se resuelve solo a veces, cuando Google reintenta. Declarar
> el tipo quita de en medio toda esa clase de causa; si tras desplegar y
> reenviar sigue fallando, hay que mirar el cortafuegos de Vercel.

### Lo que esto enseña

Las dos cosas estaban **bien construidas y mal expuestas**. La web funcionaba
igual de bien para cualquier persona en los dos casos. El proyecto tiene
guardias para casi todo, y ninguna podía ver esto: una comprueba el marcado
que escribimos, no el que falta; la otra no sabe qué cabecera pone el
servidor.

Por eso la única verificación que valía era **publicar y mirar lo que decía
Search Console**. Conviene volver a mirarla unos días después de cada cambio
de SEO, no solo al montarla.

---

## 15. Y además tiré el despliegue con un comentario (1/11/2026)

Al declarar el `Content-Type` del sitemap quise dejar escrito **por qué**, y
JSON no tiene comentarios. Así que inventé una clave `_comentario` dentro de
cada entrada de `headers`, dando por hecho que lo que no se reconoce se
ignora.

**No se ignora.** `vercel.json` declara su `$schema` y Vercel valida la
configuración de forma estricta: una propiedad que no está en el esquema no
es un aviso, es un error, y **el despliegue falla antes de compilar nada**.

Lo delató que fallara el proyecto `landing` y no el `admin`: lo único que los
distinguía en ese cambio era ese archivo.

### La parte que importa: CI estaba en verde

`vercel.json` **no lo lee nada nuestro**. `format:check` lo da por bueno
porque es JSON válido; `lint`, `typecheck`, `test` y `build` no lo miran
siquiera. Los seis pasos pasaron con el despliegue roto, y el fallo solo
apareció en el PR, en un sitio donde solo mira quien va a fusionar.

De ahí `vercel-json-no-lleva-inventos.test.ts`, que adelanta esa validación a
los pasos que ya se ejecutan. No reimplementa el esquema de Vercel —no sería
honesto mantenerlo— sino que comprueba las claves de las secciones que este
proyecto usa, que es lo que de verdad falló. Verificado volviendo a meter la
clave: falla nombrándola.

### La regla, para la próxima

**Si hay que explicar una regla de `vercel.json`, se explica aquí, no ahí.**
Un archivo de configuración sin comentarios es el precio de JSON, y ese
precio se paga; no se intenta esquivar.
