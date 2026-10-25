# 38 — Fotos y vídeos de antes y después

> Etapa 2.A de la galería: **los permisos, antes del código.** La dueña quiere
> colgar vídeos de antes y después, y la web va a tener una galería. Lo que se
> publica es **el interior de la casa de un cliente**, y el «antes» es, por
> definición, la imagen de su casa sucia. Sin un permiso bien hecho, ese es el
> escenario de demanda más probable de todo el proyecto — más que los cobros.

> **ESTO NO ES ASESORÍA LEGAL.** Es el borrador operativo para que un abogado
> de Georgia lo revise, junto con `docs/37-dossier-operativo.md`. Lo escribe
> quien construyó el sistema, no un letrado. Nada de aquí se publica sin que
> alguien con licencia en Georgia lo haya leído.

---

## 1. Las dos cosas que no hay que confundir

Es el error más fácil de cometer y el más caro, porque las dos son «fotos del
trabajo»:

|              | **Marketing**                                 | **Prueba del trabajo**                             |
| ------------ | --------------------------------------------- | -------------------------------------------------- |
| Para qué     | Vender                                        | Defenderse de una queja o de una disputa de Stripe |
| Quién lo ve  | Todo internet                                 | Solo administración                                |
| Dónde vive   | YouTube (vídeo) y la galería de la web (foto) | Dentro del sistema, con acceso restringido         |
| Permiso      | **Imprescindible y por escrito**              | No es publicación: es registro del servicio        |
| ¿Existe hoy? | No                                            | No                                                 |

**Una foto de prueba del trabajo no se publica nunca, aunque salga bien.** Y
una foto de marketing no sirve como prueba, porque está elegida y recortada.

Hoy no existe ninguna de las dos. El dossier las tiene apuntadas como huecos
(punto 9 y apartado L). Esta etapa resuelve la primera; la segunda queda para
una etapa propia.

---

## 2. El modelo de consentimiento

La web es bilingüe, así que el permiso también. **Se firma el del idioma en
que se hable con el cliente**, y las dos versiones dicen lo mismo.

### Lo que el documento tiene que recoger

| Campo                                          | Por qué                                                  |
| ---------------------------------------------- | -------------------------------------------------------- |
| Nombre del cliente y dirección de la propiedad | El permiso es **de esa casa**, no del cliente en general |
| Fecha del servicio                             | Ata el permiso a un trabajo concreto                     |
| Qué se graba                                   | Interior, exterior, o ambos — marcado, no supuesto       |
| Dónde se publica                               | Web, Facebook, Instagram, YouTube: **enumerados**        |
| Si se puede mostrar el «antes»                 | Es la parte sensible; va en su propia casilla            |
| Si se puede identificar la zona                | «Marietta» sí, la calle no, nunca el número              |
| Duración                                       | Indefinido hasta que se revoque                          |
| Cómo se revoca                                 | Un correo o un WhatsApp bastan, y por escrito            |
| Plazo de retirada                              | **Cuántos días** tarda la empresa en quitarlo            |
| Firma y fecha                                  | Sin firma no hay permiso                                 |
| Que no se paga por ello                        | Si se paga, es otra figura legal distinta                |

**Un permiso verbal no vale.** No porque sea inválido en todos los casos, sino
porque no se puede demostrar, y el día que haga falta es precisamente el día
en que el cliente dice que no lo dio.

### Texto en inglés

```
BEFORE-AND-AFTER PHOTO AND VIDEO RELEASE

Customer name: ______________________  Phone: ______________________
Property address: ___________________________________________________
Date of service: ____________________

I allow Freshness Touch to take photographs and video of the following
areas of this property in connection with the cleaning service performed
on the date above:

  [ ] Interior      [ ] Exterior      [ ] Both

I allow Freshness Touch to publish that material for advertising on:

  [ ] Its website   [ ] Facebook   [ ] Instagram   [ ] YouTube

I specifically allow the "before" images, showing the property prior to
cleaning, to be published:            [ ] Yes      [ ] No

The city may be named (for example, "Marietta"). The street name and the
house number may never be shown or named.   [ ] Agreed

This permission lasts until I withdraw it. I may withdraw it at any time,
in writing, by email or text message to Freshness Touch. Freshness Touch
will remove the material from the places listed above within ____ days of
receiving my request. Material already downloaded or reshared by other
people may not be recoverable, and I understand that.

I receive no payment for this permission and I am not required to give it
in order to receive the cleaning service.

Signature: __________________________  Date: __________________
```

