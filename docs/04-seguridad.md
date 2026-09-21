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

| #   | Amenaza                                                         | Control aplicado                                                                                         | Dónde                                      |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Manipular el precio desde el navegador                          | El cálculo ocurre solo en el servidor; el front únicamente muestra                                       | `apps/api/src/quotes/`                     |
| 2   | Inyectar campos no previstos (_mass assignment_)                | Esquemas Zod estrictos: cualquier clave desconocida rechaza la petición                                  | `zod-validation.pipe.ts`                   |
| 3   | Valores fuera de rango (−5 baños, 10⁹ pies²)                    | Rangos declarados en el esquema y recorte de cantidades en el motor                                      | `packages/types`, `packages/pricing`       |
| 4   | Abuso del endpoint para agotar la cuota de Google               | Doble límite por IP: 60/min general y 10/min en cotizaciones                                             | `app.module.ts`                            |
| 5   | Agotar la memoria con claves de caché distintas                 | Caché con máximo de entradas y expulsión de la más antigua                                               | `ttl-cache.ts`                             |
| 6   | Cuerpos de petición enormes                                     | Límite de 16 KB en el analizador JSON (64 KB en el webhook de pagos), con respuesta `413` y no `500`     | `common/body-parsers.ts`                   |
| 7   | Uso de la API desde sitios de terceros                          | CORS con lista blanca explícita; sin comodines                                                           | `main.ts`                                  |
| 8   | Filtración de detalles internos en errores                      | Filtro global: solo código estable y clave de traducción; los detalles quedan en el log del servidor     | `all-exceptions.filter.ts`                 |
| 9   | Robo de la clave de Google                                      | La clave solo existe en el servidor; nunca se envía al navegador                                         | `google-distance.provider.ts`              |
| 10  | Arrancar con configuración incorrecta                           | El entorno se valida con Zod al inicio; si falta algo, la aplicación no levanta                          | `common/config/env.ts`                     |
| 11  | Ataques de encabezado y _clickjacking_                          | Helmet en la API; cabeceras de seguridad y CSP estricta en el sitio                                      | `main.ts`, `vercel.json`                   |
| 12  | Scripts inyectados en la página                                 | CSP con `script-src 'self'`, sin `unsafe-inline`                                                         | `vercel.json`                              |
| 13  | Rastreo de visitantes por terceros                              | Sin fuentes, analíticas ni recursos externos. El único dominio ajeno es Stripe, y solo al pagar          | `styles.css`, `index.html`                 |
| 14  | Falsificación del identificador de petición en los logs         | El id entrante solo se reutiliza si cumple un patrón seguro                                              | `request-id.middleware.ts`                 |
| 15  | **Confirmar reservas sin pagar falsificando un webhook**        | Firma sobre el cuerpo crudo, comprobada antes de tocar la base de datos y comparada en tiempo constante  | `payments/webhooks.controller.ts`          |
| 16  | Duplicar movimientos de dinero reenviando un evento             | Idempotencia por `processedAt` más bloqueo por evento; un fallo deshace la transacción entera            | `payments/webhooks.service.ts`             |
| 17  | Descubrir qué identificadores de pago existen                   | El webhook responde siempre lo mismo, se reconozca el pago o no                                          | `payments/webhooks.controller.ts`          |
| 18  | Manipular el importe del depósito                               | Lo calcula el motor en el servidor; el navegador nunca envía importes                                    | `bookings/bookings.service.ts`             |
| 19  | Robo de datos de tarjeta                                        | Nunca pasan por nuestro servidor; solo se guardan marca y últimos cuatro dígitos                         | `payments/`                                |
| 20  | **Confirmar reservas con el atajo del simulador**               | Con un proveedor real la ruta responde 404, indistinguible de una que no existe; hay un test dedicado    | `payments/mock-payments.controller.ts`     |
| 21  | Scripts de terceros al abrir el formulario de reserva           | Stripe.js se importa desde `/pure`: solo se descarga si de verdad se va a pagar                          | `booking/StripePaymentForm.tsx`            |
| 22  | Manipular la reserva desde el navegador                         | El cuerpo no lleva importes; precio, distancia y franja se recalculan en el servidor                     | `bookings/bookings.service.ts`             |
| 23  | **Entrar al panel con un token valido de quien no es personal** | Un token solo prueba identidad; la autoridad la da la ficha en `staff`, y solo si sigue activa           | `auth/auth.service.ts`                     |
| 24  | Olvidar proteger un endpoint de administracion nuevo            | La guarda es global y se activa por la ruta: todo lo que cuelga de /admin nace cerrado                   | `auth/admin.guard.ts`                      |
| 25  | Reutilizar un token de otro proyecto o de `service_role`        | Se comprueban emisor y audiencia, que la libreria NO comprueba si no se le piden                         | `auth/providers/`                          |
| 26  | Un token sin caducidad, imposible de revocar                    | Se exige que `exp` exista, no solo que se cumpla                                                         | `auth/providers/local-auth.provider.ts`    |
| 27  | Confusion de algoritmos con la clave publica                    | Un solo modo de verificacion activo: claves asimetricas O secreto heredado, nunca los dos                | `auth/providers/supabase-auth.provider.ts` |
| 28  | Descargar la base de clientes de un tiron                       | Tope duro de 100 por pagina, y el listado no lleva calle ni instrucciones de acceso                      | `admin/bookings-admin.service.ts`          |
| 29  | Arrancar en produccion con identidad simulada                   | La aplicacion se NIEGA A ARRANCAR, en vez de avisar en un registro que nadie lee                         | `common/config/env.ts`                     |
| 30  | **Desviar el telefono publico de la empresa**                   | Solo ADMIN puede guardar la configuracion; coordinacion recibe 403 aunque llame al endpoint directamente | `admin/settings-admin.controller.ts`       |
| 31  | Colar otro esquema de URL en el enlace de llamar                | El telefono se valida contra E.164 (`+` y digitos): no hay forma de escribir `javascript:`               | `packages/types/src/business-settings.ts`  |
| 32  | Filtrar quien cambio la configuracion por el endpoint publico   | El publico devuelve solo telefono, correo y horario; autoria y fecha solo salen en la ruta de ADMIN      | `settings/business-settings.controller.ts` |
| 33  | Tumbar el sitio publico con una fila de configuracion corrupta  | La lectura NUNCA falla: ante cualquier problema sirve los valores de partida y avisa en el log           | `settings/business-settings.service.ts`    |

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

