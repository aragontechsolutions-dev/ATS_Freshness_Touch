# 0005 — La cotización pide solo el código postal

**Estado:** aceptada · **Fecha:** 2026-09-20

## Contexto

Para calcular la distancia y el depósito hace falta saber dónde está el
inmueble. La opción evidente era pedir la dirección completa.

## Decisión

En la fase de cotización se pide **únicamente el código postal**. La dirección
completa se recoge al confirmar la reserva (Etapa 2).

## Razones

1. **Minimización de datos.** Una persona que solo está mirando precios no tiene
   por qué entregar su domicilio. Menos datos recogidos es menos riesgo.
2. **Conversión.** Cada campo de un formulario reduce la tasa de finalización.
   Pedir la dirección para "ver un precio" espanta visitantes.
3. **Precisión suficiente.** La diferencia entre el centro de un código postal y
   una casa concreta es de pocas millas, irrelevante para un depósito que se
   calcula por tramos y se acredita íntegro contra la factura.

## Consecuencias

- El presupuesto se marca como **estimado** y se avisa al cliente de que la
  distancia se confirma con la dirección completa
  (`quote.disclaimer.distanceEstimated`).
- La caché de distancias es mucho más eficaz: hay miles de direcciones por
  código postal, pero un solo código postal por consulta.
- En la Etapa 2, al conocer la dirección, se recalculará la distancia real antes
  de retener el depósito.