### Texto en español

```
AUTORIZACIÓN DE FOTOGRAFÍA Y VÍDEO DE ANTES Y DESPUÉS

Nombre del cliente: __________________  Teléfono: ____________________
Dirección de la propiedad: __________________________________________
Fecha del servicio: _________________

Autorizo a Freshness Touch a tomar fotografías y vídeo de las siguientes
zonas de esta propiedad, en relación con el servicio de limpieza
realizado en la fecha indicada:

  [ ] Interior      [ ] Exterior      [ ] Ambos

Autorizo a Freshness Touch a publicar ese material con fines publicitarios
en:

  [ ] Su sitio web  [ ] Facebook   [ ] Instagram   [ ] YouTube

Autorizo expresamente la publicación de las imágenes del «antes», que
muestran la propiedad sin limpiar:    [ ] Sí       [ ] No

Se puede nombrar la ciudad (por ejemplo, «Marietta»). El nombre de la
calle y el número de la casa no se pueden mostrar ni nombrar nunca.
                                      [ ] Conforme

Esta autorización dura hasta que la retire. Puedo retirarla en cualquier
momento, por escrito, por correo electrónico o por mensaje de texto a
Freshness Touch. Freshness Touch retirará el material de los lugares
indicados en un plazo de ____ días desde que reciba mi petición. El
material que otras personas ya hayan descargado o compartido puede no ser
recuperable, y lo entiendo.

No recibo ningún pago por esta autorización y no estoy obligado a darla
para recibir el servicio de limpieza.

Firma: ______________________________  Fecha: _________________
```

### Dos decisiones que faltan en el modelo

1. **El plazo de retirada** (los `____ días`). Recomendado: **5 días
   laborables.** Prometer «inmediatamente» es prometer algo que no se puede
   cumplir un domingo.
2. **Si el permiso se pide antes o después del servicio.** Recomendado:
   **antes**, al confirmar la reserva. Después de limpiar, pedirlo delante de
   la casa recién limpia es una situación en la que el cliente se siente
   obligado a decir sí, y eso debilita el permiso.

---

## 3. Lo que nunca entra en el encuadre

Esto es una lista para leer **antes de grabar**, no después:

- **El número de la casa y la placa de la calle.**
- **Nada de la puerta**: cerradura, llavero, teclado de alarma, panel de
  control. Esto conecta con una regla que el sistema ya cumple a conciencia:
  el código de la puerta no entra nunca en una URL ni en un registro
  (`docs/29-pin-de-la-puerta.md`). Sería absurdo protegerlo ahí y luego
  grabarlo en vídeo.
- **Correo, paquetes, facturas, recetas, cualquier papel con un nombre.**
- **Fotos de familia, diplomas, cuadros con dedicatoria.**
- **Niños.** Ni de lejos, ni de espaldas, ni un juguete con el nombre puesto.
- **Matrículas** de coches, en la entrada o en la calle.
- **Pantallas de ordenador o móvil encendidas.**
- **Medicamentos**, botes con etiqueta, cualquier cosa de un botiquín abierto.
- **Objetos religiosos, políticos o de orientación personal.** No porque haya
  nada malo en ellos, sino porque publican algo del cliente que el cliente no
  publicó.
- **Audio de conversaciones.** Mejor sin voz, o solo la voz de quien graba.

Regla sencilla para la grabación: **si la toma permitiría a un desconocido
llegar a esa casa o saber quién vive en ella, se repite la toma.**

---

## 4. El empleado también tiene que dar permiso

Si en el vídeo sale una persona del equipo, hace falta **su propio permiso,
aparte del del cliente**, y por escrito. Georgia reconoce el derecho de una
persona sobre el uso comercial de su imagen; usar la cara de una empleada en
un anuncio sin su permiso es un problema distinto y adicional al del cliente.

Dos cosas más:

- **No se puede condicionar el empleo a dar el permiso.** Si alguien dice que
  no, se graba sin que salga, y no pasa nada.
- **Si la persona deja la empresa**, su permiso no caduca solo. Conviene que
  el documento diga qué ocurre entonces.

---

