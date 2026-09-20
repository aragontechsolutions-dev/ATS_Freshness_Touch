# 02 — Motor de precios

Todo lo descrito aquí vive en `packages/pricing/src/config.ts`. **Es el único
archivo que hay que tocar para cambiar precios.**

> ⚠️ Las tarifas iniciales se derivaron de rangos de mercado de Georgia
> (limpieza estándar 120-250 USD, profunda 180-700, mudanza 160-750,
> post-obra 280-900, Airbnb 90-320). **La dirección de Freshness Touch debe
> revisarlas y aprobarlas antes de publicar el sitio.** Son un punto de partida
> razonable, no una decisión comercial tomada.

## Fórmula del servicio

```
servicio = base + (habitaciones × tarifa_hab) + (baños × tarifa_baño)
                + (pies_cuadrados × tarifa_pie²)

si servicio < mínimo  →  se añade una línea visible de "ajuste al mínimo"
```

### Tarifas vigentes (en dólares)

| Servicio          |   Base | Por habitación | Por baño | Por pie² |          Mínimo |
| ----------------- | -----: | -------------: | -------: | -------: | --------------: |
| Estándar          |  65.00 |          12.00 |    15.00 |    0.030 |          120.00 |
| Profunda          |  95.00 |          20.00 |    25.00 |    0.055 |          180.00 |
| Mudanza           | 110.00 |          22.00 |    28.00 |    0.065 |          190.00 |
| Post-construcción | 160.00 |          28.00 |    35.00 |    0.095 |          280.00 |
| Rotación Airbnb   |  55.00 |          12.00 |    15.00 |    0.022 |           90.00 |
| Comercial         |      — |              — |        — |        — | requiere visita |

**Ejemplo:** casa estándar de 3 habitaciones, 2 baños y 1.800 pies²
→ `65 + 36 + 30 + 54 = 185.00 USD`, dentro del promedio del área de Atlanta.

## Extras

| Extra                     | Tipo                 | Precio |
| ------------------------- | -------------------- | -----: |
| Interior del refrigerador | fijo                 |  35.00 |
| Interior del horno        | fijo                 |  35.00 |
| Interior de gabinetes     | fijo                 |  45.00 |
| Ventanas por dentro       | por unidad (máx. 40) |   6.00 |
| Lavandería                | por carga (máx. 6)   |  20.00 |
| Sótano                    | fijo                 |  40.00 |
| Garaje                    | fijo                 |  45.00 |
| Pelo de mascotas          | fijo                 |  30.00 |
| Balcón o patio            | fijo                 |  25.00 |
| Ropa de cama              | por cama (máx. 10)   |  10.00 |

Los extras "por unidad" se recortan automáticamente a su máximo: pedir 999
ventanas cobra 40, no 999.

## Descuento por recurrencia

| Frecuencia     | Descuento |
| -------------- | --------: |
| Una vez        |       0 % |
| Mensual        |       5 % |
| Cada 2 semanas |      10 % |
| Semanal        |      15 % |

El descuento se aplica sobre **servicio + extras**, nunca sobre el recargo de
traslado: ese coste (combustible y tiempo del equipo) es real y no se descuenta.

## Zonas de servicio

Se calculan a partir de la distancia entre la base de operaciones y el código
postal del cliente.

| Zona           | Distancia        | Recargo | ¿Se atiende?         |
| -------------- | ---------------- | ------: | -------------------- |
| A              | hasta 20 millas  |    0.00 | Sí                   |
| B              | 20 a 35 millas   |   25.00 | Sí                   |
| C              | 35 a 50 millas   |   50.00 | Sí                   |
| D              | 50 a 60 millas   |   75.00 | Sí                   |
| Fuera de rango | más de 60 millas |       — | No: propuesta manual |

El objetivo operativo del sector es mantener el tiempo de traslado por debajo
del 15 % de las horas pagadas. Las zonas y el recargo existen para que los
trabajos lejanos sigan siendo rentables.

## Depósito por distancia

Es la característica diferencial del sistema: cubre el riesgo de que el cliente
cancele cuando el equipo ya está en camino.

```
millas_facturables = max(0, millas − radio_libre) × 2      (ida y vuelta)
depósito           = limitar(base + millas_facturables × tarifa_IRS, mín, máx)
```

| Parámetro       |      Valor |
| --------------- | ---------: |
| Componente base |  30.00 USD |
| Radio libre     |  20 millas |
| Mínimo          |  30.00 USD |
| Máximo          | 120.00 USD |

La **tarifa por milla es la del IRS vigente en la fecha del presupuesto**
(`packages/pricing/src/mileage.ts`), lo que da una justificación objetiva y
defendible ante el cliente:

| Vigencia         | Centavos por milla |
| ---------------- | -----------------: |
| Desde 2025-01-01 |               70.0 |
| Desde 2026-01-01 |               72.5 |
| Desde 2026-07-01 |               76.0 |

> Cuando el IRS publique una tarifa nueva, **añadir una entrada** a esa tabla.
> Nunca editar las anteriores: un presupuesto antiguo debe poder reproducirse
> con la tarifa que estaba vigente ese día.

**Ejemplo:** cliente a 45 millas → exceso 25 millas → 50 millas facturables
→ `30 + (50 × 0.76) = 68.00 USD` de depósito.

Dos protecciones adicionales:

- El depósito nunca supera el tope configurado (120 USD).
- El depósito **nunca supera el total del trabajo**: no se retiene más dinero
  del que cuesta el servicio.

## Impuesto sobre ventas

**Cero.** En Georgia los servicios de limpieza están exentos del _sales tax_
(O.C.G.A. §§ 48-8-2(31) y 48-8-30(f)(1)). El motor mantiene el campo
`taxRatePercent` configurable por si en el futuro se revenden productos, pero
hoy emite `taxCents: 0` y muestra el motivo al cliente.

## Casos que van a revisión manual

| Motivo                 | Comportamiento                                  |
| ---------------------- | ----------------------------------------------- |
| Servicio comercial     | No se da precio; se ofrece visita y propuesta   |
| Fuera del radio máximo | No se da precio; se invita a consultar          |
| Fuera de Georgia       | Se avisa; se marca para revisión                |
| Más de 6.000 pies²     | **Sí** se da precio, pero se marca para revisar |

## Cómo cambiar un precio

1. Editar `packages/pricing/src/config.ts`.
2. Ejecutar `pnpm test`. Si algún test falla con un importe distinto al
   esperado, es intencionado: actualizar el valor esperado en el test confirma
   que el cambio fue deliberado y no un descuido.
3. `pnpm build` y desplegar la API. El sitio web se actualiza solo, porque lee
   el catálogo del servidor.

## Validez

Los presupuestos caducan a los **7 días** (`validityDays`). La fecha de
caducidad se muestra al cliente.