| Prueba                                               | Resultado                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| Campo desconocido `hackedPrice` en el cuerpo         | `400 VALIDATION_ERROR`, petición rechazada                   |
| Código postal `ABC`                                  | `400`, campo señalado                                        |
| Servicio inexistente `FREE_CLEANING`                 | `400`                                                        |
| 12 cotizaciones seguidas desde la misma IP           | Las 10 primeras `200`, las siguientes `429 RATE_LIMITED`     |
| El catálogo no se ve afectado por el límite estricto | `200`                                                        |
| Petición desde `https://sitio-malicioso.com`         | Sin cabecera de permiso: el navegador la bloquea             |
| Sitio servido desde un puerto no autorizado          | El catálogo no carga (CORS funcionando)                      |
| Cabeceras de la API                                  | CSP, `nosniff`, `Referrer-Policy`, HSTS presentes            |
| Sitio en navegador real                              | Sin errores de consola                                       |
| Coordinación intenta guardar la configuración        | `403`, y lo guardado no cambia                               |
| `javascript:alert(1)` como teléfono de la empresa    | `400`; ninguna variante llega a escribirse                   |
| Endpoint público de configuración                    | No devuelve autoría ni fecha de cambio                       |
| Fila de configuración corrupta a propósito           | El sitio y la agenda siguen sirviendo los valores de partida |
| Sitio con la API caída (toda petición cortada)       | Se pinta entero, sin teléfono y sin un solo error            |

> **Sobre CORS.** Dos fallos de esta familia han llegado a producción-en-pruebas
> en este proyecto: faltaba la cabecera `Authorization` (Etapa 2.3, bloque 2) y
> faltaba el método `PUT` (bloque 3). Ninguno de los dos lo detectan `curl` ni
> las pruebas de la API, porque **no hacen preflight**: el navegador bloquea la
> petición y la aplicación solo ve «no se pudo contactar con el servidor».
> Cualquier método o cabecera nueva que use el panel hay que añadirla en
> `main.ts` y probarla en un navegador de verdad.

## Seguridad de la base de datos

### El problema: Supabase publica las tablas por su cuenta

Supabase expone **automáticamente** por API REST todas las tablas del esquema
`public`. Cualquiera con la clave pública del proyecto —que es pública por
diseño y acaba en el navegador— puede leerlas y escribirlas **saltándose por
completo nuestra API y sus comprobaciones**.

En este sistema eso expondría datos de clientes, importes de pagos y, lo más
grave, `addresses.accessNotes`: códigos de puerta y dónde está la llave.

Las tablas se crearon sin esa protección (Supabase las marca como
`UNRESTRICTED`) y la migración `20260920170000_enable_rls` la activa.

### Modelo de acceso

> **Todo pasa por la API. Nadie habla con la base de datos directamente.**

La API se conecta con el rol **propietario** de las tablas. En PostgreSQL el
propietario no se ve afectado por las políticas de fila mientras no se active
`FORCE`, así que activar la seguridad no le quita acceso. Los roles públicos de
Supabase (`anon`, `authenticated`), en cambio, se quedan sin nada.