## 5. La música es la causa número uno de problemas

No es un detalle menor: **usar música con derechos es lo que más vídeos tira
abajo**, y un aviso de copyright puede llevarse el canal entero.

Qué hacer: **solo la biblioteca de audio de YouTube**, o nada. Nada funciona
mejor de lo que parece: el sonido real de una casa quedando limpia vende.

---

## 6. La retirada tiene que ser un procedimiento, no una buena intención

Prometer en el permiso que se retira en X días obliga a poder hacerlo. Hace
falta saber, de un vídeo cualquiera, **de qué cliente es**. Si no, una
petición de retirada se convierte en revisar el canal entero a ojo.

Mínimo viable, mientras no exista el registro en el sistema (etapa 2.D):

- Una hoja de cálculo con una fila por pieza publicada: fecha del servicio,
  cliente, dirección, enlace del vídeo o nombre del archivo de la foto, y
  dónde se publicó.
- El permiso firmado, escaneado y guardado con un nombre que lleve la misma
  referencia.
- **La grabación original, guardada aparte.** Si un día YouTube quita el
  vídeo, el material no se pierde.

Cuando montemos el registro dentro del sistema esto pasa a ser automático,
pero la hoja de cálculo vale desde el primer día y no depende de mí.

---

## 7. Lo que se enseña tiene que ser lo que se vende

Esto es publicidad, y la publicidad responde de lo que promete:

- **No enseñar una limpieza profunda como resultado de una limpieza
  estándar.** Si el vídeo es de un servicio de los caros, hay que decirlo.
- **Nada de testimonios inventados**, ni de «resultados» recreados a propósito
  para la cámara.
- **No prometer un tiempo** («en 2 horas») si no es el tiempo real del
  servicio que se vende.

El dossier legal ya tiene abierta esta cuestión para el abogado, en el
apartado de lo que se vende frente a lo que se cobra.

---

## 8. Lo técnico que resolvemos nosotros

Esto no es cosa de la dueña; queda escrito aquí porque es parte del mismo
problema:

- **Se quitan los metadatos (EXIF) de toda foto antes de publicarla.** Una
  foto hecha con el móvil lleva dentro **las coordenadas GPS** del sitio donde
  se tomó. Publicar la foto del salón de un cliente con su GPS incrustado es
  publicar su dirección, aunque la imagen no enseñe el número de la casa. Es
  exactamente la misma razón por la que del fichaje de los empleados solo se
  guarda la distancia y nunca las coordenadas (`docs/25-fichaje-con-ubicacion.md`).
- **De los vídeos solo se guarda el identificador validado**, nunca una URL
  libre: así quien entre al panel no puede incrustar en la portada un marco de
  cualquier sitio, y la CSP sigue siendo un muro de verdad.
- **El vídeo no carga nada de Google hasta que el visitante pulsa play.** Se
  enseña una miniatura servida desde nuestro propio dominio. El modo «sin
  cookies» de YouTube **no es tan limpio como Google dice** —las pruebas
  independientes encuentran que escribe un identificador en el navegador y
  manda la IP al cargar, antes de que nadie le dé al play—, así que la única
  forma de mantener el «esta web no pone cookies ni manda datos a terceros» es
  no cargar el marco hasta que el visitante lo pida. Hay que comprobarlo en el
  navegador cuando esté montado, no darlo por bueno.

---

## 9. Lo que ya está construido (etapa 2.B)

La sección pública de vídeos, entera, y **se puede desplegar hoy**: si no hay
vídeos configurados no se pinta nada. Eso es deliberado — permite que el
código esté listo mientras se firman los primeros permisos.

### El contrato: se guarda el identificador, nunca una URL

`packages/types/src/gallery.ts`. Un vídeo de YouTube son once caracteres de
`[A-Za-z0-9_-]`. Se guardan esos once y **la web construye la dirección**.

Guardar la URL que alguien pegue convertiría el panel en una vía para
incrustar en la portada un marco de cualquier sitio de internet: la CSP
permite un origen para los marcos, y si el origen saliera del dato guardado
dejaría de ser un muro. Con el identificador, el origen lo decide el código,
en un solo sitio. En el conjunto permitido no cabe ni una barra, ni dos
puntos, ni un punto, así que lo guardado no puede convertirse en otra
dirección.

