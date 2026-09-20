# 0003 — El dinero se maneja en centavos enteros

**Estado:** aceptada · **Fecha:** 2026-09-20

## Contexto

El sistema calcula precios, descuentos porcentuales, recargos y depósitos, y en
la Etapa 2 cobrará de verdad a través de Stripe.

## Decisión

Todo importe monetario es un **entero de centavos**. Los nombres de campo
terminan en `Cents`. La conversión a texto ("$185.00") ocurre solo al mostrar.

## Razón

La aritmética de coma flotante no representa exactamente los decimales:
`0.1 + 0.2` no es `0.3`. Aplicado a descuentos del 10 % sobre decenas de líneas,
el error se acumula y produce facturas que no cuadran con lo cobrado. Es un
error clásico y caro en software de facturación.

Además, Stripe trabaja en centavos, así que no hay conversión en la frontera.

## Consecuencias

- El redondeo ocurre en un solo sitio y de forma explícita (`roundCents`,
  `percentOfCents`).
- Los tests comprueban que los totales son enteros y que la suma de las líneas
  coincide exactamente con el total.
- El formato depende del idioma y se resuelve con `Intl.NumberFormat`.