Por eso la seguridad se activa **sin crear ninguna política**: eso significa
"denegar a todos salvo al propietario", que es exactamente lo que se quiere
mientras la API sea el único camino de entrada.

### Dos capas, no una

| Capa                                              | Qué hace                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Seguridad a nivel de fila activada, sin políticas | Deniega a cualquier rol que no sea el propietario                                 |
| Permisos retirados a `anon` y `authenticated`     | Aunque alguien creara una política por error, sin permisos de tabla no hay acceso |

La segunda capa incluye `ALTER DEFAULT PRIVILEGES`, de modo que **las tablas
futuras tampoco nacen accesibles**.

### El guardia contra el olvido

Activar la protección una vez no sirve si la siguiente tabla nace sin ella. Hay
tres tests que lo impiden (`src/database/migrations.test.ts`):

1. **Todas las tablas tienen la seguridad activada.** Si falta alguna, la CI se
   pone en rojo y el mensaje imprime la línea `ALTER TABLE ... ENABLE ROW LEVEL
SECURITY;` exacta que hay que añadir.
2. **Ninguna usa `FORCE`**, que dejaría fuera a la propia API.
3. **No hay ninguna política**, para que abrir una puerta directa tenga que ser
   una decisión deliberada y revisada, no algo copiado de un tutorial.

Comprobado que el guardia funciona de verdad: al añadir una tabla sin proteger,
el test falla e indica la línea que falta.

## Seguridad del almacenamiento de archivos

Supabase Storage **todavía no se usa**: las fotos de los trabajos llegan en la
Etapa 3. Se dejan escritas las reglas ahora para que no se improvisen después.

Estado actual: Supabase protege `storage.objects` por defecto y no hay ninguna
política, así que nadie tiene acceso. El riesgo aparece el día que alguien cree
un **bucket público** desde el panel, porque entonces sus archivos quedan
accesibles con solo conocer la URL, sin ninguna credencial.

Reglas para cuando se implemente:

1. **Ningún bucket público.** Las fotos de una casa ajena no pueden estar a un
   enlace de distancia. Se crean con `public = false`.
2. **Acceso mediante URLs firmadas de corta duración** (minutos, no días),
   generadas por la API tras comprobar que quien pide la foto tiene derecho a
   verla.
3. **Ruta con el identificador dentro**: `job-photos/{bookingId}/{archivo}`.
   Las políticas se apoyan en esa ruta para acotar quién ve qué.
4. **Consentimiento explícito** del cliente para las fotos de antes y después,
   registrado con fecha.
5. **Caducidad**: las fotos de trabajos cerrados no deben conservarse
   indefinidamente. Hay que fijar un plazo y borrarlas.

SQL de partida, para aplicar cuando exista la funcionalidad:

```sql
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false);
-- Sin politicas: solo la API, con su clave de servicio, puede leer y escribir.
```

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

- ~~Autenticación y control de acceso por rol en guardas del servidor~~ —
  **hecho** para el personal (`docs/13-panel-y-permisos.md`), con RLS activado
  como segunda capa. El acceso de los clientes a su propio historial llega con
  el portal del cliente.
- Cifrado y control de acceso de la información de clientes y direcciones.
- URLs firmadas y de corta duración para las fotos de los trabajos, con
  consentimiento explícito para las fotos de antes y después.
- ~~Verificación de firma en todos los webhooks~~ — **hecho**, con pruebas de
  firma ausente, inventada, de otra clave, de longitud distinta y de cuerpo
  manipulado después de firmar (`docs/12-pagos-y-deposito.md`).
- ~~Nunca almacenar números de tarjeta~~ — **hecho**: el navegador los envía
  directamente al proveedor (ámbito PCI SAQ-A).
- Recorrer el pago real con las tarjetas de prueba de Stripe: el código está
  escrito, pero **nunca se ha ejecutado una confirmación de tarjeta real**.
- Captura y devolución desde el panel, con registro de auditoría de quién las
  ordenó.
- Sesiones cortas con rotación de tokens y revocación al cerrar sesión. Hoy la
  baja es inmediata por otra vía: `isActive = false` cierra la puerta en la
  siguiente petición sin esperar a que caduque el token.
- ~~Registro de auditoría para las acciones administrativas~~ — **la tabla y el
  servicio están**; se llenará según lleguen las acciones que cambian datos.
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
8. **¿Añade tablas?** Entonces la migración debe activar la seguridad a nivel
   de fila en cada una. El test lo comprueba, pero es más rápido escribirlo a
   la primera que descubrirlo en la CI.
9. **¿Guarda archivos?** Bucket privado y URLs firmadas de corta duración.
