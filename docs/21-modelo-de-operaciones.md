# 21 — El modelo de operaciones

Cómo se cobra un trabajo: la tarifa por servicio y frecuencia, el depósito
fijo de 35 $, el traslado por milla y qué entra y qué no entra en una
limpieza.

Esta etapa **no cambia unas cifras: cambia la forma del motor**. Los números
viejos seguían cuadrando entre ellos; lo que dejó de encajar fue el modelo.

---

## 1. Lo que había, y por qué se cambió

|                                     | Antes                                                        | Ahora                                                      |
| ----------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| **Estándar**                        | `65 $ base + 12 $/dorm + 15 $/baño + 3¢/pie²`, mínimo 120 $  | **185 $** planos, y su propia tarifa por cadencia          |
| **Recurrencia**                     | Descuento en porcentaje (15 / 10 / 5 %)                      | **Tarifa propia**: 150 mensual, 135 quincenal, 120 semanal |
| **Profunda y mudanza**              | Fórmula por habitaciones                                     | **`max(250 $, 0,30 $/pie²)`**, solo puntual                |
| **Depósito**                        | Variable: 30 $ + millas × tarifa IRS, acotado entre 30 y 120 | **35 $ fijos**, descontados del total                      |
| **Distancia**                       | Cuatro anillos con recargo fijo (0 / 25 / 50 / 75 $)         | **35 millas incluidas**, y por encima las millas reales    |
| **Extras**                          | Diez                                                         | **Cuatro**: horno, nevera, gabinetes, ventanas por dentro  |
| **Servicios con precio automático** | Cinco                                                        | **Tres**: estándar, profunda y mudanza                     |

Cuatro de esos cambios son de modelo, no de cifra, y conviene tener escrito
por qué.

### 1.1 La recurrencia dejó de ser un descuento

Un descuento del 35 % obliga a hacer la cuenta para saber lo que se paga. Una
tarifa dice el precio: **«120 a la semana»**. Además, el descuento arrastraba
un problema real: cualquiera podía poner un 15 % mensual y un 5 % semanal, y
entonces quien más se compromete paga proporcionalmente más. Cada número era
válido por separado y el conjunto no significaba nada.

Ahora las cuatro cadencias son cuatro precios, y el contrato comprueba que
**el precio no sube al aumentar la frecuencia** (`ServiceRatesSchema`).

### 1.2 No hay umbral por tamaño: manda el mayor de los dos

La regla tal como se dijo era «hasta 809 pies² cuesta 250 $, por encima 0,30 $
el pie». Leída literalmente, **crea un escalón hacia abajo**: a 810 pies²
saldrían 243 $ y a 809, 250 $. La casa más grande, siete dólares más barata,
y nadie sabría explicarlo por teléfono. El hueco va de 810 a 833 pies².

Se implementó como **el mayor de los dos**:

```
precio = max(flatCents, centsPerSquareFoot × pies cuadrados)
```

Respeta exactamente lo que se pidió —hasta 833 pies² se pagan 250 $— y no
tiene escalón. Es la misma regla, dicha de una forma que no se contradice.

### 1.3 El traslado se cuenta por milla, no por franjas

Con franjas, dos casas separadas por una milla pagaban veinticinco dólares de
diferencia por caer a un lado u otro de una raya que el cliente no ve.

```
millasFacturables = max(0, millas − 35) × 2        (ida y vuelta)
recargo           = millasFacturables × centavos por milla
```

**Por defecto la tarifa es la del IRS**, y eso no es pereza: es una cifra
oficial y publicada (`packages/pricing/src/mileage.ts`, con fechas de
vigencia). Ante un cliente que discute el recargo hay algo que enseñar que no
se ha inventado la empresa. Se puede fijar una propia desde el panel.

### 1.4 El depósito es fijo y sale del total

35 $ que se **retienen** al reservar y se **acreditan** contra la factura. No
es un cargo extra: en una estándar puntual de 185 $, se retienen 35 y se
cobran 150 al terminar; a la cuenta llegan 185.

Lo único que hace el motor es acotarlo al total, por si algún día un trabajo
cuesta menos que el depósito.

---

## 2. Las tres bandas del área de servicio

Las cinco zonas con recargo pasaron a tres bandas sin recargo propio:

| Zona           | Hasta      | Qué significa                                                     |
| -------------- | ---------- | ----------------------------------------------------------------- |
| **A**          | 35 millas  | Dentro del radio incluido: **el traslado no se cobra**            |
| **B**          | 60 millas  | Se cobra el traslado por milla, **el precio sigue saliendo solo** |
| **C**          | 325 millas | El resto de Georgia: **se atiende, sin precio automático**        |
| `OUT_OF_RANGE` | —          | Más allá de la última. No se configura: no es una zona            |

