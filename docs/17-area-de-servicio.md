# 17 — Área de servicio y mapa de zonas

> Etapa 2.18. La empresa pasa a operar en **todo el estado de Georgia**, las
> zonas se editan desde el panel en vez de vivir en el código, y se ven en un
> mapa tanto en el sitio público como en el panel.

---

## 1. El problema de cubrir un estado entero

Hasta ahora se atendía hasta **60 millas** de Atlanta y lo demás se rechazaba.
Cubrir Georgia significa llegar a unas **300 millas** hasta la esquina más
lejana: Savannah queda sobre las 250 y la esquina sureste sobre las 300.

Y ahí aparece el problema que define toda esta etapa: **un trabajo a 250
millas son unas 500 de ida y vuelta y cerca de ocho horas de conducción.**
Ninguna tabla de recargos acierta eso a ciegas. Con el recargo máximo de
entonces —$75— se perdía dinero en cada viaje.

### La respuesta: atendida y con precio automático no son lo mismo

| Concepto                  | Qué significa                          |
| ------------------------- | -------------------------------------- |
| **Atendida**              | Vamos a esa casa                       |
| **Con precio automático** | El cotizador dice la cifra al instante |

Antes iban siempre juntas. Ahora se separan: las zonas lejanas **se atienden
pero no dan precio automático**. El cotizador recoge la solicitud y el precio
se da en persona.

Esa distinción se eligió sobre las alternativas —recargos escalonados hasta
el final, o un recargo máximo plano— porque es la única que no promete una
cifra que nadie ha calculado.

---

## 2. Lo que el motor ya sabía hacer

El cambio en el motor de precios es de tres líneas, y no por suerte: la
maquinaria de «esto necesita revisión manual» ya existía para los servicios
comerciales y para las propiedades muy grandes.

```ts
const quotable = service.instantQuote && zone.serviceable && zone.instantQuote;
```

La tercera condición es la nueva. Con `quotable` en falso, el motor ya no
añade líneas, no calcula total y no retiene depósito — todo eso estaba
escrito. Lo único que hizo falta añadir fue el motivo:

```ts
if (!zone.serviceable) {
  manualReviewReasons.push(MANUAL_REVIEW_REASONS.outOfRange);
} else if (!zone.instantQuote) {
  manualReviewReasons.push(MANUAL_REVIEW_REASONS.farZone);
}
```

**El `else if` importa.** «No vamos» y «vamos, te llamamos con el precio» son
dos respuestas opuestas para quien pide un presupuesto; decírselas juntas
pierde un cliente que sí se podía atender.

---

## 3. Las zonas de partida

**Dos zonas desde la Etapa 2.26.** Eran cinco anillos con recargo propio,
luego tres bandas, y ahora quedan dos.

| Zona           | Hasta      | Traslado              | Precio automático |
| -------------- | ---------- | --------------------- | ----------------- |
| A              | 35 mi      | **No se cobra**       | Sí                |
| C              | **325 mi** | Se calcula en persona | **No**            |
| `OUT_OF_RANGE` | más allá   | —                     | No se atiende     |

**Las 35 millas de la zona A son el radio sin recargo**, y no es casualidad:
la frontera que el cliente nota es «me cobras el viaje o no», así que la zona
y el radio tienen que coincidir. El día que se muevan por separado, el mapa
dirá una cosa y la factura otra.

### Por qué falta la B, y por qué no se renombró la C

Eran 60 millas con precio automático, y dejó de decidir nada en cuanto el
traslado pasó a cobrarse **por milla desde las 35**: una banda intermedia ya
no cambiaba ni lo que se cobra ni lo que se promete.

La tentación era renombrar la C a B para que fueran seguidas. **No se hizo:**
el código de zona **se guarda en cada reserva**, y hay reservas antiguas con
zona B que significan «hasta 60 millas, con precio automático». Si B pasara a
ser «el resto de Georgia, a mano», una consulta sobre el pasado mezclaría
trabajos a 50 millas con trabajos a 250 y nada avisaría de la mezcla.

Por eso la regla del contrato pasó de «en orden y **sin saltos**» a «en
orden», permitiendo huecos. Lo que se sigue impidiendo es **repetir un código
o ponerlos al revés**, que es lo que de verdad rompería la resolución de
zonas.

