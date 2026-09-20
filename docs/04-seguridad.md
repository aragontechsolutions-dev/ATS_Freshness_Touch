# 04 — Seguridad

Análisis de la Etapa 1. Se revisa y amplía en cada etapa nueva.

## Qué hay que proteger

En esta etapa el sistema **no almacena información personal**: el cotizador no
guarda nada. Lo que hay que proteger es, por tanto:

1. **La integridad del precio.** Si alguien puede manipular el importe, la
   empresa pierde dinero directamente.
2. **La disponibilidad del servicio.** Si la API cae o se satura, se pierden
   clientes potenciales.
3. **El coste de las APIs de pago.** Cada cotización puede consumir cuota
   facturable de Google.
4. **La confianza del visitante.** El sitio pide un código postal; debe hacerlo
   con las cabeceras y el cifrado correctos.

## Amenazas y controles

| #   | Amenaza                                                 | Control aplicado                                                                                     | Dónde                                |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Manipular el precio desde el navegador                  | El cálculo ocurre solo en el servidor; el front únicamente muestra                                   | `apps/api/src/quotes/`               |
| 2   | Inyectar campos no previstos (_mass assignment_)        | Esquemas Zod estrictos: cualquier clave desconocida rechaza la petición                              | `zod-validation.pipe.ts`             |
| 3   | Valores fuera de rango (−5 baños, 10⁹ pies²)            | Rangos declarados en el esquema y recorte de cantidades en el motor                                  | `packages/types`, `packages/pricing` |
| 4   | Abuso del endpoint para agotar la cuota de Google       | Doble límite por IP: 60/min general y 10/min en cotizaciones                                         | `app.module.ts`                      |
| 5   | Agotar la memoria con claves de caché distintas         | Caché con máximo de entradas y expulsión de la más antigua                                           | `ttl-cache.ts`                       |
| 6   | Cuerpos de petición enormes                             | Límite de 16 KB en el analizador JSON                                                                | `main.ts`                            |
| 7   | Uso de la API desde sitios de terceros                  | CORS con lista blanca explícita; sin comodines                                                       | `main.ts`                            |
| 8   | Filtración de detalles internos en errores              | Filtro global: solo código estable y clave de traducción; los detalles quedan en el log del servidor | `all-exceptions.filter.ts`           |
| 9   | Robo de la clave de Google                              | La clave solo existe en el servidor; nunca se envía al navegador                                     | `google-distance.provider.ts`        |
| 10  | Arrancar con configuración incorrecta                   | El entorno se valida con Zod al inicio; si falta algo, la aplicación no levanta                      | `common/config/env.ts`               |
| 11  | Ataques de encabezado y _clickjacking_                  | Helmet en la API; cabeceras de seguridad y CSP estricta en el sitio                                  | `main.ts`, `vercel.json`             |
| 12  | Scripts inyectados en la página                         | CSP con `script-src 'self'`, sin `unsafe-inline`                                                     | `vercel.json`                        |
| 13  | Rastreo de visitantes por terceros                      | Sin fuentes, analíticas ni recursos externos                                                         | `styles.css`, `index.html`           |
| 14  | Falsificación del identificador de petición en los logs | El id entrante solo se reutiliza si cumple un patrón seguro                                          | `request-id.middleware.ts`           |

## Privacidad desde el diseño

- **Minimización de datos.** El cotizador pide el **código postal**, no la
  dirección. Para estimar distancia y depósito es suficiente, y así no se
  recoge el domicilio de personas que todavía no son clientes.
- **Sin almacenamiento.** Ninguna cotización se guarda. No hay base de datos que
  filtrar ni que respaldar.
- **Registros sin datos personales.** Los logs guardan el identificador de
  petición, el proveedor de distancia y las millas; no el código postal junto al
  resto de datos de la cotización.
- **Sin terceros.** El sitio no carga fuentes de Google ni ninguna analítica, así
  que la visita no se comparte con nadie.

## Verificaciones realizadas

Comprobado en ejecución real contra la API levantada:

| Prueba                                               | Resultado                                                |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Campo desconocido `hackedPrice` en el cuerpo         | `400 VALIDATION_ERROR`, petición rechazada               |
| Código postal `ABC`                                  | `400`, campo señalado                                    |
| Servicio inexistente `FREE_CLEANING`                 | `400`                                                    |
| 12 cotizaciones seguidas desde la misma IP           | Las 10 primeras `200`, las siguientes `429 RATE_LIMITED` |
| El catálogo no se ve afectado por el límite estricto | `200`                                                    |
| Petición desde `https://sitio-malicioso.com`         | Sin cabecera de permiso: el navegador la bloquea         |
| Sitio servido desde un puerto no autorizado          | El catálogo no carga (CORS funcionando)                  |
| Cabeceras de la API                                  | CSP, `nosniff`, `Referrer-Policy`, HSTS presentes        |
| Sitio en navegador real                              | Sin errores de consola                                   |

## Incidente resuelto: la sonda de salud quedaba limitada

Detectado en los registros de Render, ya corregido. Merece quedar escrito
porque es un error fácil de repetir.

**Qué pasaba.** La API define dos limitadores con nombre propio, `global` y
`quotes`. El decorador `@SkipThrottle()` **sin argumentos no exime de nada**
cuando los limitadores tienen nombre: solo omite uno llamado `default`. Así que
la sonda de salud estaba sujeta al límite estricto de 10 peticiones por minuto.

**Consecuencia.** Render consulta `/health` cada 5 segundos, es decir 12 veces
por minuto. A partir de la petición 11 recibía `429` y daba el servicio por
caído, con reinicios en bucle de una API que funcionaba perfectamente.

**Arreglo.** Los nombres de los limitadores viven ahora en una sola lista
(`src/common/throttling.ts`) y la exención se **deriva** de ella. Añadir un
limitador nuevo lo incluye automáticamente, así que el error no se puede
repetir por olvido.

**Lección.** Los tests unitarios no podían detectarlo: el fallo estaba en cómo
interactúan el guardia, los decoradores y las rutas. Por eso se añadieron
pruebas que levantan la aplicación entera y le hacen peticiones HTTP reales,
incluida una que llama 30 veces a la sonda y exige que todas respondan 200.

## Pendiente (etapas siguientes)

Cuando entren autenticación, datos de clientes y pagos:

- Autenticación con Supabase y control de acceso por rol (cliente, personal,
  administración) en guardas del servidor, con RLS activado como segunda capa.
- Cifrado y control de acceso de la información de clientes y direcciones.
- URLs firmadas y de corta duración para las fotos de los trabajos, con
  consentimiento explícito para las fotos de antes y después.
- Verificación de firma en todos los webhooks de Stripe.
- Nunca almacenar números de tarjeta: tokenización con Stripe (ámbito PCI SAQ-A).
- Sesiones cortas con rotación de tokens y revocación al cerrar sesión.
- Registro de auditoría para las acciones administrativas.
- Copias de seguridad y prueba de restauración.

## Cómo revisar la seguridad al añadir algo nuevo

Lista de comprobación para cada funcionalidad futura:

1. ¿Qué datos nuevos se reciben? ¿Están validados con un esquema estricto?
2. ¿Qué datos nuevos se guardan? ¿Son imprescindibles? ¿Quién puede leerlos?
3. ¿El endpoint necesita autenticación? ¿Y autorización por rol?
4. ¿Puede alguien abusar de él para gastar dinero de la empresa?
5. ¿Los mensajes de error revelan algo que no deberían?
6. ¿Hay algún secreto que pueda acabar en el paquete del navegador?
7. ¿Qué pasa si el servicio externo del que depende falla o tarda?
