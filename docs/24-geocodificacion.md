# 24. Geocodificación de las direcciones

> Etapa 3.2. Traduce la dirección en texto de cada casa al punto que ocupa en
> el mapa, y lo guarda. Es el paso previo obligatorio del fichaje con
> ubicación: sin saber dónde está la casa, no se puede decir si alguien estaba
> en ella.

---

## 1. Por qué existe, y por qué antes que el fichaje

Al planificar el fichaje con ubicación apareció un bloqueo estructural: **el
sistema no sabía dónde está ninguna casa.** Tenía la dirección en texto
(`123 Main St, Atlanta, GA 30303`) y nada más. La pregunta que justifica todo
el fichaje —«¿estaba esta persona en la casa cuando dijo que había
llegado?»— no tenía forma de responderse.

Esto se construyó primero, y solo. El fichaje va detrás (Etapa 3.3).

## 2. Qué se guarda, y qué NO

En la tabla `addresses`, seis columnas nuevas, **todas anulables**:

| Columna                 | Para qué                                       |
| ----------------------- | ---------------------------------------------- |
| `latitude`, `longitude` | El punto                                       |
| `geocodePrecision`      | `ROOFTOP` o `INTERPOLATED` (ver §4)            |
| `geocodeProvider`       | Quién lo resolvió                              |
| `geocodeMatchedAddress` | La dirección que **entendió** el servicio (§6) |
| `geocodedAt`            | Cuándo                                         |

**Lo que NO se guarda en ninguna parte es la ubicación del empleado.** Esa
decisión se tomó al diseñar el fichaje y esta etapa no la toca: las
coordenadas del móvil se usan para calcular una distancia y se descartan en el
servidor, sin llegar a la base de datos.

> **Sobre privacidad, porque la pregunta es legítima:** geocodificar la casa no
> añade exposición ninguna. La dirección completa ya estaba en esta misma
> tabla, en texto plano. Un par de coordenadas no revela nada que
> «123 Main St, Atlanta» no revelara.

## 3. El servicio: el Censo de Estados Unidos

`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress`

Se eligió sobre Google y los demás por tres razones, en este orden:

1. **No tiene clave de API.** No hay nada que rotar, que filtrar en un
   despliegue, ni que se pueda gastar si alguien lo usa de más. Es la razón
   principal.
2. **Es gratis y sin límite práctico** para el volumen de una empresa de
   limpieza.
3. **Solo cubre Estados Unidos**, que es exactamente donde opera Freshness
   Touch.

Se cambia con una variable: `GEOCODING_PROVIDER=census`. El otro valor,
`mock`, es el de desarrollo — inventa un punto estable dentro de Georgia y
**no corresponde a la casa real**.

## 4. La precisión: interpola sobre la calle, no da el portal

**Esto decide cómo se puede leer un fichaje, y hay que tenerlo claro antes de
construir la Etapa 3.3.**

El Censo no tiene la posición de cada edificio. Tiene los tramos de calle
(TIGER/Line) con el rango de números de cada tramo, y coloca el punto
**interpolando**: si el tramo va del 100 al 200 y se busca el 150, devuelve el
punto medio del tramo. Por eso este proveedor devuelve siempre
`INTERPOLATED` y nunca `ROOFTOP`: decir otra cosa sería mentir sobre la
calidad del dato.

En metros: en una calle urbana corta, unas decenas. En una manzana rural larga
de Georgia, **cientos**.

> **Consecuencia práctica para la Etapa 3.3: el umbral de «está en la casa»
> tiene que ser GENEROSO** —del orden de un par de cientos de metros—, no de
> veinte.

Sirve para distinguir «llegó a la casa» de «fichó desde su propia casa a 30
kilómetros», que es lo que se pidió. **No sirve** para discutir si estaba en el
portal o en la acera de enfrente, y no se debe usar para eso.

## 5. La guardia: mejor sin coordenadas que con las de otro sitio

Un geocodificador **no devuelve un error cuando no encuentra la dirección:
devuelve lo más parecido.** Y hay una «Main Street» en cada pueblo del país.

