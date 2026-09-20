# 03 — Integraciones con servicios externos

## Principio: adaptadores intercambiables

Todo proveedor externo se usa a través de una **interfaz** definida por el
proyecto, con al menos dos implementaciones: una simulada y una real. Se elige
con una variable de entorno.

Ventajas concretas:

- Se puede desarrollar y demostrar el sistema completo sin contratar nada.
- Los tests no dependen de internet ni gastan cuota.
- Cambiar de proveedor no obliga a tocar la lógica de negocio.
- Si el proveedor real falla, hay un camino claro para degradar el servicio.

---

## Distancia (implementado)

**Interfaz:** `apps/api/src/distance/distance.types.ts`
**Variable:** `DISTANCE_PROVIDER=mock | google`

### Modo `mock` (activo por defecto)

Estima las millas a partir del prefijo del código postal, con una tabla de
prefijos de Georgia y una variación estable derivada de un hash.

- **Determinista:** el mismo código postal da siempre la misma distancia. Es
  imprescindible: un cliente no puede ver dos precios distintos al recargar.
- **Realista:** los prefijos cubren todas las zonas (A, B, C, D y fuera de área),
  así que se puede probar el sistema entero.
- **Gratis y sin red.**

> No usar en producción: son aproximaciones, no rutas reales.

### Modo `google` (implementado, pendiente de validar con credenciales)

Usa **Routes API — Compute Route Matrix**, no el antiguo Distance Matrix, que
Google marcó como heredado (_legacy_). El precio es el mismo: 5 USD por cada
1.000 elementos, con 10.000 elementos gratuitos al mes. Cada cotización consume
**1 elemento** (un origen × un destino), así que una empresa pequeña se mantiene
dentro de la cuota gratuita.

Para activarlo:

1. Crear un proyecto en Google Cloud y habilitar **Routes API**.
2. Activar la facturación (obligatoria aunque se esté en la cuota gratuita).
3. Crear una clave de API y **restringirla** por API (solo Routes) y, si es
   posible, por IP del servidor.
4. En Render: `DISTANCE_PROVIDER=google` y `GOOGLE_MAPS_API_KEY=...`.

> **Honestidad sobre el estado:** este proveedor está escrito y compila, pero
> **no se ha ejecutado contra la API real** porque el proyecto no tiene
> credenciales. Antes de activarlo en producción hay que probarlo con una clave
> de prueba y confirmar el formato de la respuesta.

La clave vive **solo en el servidor**. Una clave de Maps expuesta en el
navegador puede ser usada por terceros y facturada a la empresa.

### Caché

`TtlCache` guarda los resultados 24 horas, con un máximo de 5.000 entradas. La
distancia entre dos códigos postales no cambia, así que la caché elimina casi
todo el gasto. El límite de entradas también es una medida de seguridad: sin él,
alguien podría agotar la memoria del servidor pidiendo cotizaciones con códigos
postales distintos.

---

## Pagos (implementado)

Mismo patrón que la distancia: una interfaz `PaymentProvider` y dos
implementaciones que se eligen con `PAYMENT_PROVIDER`.

### Modo `mock` (activo por defecto)

`MockPaymentProvider` simula el proveedor sin mover dinero. Permite desarrollar
y probar el flujo completo —reserva, retención, aviso, confirmación— sin cuenta
de Stripe.

No guarda estado a propósito: la fuente de verdad de lo que pasó con cada
depósito es nuestra tabla `payments`, no el simulador. Una simulación con
memoria en el proceso mentiría en cuanto la API se reiniciara.

Sus webhooks se firman con HMAC-SHA256 sobre el cuerpo crudo
(`PAYMENT_MOCK_WEBHOOK_SECRET`, cabecera `x-mock-signature`), así que la
verificación de firma se ejercita de verdad y no se queda sin probar hasta el
día en que se conecte Stripe.

> ⚠️ Con este modo activo en producción **no se retiene dinero real**. La API
> escribe un error en los registros en cada arranque para que no pase
> inadvertido.

### Modo `stripe` (implementado, pendiente de credenciales)

| Necesidad                               | Solución                                       |
| --------------------------------------- | ---------------------------------------------- |
| Retener el depósito sin cobrarlo        | `PaymentIntent` con `capture_method: 'manual'` |
| Cobrar al terminar                      | Captura (total o parcial) del mismo intento    |
| Cliente cancela con el equipo en camino | Se captura el depósito                         |
| Cobro presencial                        | Stripe Terminal (2,7 % + 0,05 USD)             |
| Pagar al personal por la plataforma     | Stripe Connect, solo si llega a hacer falta    |

Decisiones tomadas en la implementación:

- **Solo tarjeta** (`payment_method_types: ['card']`). Los demás métodos que
  ofrece Stripe no admiten retener y capturar después, que es justo lo que este
  depósito necesita.
- **No se fija `apiVersion` a mano.** La librería usa la versión con la que se
  generaron sus propios tipos, así que código y tipos no pueden desincronizarse
  al actualizar.
- **Clave de idempotencia derivada** de la reserva y el importe, no aleatoria:
  un reintento tras un fallo de red devuelve la retención que ya existe en vez
  de bloquear los fondos dos veces.
- **Estados sin colapsar.** `requires_action` (el banco pide verificar al
  titular) y `processing` (el banco aún decide) tienen su propio valor en el
  modelo. Guardar cualquiera de los dos como «pendiente de confirmar» haría que
  soporte leyera una situación distinta de la real.

Reglas que se respetan:

- **Nunca** se almacenan números de tarjeta. El navegador los envía
  directamente a Stripe con el `client_secret` (ámbito PCI mínimo, SAQ-A). Solo
  se guardan marca y últimos cuatro dígitos, y solo para mostrarlos.
- Todos los webhooks se verifican con `stripe.webhooks.constructEvent` sobre el
  **cuerpo crudo**. Un webhook sin verificar es una puerta abierta para
  falsificar pagos.
- Una retención solo se puede capturar una vez y no se puede aumentar: si el
  precio final supera lo autorizado, se cobra la diferencia aparte.
- Las retenciones caducan a los 7 días. El calendario de reservas lo tiene en
  cuenta (`PAYMENT_AUTHORIZATION_DAYS`).

El detalle del flujo y de la idempotencia está en
`docs/12-pagos-y-deposito.md`.

## Notificaciones (Etapa 3, no implementado)

- **SMS:** Twilio (~0,0079 USD por mensaje en EE. UU.).
- **Correo:** Resend (3.000 mensajes gratis al mes) o Amazon SES si el volumen
  crece mucho.
- Misma regla: interfaz `NotificationProvider` con implementación simulada que
  escriba en el log durante el desarrollo.

## Verificación de antecedentes (Etapa 4)

Práctica estándar del sector: búsqueda penal por condado de 7 años, base
nacional, registro de ofensores sexuales y verificación de identidad, conforme
a la FCRA. Coste aproximado 25-75 USD por contratación.

---

## Resumen de costes mensuales estimados

| Servicio        | Etapa 1 (hoy)         | Con reservas y pagos               |
| --------------- | --------------------- | ---------------------------------- |
| Render (API)    | ~7 USD (plan starter) | ~7-25 USD                          |
| Vercel (sitio)  | 0 USD                 | 0-20 USD                           |
| Supabase        | —                     | 0-25 USD                           |
| Google Routes   | 0 USD (modo simulado) | 0 USD dentro de la cuota           |
| Stripe          | —                     | Por transacción (2,9 % + 0,30 USD) |
| Twilio / Resend | —                     | Por uso                            |

> Verificar las tarifas en las páginas oficiales antes de contratar: cambian
> con frecuencia.
