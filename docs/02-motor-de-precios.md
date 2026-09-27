# 02 — Motor de precios

Cómo se calcula un presupuesto, número a número.

> **Las cifras de este documento son las de partida** (`packages/pricing/src/config.ts`).
> Desde la Etapa 2.22 **los precios se editan desde el panel** y se guardan en
> la tabla `pricing_tables`, así que lo que cobra la empresa hoy puede no ser
> lo que se lee aquí: esto es la semilla y el modelo, no la verdad vigente.
> Ver `docs/20-tarifas-editables.md` (cómo se editan y versionan) y
> `docs/21-modelo-de-operaciones.md` (por qué el modelo es este).

---

## 1. La fórmula del servicio

Cada servicio tiene una tarifa **por cadencia**, y en cada una manda el mayor
de dos números:

```
servicio = max(importe_plano, centavos_por_pie² × pies_cuadrados)
```

**Por qué el mayor y no un umbral por tamaño.** Con un umbral —«hasta 809
pies² lo plano, por encima por pie»— aparece un escalón hacia abajo: a 810
pies² saldrían 243 $ y a 809, 250 $. La casa más grande, siete dólares más
barata, y nadie sabría explicarlo por teléfono. Con el máximo no hay escalón
y la regla dice lo mismo.

`null` en una cadencia significa **que el servicio no se ofrece así**, y no es
lo mismo que un precio alto: una limpieza profunda no se contrata cada semana
porque la casa ya está profunda.

### Tarifas de partida (importe plano, en dólares)

| Servicio | Una vez | Mensual | Cada 2 semanas | Semanal | Por pie² |
| --- | ---: | ---: | ---: | ---: | ---: |
| Estándar | 185.00 | 150.00 | 135.00 | 120.00 | — |
| Profunda | 250.00 | — | — | — | 0.30 |
| Mudanza | 250.00 | — | — | — | 0.30 |
| Post-construcción | requiere visita | | | | |
| Rotación Airbnb | requiere visita | | | | |
| Comercial | requiere visita | | | | |

**La estándar es plana: el tamaño no la cambia.** Un piso de 400 pies² y una
casa de 3 000 pagan lo mismo. Es deliberado —es el precio que se dice por
teléfono sin preguntar nada— pero conviene tenerlo escrito.

**El contrato comprueba que el precio no sube al aumentar la frecuencia.** Es
la invariante del conjunto: cada número por separado puede ser válido y los
cuatro juntos no significar nada.

---

## 2. Extras

| Extra | Tipo | Precio |
| --- | --- | ---: |
| Interior del horno | fijo | 50.00 |
| Interior del refrigerador | fijo | 50.00 |
| Interior de gabinetes | fijo | 25.00 |
| Ventanas por dentro | por unidad (máx. 40) | 6.00 |

Los "por unidad" se recortan a su máximo: pedir 999 ventanas cobra 40, no 999.

Hay seis extras más en la configuración —lavandería, sótano, garaje, pelo de
mascotas, patio, ropa de cama— **marcados como no ofrecidos**. El motor no los
cobra aunque vengan en la petición: su código sigue existiendo solo para poder
releer presupuestos antiguos.

---

## 3. Traslado

```
millas_facturables = max(0, millas − radio_libre) × 2      (ida y vuelta)
recargo            = millas_facturables × centavos_por_milla
```

| Parámetro | Valor de partida |
| --- | ---: |
| Radio libre | 35 millas |
| Ida y vuelta | sí |
| Centavos por milla | la tarifa del IRS |

**Por milla y no por escalones.** Antes había franjas con recargos fijos —25,
50, 75 dólares—, así que dos casas separadas por una milla podían pagar
veinticinco dólares de diferencia por caer a un lado u otro de una raya que el
cliente no ve.

La **tarifa por milla por defecto es la del IRS vigente en la fecha del
presupuesto** (`packages/pricing/src/mileage.ts`), lo que da una justificación
objetiva y defendible ante el cliente:

| Vigencia | Centavos por milla |
| --- | ---: |
| Desde 2025-01-01 | 70.0 |
| Desde 2026-01-01 | 72.5 |
| Desde 2026-07-01 | 76.0 |

