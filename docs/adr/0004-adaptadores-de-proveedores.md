# 0004 — Proveedores externos detrás de una interfaz

**Estado:** aceptada · **Fecha:** 2026-09-20

## Contexto

El sistema depende de servicios de pago por uso: distancia (Google), pagos
(Stripe), SMS (Twilio) y correo (Resend). Al empezar el proyecto no había
cuentas contratadas de ninguno.

## Decisión

Cada proveedor externo se usa a través de una **interfaz definida por el
proyecto**, con al menos dos implementaciones —una simulada y una real— que se
eligen con una variable de entorno.

Implementado hoy: `DistanceProvider` con `MockDistanceProvider` y
`GoogleDistanceProvider`, seleccionados por `DISTANCE_PROVIDER`.

## Consecuencias

- El cotizador completo funciona y se puede demostrar **sin contratar Google**.
- Los tests no dependen de internet ni consumen cuota facturable.
- Cambiar de proveedor no toca la lógica de negocio.
- El proveedor simulado es **determinista**: el mismo código postal da siempre
  la misma distancia. Sin eso, un cliente podría ver precios distintos al
  recargar la página.

## Riesgo asumido

El proveedor de Google está escrito pero **no se ha ejecutado contra la API
real** por falta de credenciales. Antes de activarlo en producción hay que
probarlo con una clave de prueba y confirmar el formato de la respuesta. Queda
anotado en el código y en `docs/03-integraciones.md`.