`B`, `D` y `E` siguen en el enumerado aunque el área de partida ya no las
use: **están escritas en reservas que ya existen**.

`OUT_OF_RANGE` **no se configura desde el panel**, y es deliberado: no es una
zona, es lo que hay más allá de la última. Ofrecerla para editar invitaría a
marcarla como atendida, que es una contradicción con nombre propio.

---

## 4. Qué se puede editar y qué no

Se editan **los límites en millas y si cada zona da precio automático**.

> **El recargo por zona ya no existe.** Lo tuvo —25, 50 y 75 dólares por
> franja— y se quitó en la Etapa 2.23: dos casas separadas por una milla
> podían pagar veinticinco dólares de diferencia por caer a un lado u otro de
> una raya que el cliente no ve. El traslado se cobra ahora **por milla** a
> partir del radio incluido (`docs/21-modelo-de-operaciones.md` §1.3), y lo
> único que deciden las zonas es hasta dónde se va y hasta dónde el precio
> sale solo.

**No se puede inventar zonas.** El conjunto de códigos (`A`…`E`) es fijo
porque **se guarda en cada reserva**: si se pudieran crear zonas, el histórico
acabaría lleno de códigos que ya no significan nada y ninguna consulta sobre
el pasado sería fiable.

### Las cuatro reglas del conjunto

El contrato las comprueba, y cada una evita un problema concreto:

| Regla                                                | Qué evita                                                                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los códigos van en orden y sin saltos                | El motor recorre la lista y se queda con la primera zona que alcanza la distancia: desordenada, diría **que el precio se da en persona cuando sale solo, o al revés**, sin fallar por ningún sitio |
| Cada anillo llega más lejos que el anterior          | Un tramo que nunca se alcanza: una zona configurada que no se asigna jamás                                                                                                                         |
| El precio automático no vuelve                       | Si a 50 millas hay que dar precio en persona, a 200 también. Lo contrario deja al cotizador dando cifras más lejos de donde ya dijo que no puede                                                   |
| La zona más cercana **siempre** da precio automático | Sin ella no habría cotizador: el sitio pediría los datos para no darle ninguna cifra a nadie, ni siquiera a quien vive al lado                                                                     |

Hay además un **tope duro de 500 millas** por zona. No es manía: sin él, un
cero de más convierte el área de servicio en medio país.

---

## 5. De un archivo a la base de datos

Las zonas viven ahora en la tabla de configuración, en su propia fila
(`service_area`). No hizo falta tabla nueva: la de configuración es de clave
y valor.

**El cambio con más consecuencias no es ese, es cuándo se lee.**
`buildPricingConfig` se llamaba **una vez, en el constructor** de cada
servicio. Con las zonas en la base eso ya no vale: un cambio desde el panel
no se vería hasta reiniciar el servidor. Ahora hay un `PricingConfigService`
que la resuelve **por petición**, con la caché de 30 segundos del área
evitando que eso cueste una consulta cada vez.

Y sigue estando **en un solo sitio** por lo mismo que antes: el cotizador y
las reservas tienen que calcular con la misma configuración. Si cada uno se la
montara por su cuenta, un día darían precios distintos para la misma casa y
nadie sabría cuál es el bueno.

**Nunca falla al leer.** Si la fila no existe, tiene basura de una versión
anterior o la base no responde, se usa el área de partida y se deja en el log.
De esto depende que el sitio pueda dar precios.

---

## 6. El mapa: Leaflet y OpenStreetMap

### Por qué estos y no otros

No necesitan clave de API ni cuenta ni tarjeta: se despliega y funciona. Las
alternativas conocidas cobran por carga de mapa y exigen una clave que hay que
guardar, rotar y vigilar — y que, al ir en el navegador, **es pública por
definición**. Para dibujar unos círculos sobre un estado, eso es pagar y
arriesgar por nada.

Esa elección tiene una letra pequeña que conviene leer antes de darla por
cerrada: **«Una advertencia que hay que tener escrita»**, más abajo en esta
misma sección.

### Tres cosas que hubo que resolver antes de publicar

**1. La CSP bloqueaba las teselas.** `img-src` estaba en `'self' data:`, así
que el mapa habría salido **gris en producción y perfecto en local** — ahí no
hay cabeceras. Se añadió `https://tile.openstreetmap.org` a la política de las
dos aplicaciones. Es el tipo de fallo que no se ve hasta que un cliente lo
reporta.

