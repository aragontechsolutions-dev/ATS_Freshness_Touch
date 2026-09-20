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

## Pagos — Stripe (Etapa 2, no implementado)

Plan acordado, documentado aquí para que la etapa siguiente no empiece de cero:

| Necesidad                               | Solución                                       |
| --------------------------------------- | ---------------------------------------------- |
| Retener el depósito sin cobrarlo        | `PaymentIntent` con `capture_method: 'manual'` |
| Cobrar al terminar                      | Captura (total o parcial) del mismo intento    |
| Cliente cancela con el equipo en camino | Se captura el depósito                         |
| Cobro presencial                        | Stripe Terminal (2,7 % + 0,05 USD)             |
| Pagar al personal por la plataforma     | Stripe Connect, solo si llega a hacer falta    |

Reglas que deberán respetarse:

- **Nunca** se almacenan números de tarjeta. Se usan los componentes de Stripe
  para que los datos no pasen por nuestro servidor (ámbito PCI mínimo, SAQ-A).
- Todos los webhooks se verifican con `stripe.webhooks.constructEvent`. Un
  webhook sin verificar es una puerta abierta para falsificar pagos.
- Una retención solo se puede capturar una vez y no se puede aumentar: si el
  precio final supera lo autorizado, se cobra la diferencia aparte.
- Las retenciones caducan a los 7 días (ampliables a 30 con autorizaciones
  extendidas). El calendario de reservas debe tenerlo en cuenta.

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
