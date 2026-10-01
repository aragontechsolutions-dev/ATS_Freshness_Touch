# 26. La tabla de precios por tamaño de casa

> Etapa 3.4. El precio de una limpieza deja de salir de una fórmula y pasa a
> leerse de una tabla: una fila por tramo de pies cuadrados, igual que la hoja
> de cálculo del cliente.

---

## 1. Por qué una tabla y no una fórmula

Hasta ahora el precio salía de un importe plano y, en la profunda, unos
centavos por pie cuadrado; mandaba el mayor de los dos. Era una fórmula.

**La fórmula no describe lo que cobra esta empresa.** Sus precios suben a
saltos irregulares, hay tramos donde el precio se queda quieto mientras la
casa crece, y hay al menos un sitio donde baja. Ninguna recta pasa por esos
puntos.

Con la tabla, **lo que está escrito es exactamente lo que se cobra.**

## 2. Cómo se lee

| Columna                   | Qué es                                                      |
| ------------------------- | ----------------------------------------------------------- |
| `maxSquareFeet`           | El tope del tramo, inclusive                                |
| `deepCents`               | Profunda, mudanza de entrada y de salida (comparten precio) |
| `standardMonthlyCents`    | Estándar una vez al mes                                     |
| `standardBiweeklyCents`   | Estándar cada dos semanas                                   |
| `standardWeeklyCents`     | Estándar cada semana                                        |
| `windowsAndCabinetsCents` | El extra de ventanas y gabinetes interiores                 |

**Una casa toma el primer tramo cuyo tope la alcanza:**

```
casa de 1.000 pies  ->  tramo de 1.200   (en el hueco: SUBE)
casa de 1.200 pies  ->  tramo de 1.200
casa de 1.201 pies  ->  tramo de 1.400
casa de    300 pies ->  tramo de   900   (el mínimo de la tabla)
casa de  9.000 pies ->  NO HAY PRECIO    (ver §4)
```

> La regla de subir existe porque **la tabla del cliente tiene huecos**: de
> 900 salta a 1.200. Sin ella una casa de 1.000 pies no tendría precio.
> Subir nunca cobra de menos, que es el lado correcto del error cuando hay
> que elegir uno.

## 3. La estándar ya no se vende de una sola vez

La tabla del cliente solo le pone precio mensual, quincenal y semanal. **No es
que sea cara de una vez: es que no se vende así.** Quien quiere una limpieza
suelta contrata la profunda, que es práctica habitual del sector — la primera
limpieza de una casa siempre es profunda.

Pedir una estándar puntual por la API responde «elige otra frecuencia», no
«te llamamos»: son dos cosas distintas y el cotizador las distingue.

## 4. Por encima del último tramo no se inventa un precio

La tabla acaba en **6.900 pies**. Una casa más grande **no** se tarifa
extrapolando: nada dice que la progresión continúe, y a ese tamaño el error se
multiplica. Se recoge la solicitud y el precio se da tras ver la casa, por el
mismo camino que las zonas lejanas (`quote.review.beyondSizeTable`).

Ojo con no confundir dos cosas que se parecen:

- **Umbral de revisión (6.000 pies):** hay precio, y además se pide una
  mirada humana.
- **Final de la tabla (6.900 pies):** no hay precio.

Entre los dos queda una franja donde ocurren las dos cosas a la vez, y hay una
prueba para ella.

## 5. Ventanas y gabinetes, en un solo extra

La hoja del cliente los junta en una columna que **crece con la casa**, de $30
a $85, porque una casa grande tiene más ventanas. Así que ahora son un solo
extra, `WINDOWS_AND_CABINETS`, y su precio sale del tramo.

Los dos anteriores —`INTERIOR_WINDOWS` a $6 por unidad e `INSIDE_CABINETS` a
$25— **se apagan, no se borran**: sus códigos están escritos dentro del JSON de
cotizaciones y reservas que ya existen, y quitarlos haría ilegible un
presupuesto del mes pasado. Pedirlos por la API ya no los cobra.

El horno y la nevera siguen planos a $50: **limpiar un horno cuesta lo mismo en
un apartamento que en una mansión.**

## 6. Tres servicios retirados del sitio

La post-obra, el cambio de Airbnb y el comercial dejan de aparecer: ni en la
lista de servicios, ni en el cotizador, ni en el formulario de reserva.

Se apagan con un `offered: false` en la configuración y **el catálogo los
filtra ahí**, en un solo sitio, que es lo que hace que no se escapen por
ninguna pantalla. Tampoco se borran del enumerado, por la misma razón que los
extras.

