# 0006 — La idempotencia del webhook se decide por `processedAt`

**Estado:** aceptada · **Fecha:** 2026-09-20

## Contexto

Los proveedores de pago reenvían el mismo evento si no reciben un `2xx` a
tiempo. Sin protección, un reenvío de «el depósito quedó autorizado» podría
duplicar movimientos de dinero.

La tabla `webhook_events` tiene como clave primaria el identificador del evento,
y la solución evidente —la que estaba escrita en la documentación del modelo de
datos— era usarla como candado: si el `INSERT` falla por clave duplicada, es un
reenvío y se ignora.

## Decisión

Un evento se considera procesado **solo cuando tiene `processedAt`**, no por el
mero hecho de que exista su fila.

```
BEGIN
  pg_advisory_xact_lock(hashtext('webhook:' || id))   -- serializa entregas simultáneas
  SELECT processedAt ...                              -- ¿ya procesado? -> 200 y fuera
  INSERT/UPDATE webhook_events                        -- se registra el evento
  ... se aplica el efecto ...
  UPDATE webhook_events SET processedAt = now()
COMMIT
```

Si algo falla, la transacción se deshace **entera**, incluida la fila del
evento. El motivo se anota aparte, en una escritura fuera de la transacción.

## Razones

El esquema «la clave primaria es el candado» falla justo cuando más importa:
cuando el procesamiento **falla**. La fila ya está escrita, así que el reintento
del proveedor se tomaría por duplicado y **el evento se perdería para siempre**.

En la práctica eso significa una reserva pagada que nunca se confirma, o un
depósito rechazado que nunca cancela la cita: el fallo transitorio (base de
datos saturada, tiempo de espera agotado) se convierte en pérdida permanente.

## Alternativas descartadas

| Alternativa                              | Por qué no                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Clave primaria como candado              | Un fallo transitorio deja el evento sin procesar para siempre                        |
| Borrar la fila si el procesamiento falla | Pierde el rastro de qué falló y por qué; imposible investigar                        |
| Consultar el estado al proveedor         | Depende de que el proveedor esté disponible justo en ese momento; más lento y frágil |

## Consecuencias

- Hace falta el bloqueo por evento: sin él, dos entregas simultáneas verían las
  dos `processedAt` nulo y se procesarían por duplicado.
- `webhook_events.failureReason` tiene sentido de verdad: marca los eventos que
  fallaron y siguen pendientes, y sirve de cola de trabajo para investigarlos.
- Un evento que falle siempre (uno malformado, por ejemplo) se reintentará
  hasta que el proveedor se rinda. Es el comportamiento correcto: preferimos
  ruido en los registros a perder dinero en silencio.
