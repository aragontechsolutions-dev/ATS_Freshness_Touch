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

| Zona           | Hasta      | Recargo | Precio automático |
| -------------- | ---------- | ------- | ----------------- |
| A              | 20 mi      | —       | Sí                |
| B              | 35 mi      | $25     | Sí                |
| C              | 50 mi      | $50     | Sí                |
| D              | 60 mi      | $75     | Sí                |
| **E**          | **325 mi** | —       | **No**            |
| `OUT_OF_RANGE` | más allá   | —       | No se atiende     |

Las cuatro primeras son **exactamente las que ya estaban** en el código: esta
etapa amplía la cobertura, **no cambia ningún precio vigente**. `E` es lo
nuevo.

`OUT_OF_RANGE` **no se configura desde el panel**, y es deliberado: no es una
zona, es lo que hay más allá de la última. Ofrecerla para editar invitaría a
marcarla como atendida, que es una contradicción con nombre propio.

---

## 4. Qué se puede editar y qué no

Se editan **los límites, los recargos y si cada zona da precio automático**.

**No se puede inventar zonas.** El conjunto de códigos (`A`…`E`) es fijo
porque **se guarda en cada reserva**: si se pudieran crear zonas, el histórico
acabaría lleno de códigos que ya no significan nada y ninguna consulta sobre
el pasado sería fiable.

### Las cuatro reglas del conjunto

El contrato las comprueba, y cada una evita un problema concreto:

| Regla                                       | Qué evita                                                                                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los códigos van en orden y sin saltos       | El motor recorre la lista y se queda con la primera zona que alcanza la distancia: desordenada, asignaría **el recargo equivocado sin fallar por ningún sitio** |
| Cada anillo llega más lejos que el anterior | Un tramo que nunca se alcanza: un recargo configurado que no se aplica jamás                                                                                    |
| El precio automático no vuelve              | Si a 50 millas hay que dar precio en persona, a 200 también. Lo contrario deja al cotizador dando cifras más lejos de donde ya dijo que no puede                |
| Sin precio automático no hay recargo        | Un número que no se cobra nunca y que hace creer que sí                                                                                                         |

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

### Tres cosas que hubo que resolver

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

## 7. Las coordenadas de la base

El mapa se centra en `COMPANY_BASE_LATITUDE` / `COMPANY_BASE_LONGITUDE`
(Atlanta por defecto), que viajan en el catálogo público junto al resto de la
base de operaciones.

**Van ahí y no sueltas en el sitio web a propósito:** si se guardaran por
separado, el día que la empresa se mude el mapa seguiría dibujando círculos
alrededor del sitio antiguo mientras los precios se calculan desde el nuevo.
El mapa mentiría, y nadie lo notaría hasta que un cliente reclamara.

> **Si la empresa se muda** hay que tocar **dos** sitios: las variables de
> entorno de la API, y la constante `BASE` de
> `apps/admin/src/components/ServiceAreaForm.tsx`. El panel no consume el
> catálogo público, y pedirlo entero para dos números sería una llamada de más
> en cada apertura.

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
  crecen, precio automático que vuelve, recargo en zona sin precio, y códigos
  con saltos. Más el tope de distancia y los códigos inventados.
- **Que el cambio llegue de verdad al cotizador**: se reduce el área y el
  catálogo público lo refleja. Es el punto de toda la etapa — si el área se
  guarda pero el cotizador sigue con la del código, no se ha sacado nada del
  código.
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