**Las 35 millas de la zona A son el radio sin recargo, y no es casualidad.**
La frontera que el cliente nota es «me cobras el viaje o no», así que la zona
y el radio tienen que coincidir. El día que se muevan por separado, el mapa
dirá una cosa y la factura otra.

`D` y `E` siguen en el enumerado aunque no se usen: **están escritas en
reservas que ya existen** y borrarlas dejaría el histórico ilegible.

### 2.1 Las filas guardadas con el recargo antiguo

Hay áreas guardadas en `business_settings` con `surchargeCents` en cada zona.
El contrato es estricto —un campo de más se rechaza, no se ignora—, así que
sin hacer nada esas filas caerían enteras y la empresa volvería a las zonas
de partida **sin enterarse**: sus 60 millas configuradas se convertirían en
35, y con ellas el precio de cada reserva posterior.

`ServiceAreaService.leer()` limpia el campo retirado **antes** de validar
(`sinCamposRetirados`). Se hace al leer y no con una migración de datos
porque el valor es un JSON opaco para la base: en SQL habría que reescribirlo
a ciegas. Al guardar de nuevo desde el panel, la fila queda ya sin el campo.

---

## 3. El catálogo, recortado

### 3.1 Servicios

| Servicio          | Precio automático | Cadencias    |
| ----------------- | ----------------- | ------------ |
| Estándar          | Sí                | Las cuatro   |
| Profunda          | Sí                | Solo puntual |
| Mudanza           | Sí                | Solo puntual |
| Post-construcción | **No**            | —            |
| Rotación Airbnb   | **No**            | —            |
| Comercial         | **No**            | —            |

Los tres últimos se visitan y se proponen a mano. **No desaparecen del
enumerado**: su código está escrito en reservas que ya existen.

`estimateDurationMinutes` devuelve `0` para ellos, y es coherente: sin tarifa
automática no hay hueco que reservar hasta que alguien lo mire.

### 3.2 Extras

Cuatro: horno (50 $), nevera (50 $), gabinetes (25 $) y ventanas por dentro
(6 $ cada una, hasta 40).

Los otros seis —lavandería, sótano, garaje, pelo de mascotas, patio, ropa de
cama— **siguen en la configuración con `offered: false`**. El motor no los
cobra aunque vengan en la petición, y eso es deliberado: sin esa línea
alguien podría pedir por la API algo que el sitio ya no ofrece, y que quizá
el equipo ya no sabe hacer.

---

## 4. Qué se hace y qué no se hace

El sitio tiene una sección propia (`apps/landing/src/sections/ScopeOfWork.tsx`,
ancla `#scope`) con dos bloques y dos orígenes distintos **a propósito**:

- **Los servicios adicionales salen del catálogo**, no de una lista escrita a
  mano. Son los mismos que el cotizador ofrece y al mismo precio, porque son
  los mismos datos. Una lista escrita a mano se quedaría vieja el día que
  alguien tocara la pantalla de Tarifas, y el sitio estaría prometiendo un
  precio que el cotizador no da.
- **Lo que no se limpia es texto** (`scope.notIncluded.*` en `es.ts`/`en.ts`),
  y tiene que serlo: no es un producto que se pueda comprar, es una frontera
  del servicio.

Lo que no se limpia: patios, porches, ventanas por fuera, rieles de ventana,
platos y lavavajillas, paredes, refrigerador y gabinetes con cosas dentro,
mini hornos y freidoras de aire.

**Está en la página principal y no escondido en las condiciones**, y es
deliberado: casi todas las quejas de una limpieza salen de algo que el
cliente daba por incluido. Decirlo antes cuesta una sección y evita la
discusión entera, que siempre acaba costando más.

> **Pendiente de contenido.** Las listas de tareas por estancia —áreas
> comunes (11 tareas), baños (7) y cocina (7) de las plantillas de trabajo—
> todavía no están en el sitio. Cuando se transcriban, van como claves nuevas
> dentro de `scope` y se pintan en esta misma sección: no hace falta tocar
> el motor ni el catálogo.

---

## 5. Cómo se lee un presupuesto ahora

El orden importa, porque determina el resultado:

1. **Servicio**, según cadencia: `max(importe plano, precio por pie × pies)`.
2. **Extras**, saltando los que no se ofrecen.
3. **Traslado**: las millas que pasan del radio libre, ida y vuelta.
4. **Impuesto**: 0 en Georgia para servicios de limpieza.
5. **Depósito**: cifra fija, acotada al total.

`totals.discountCents` **se sigue declarando en cero**. No es un olvido: un
presupuesto antiguo y uno nuevo tienen así la misma forma y se pueden
comparar sin casos especiales.

### 5.1 Las dos razones de «esto lo vemos a mano»