Si se pide «Main St, Columbus, GA» y el servicio contesta con el Columbus de
Ohio, llegan coordenadas perfectamente válidas. Guardarlas dejaría la casa en
Ohio, y a partir de ahí **todos** los fichajes de ese cliente dirían «a 800
kilómetros». No fallaría nada. Simplemente mentiría, para siempre y en
silencio.

Por eso todo resultado pasa por una guardia que comprueba que el punto cae
**dentro del contorno real de Georgia** —el mismo que dibuja el mapa, de la
Etapa 2.25— antes de guardarlo. Lo que no pasa, no se guarda, y la dirección
queda **recuperable**: el barrido volverá a intentarlo.

## 6. El fallo que ninguna guardia atrapa

La guardia del §5 detecta el punto que cae en otro estado. **No puede
detectar la coincidencia plausible:** se pide «123 Main St, Atlanta» y el
servicio entiende «123 Main Ave, Atlanta». Dos calles del mismo barrio,
coordenadas válidas, guardia pasada con nota, y la casa a kilómetro y medio de
donde está.

Lo único que lo revela es **comparar la dirección que se pidió con la que el
servicio dice haber entendido**, y para eso está `geocodeMatchedAddress`.

Se guarda en la base, pero **no sale de ella**: no forma parte de
`AddressCoordinates`, que es lo que consumirá el fichaje y viajará al móvil de
un empleado. Es columna de diagnóstico, no dato de la aplicación.

## 7. Nada de esto puede romper una reserva

Ni una sola operación de la geocodificación lanza hacia arriba. Es una regla,
no una casualidad, y el motivo es concreto: **esto cuelga de la creación de
reservas, que es el camino del dinero.** Una reserva no puede fallar porque un
servicio del gobierno federal esté lento.

| Qué pasa                           | Qué ocurre                |
| ---------------------------------- | ------------------------- |
| El servicio no responde o va lento | Dirección sin coordenadas |
| No encuentra la dirección          | Dirección sin coordenadas |
| Responde algo ilegible             | Dirección sin coordenadas |
| Devuelve un punto fuera de Georgia | Se descarta, sin guardar  |
| El código postal está mal formado  | Ni se consulta            |

Y en todos los casos el barrido (§8) lo reintentará.

### Dos detalles que importan más de lo que parecen

**El contrato del puerto dice que un geocodificador no lanza nunca, y aun así
el servicio lo vigila con un `try`.** No es desconfianza gratuita: al crear una
reserva esto se llama **sin esperarlo** (`void resolveAndStore(...)`). Una
promesa rechazada que nadie recoge es un `unhandledRejection`, y en Node 22 eso
**tumba el proceso entero**. La diferencia entre devolver `null` y lanzar no
sería «una dirección sin coordenadas» frente a «un error», sino una dirección
sin coordenadas frente a **la API caída, y con ella todas las reservas**. Hay
una prueba para esto, y fallaba cuando se escribió: el agujero era real.

**La petición al Censo no sigue redirecciones** (`redirect: 'error'`). Lo que
viaja en ella es el domicilio de un cliente; el destino es una constante del
código, y una redirección es la única forma de que ese domicilio acabe en un
servidor que nadie eligió. Con esto, una redirección es un fallo limpio y
anotado en vez de una fuga silenciosa.

## 8. Se geocodifica sola, por dos caminos

1. **Al crear una reserva**, en cuanto la transacción termina —nunca dentro de
   ella— y sin esperar el resultado.
2. **Un barrido cada 15 minutos** que busca las direcciones que siguen sin
   coordenadas y las resuelve **de una en una**, con un tope de 20 por pasada.

El barrido no es un lujo: el intento del punto 1 puede fallar, y su fallo es
silencioso a propósito. Sin barrido, esa dirección se quedaría sin punto en el
mapa **para siempre**, y los fichajes de ese cliente no registrarían distancia
nunca, sin que nadie se enterara. También recoge las direcciones que ya
existían antes de que esto se construyera, que al desplegar son **todas**.

De una en una y con tope porque son llamadas a un servicio público gratuito:
veinte peticiones simultáneas es justo la forma de que te limiten. Con 20 cada
15 minutos son 1920 al día, de sobra, y nada depende de esto con urgencia.

## 9. Riesgos aceptados, dichos en voz alta