> Cuando el IRS publique una tarifa nueva, **añadir una entrada** a esa tabla.
> Nunca editar las anteriores: un presupuesto antiguo debe poder reproducirse
> con la tarifa que estaba vigente ese día.

Se puede fijar una tarifa propia desde el panel, y entonces esa manda.

**Ejemplo:** cliente a 50 millas → 15 de exceso → 30 facturables →
`30 × 0.76 = 22.80 USD`.

---

## 4. Zonas de servicio

Tres bandas, que salen de la base de datos y se editan desde el panel
(`docs/17-area-de-servicio.md`).

| Zona | Distancia | ¿Se atiende? | ¿Precio automático? |
| --- | --- | --- | --- |
| A | hasta 35 millas | Sí | Sí |
| B | hasta 60 millas | Sí | Sí |
| C | hasta 325 millas | Sí | **No**: se da en persona |
| Fuera de rango | más allá | No | — |

**Las 35 millas de la zona A son el radio sin recargo**, y tienen que
coincidir: la frontera que el cliente nota es «me cobras el viaje o no».

Cubrir Georgia entera significa atender hasta unas 300 millas. A esa distancia
el traslado —ocho horas de coche ida y vuelta— pesa más que la limpieza, y
ninguna tabla acierta a ciegas: por eso la zona C se atiende **sin** precio
automático.

---

## 5. Depósito

**35 dólares fijos**, que se retienen al reservar y se **acreditan contra la
factura final**. No es un cargo extra.

En una estándar puntual de 185 $: se retienen 35 al reservar, se cobran 150 al
terminar, y a la cuenta de la empresa llegan 185.

Solo tiene una protección: **nunca supera el total del trabajo**. No se retiene
más dinero del que cuesta el servicio.

Cubre el riesgo de que el cliente cancele con el equipo ya en camino, o de que
no se pueda entrar en la casa.

---

## 6. Impuesto sobre ventas

**Cero.** En Georgia los servicios de limpieza están exentos del _sales tax_
(O.C.G.A. §§ 48-8-2(31) y 48-8-30(f)(1)). El motor mantiene el campo
`taxRatePercent` configurable por si en el futuro se revenden productos, pero
hoy emite `taxCents: 0` y muestra el motivo al cliente.

---

## 7. Orden de cálculo

Importa, porque determina el resultado:

1. **Servicio**, según cadencia.
2. **Extras**, saltando los que no se ofrecen.
3. **Traslado**.
4. **Impuesto**.
5. **Depósito**, calculado sobre el total.

`totals.discountCents` se sigue declarando en cero aunque ya no haya paso de
descuento: así un presupuesto antiguo y uno nuevo tienen la misma forma y se
pueden comparar sin casos especiales.

---

## 8. Casos que van a revisión manual

| Motivo | Comportamiento |
| --- | --- |
| Servicio sin precio automático | No se da precio; se ofrece visita y propuesta |
| Zona atendida sin precio automático | **Se atiende**, pero el precio se da en persona |
| Fuera del radio máximo | No se atiende; se invita a consultar |
| Fuera de Georgia | Se avisa; se marca para revisión |
| Más de 6.000 pies² | **Sí** se da precio, pero se marca para revisar |
| El servicio no se ofrece en esa cadencia | No se da precio; la salida es elegir otra frecuencia |

Las dos últimas filas son nuevas y la distinción importa: «no vamos», «vamos y
te llamamos con el precio» y «elige otra frecuencia» son tres respuestas
distintas para quien está pidiendo un presupuesto.

---

## 9. Cómo cambiar un precio

**Desde el panel** (lo normal): *Configuración → Tarifas*. Solo ADMIN. Cada
guardado crea una versión nueva y ninguna se borra. Ver
`docs/20-tarifas-editables.md`.

**En el código** (solo para cambiar el punto de partida de una instalación
nueva):

1. Editar `packages/pricing/src/config.ts`.
2. Ejecutar `pnpm test`. Si un test falla con un importe distinto al esperado,
   es intencionado: actualizar el valor esperado confirma que el cambio fue
   deliberado y no un descuido.
3. `pnpm build` y desplegar la API. El sitio se actualiza solo, porque lee el
   catálogo del servidor.

---

## 10. Validez

Los presupuestos caducan a los **7 días** (`validityDays`). La fecha de
caducidad se muestra al cliente.