Las pruebas del contrato rechazan expresamente `https://evil.example/x`,
`dQw4w9WgX/Q`, `dQw4w9WgX:Q`, `dQw4w9WgX.Q` y `../../evil11`.

### La fachada: nada de Google hasta el clic

`apps/landing/src/components/VideoFacade.tsx`. Hasta que el visitante pulsa,
la tarjeta es nuestra: un botón, un triángulo y un título. No hay marco, ni
script, ni ninguna petición a ningún tercero.

**«youtube-nocookie» no bastaba.** Retiene las cookies hasta la reproducción,
pero las pruebas independientes encuentran que el marco escribe un
identificador en el navegador y manda la IP del visitante a Google **en cuanto
carga**, antes de que nadie pulse play. Google dice lo contrario y no hay
forma de comprobarlo desde el código. Así que el marco no se carga hasta que
el visitante lo pide: entonces es su decisión, no la nuestra, y el «esta web
no manda datos a terceros» sigue siendo verdad para quien no pulse.

**La miniatura es nuestra, no la de YouTube.** La natural sería la de YouTube
(`i.ytimg.com`): gratis, automática y siempre al día. Y sería exactamente la
misma petición a Google por otra puerta, encima en cuanto la sección entra en
pantalla y sin que nadie pulse nada. Así que la portada se sube al almacén
propio (etapa 2.C.3, más abajo) y se sirve desde nuestro dominio. **Sin
miniatura la tarjeta funciona igual**, con los colores de la marca: no es un
hueco ni un error, es el estado de partida.

El aviso de que el vídeo lo sirve un tercero se pinta **antes** del botón, no
después: quien pulsa tiene que poder decidirlo sabiéndolo.

### La CSP

`apps/landing/vercel.json`: `frame-src` gana `https://www.youtube-nocookie.com`
y nada más. `frame-ancestors 'none'` no se toca — ampliar `frame-src` es dejar
entrar; eso otro es que nadie nos incruste a nosotros.

`el-video-no-carga-hasta-que-se-pulsa.test.ts` ata las dos mitades, que viven
en archivos distintos: el origen que usa el código tiene que estar permitido
por la cabecera que Vercel sirve de verdad. Es el mismo fallo que ya ocurrió
con las teselas del mapa, donde el mapa se veía en desarrollo y no en
producción.

### El resto de las piezas

| Pieza                            | Dónde                                         |
| -------------------------------- | --------------------------------------------- |
| Lectura pública, nunca falla     | `apps/api/src/settings/gallery.service.ts`    |
| Endpoint `GET /api/v1/gallery`   | `apps/api/src/settings/gallery.controller.ts` |
| La sección                       | `apps/landing/src/sections/Gallery.tsx`       |
| Una petición para toda la página | `apps/landing/src/hooks/useGallery.ts`        |
| Textos en los dos idiomas        | `gallery.*` en `packages/i18n`                |

La galería vive en **una sola fila** de `business_settings`, como el resto de
la configuración, y por el mismo motivo: se reordena en tandas, y un fallo a
mitad dejaría la portada con un vídeo repetido y otro perdido.

**La caché son 30 segundos en el servidor y 5 minutos en el navegador, a
propósito corta:** un cliente puede revocar su consentimiento y la empresa
promete retirar el material en unos días. Una caché larga alargaría esa
promesa sin que nadie lo notara.

Si la fila tiene basura, un identificador inválido o una clave que el contrato
no conoce, **se ignora la fila entera y la sección no se pinta**. Se ignora
entera y no solo el vídeo malo a propósito: colando los válidos, la dueña
vería la galería «casi bien» y no sabría que le falta uno.

### La pantalla del panel (etapa 2.C.1)

_Ajustes → Antes y después._ **Solo ADMIN, también para leer.**

Para escribir, porque publicar el interior de la casa de un cliente sin su
permiso firmado es el peor escenario legal del sistema, y eso no tiene nada
que ver con coordinar una agenda. Para leer, porque la pantalla trae además
quién publicó cada vídeo y cuándo; la lista a secas está en el endpoint
público, sin sesión.

Cuatro decisiones de la pantalla, y ninguna es de maquetación:

1. **El aviso del permiso está arriba, en rojo y permanente.** No es una
   casilla de «he leído»: esas se marcan sin leer. Esta pantalla se va a abrir
   muchas veces y la primera es la única en que alguien lee algo nuevo.
