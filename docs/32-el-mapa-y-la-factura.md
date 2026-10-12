# 32. El mapa y la factura (Etapas 3.14 y 3.15)

> Dos etapas, un solo tema: **el mapa promete cosas que la factura no cumple.**
> La 3.14 fue la distancia (línea recta contra carretera); la 3.15, el radio
> que no cobra traslado. Van juntas aquí porque separarlas dejaría dos medias
> historias.

## 1. De dónde sale esta etapa

La noche del 11 de octubre de 2026 se cambió `DISTANCE_PROVIDER` de `mock` a
`google`. La primera cotización real —Monroe, GA 30655— devolvió **80 millas**
y zona C, es decir, sin precio automático.

Parecía un fallo y no lo era. La base de operaciones está en **Powder Springs
(30127)**, no en el centro de Atlanta, y 80 millas de carretera hasta Monroe es
la cifra correcta. Lo que estaba mal era la expectativa.

Pero al comprobarlo aparecieron dos cosas que sí lo estaban, y las dos llevaban
ahí desde siempre **sin poder verse mientras el proveedor fuera el simulado**.

## 2. El simulado escondía los dos defectos

`MockDistanceProvider` es una tabla de millas desde el centro de Atlanta por
prefijo del código postal del **destino**. Lo dice su propia cabecera:

> LO QUE NO HACE, Y HAY QUE SABERLO: ignora el ORIGEN.

Mientras el origen no se usara, daba igual de dónde saliera. El día que el
proveedor real empezó a medir de verdad, el origen pasó a decidir cada factura.

## 3. Defecto uno: dos fuentes para el mismo dato

El panel guarda la sede como **cinco campos**: latitud, longitud, ciudad, estado
y código postal. Pero cada mitad se usaba para una cosa distinta:

| Dato guardado      | Para qué servía                |
| ------------------ | ------------------------------ |
| Latitud y longitud | Dibujar el mapa y los anillos  |
| **Código postal**  | **Calcular lo que se factura** |

Y nada obligaba a que coincidieran. El código postal es un campo que se escribe
a mano; el punto se pone arrastrando el ratón. Bastaba con mover el marcador a
la sede nueva y olvidar el campo de abajo para que **el mapa dibujara un sitio y
la factura se calculara desde otro**, sin un error en ninguna pantalla.

Hoy coinciden. Esta etapa quita la posibilidad de que dejen de hacerlo.

### El arreglo: quitar la segunda fuente, no avisar de que discrepan

Se consideró detectar el descuadre y avisar en el panel. Se descartó por dos
razones:

1. **No se puede comprobar.** Haría falta una tabla de código postal a
   coordenadas que el repositorio no tiene, y el geocodificador del Censo que
   ya existe **exige una calle**: no resuelve un código postal suelto.
2. **Un aviso es peor arreglo que no tener el problema.** Dos fuentes de verdad
   con una alarma encima siguen siendo dos fuentes de verdad.

Así que **el origen pasa a ser el punto marcado**:

```ts
// apps/api/src/distance/providers/google-distance.provider.ts
origins: [
  { waypoint: { location: { latLng: { latitude, longitude } } } },
],
destinations: [{ waypoint: { address: formatDestination(query) } }],
```

El código postal de la sede ya no viaja a ninguna parte. Su etiqueta en el panel
lo dice ahora: _«Solo para la ficha»_.

**El origen es un punto y el destino sigue siendo texto**, y no es una
incoherencia: de la sede hay un marcador puesto a mano sobre el mapa; del
cliente solo hay su dirección escrita.

### De regalo, mide mejor

`"30127, GA, USA"` hacía que la ruta saliera del **centroide del código
postal**, que puede caer a un par de millas de la puerta. El marcador está donde
está la empresa.

### La clave de la caché también cambia

```ts
const key = [provider.name, origin.latitude, origin.longitude, state, destZip, line1, city];
```

Antes llevaba el código postal. Con eso, **mover el marcador unas millas sin
cambiar de código postal cambiaba la medida pero no la clave**, y se seguía
sirviendo la distancia de la sede anterior hasta veinticuatro horas después.

## 4. Defecto dos: el círculo miente, y le cuesta dinero a alguien

Leaflet dibuja los anillos así:

```ts
// apps/landing/src/components/ServiceAreaMap.tsx
L.circle(puntoCentral, { radius: zona.maxMiles * METROS_POR_MILLA, ...estilo });
```