**2. El mapa reventaba entero.** El encuadre inicial pedía `getBounds()` a un
círculo suelto; un círculo que no está añadido al mapa no tiene con qué
convertir metros a coordenadas, y lanza
`Cannot read properties of undefined (reading 'layerPointToLatLng')`. Se
calcula ahora desde el punto con `toBounds`. **No se ve leyendo el código: se
vio abriéndolo en un navegador.**

**3. Las escalas no se llevan.** El área con precio al instante llega a 60
millas y la cobertura entera a 325. Encuadrado al estado completo, las cuatro
zonas cercanas se apelotonan en un punto y no se distingue ninguna. Por eso el
sitio ofrece **dos encuadres**: «todo el estado» (el que sale por defecto,
porque es lo que la gente viene a comprobar) y «área con precio al instante».

### Dos fallos que solo aparecieron en producción

Los dos se reportaron desde el sitio publicado, y ninguno de los dos podía
verse en local: uno depende de desplazar una página completa, el otro de una
cabecera que solo pone Vercel.

**4. El mapa se subía encima de la cabecera.** Leaflet pinta sus capas hasta
`z-index` 700 y sus controles —el zoom, la atribución— en **1000**. La
cabecera pegajosa está en 40 en el sitio y en 30 en el panel, así que al
desplazar, el mapa le pasaba por encima.

Subir la cabecera **no es el arreglo**: es una carrera que se pierde con el
siguiente componente que traiga números altos. El arreglo es **encerrar** a
Leaflet. En `.ft-map` y `.ft-map-hueco`:

```css
position: relative;
isolation: isolate;
z-index: 0;
```

Eso crea un **contexto de apilamiento**: los 1000 de Leaflet pasan a competir
solo entre ellos, dentro de la caja, y la caja entera vale 0 frente al resto
de la página. Se aplicó en las **dos** aplicaciones — el sitio tenía el mismo
fallo latente aunque nadie lo hubiera reportado todavía.

**5. El panel recibía 403 al pedir las teselas; el sitio no.** El mensaje era
`App is not following the tile usage policy`. La diferencia entre las dos
aplicaciones estaba en una cabecera de `vercel.json`:

| Aplicación | `Referrer-Policy`                 | Teselas |
| ---------- | --------------------------------- | ------- |
| Sitio      | `strict-origin-when-cross-origin` | Cargan  |
| Panel      | `no-referrer`                     | **403** |

OpenStreetMap exige que una aplicación **se identifique**; sin referente, sus
servidores la bloquean. Y `no-referrer` en el panel es lo correcto: es una
herramienta interna, y sus rutas (`/admin/reservas/<id>`, por ejemplo) no
tienen por qué salir a ningún sitio.

Por eso se arregla **en la capa de teselas y no aflojando la cabecera**:

```ts
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  referrerPolicy: 'strict-origin-when-cross-origin',
  ...
});
```

El atributo del elemento manda sobre la política del documento, así que
**solo estas imágenes** envían referente, y `strict-origin` envía **solo el
origen**, nunca la ruta. El panel conserva `no-referrer` para todo lo demás.

### Una advertencia que hay que tener escrita

El 403 se arregló, pero destapó algo más grande que conviene dejar por
escrito antes de que muerda: **el servidor público de teselas de
OpenStreetMap no está pensado para producción.** Lo mantiene la fundación con
donaciones, y su política de uso lo reserva a desarrollo y a usos ligeros; se
reserva el derecho a bloquear a cualquier aplicación, y eso es exactamente lo
que le acaba de pasar al panel.

Hoy funciona y la carga de este proyecto es mínima, así que no hay nada roto.
Pero **es una dependencia prestada**: si un día deja de servir teselas, el
mapa sale gris y no hay a quién reclamar. Las salidas, por orden de coste:

