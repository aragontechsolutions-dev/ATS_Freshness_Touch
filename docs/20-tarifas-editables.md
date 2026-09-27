# 20 — Las tarifas salen del código

Los precios se editan desde el panel, y cada cambio queda guardado como una
versión que se puede volver a leer. Es la última pieza de la configuración.

---

## 1. La promesa que llevábamos sin cumplir

Esto está en el esquema desde el primer día, en `Quote` y en `Booking`:

```prisma
/// Version de la configuracion de precios usada. Sin esto, un presupuesto
/// antiguo no se puede reproducir despues de cambiar las tarifas.
pricingVersion String
```

Esa cadena se guarda en **cada cotización y cada reserva**, y se enseña en el
detalle de la reserva en el panel. Pero **no servía para reproducir nada**:
apuntaba a `packages/pricing/src/config.ts`, y de un archivo del código solo
existe su versión actual. La anterior está en el historial de Git, no en un
sitio del que la API pueda leer.

Mientras los precios se cambiaran con un despliegue, era tolerable. **En
cuanto se editan desde el panel, deja de serlo:** cambias un precio un martes
y el presupuesto que diste el lunes ya no se puede recalcular. Y eso no es una
pantalla, es facturación.

Por eso esta etapa no es «un formulario de precios». Es **un formulario de
precios y una tabla de solo añadir**, y lo segundo es lo que la hace correcta.

---

## 2. Qué se edita y qué no

| Se edita desde el panel                                   | Se queda en el código                 | Por qué                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Precio por servicio: base, dormitorio, baño, pie², mínimo |                                       | Es la decisión comercial                                                                                                          |
| Extras: importe y cantidad máxima                         |                                       | Ídem                                                                                                                              |
| Descuentos por recurrencia                                |                                       | Ídem                                                                                                                              |
| Regla del depósito                                        |                                       | Ídem                                                                                                                              |
|                                                           | **El servicio comercial**             | No da precio automático: se visita y se propone a mano. Cualquier cifra sería decorativa                                          |
|                                                           | **Si un extra es plano o por unidad** | Cambia el significado de su cantidad máxima y el de cada línea de los presupuestos anteriores. Es producto, no precio             |
|                                                           | **Las duraciones**                    | Afectan a la agenda, no al importe. En el mismo formulario esconderían el cambio caro entre veinte campos que casi nunca se tocan |
|                                                           | **Los límites de validación**         | Dormitorios, pies², número de extras. Tocarlos mal rompe el cotizador en silencio                                                 |
|                                                           | **El impuesto**                       | En Georgia la limpieza está exenta **por ley**, no por decisión de la empresa                                                     |

Hay una **guardia de compilación** para que esto no se pudra: si mañana se
añade un tipo de servicio, `packages/types/src/pricing-rates.ts` deja de
compilar hasta que alguien decida si se tarifa desde el panel o se queda en el
código. Sin ella, un servicio nuevo se quedaría callado con las tarifas del
código y nadie lo echaría de menos hasta ver una factura rara.

---

## 3. El contrato: topes e invariantes

Un precio equivocado **no rompe nada**. Cotiza, cobra y factura, con la cifra
mal, y no hay pantalla roja que avise. Lo único que se interpone entre un dedo
y una factura absurda son estas reglas.

### Los topes

El fallo realista no es un precio negativo: es **un cero de más**, teclear
120 000 donde iban 12 000. Cada campo tiene su tope, puesto **un orden de
magnitud por encima de cualquier cifra sensata del sector** y no pegado a los
precios actuales — un tope ajustado obligaría a tocar el código para subir un
precio, que es justo lo que esta etapa evita.

| Campo                 | Tope     |
| --------------------- | -------- |
| Cargo base y mínimo   | 10 000 $ |
| Por dormitorio o baño | 1 000 $  |
| Por pie cuadrado      | 1 $      |
| Un extra              | 1 000 $  |
| Descuento             | 50 %     |

### Las invariantes

Combinaciones donde **cada número por separado es válido y el conjunto no
significa nada**:

| Regla                                       | Qué evita                                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El mínimo no puede ser cero                 | El motor lo aplica como suelo. Sin suelo, una casa pequeña sin extras sale **gratis**                                                                                    |
| El descuento no baja al subir la frecuencia | Quien se compromete a una limpieza semanal pagaría proporcionalmente más que quien viene una vez al mes. Se pierde dinero en cada reserva recurrente y no lo delata nada |
| El mínimo del depósito no supera al máximo  | El depósito se recorta a ese intervalo; invertido, el resultado depende del orden en que se apliquen los dos límites                                                     |