No son lo mismo y la diferencia le importa mucho a quien la lee:

- `quote.review.farZone` — **vamos, te llamamos con el precio**. La zona se
  atiende pero no da precio automático.
- `quote.review.frequencyUnavailable` — **el servicio no se contrata así**.
  Una limpieza profunda no se hace cada semana porque la casa ya está
  profunda. Aquí la salida está en la misma pantalla: cambiar de frecuencia.

En el cotizador, las cadencias que un servicio no ofrece **aparecen apagadas**
en vez de dejar pulsar y contestar con un aviso: enseñar la puerta cerrada es
más honesto que dejar que alguien se estrelle contra ella. Y cambiar de
servicio devuelve la cadencia a «una vez», que todos los servicios con precio
automático ofrecen por contrato.

---

## 6. Qué se puede editar desde el panel

En **Tarifas** (solo ADMIN):

- El importe plano y el precio por pie cuadrado de cada servicio editable en
  cada una de las cuatro cadencias, y si esa cadencia **se ofrece**.
- El precio y la cantidad máxima de los cuatro extras.
- El depósito, el radio libre, los centavos por milla y si se cobra ida y
  vuelta.

En **Área de servicio** (solo ADMIN): el límite en millas de cada zona y si
da precio automático.

**Lo que NO se edita, y por qué:**

|                                      | Por qué                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| Que un servicio dé precio automático | Es una regla de negocio, no una tarifa                             |
| Si un extra es plano o por unidad    | Cambia el significado de cada línea de los presupuestos anteriores |
| Las duraciones                       | Afectan a la agenda, no al importe                                 |
| El impuesto                          | En Georgia la limpieza está exenta por ley                         |

---

## 7. Seguridad

Lo que se revisó al cerrar la etapa:

- **Quién puede cambiar precios.** `PUT /admin/pricing-rates` y
  `PUT /admin/service-area` son solo ADMIN: coordinación recibe 403 y sin
  sesión se recibe 401. Hay prueba de las tres salidas en los dos `e2e`.
- **Los topes siguen siendo la guardia principal.** El fallo realista no es
  un precio negativo, es **un cero de más**. Cada campo tiene un tope un
  orden de magnitud por encima de cualquier cifra sensata del sector.
- **Nada de lo que se puede teclear desborda el cálculo.** Los pies cuadrados
  están acotados a 20 000 por contrato y el precio por pie a 100 ¢, así que
  el máximo posible de una línea de servicio son 20 000 $. Las millas están
  acotadas a 500 y el centavo por milla a 500, así que el traslado máximo son
  4 650 $. No hay ninguna entrada libre que multiplique sin techo.
- **La auditoría guarda qué cambió, no un volcado.** `pricing.updated` lleva
  solo los campos que se movieron, con la cifra de antes y la de después. No
  hay datos personales, ni de tarjeta, en esa metadata.
- **Una tabla de precios no se borra nunca.** `pricing_tables` es de solo
  añadir, y tiene RLS activado como todas las tablas (lo comprueba
  `migrations.test.ts`).

---

## 8. Dónde está cada cosa

| Qué                        | Dónde                                            |
| -------------------------- | ------------------------------------------------ |
| La forma del modelo        | `packages/pricing/src/config.ts`                 |
| El cálculo                 | `packages/pricing/src/engine.ts`                 |
| El traslado                | `packages/pricing/src/travel.ts`                 |
| El depósito                | `packages/pricing/src/deposit.ts`                |
| El catálogo público        | `packages/pricing/src/catalog.ts`                |
| El contrato de lo editable | `packages/types/src/pricing-rates.ts`            |
| El contrato de las zonas   | `packages/types/src/service-area.ts`             |
| La pantalla de Tarifas     | `apps/admin/src/components/PricingRatesForm.tsx` |
| Qué se hace y qué no       | `apps/landing/src/sections/ScopeOfWork.tsx`      |

---

## 9. Lo que quedó sin resolver, y hay que saberlo

- **La estándar es plana: el tamaño no la cambia.** Un piso de 400 pies² y
  una casa de 3 000 pagan lo mismo. Puede ser deliberado —un precio simple,
  fácil de decir por teléfono— pero conviene tenerlo escrito, porque el día
  que una casa grande salga cara de limpiar no habrá nada en el sistema que
  lo explique.
- **Los precios por pie de las cadencias recurrentes no se usan.** El modelo
  elegido da a la estándar las cuatro cadencias y a la profunda solo la
  puntual, así que los 0,18 / 0,16 / 0,14 $ por pie que se mencionaron no
  tienen dónde aplicarse hoy. El contrato los admite: el día que la profunda
  se ofrezca mensual, el campo ya está.
- **Las listas de tareas por estancia**, según la sección 4.