**El adaptador del Censo no se ha probado contra el servicio real.** El entorno
de desarrollo no tiene salida a `geocoding.geo.census.gov`. Se escribió contra
la API documentada y se probó con **respuestas reales capturadas**, pero la
primera llamada de verdad ocurrirá ya en el despliegue. Es el mismo caso que el
proveedor de distancia de Google.

**Cómo comprobarlo en cuanto esté desplegado:** guardar una dirección conocida
y mirar en el registro que las coordenadas caen donde deben. Si el
geocodificador estuviera mal, la guardia del §5 rechazaría el resultado y la
dirección se quedaría sin coordenadas — **nunca guardaría un punto equivocado
en silencio**.

**Si en producción no se geocodifica nada nunca**, hay tres cosas que mirar, en
este orden:

1. `GEOCODING_PROVIDER` sigue en `mock`.
2. El cortafuegos de salida de Render no deja llegar al Censo.
3. El Censo responde con una redirección (ver §7).

**La dirección del cliente sale de nuestra infraestructura** hacia un servicio
federal, por HTTPS. Es inherente a geocodificar con un servicio externo; la
alternativa sería una base de datos de calles propia, que para este volumen no
tiene sentido. Lo que sí se controla es que **la dirección no aparece en ningún
registro del servidor**: se anota el código postal y el nombre del error, nunca
la calle.

**El cuerpo de la respuesta no tiene tope de tamaño.** Una respuesta hostil
enorme agotaría memoria. Queda acotado por el tiempo de espera de 15 segundos,
que corta también la descarga del cuerpo, y el riesgo real es bajo tratándose
de un servicio federal por HTTPS. Se deja anotado por si algún día se cambia de
proveedor.

## 10. Lo que NO se hizo, a propósito

- **Ningún endpoint.** La geocodificación no tiene controlador: no se puede
  disparar desde fuera, ni con sesión de administrador. Es superficie de ataque
  que no hace falta.
- **Ningún índice** en las columnas nuevas. El barrido busca
  `WHERE latitude IS NULL`, que un índice sobre `createdAt` no acelera; y un
  índice parcial de verdad no se puede declarar en el esquema de Prisma, así
  que quedaría solo en el archivo de migración y la siguiente migración
  intentaría reconciliarlo. A la escala real de esta tabla el recorrido
  secuencial tarda milisegundos.
- **Nada en el registro de auditoría.** La auditoría registra lo que hacen las
  personas. Esto lo hace una tarea de fondo, no modifica ningún dato que
  alguien haya introducido, y llenaría el registro de ruido.
- **Ninguna pantalla en el panel.** No hay nada que decidir: o se resolvió o se
  reintentará.

## 11. Dónde está

| Qué                         | Dónde                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| Contrato y guardias         | `packages/types/src/geocoding.ts`                                |
| Distancia (haversine) común | `packages/types/src/geo-distance.ts`                             |
| Puerto                      | `apps/api/src/geocoding/geocoding.types.ts`                      |
| Proveedor del Censo         | `apps/api/src/geocoding/providers/census-geocoding.provider.ts`  |
| Proveedor simulado          | `apps/api/src/geocoding/providers/mock-geocoding.provider.ts`    |
| Servicio y caché            | `apps/api/src/geocoding/geocoding.service.ts`                    |
| Barrido                     | `apps/api/src/geocoding/geocoding-sweep.service.ts`              |
| Migración                   | `apps/api/prisma/migrations/20260930020000_address_coordinates/` |
| Variables de entorno        | `docs/08-variables-de-entorno.md`                                |

`geo-distance.ts` es una consolidación de esta etapa: el cálculo de distancia
entre dos puntos estaba **duplicado** en el contorno de Georgia y en el
servicio de ubicación de la empresa. Ahora está en un sitio, y esta etapa lo
usa en vez de añadir una tercera copia.

## 12. Pendiente para el usuario

- [ ] **Aplicar la migración** `20260930020000_address_coordinates`.
- [ ] **Poner `GEOCODING_PROVIDER=census` en Render.** Sin esto las
      coordenadas son inventadas y el fichaje de la Etapa 3.3 no significará
      nada.
- [ ] Tras el despliegue, comprobar en el registro que una dirección conocida
      cae donde debe (§9).