El **depósito base sí puede quedar por debajo del mínimo**, y hay una prueba
que lo permite explícitamente: la base es un componente del cálculo, no el
resultado. Lo que se recorta es el total, ya con el recargo por distancia.

### Los mensajes son claves, no frases

Las tres invariantes llevan `admin.rates.errXxx` como mensaje. Es la lección
que dejaron los ajustes del negocio: **un mensaje escrito en el contrato acaba
apareciendo en español en un panel en inglés**, porque el contrato no sabe
quién lo está leyendo.

Para los topes no hay clave —son mensajes de Zod, técnicos y en inglés—, así
que la pantalla no los enseña: los traduce a _«Ese importe está fuera de lo
razonable. Revisa «Base»: ¿sobra un cero?»_. De un tope, lo útil no es el
límite exacto sino **qué campo** revisar.

---

## 4. La tabla de versiones

```prisma
model PricingTable {
  version       String   @id      // AAAA.MM.DD.n
  rates         Json
  createdAt     DateTime @default(now())
  createdBy     String?  @db.Uuid
  createdByName String?            // el nombre, como TEXTO
}
```

**Es de solo añadir.** Cada guardado escribe una fila nueva y ninguna se
actualiza ni se borra. Tampoco tiene purga automática, a diferencia de la
auditoría: la fila de 2026 sigue haciendo falta el día que se revise una
factura de 2026.

**El nombre de quien la puso va como texto** y no como referencia a su ficha:
quien subió un precio el año pasado puede haber causado baja, y «lo cambió
alguien que ya no está» no sirve de nada al revisar una factura.

**La versión la pone el servidor**, contando las que ya existen de ese día. Si
viniera en la petición, dos pestañas abiertas podrían mandar la misma y la
segunda machacaría a la primera — exactamente lo que una tabla de solo añadir
existe para impedir. Y se cuenta sobre las filas que hay, no sobre un contador
aparte: un contador es otro estado que se puede desincronizar de la tabla que
numera.

### La semilla

La primera fila la escribe **la API al primer uso**, con las tarifas del
código y **la versión que ya llevan las cotizaciones existentes**
(`2026.09.1`). Eso hace que la historia empiece sin agujero: todo lo cotizado
hasta hoy se puede resolver desde el primer momento.

No va en la migración a propósito: ponerla en SQL obligaría a repetir cada
importe en un `.sql`, y esa copia quedaría desfasada en cuanto alguien tocara
la configuración del código. **Dos fuentes para el mismo precio es justo el
fallo que esta etapa cierra.**

Si la escritura falla —base de solo lectura, permisos— no pasa nada: se
devuelven las tarifas del código igualmente y se reintenta en la siguiente
lectura. Una base caída no puede dejar al sitio sin precios.

---

## 5. Cómo llega al motor

```
PricingConfigService.current()
  ├── buildPricingConfig(entorno)   ← base de operaciones, límites, duraciones
  ├── applyPricingRates(…, tarifas) ← lo editable, de la tabla vigente
  ├── version: la de la tabla       ← lo que se congela en cada reserva
  └── zones: del área de servicio   ← etapa 2.18
```

`applyPricingRates` **no muta nada**: la configuración del código es un valor
compartido por todo el proceso, y escribir en ella haría que un cambio de
precios contaminara hasta las pruebas que usan los valores de partida.

Y conserva del código lo que no es tarifa: el `instantQuote` de cada servicio,
el `unit` de cada extra y el `ONE_TIME: 0` de los descuentos.

### Reproducir un presupuesto antiguo

`PricingConfigService.atVersion(version)` devuelve la configuración tal y como
estuvo. **Con una limitación que hay que decir:** las zonas **no** se
versionan, así que reproduce los precios de entonces con las zonas de hoy.
Para revisar una factura es lo que importa —el recargo por zona ya está
escrito en la reserva— pero no es un viaje completo en el tiempo.

### La caché

Treinta segundos, igual que el área de servicio y por lo mismo: el cotizador
resuelve precios en cada petición y sin caché una página de precios dispararía
una consulta por pulsación. **Al guardar se invalida en el acto**, sin esperar
sus treinta segundos: quien acaba de cambiar un precio va a comprobarlo en el
sitio ahora mismo.

---