2. **Se pega la dirección de YouTube, no el identificador.** Nadie tiene a
   mano `dQw4w9WgXcQ`; todo el mundo tiene la dirección que copia. Se aceptan
   las seis formas (`watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/` y
   el identificador suelto), y **lo que se guarda son solo los once
   caracteres**. Si la pantalla exigiera el identificador suelto, se acabaría
   pegando la dirección, el campo se pondría rojo y la conclusión sería «esto
   no funciona».
3. **Retirar es un botón por fila**, no una papelera escondida. Es la
   operación que de verdad va a usarse.
4. **Los dos idiomas del título van juntos**, uno al lado del otro, igual que
   en los textos del sitio: separarlos es como se acaba escribiendo el inglés
   y olvidando el español.

**Se manda la galería entera, con `PUT`.** Y aquí la razón no es la simetría
con el resto de la configuración: lo que más va a pasar es **retirar** un
vídeo porque su propietario revocó el permiso, y retirar es una ausencia.
Mandando el conjunto, lo que no viene es que ya no está. Con operaciones de
borrado independientes, una petición perdida por el camino deja publicada la
casa de alguien que pidió que la quitaran.

**El rastro guarda la diferencia, no la lista.** La acción de auditoría es
`gallery.updated` y la metadata es `{ added: [...], removed: [...] }`. La
lista entera no responde a «cuándo se retiró el vídeo de esta casa», que es la
única pregunta que llega tarde; la diferencia sí. Y no entra **ninguna
dirección ni ningún dato del cliente**: son identificadores de vídeos ya
públicos en YouTube. El cambio y su registro van en la misma transacción.

### Las fotos (etapa 2.C.2)

Se suben desde el panel, van a Supabase Storage y salen en la misma sección,
debajo de los vídeos.

#### Lo más importante: se les quita el GPS

`apps/api/src/storage/strip-image-metadata.ts`.

Una foto hecha con un móvil lleva dentro, en un bloque aparte de los píxeles,
**las coordenadas GPS del sitio donde se tomó**. También la fecha, el modelo
del teléfono y a veces el nombre del propietario.

El permiso que firma el cliente dice que no se mostrará su calle ni su número,
y el encuadre se cuida para que no salga la placa. Y después se publicaría un
archivo con su dirección **exacta** escrita dentro, legible con cualquier visor
de propiedades. Es el mismo criterio que ya rige en el fichaje de los
empleados: de su ubicación solo se guarda la distancia, nunca las coordenadas.

**Se hace sin recodificar y sin ninguna dependencia nueva.** Lo habitual sería
`sharp`, que de paso borra todo, pero es una dependencia **nativa con script
de instalación**, y este repositorio tiene los scripts de instalación cerrados
a propósito: abrirlos amplía la superficie de suministro y mete un binario
nativo en el arranque de la API. Esto es TypeScript puro que reconstruye el
contenedor dejando fuera los bloques de metadatos.

| Formato | Lo que se va                                              | Lo que se queda                                          |
| ------- | --------------------------------------------------------- | -------------------------------------------------------- |
| JPEG    | `APP1` (EXIF y XMP), `APP13` (IPTC), `APP14`, comentarios | `APP0` (JFIF), `APP2` (perfil de color), tablas, píxeles |
| PNG     | `eXIf`, `tEXt`, `zTXt`, `iTXt`, `tIME`                    | todo lo demás, byte a byte                               |
| WebP    | los trozos `EXIF` y `XMP `                                | el resto, y se **apagan las dos banderas** del `VP8X`    |

Tres detalles que costarían un fallo difícil de encontrar si se hicieran mal, y
que tienen su prueba:

1. **En JPEG se copia tal cual desde el inicio de los datos.** Dentro de los
   píxeles aparecen bytes `FF` por puro azar, y un `FF E1` ahí **no** es un
   EXIF. Un limpiador que siguiera buscando marcadores recortaría un trozo de
   la imagen y la corrompería **solo en algunas fotos**: el peor fallo posible,
   porque pasa las pruebas con cualquier imagen que no tenga esa combinación.
2. **En WebP hay que apagar las banderas de EXIF y XMP del `VP8X`.** Quitar los
   datos y dejar la bandera encendida deja un archivo que anuncia un EXIF que
   ya no existe: carga en unos navegadores y no en otros.