> `offered` y `instantQuote` **no son lo mismo**: el primero decide si aparece,
> el segundo si lleva precio automático. Un servicio puede aparecer sin precio
> («te llamamos»), y eso es lo que eran estos tres hasta ahora.

## 7. Una incoherencia de la hoja, conservada a propósito

**La estándar mensual de 900 pies cuesta $160 y la de 1.200 cuesta $150: la
casa más grande paga diez dólares menos al mes.** Es la única columna donde el
precio baja al crecer la casa, y parece una errata del cliente.

**No se corrige.** Son sus precios, y arreglarlos en silencio sería cobrar algo
distinto de lo que dijo.

Esto tiene una consecuencia de diseño: **el contrato NO exige que el precio
suba con el tamaño.** Una invariante así rechazaría sus propios precios y le
impediría guardarlos desde el panel. Hay dos pruebas que dejan esto por
escrito, para que nadie lo «arregle» más adelante.

> **Pendiente de confirmar con el cliente.** Si era una errata, cambiar ese
> número es editar una celda en el panel.

## 8. Cómo se comprobó la transcripción

Veintiséis filas por cinco columnas son **130 números copiados a mano** de una
hoja de cálculo, y un dígito cambiado no rompe nada: cotiza, cobra y factura
con total normalidad.

Dos comprobaciones independientes, las dos automatizadas:

1. **Fila a fila**, cotizando en el tope de cada tramo y comparando con los
   números leídos de la hoja. Los números de la prueba se escribieron
   **leyendo la fuente, no copiando el código**: sacarlos de `config.ts` sería
   comprobar que un archivo es igual a sí mismo.
2. **La suma de toda la tabla da 47.275 dólares**, que es exactamente el total
   que mostraba Google Sheets con las ocho columnas seleccionadas. Un error
   compensado —dos dígitos que se anulan— es lo único que pasaría las dos.

## 9. Lo que sigue siendo editable desde el panel

**La tabla entera**, con la misma forma que la hoja del cliente: una fila por
tramo, y botones para añadir y quitar tramos. Las tarifas se siguen guardando
versionadas y ninguna se borra.

Lo que **no** es editable, y es deliberado:

- **Qué cadencias ofrece cada servicio.** Que la profunda no se contrate cada
  semana es producto, no una tarifa.
- **Qué servicios se ofrecen.** Lo mismo.
- **Si un extra cobra por tamaño.** Editable, el precio del horno podría pasar
  a leerse de la columna de ventanas sin que nadie lo pidiera.

### Las guardias del contrato

- Los tramos van en orden y sin repetirse. Con dos topes iguales, cuál gana
  dependería de cómo esté guardada la lista.
- Dentro de cada tramo, **semanal ≤ quincenal ≤ mensual**. Al revés se
  castigaría al cliente que más se compromete, y se perdería dinero en cada
  reserva recurrente sin que lo delatara ninguna pantalla.
- Topes de cordura por celda, que es lo que para el cero de más.

## 10. Una consecuencia que conviene saber

**Las tablas de tarifas guardadas con el modelo anterior ya no se pueden
leer.** Su JSON tiene `services` con importes planos, y el contrato nuevo
espera `sizeBands`.

En la práctica no afecta a nada: reproducir una versión antigua de tarifas solo
lo usaban las pruebas, y no hay ningún camino de producción que dependa de
ello. Pero es real, y la alternativa —reescribir las filas viejas con los
precios nuevos— sería peor: falsificaría el historial.

## 11. Dónde está

| Qué                  | Dónde                                            |
| -------------------- | ------------------------------------------------ |
| Contrato de la tabla | `packages/types/src/pricing-size-bands.ts`       |
| Los 26 tramos        | `packages/pricing/src/config.ts`                 |
| El motor             | `packages/pricing/src/engine.ts`                 |
| Prueba fila a fila   | `packages/pricing/src/size-bands.test.ts`        |
| Pantalla de Tarifas  | `apps/admin/src/components/PricingRatesForm.tsx` |
| Servicios del sitio  | `packages/pricing/src/catalog.ts`                |

## 12. Pendiente para el usuario

- [ ] **Confirmar con el cliente la incoherencia del §7** (mensual de 900 vs
      1.200 pies).
- [ ] Preguntarle qué significa **el asterisco** del tramo `5.800–6.000*` de su
      hoja: no se ve en la captura y de momento se ha tratado como un tramo
      normal.
- [ ] Redesplegar API y sitio. **No hace falta migración**: la tabla de precios
      es JSON en una columna que ya existe.