Eso es un círculo **geodésico**: 35 millas en línea recta. Pero lo que se cobra
son las millas que recorre el coche, que **siempre son más** —en un área
metropolitana con ríos, interestatales y sin diagonales, bastante más—.

Consecuencia: **una casa que el cliente ve dentro del círculo azul puede llevar
recargo de traslado igualmente.** El mapa promete una cosa y el presupuesto dice
otra, y el cliente lo descubre al final, que es cuando peor sienta.

No se arregla dibujando isócronas —eso es una consulta a Google por cada píxel
del contorno—. Se arregla **diciéndolo**, en el sitio público y en el panel:

> Los anillos son distancias en línea recta. El traslado se cobra por millas de
> carretera, que siempre son más: el cotizador da la cifra exacta.

El número exacto lo sigue dando el cotizador, que es quien lo sabe.

## 5. La prueba que sostiene la etapa

`google-distance.provider.test.ts` es nuevo y afirma sobre el **JSON literal**
que se le manda a Google.

Hace falta porque **el cuerpo de esta petición no se puede probar contra la API
real desde el repositorio**: no hay clave en desarrollo y no debe haberla. La
versión con el origen como texto sí se verificó contra la API de verdad (Powder
Springs → Monroe, 80 millas, 200 OK). La forma nueva no, y un cuerpo mal formado
no da un resultado raro: da un 400 → 503 → **el cotizador deja de dar precios**.

La prueba no demuestra que Google lo acepte. Demuestra que lo que se manda es lo
que se quiso mandar, y que nadie lo cambia sin enterarse.

Vigila además una regla que no puede romperse nunca: **la clave de API va en la
cabecera y en ningún otro sitio.** En la URL acabaría en los registros de acceso
de todos los saltos intermedios; en el cuerpo, en cualquier traza. Hay una
prueba para cada mitad.

## 6. Verificación tras desplegar — HAZLA

Dos minutos, y es la única forma de saber que la forma nueva funciona:

1. Abre el cotizador y pide un presupuesto para **30655**.
2. F12 → Network → `estimate` → pestaña **Response**.
3. Mira el bloque `distance`:

```json
"distance": { "miles": 80, "provider": "google", "estimated": false }
```

| Lo que ves                     | Qué significa                           |
| ------------------------------ | --------------------------------------- |
| `200` y `"provider": "google"` | **Correcto.** La forma nueva funciona   |
| `503`                          | Google rechazó el cuerpo. Ver más abajo |
| `"provider": "mock"`           | El despliegue no entró todavía          |

Las millas pueden variar un poco respecto a las 80 de antes: ahora se mide desde
el punto exacto y no desde el centroide del código postal. Eso es lo correcto.

### Si sale 503

1. **Parada de emergencia:** en Render, `DISTANCE_PROVIDER=mock`. El cotizador
   vuelve a dar precios al instante, con las distancias aproximadas de siempre.
2. En los registros de Render busca `Routes API respondio`. El número que
   acompaña dice si fue el cuerpo (400), la clave (403) o la cuota (429).
3. Deshacer esta etapa es `git revert` del commit y redesplegar.

## 7. Lo que NO entra en esta etapa

**Revisar los límites de 35 y 60 millas.** Se fijaron cuando la base de partida
era el centro de Atlanta. Con la sede real en Powder Springs, el radio cubre el
oeste y el noroeste y se queda corto por el este: Monroe, Snellville o
Lawrenceville quedan más lejos de lo que quedarían desde Atlanta.

Eso es **una decisión comercial, no un defecto del código**, y se toma mirando
dónde están los clientes de verdad. La forma de comprobarlo es pasar por el
cotizador los códigos postales donde se trabaja y anotar la zona que sale; cada
consulta cuesta un elemento de Google y se cachea veinticuatro horas.

**Aviso de descuadre entre el mapa y el código postal.** Ya no hace falta: no
hay descuadre posible, porque solo hay un origen (§3).

---

# Etapa 3.15 — El anillo del traslado, por su cuenta

## 9. El agujero que quedaba

Al revisar las zonas tras la 3.14 salió que **no existe la zona B**: el área
guardada tiene solo A (≤35, precio automático) y C (≤325, sin precio
automático). Está decidido así desde la etapa 2.26 y escrito en
`service-area.ts`:

> **POR QUE FALTA LA B.** Eran 60 millas con precio automático, y desapareció:
> el traslado ya se cobra por milla desde las 35, así que una banda intermedia
> no decidía nada.