## 6. La pantalla

**Solo ADMIN, también para leer.** Quien pueda abrirla decide cuánto factura
la empresa; y lo que hay dentro es la estructura de costes completa, que es lo
que un competidor querría. Coordinación organiza la agenda.

Tres decisiones de forma:

1. **Todo en dólares, salvo el precio por pie cuadrado.** Nadie piensa en
   centavos al fijar un precio, y un cero de más en un campo de centavos es un
   precio diez veces mayor que nadie revisa. El pie cuadrado es la excepción
   porque el sector **sí** piensa en centavos ahí —«cobramos tres centavos el
   pie»— y en dólares saldría 0,03.

2. **Un campo vacío es `NaN`, no cero.** Si se colara como cero, borrar un
   precio y guardar dejaría ese servicio a cero sin que nadie lo escribiera y
   el cotizador empezaría a regalar limpiezas. El esquema no lo atrapa
   —`z.number()` acepta `NaN`— así que se comprueba a mano antes de validar.

3. **Se dice que lo ya reservado no cambia**, en un aviso arriba del todo. Es
   la primera pregunta que hace cualquiera antes de tocar un precio, y no
   responderla en la pantalla lleva a no tocarlo o a llamar por teléfono.

Se valida en el navegador **con el mismo esquema que usa el servidor**. No por
desconfiar de él —vuelve a validar igual— sino para que el error salga antes
de guardar y diga cuál de las reglas se ha roto.

---

## 7. La auditoría

Acción propia, `pricing.updated`, y no `settings.updated`. Cambiar un precio
mueve dinero en **cada reserva posterior**: ante una reclamación la pregunta
es «quién subió este precio y cuándo», y eso se responde con un filtro, no
leyendo cincuenta cambios de teléfono.

Se registran **las cifras que cambiaron, no un volcado**:

```json
{
  "version": "2026.09.27.1",
  "previousVersion": "2026.09.1",
  "changes": { "DEEP.base": "9500 → 11000" }
}
```

Cuarenta números en cada fila, de los que treinta y nueve son iguales, no los
lee nadie.

---

## 8. Qué se comprueba

**19 pruebas contra PostgreSQL real** más **18 del contrato**. Las que
importan, por orden:

| Prueba                                                              | Qué protege                                                                                                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Subir el cargo base sube el precio de la siguiente cotización       | **El punto de toda la etapa.** Si se guarda pero el precio sigue saliendo del código, no se ha sacado nada del código |
| Una versión antigua se lee con **sus** precios                      | La promesa que el esquema lleva escrita desde el primer día                                                           |
| Guardar crea una versión nueva y no borra la anterior               | Que la tabla siga siendo de solo añadir                                                                               |
| La versión que se congela en cada reserva es la de la tabla vigente | Antes era siempre la del código, dijera lo que dijera la tabla                                                        |
| Coordinación recibe 403 al leer y al escribir                       | Quien fija precios                                                                                                    |
| Un rechazo no deja ninguna versión a medias                         | Que un 400 no ensucie el historial                                                                                    |
| El comercial sigue sin precio automático tras guardar               | Que `applyPricingRates` no toque lo que no debe                                                                       |
| La auditoría no incluye lo que no cambió                            | Que el registro se pueda leer                                                                                         |

### Comprobado en navegador

El panel entero contra la API real y PostgreSQL real, en claro, oscuro y a
390 px: se abre la pestaña, se sube la base de la limpieza estándar de 65 $ a
99 $, se guarda, y **la cotización pasa de 14 000 a 17 400 centavos** — los
3 400 de diferencia, exactos. La versión en pantalla pasa a `2026.09.27.1` con
«Ada Jefa» y la hora. Con un cero de más, la pantalla lo rechaza **sin llegar
a llamar a la API** y nombra el campo. Cero errores de consola.

---

## 9. Si mañana hay que tocar esto

- **No añadas un campo al formulario sin añadirlo al contrato.** El esquema es
  estricto: un campo de más se rechaza, no se ignora.
- **No conviertas la tabla en una fila que se sobrescribe.** Es lo que hace
  que `pricingVersion` signifique algo.
- **No subas un tope para que quepa un precio concreto** sin preguntarse
  antes si ese precio es real. Los topes están donde están para atrapar un
  dedo, no para molestar.
- Si hace falta versionar también las zonas, el sitio es este mismo modelo; y
  entonces `atVersion` podría reconstruir el cuadro completo.
