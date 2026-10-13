# 34. «Llévame allí»: navegación desde la PWA (Etapa 3.17)

## 1. Qué había, y por qué no bastaba

La pantalla de limpieza ya enlazaba a Google Maps en dos sitios:

```tsx
href={`https://maps.google.com/?q=${encodeURIComponent(completa)}`}   // la dirección
href={`https://maps.google.com/?q=${job.doorPin.latitude},${...}`}    // el pin del cliente
```

Pero `?q=` **enseña** el sitio en el mapa. Quien llega todavía tiene que pulsar
«Cómo llegar» y luego «Iniciar»: dos toques y una decisión con el coche en
marcha.

Y el segundo enlace sólo existe cuando el cliente marcó el pin, que **es la
minoría**: el propio contrato lo dice —_«`null` es el caso NORMAL, no un error:
marcar el pin es opcional y la mayoría no lo hará»_—. La mayoría de los
trabajos se quedaba sin nada parecido a una navegación.

## 2. El botón nuevo

```
https://www.google.com/maps/dir/?api=1&destination=…&travelmode=driving
https://maps.apple.com/?daddr=…&dirflg=d
```

Abren la **ruta ya trazada**, a un toque de «Iniciar».

### El destino: el pin si lo hay, la dirección si no

| Caso                      | Destino               | Por qué                                                                                                                                  |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Con pin**               | Las coordenadas       | El cliente lo marcó precisamente porque el geocodificador interpola sobre el tramo de vía y en el campo deja la casa a cientos de metros |
| **Sin pin** (lo habitual) | La dirección en texto | La geocodifica el servicio de mapas, que lo hace mejor que nuestro proveedor del Censo                                                   |
| **Pin caducado**          | La dirección          | Se borra 24 h después del trabajo; la decisión se toma en cada llamada, nunca se guarda                                                  |

### No se manda el origen, y eso es lo importante

De dónde sale lo pone la aplicación de mapas con la ubicación del propio
móvil. Así **la ubicación de la empleada no pasa por nuestros servidores en
ningún momento** —ni siquiera se le pide el permiso de geolocalización—. La
regla de la etapa 3.3 queda intacta: es un enlace, no una funcionalidad.

## 3. iPhone y Android

**El botón de Google se pinta siempre. El de Apple sólo se añade en iPhone y
iPad.**

La detección por la cadena del navegador es frágil por definición: la escribe
el fabricante, cambia con cada versión y algunos navegadores mienten a
propósito. Por eso **no decide cuál se enseña, sólo si se añade uno más**:

- Si acierta de más, sobra un botón.
- Si acierta de menos, queda el de Google, que en un iPhone funciona igual.

Si la detección decidiera cuál se enseña, un fallo dejaría a alguien
conduciendo con un botón que no abre nada.

Un caso que la cadena no resuelve sola: **un iPad con iPadOS 13 o posterior se
presenta como un Mac de escritorio.** Lo delata que tenga pantalla táctil.

### Lo que NO se puede hacer, y por qué

**Saber si Apple Maps está instalado: no se puede.** Ningún navegador expone
qué aplicaciones tiene el dispositivo, y es deliberado — esa lista sirve para
identificar a una persona. No hay API, ni truco que funcione de forma fiable.

**Y mandar a un Android a descargar Apple Maps tampoco: no existe para
Android.** Es sólo de iPhone y Mac.

No hace falta ninguna de las dos. `maps.apple.com` es un **enlace universal**:
abre la aplicación si está instalada y, si alguien la borró, Safari enseña la
página de Apple que ofrece recuperarla. Lo resuelve Apple. Lo mismo vale para
Google Maps: sin la app, el enlace abre la versión web, que funciona.

## 4. Lo que nunca entra en la URL

| Dato                          | Por qué se queda fuera                                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`accessNotes`**             | El código de la puerta, dónde está la llave, si hay perro suelto. Una URL acaba en el historial del navegador, en los registros del servicio de mapas y en el menú de «compartir» del móvil |
| **`addressLine2`**            | «Apto 3B» no mueve el edificio de sitio, y algunos geocodificadores fallan la coincidencia entera. Misma regla que ya aplica `GeocodeQuerySchema`                                           |
| Nombre y teléfono del cliente | No hacen falta para llegar                                                                                                                                                                  |

El tipo `DestinoDeTrabajo` sólo admite los cinco campos que hacen falta, así
que añadir uno mañana exige tocar la firma: un gesto visible en una revisión
en vez de una línea más.

**El teléfono del cliente sí puede ir en un `href`, y va**: el botón de llamar
es un `tel:` a propósito, porque quien está en la puerta a las ocho y no le
abren necesita poder llamar sin pasar por la oficina. Un `tel:` no sale del
móvil; una URL de mapas sí. Hay una prueba que exige que ese botón siga ahí.

## 5. Coste

**Cero.** Esto no es una llamada a ninguna API: es una URL que abre una
aplicación. No toca la clave de Routes API, ni la cuota de 500/día, ni el
presupuesto de 1 $.

## 6. Qué NO cambia

Los dos enlaces de antes **se quedan**:

- La **dirección** sigue siendo un enlace a `?q=`. Es la que se reconoce y la
  que se le dice a alguien por teléfono.
- El **pin del cliente** sigue teniendo su enlace propio, para _comprobar_
  dónde cae antes de fiarse. El código ya razonaba por qué: el pin lo puso una
  persona y puede estar mal, así que quitar la dirección dejaría al equipo sin
  nada a lo que volver.

Lo nuevo es un botón más, no un reemplazo.

## 7. Qué comprobar tras desplegar

1. Abre la PWA en un **Android**: debe salir un botón «Llévame allí» y ningún
   botón de Apple Maps.
2. Pulsa: tiene que abrir Google Maps con la ruta ya trazada desde donde estás.
3. En un **iPhone**: deben salir los dos botones.
4. Prueba un trabajo **sin pin** y otro **con pin**, si tienes alguno: los dos
   tienen que llevar a la casa.