| Salida                         | Clave de API | Coste         | Qué implica                                                                |
| ------------------------------ | ------------ | ------------- | -------------------------------------------------------------------------- |
| Seguir con OSM                 | No           | $0            | Lo de hoy. Puede bloquearse sin aviso                                      |
| Esri (teselas ráster)          | No           | $0            | Sigue siendo Leaflet, solo cambia una URL. Sus condiciones hay que leerlas |
| OpenFreeMap                    | No           | $0            | **Vectorial**: obliga a cambiar Leaflet por MapLibre GL                    |
| MapTiler / Stadia / LocationIQ | **Sí**       | Capa gratuita | Clave pública en el navegador, hay que restringirla por dominio            |

**La decisión es del negocio, no técnica**, y no se ha tomado en esta etapa.
Cambiar de proveedor ráster es cambiar una URL y la atribución; pasar a
vectorial es reescribir el componente.

### Detalles que parecen menores

- **El zoom con la rueda va apagado** hasta que se pulsa el mapa. Está en
  medio de una página que se lee hacia abajo: con la rueda activa, quien pasa
  por encima se queda atrapado haciendo zoom en vez de seguir leyendo.
- **Se dibuja de fuera hacia dentro.** Leaflet apila en el orden en que se
  añade: al revés, el círculo exterior taparía a todos los demás.
- **Modo oscuro: se invierten las teselas, no se cambia de proveedor.** El
  filtro se aplica solo a la capa de teselas; si se aplicara al contenedor,
  los círculos y la atribución se invertirían también y el azul de marca
  saldría naranja.
- **La atribución de OpenStreetMap es obligatoria** por su licencia, y va
  puesta.
- **Se carga aparte.** Leaflet son unos 40 kB comprimidos. En el sitio se pide
  cuando la sección entra en pantalla (que en la mayoría de visitas no llega a
  pasar); en el panel, al abrir la pestaña. Queda en su propio trozo de
  150 kB, fuera del paquete principal.

### El componente está duplicado, a propósito

`apps/landing/src/components/ServiceAreaMap.tsx` y su gemelo en `apps/admin`
son casi el mismo archivo. Las dos aplicaciones se despliegan por separado y
el monorepo **no tiene ningún paquete compartido de React**: montar uno para
cien líneas sería más estructura que beneficio. **Si aparece un tercer
consumidor, toca extraerlo.**

---

## 6 bis. El anillo exterior es el estado, no un círculo

Un círculo de 325 millas centrado en Atlanta entra en **Tennessee, Carolina
del Sur, Alabama, Carolina del Norte y Florida**. A ninguno de esos sitios se
va: el propio motor marca `outOfState` en cuanto el código postal no es de
Georgia. El mapa prometía cobertura en cinco estados que el sistema rechaza.

Desde la Etapa 2.25, **una zona cuyo radio llega más lejos que el estado se
dibuja con el contorno real de Georgia**.

### Por qué esto es más preciso, y no una aproximación

El punto de Georgia más lejano de Atlanta está a **275 millas** —la esquina
sureste, hacia St. Marys—, así que las 325 de la zona C cubren el estado
entero con 50 millas de sobra. El contorno no es un recorte del círculo: es
la cobertura de verdad, y el círculo era lo que sobraba.

Las zonas cercanas **siguen siendo círculos**, y también por medirlo: el
borde de Georgia más cercano a la base está a 65,1 millas, así que los
anillos de 35 y 60 se quedan dentro del estado por todos lados. Ahí el
círculo dice la verdad y además se entiende de un vistazo.

### La regla, y por qué se calcula en vez de escribirse

```ts
const cubreElEstado = zona.maxMiles >= farthestGeorgiaMiles(centro.lat, centro.lon);
```

`farthestGeorgiaMiles` recorre el contorno y devuelve la distancia al punto
más lejano. **No es una constante a propósito:** la base de operaciones es
configurable, y el día que la empresa se mude la respuesta cambia sola en vez
de quedarse un número escrito mintiendo. Son 476 puntos y una raíz cuadrada
por punto, una vez al montar el mapa.

El borde del estado se dibuja además como línea gris discontinua **cuando
ninguna zona llega tan lejos**, para que se vea dónde acaba Georgia. Si una
zona ya lo dibuja, pintarlo otra vez sería repetir el mismo trazado de 476
puntos por debajo del otro.

Y el encuadre de «todo el estado» se ajusta ahora al polígono: un cuadrado de
325 millas de lado dejaba media Carolina en pantalla y Georgia pequeña en el
medio.

### De dónde salen las coordenadas