3. **En WebP hay que reescribir el tamaño declarado del RIFF**, o el archivo
   anuncia más bytes de los que tiene.

Se conservan el perfil de color y la cabecera JFIF a propósito: no dicen nada
de nadie, y sin el perfil una foto de móvil se publica con los colores lavados.

#### Por qué la subida pasa por la API y no va directa al almacén

Podría ir del navegador a Supabase. No va, por tres cosas que solo se pueden
hacer en el servidor:

1. **Comprobar que los bytes son una imagen**, por los bytes y no por lo que
   diga el cliente. Sin esto, llamar `.jpg` a un SVG colaría **un documento con
   JavaScript dentro** en un bucket público.
2. **Quitar los metadatos**, que es lo de arriba.
3. **Poner el nombre.** Si lo pusiera quien sube, se acabarían subiendo
   archivos llamados `casa-de-los-martinez.jpg`, que es publicar el apellido del
   cliente en una dirección que cualquiera puede leer. El nombre son **32
   caracteres hexadecimales** y nada del original sobrevive.

Y una cuarta: la clave de servicio de Supabase se salta las políticas de la
base. En el navegador sería una clave de administración repartida a todo el que
abra el panel.

#### Rutas dentro, direcciones fuera

Guardada vive la **ruta** (`photos/abc….jpg`), validada contra
`/^photos\/[0-9a-f]{32}\.(jpg|png|webp)$/`. La **dirección** la compone el
servidor, que es el único que sabe dónde está el almacén.

Mandar la ruta y que la web le pegue delante un dominio suyo pondría ese
dominio en dos sitios que tendrían que coincidir para siempre, y ya sabemos
cómo acaba: es exactamente el fallo de la sede. La web no compone ninguna
dirección, y una prueba comprueba que en la sección no aparece escrito ningún
dominio de almacén.

La CSP de las dos aplicaciones gana el origen del almacén en `img-src`, y una
prueba exige que haya **exactamente uno** y que sea `https`.

#### Retirar una foto la borra de verdad

Quitarla solo de la fila dejaría el archivo accesible con su dirección para
quien la tuviera. El permiso promete **retirar el material**, no esconder el
enlace.

- **El borrado va después de la transacción, no dentro.** Dentro, un fallo
  posterior haría retroceder la fila y dejaría las fotos ya borradas: la
  galería apuntaría a archivos que no existen.
- **`remove` no falla nunca**, a propósito. Lo que importa de retirar una foto
  es que deje de verse, y eso ya pasó al guardar la fila. Un archivo huérfano
  es un problema de limpieza; una foto que sigue publicada después de pedir que
  la quiten es un problema legal.

#### Un dato que casi se perdió

La pantalla tiene **dos listas y un solo botón de guardar**, y se manda la
galería entera: lo que no viene, se borra. La primera versión del formulario
solo conocía los vídeos, así que guardar un vídeo habría **retirado todas las
fotos y las habría borrado del almacén** sin que nadie lo pidiera. Lo atan dos
pruebas: «guardar un cambio de los vídeos NO borra las fotos» y la simétrica.

#### Configuración