Consecuencia: **todo lo que pase de 35 millas no da precio automático.** Si el
negocio sí quiere cotizar hasta las 60, el arreglo es un campo en el panel:
subir el límite de la zona A.

**Y ahí estaba la trampa.** El límite de la zona y el radio sin recargo son
**dos ajustes independientes** que hoy valen los dos 35:

| Ajuste                   | Qué decide                      | Dónde vive       |
| ------------------------ | ------------------------------- | ---------------- |
| `zones[0].maxMiles`      | Hasta dónde sale el precio solo | Área de servicio |
| `travel.freeRadiusMiles` | Desde dónde se cobra el viaje   | Tabla de tarifas |

El mapa del sitio **solo sabía dibujar zonas**. El radio sin recargo no se
dibujaba en ninguna parte: _se veía_ porque el círculo de la zona A caía justo
encima.

Subir la zona A a 60 habría hecho esto:

1. El círculo crece a 60 millas.
2. El radio sin recargo se queda en 35.
3. El mapa enseña un círculo de 60 millas que el cliente lee como «aquí dentro
   no me cobran el viaje».
4. Se le cobra el viaje a partir de la milla 35.

**Ningún error en ninguna pantalla. Solo clientes discutiendo una factura.**

## 10. El arreglo: el anillo se dibuja siempre y por su cuenta

```tsx
// apps/landing/src/components/ServiceAreaMap.tsx
if (radioLibreMillas > 0) {
  L.circle(puntoCentral, {
    radius: radioLibreMillas * METROS_POR_MILLA,
    color: COLOR_RADIO_LIBRE, // verde
    dashArray: '6 4', // discontinuo
    fill: false,
  })
    .addTo(instancia)
    .bindPopup(etiquetaRadioLibre);
}
```

Tres decisiones, cada una por su motivo:

- **Verde y discontinuo.** El color lo separa de las zonas; el trazo
  discontinuo lo separa **sin depender del color**, que es lo único que sirve
  para quien no distingue bien el verde del azul. Misma regla que la pantalla
  de estado del panel.
- **Sin relleno.** Un relleno más encima emborrona los colores de todo lo que
  hay debajo, y además se tragaría los clics de la zona A: sin relleno, Leaflet
  solo atiende el trazo, así que el interior sigue siendo de la zona.
- **El último en dibujarse**, para quedar por encima de los círculos de zona.

Se dibuja **siempre**, también hoy que coincide con la zona A. Que coincidan
también es información: dice que ahí las dos cosas valen lo mismo. Y el día que
dejen de coincidir, el anillo ya está, no aparece de repente.

El mapa del panel (`LocationPickerMap`) ya lo dibujaba desde la etapa 2.26. El
público no. Ahora los dos cuentan lo mismo.

## 11. Qué ve el cliente ahora

| Elemento                  | Qué significa                          |
| ------------------------- | -------------------------------------- |
| Círculo azul              | Precio al instante en la web           |
| Contorno ámbar            | Se va, pero el precio se da en persona |
| **Anillo verde a trazos** | **Hasta aquí no se cobra traslado**    |

Con la leyenda explicando los tres, y el aviso de la etapa 3.14 recordando que
los radios son en línea recta y la factura por carretera.

## 12. Ahora sí se puede subir la zona A

**Panel → Datos del negocio → Área de servicio → límite de la zona A: 35 → 60**

Qué pasa:

- De 0 a 35 millas: precio automático, **sin traslado**.
- De 35 a 60: precio automático, **con traslado por milla**.
- Más de 60: se atiende, precio en persona.

Y el mapa lo enseña con dos círculos distintos en vez de con uno que miente.

El esquema lo valida: cada zona tiene que llegar más lejos que la anterior, la
primera tiene que dar precio automático, y una vez que una zona deja de darlo
las siguientes tampoco pueden. Subir A de 35 a 60 cumple las tres.

## 13. Lo que sigue pendiente

**Añadir o quitar zonas desde el panel.** El formulario solo edita las filas que
existen —el límite y la casilla de precio automático—; no hay botón de añadir.
Para tener tres bandas de verdad (A 35 / B 60 / C 325) hace falta otra etapa.

**El array `zones` de `packages/pricing/src/config.ts` está muerto.** Declara
A, B y C, pero los dos únicos sitios que construyen la configuración lo
sobrescriben siempre con `serviceArea.zoneRules()`. Es lo que hizo creer
—durante toda una sesión de diagnóstico— que existía una zona B. Quitarlo o
alinearlo con `DEFAULT_SERVICE_AREA` es una etapa pequeña y pendiente.