`packages/types/src/georgia-outline.ts`. Derivadas de los límites estatales
del censo de Estados Unidos, obtenidas del proyecto
[`unitedstates/districts`](https://github.com/unitedstates/districts), que
está en **dominio público**.

|                       |                                    |
| --------------------- | ---------------------------------- |
| Vértices del original | 4.826                              |
| Vértices publicados   | 476                                |
| Simplificación        | Douglas-Peucker, tolerancia 0,005° |
| Desviación máxima     | ~557 m                             |
| Peso                  | 11,5 kB de fuente                  |

557 metros a la escala a la que se ve el estado entero es **menos de un
píxel**. Es un mapa para decir «venimos a tu casa», no para replantear una
linde.

**No pesa en la carga inicial del sitio.** Se comprobó en el paquete
construido: el contorno aparece en el trozo diferido del mapa y no en el
principal, así que solo se descarga cuando la sección de zonas entra en
pantalla, junto a Leaflet.

### Lo que esto NO hace

Las zonas que **no** cubren el estado se siguen dibujando como círculos
completos. Con el área de partida no hay ninguna en ese caso, pero si alguien
configurara una zona de, digamos, 150 millas, su círculo entraría un poco en
Alabama y Tennessee. Recortar un círculo contra un polígono cóncavo exige un
algoritmo de intersección que hoy no está; lo que sí está es el borde gris,
que en ese caso se dibuja y deja ver dónde se acaba el estado.

---

## 7. La ubicación de la empresa

Es el **origen desde el que se mide todo**: la distancia de cada presupuesto,
las millas de traslado que se cobran, la zona que se guarda en cada reserva y
el centro del mapa. Desde la Etapa 2.26 se marca desde el panel, en
_Configuración → Ubicación de la empresa_.

### Por qué salió de las variables de entorno

Dos motivos, y el segundo ya estaba pasando:

1. Mudarse exigía un redespliegue.
2. **El mapa del panel llevaba las coordenadas escritas a mano.** Si alguien
   cambiaba la variable, administración seguía dibujando círculos alrededor
   del sitio antiguo mientras los precios se calculaban desde el nuevo. La
   propia documentación avisaba de que había «dos sitios que tocar»; ya no
   los hay.

### Quién puede verla y moverla

**Solo ADMIN**, tanto para leer como para escribir. Quien mueva este punto
cambia lo que factura la empresa en cada reserva posterior; coordinación
mueve la agenda, no la sede.

> **Lo que NO es privado, y conviene saberlo.** Las coordenadas siguen
> saliendo en el catálogo público, y tienen que salir: el mapa del sitio
> dibuja el círculo de las 35 millas centrado aquí, y **un círculo en un mapa
> enseña dónde está su centro** — se puede situar a ojo con un par de millas
> de error. Lo que es solo de administración es la ficha y poder cambiarla,
> no el hecho de que el área de servicio tenga un centro visible. Quien
> quiera el punto exacto fuera del alcance del público tendría que renunciar
> a dibujar esa zona en el sitio.

### La guardia: el punto tiene que estar dentro de Georgia

Es la regla que de verdad importa, porque **el fallo que atrapa no rompe
nada**: recentra el área de servicio y recalcula todos los traslados en
silencio.

| Dedazo                            | A dónde va la sede                            |
| --------------------------------- | --------------------------------------------- |
| `+84` en vez de `-84`             | Asia. Todos los clientes quedan fuera de área |
| Latitud y longitud intercambiadas | El océano Índico                              |
| Un dígito de más                  | Kansas                                        |

Ninguna de las tres falla por ningún sitio: el sistema sigue cotizando,
cobrando y facturando. Por eso el contrato las rechaza, y por eso la pantalla
deja **marcar el punto pulsando en el mapa**, que es la forma de no poder
cometer ese error.

El estado también se comprueba (`GA`): es la misma verdad dicha dos veces,
porque el motor usa ese campo para decidir si un cliente queda fuera de
estado, y puesto mal **ningún** presupuesto de Georgia daría precio.

### Dos fallos que se arreglaron al montarlo

- **El servicio de distancia leía el origen una sola vez al arrancar.** Mover
  la sede habría recentrado el mapa y las zonas mientras las millas
  facturadas seguían siendo las de antes. Ahora se pregunta en cada llamada,
  y **el origen entra en la clave de la caché**: sin eso, lo cacheado desde
  la sede anterior se seguiría sirviendo durante horas.
- **El respaldo iba a ser un punto escrito en el código.** Una instalación
  con `COMPANY_BASE_*` apuntando a otro sitio habría movido la base sola en
  el primer despliegue. El respaldo son esas variables; el valor del contrato
  es el último recurso.

### Lo que el proveedor simulado no puede comprobar

`MockDistanceProvider` **ignora el origen**: es una tabla de millas desde el
centro de Atlanta por prefijo del destino. Mover la sede no cambia lo que
devuelve, así que no sirve para probar esto. Queda escrito en el propio
proveedor, y la comprobación se hace en `distance.service.test.ts` con un
proveedor falso que delata lo que recibe.

---

## 8. Variables de entorno nuevas

| Variable                 | Por defecto | Obligatoria |
| ------------------------ | ----------- | ----------- |
| `COMPANY_BASE_LATITUDE`  | `33.749`    | No          |
| `COMPANY_BASE_LONGITUDE` | `-84.388`   | No          |

---

## 9. Qué se comprueba

`apps/api/src/settings/service-area.e2e.test.ts`, contra PostgreSQL real:

- Solo administración lee y escribe. Coordinación recibe `403` en las dos.
- **Las cuatro reglas del conjunto**, cada una con su caso: anillos que no
  crecen, precio automático que vuelve, un área en la que ni la zona más
  cercana da precio, y códigos con saltos. Más el tope de distancia y los
  códigos inventados.
- **Que una fila guardada con el recargo antiguo se siga leyendo.** El
  contrato es estricto, así que sin limpiar el campo retirado esas filas
  caerían enteras y la empresa volvería a las zonas de partida sin enterarse:
  sus 60 millas configuradas se convertirían en 35, y con ellas el precio de
  cada reserva posterior (`docs/21-modelo-de-operaciones.md` §2.1).
- **Que el cambio llegue de verdad al cotizador**: se reduce el área y el
  catálogo público lo refleja. Es el punto de toda la etapa — si el área se
  guarda pero el cotizador sigue con la del código, no se ha sacado nada del
  código.
  `packages/types/src/georgia-outline.test.ts` comprueba el contorno con la
  pregunta que el mapa existe para contestar, en sitios donde la respuesta se
  sabe de antemano: siete ciudades de Georgia caen **dentro** y cinco de los
  estados vecinos —Chattanooga, Greenville, Birmingham, Jacksonville,
  Asheville— caen **fuera**. Es la prueba que justifica el archivo entero: el
  círculo de 325 millas metía a las cinco dentro del área de servicio.

También comprueba que las coordenadas caben en la caja real del estado, que
es como se detecta el fallo clásico de intercambiar latitud y longitud al
pasar de GeoJSON a Leaflet —y que deja Georgia en medio del océano Índico.

- Que el cambio quede en la auditoría **con las cifras** (`service_area.updated`
  guarda de cuántas millas a cuántas, no un volcado).

Y en el motor (`packages/pricing/src/engine.test.ts`):

- A media distancia **se atiende sin precio automático**, y **no** se le dice
  a esa persona que está fuera del área.
- Más allá del estado sí queda fuera.
- **Las zonas cercanas siguen cotizando exactamente igual que antes.**

### Comprobado en navegador

Chromium real, en claro, oscuro y a 390 px, con las teselas servidas en local
(el contenedor de desarrollo no alcanza `tile.openstreetmap.org`). Se verificó
que Leaflet pinta los cinco círculos, que las teselas se solicitan a la URL
correcta, que la atribución aparece y que los dos encuadres funcionan.

---

## 10. Lo que queda fuera

- **Zonas por polígono o por código postal.** Hoy son anillos de distancia
  desde la base, que es como calcula el motor. Dibujar áreas a mano sería otro
  modelo de precios, no una mejora del mapa.
- **Tarifas editables desde el panel.** Es la pieza que queda para cerrar la
  configuración por completo, y la más pesada: cambiar un precio afecta a la
  facturación, así que necesita versionado y registro de quién lo cambió.
- **Textos y afirmaciones del sitio** (seguros, verificación de antecedentes,
  garantía), hoy fijos en el código.