| Variable                    | Valor en producción | Qué hace                                                                                                                                    |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_PROVIDER`          | `supabase`          | Con `memory` las fotos viven en la memoria del proceso y sus direcciones no cargan nada. La API avisa por error si sigue así en producción. |
| `GALLERY_BUCKET`            | `gallery`           | El bucket público.                                                                                                                          |
| `SUPABASE_SERVICE_ROLE_KEY` | secreto en Render   | Nunca sale al navegador ni se escribe en un registro.                                                                                       |
| `STORAGE_TIMEOUT_MS`        | `10000`             |                                                                                                                                             |

La API **no arranca** con `STORAGE_PROVIDER=supabase` y sin clave: el fallo se
ve en el despliegue, no la primera vez que alguien intenta publicar una foto.

### Las miniaturas de los vídeos (etapa 2.C.3)

Cada vídeo puede tener su propia portada, subida desde el panel igual que una
foto. Lo que se ve antes de pulsar play deja de ser un rectángulo de color y
pasa a ser una imagen real — **sin pedirle nada a Google**, que es todo el
punto.

#### Carpeta aparte, y no es un detalle de orden

Las miniaturas van a `posters/` y las fotos a `photos/`, con su propia
expresión de validación cada una. **Son dos cosas distintas aunque sean dos
imágenes:** una foto es contenido de la galería; una miniatura es la portada
de otra cosa.

Si vivieran juntas, retirar una foto podría llevarse por delante la portada de
un vídeo —y al contrario—, y nadie entendería por qué al quitar una foto un
vídeo se quedó en gris. El contrato rechaza expresamente una ruta de `photos/`
como miniatura y una de `posters/` como foto.

#### Un endpoint, no dos

`POST /api/v1/admin/gallery/images?kind=photo|poster`.

Lo que cambia entre subir una foto y subir una miniatura es **una carpeta**.
Con dos rutas habría dos sitios donde comprobar los bytes y quitar los
metadatos, y tarde o temprano un arreglo se aplicaría a una y no a la otra.
Sin `kind`, o con uno inventado, la subida se rechaza con un 415: adivinarlo
sería decidir por quien llama dónde acaba su archivo.

#### Sustituir una portada borra la anterior

Es lo que más va a pasar con las miniaturas, y es fácil de olvidar porque no
se parece a un borrado. Sin esto, cada cambio de portada dejaría la anterior
en el almacén para siempre, accesible con su dirección para quien la tuviera.

El borrado va al **guardar**, no al subir. Si se borrara al subir la nueva y
luego no se guardara, el vídeo publicado se quedaría apuntando a un archivo
que ya no existe.

El rastro lo registra aparte de las fotos: `postersAdded` y `postersRemoved`.

#### El texto alternativo va vacío, y es la única imagen del sitio que lo lleva

La portada es **decorativa**: el botón que la contiene ya se anuncia con el
título del vídeo. Describirla otra vez haría que un lector de pantalla leyera
lo mismo dos veces.

Es lo contrario de las fotos de la galería, que **siempre** llevan texto
alternativo, porque ahí la imagen _es_ el contenido.

### Lo que todavía no existe

- **Reordenar** los vídeos y las fotos arrastrando. Hoy el orden es el de
  subida; para cambiarlo hay que quitar y volver a poner.
- **El registro de consentimientos** (etapa 2.D), que une el papel firmado con
  la pieza publicada. Mientras no exista, sirve la hoja de cálculo de la
  sección 6.
- **Limpieza de huérfanos**: una foto subida y nunca guardada se queda en el
  almacén sin verse en ninguna parte. No molesta a nadie, pero ocupa.

### El bucket de Supabase Storage

Nombre **`gallery`**, el mismo que la fila de configuración, el endpoint y el
módulo de tipos. Configuración:

| Ajuste             | Valor                                   | Por qué                                                                                                                                                       |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public bucket      | **Sí**                                  | Son imágenes hechas para que las vea todo internet. Las URLs firmadas son para las fotos **internas** de prueba del trabajo, que es otra etapa y otro bucket. |
| File size limit    | 5 MB                                    | Una foto de móvil son 3–4 MB. Más es un vídeo disfrazado o un error.                                                                                          |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp` | **Nada de SVG**: un SVG es un documento que puede llevar JavaScript dentro, y servido desde un bucket público sería un hueco de seguridad real.               |

**Sin políticas RLS.** La lectura es pública por ser bucket público, y la
escritura va por la API con la `service_role`, que se salta RLS por
definición. Una política de escritura ahí sería señal de que algo se está
subiendo desde el navegador, que es justo lo que no queremos: la subida tiene
que pasar por la API para poder quitar el EXIF, limitar el tamaño y auditar
quién subió qué.

---

## 10. Qué hace falta para seguir

Por orden, y lo primero bloquea el resto:

1. **Un abogado de Georgia revisa el modelo** de la sección 2, junto con el
   dossier.
2. **La dueña decide** el plazo de retirada y si el permiso se pide antes o
   después del servicio.
3. **Se firman los primeros permisos** y se graban 3–5 piezas cortas.
4. Con eso ya en la mano, se monta el código: la galería y la sección de
   vídeos (etapa 2.B), la subida desde el panel (2.C) y el registro de
   consentimientos (2.D).

Mientras no haya permisos firmados, **la sección se puede construir pero no se
puede publicar con material real.**
