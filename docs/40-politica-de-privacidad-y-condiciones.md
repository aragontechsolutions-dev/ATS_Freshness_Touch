# 40 — La política de privacidad y los términos y condiciones

> Etapa 3.25. Los textos están en `docs/legal/`. Este documento es el **por
> qué**: qué son estas dos cosas, qué exige la ley, de dónde sale cada frase
> de los borradores, qué tiene que decidir la dueña y cómo se va a registrar
> la aceptación en la reserva.

> ⚠️ **NO ES ASESORÍA LEGAL.** Lo que sigue es una investigación hecha por el
> equipo de desarrollo a partir de fuentes públicas, recogida aquí para que
> las decisiones técnicas tengan contexto y para que un abogado de Georgia
> pueda revisar los borradores sabiendo de dónde viene cada cosa. **Hay que
> encargar esa revisión antes de publicar.**

---

## 1. Qué son, y por qué son dos documentos y no uno

Se confunden constantemente, y mezclarlos es el error más común.

|                     | Política de privacidad                                    | Términos y condiciones                                    |
| ------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| **Qué es**          | Una **declaración**: esto es lo que hacemos con sus datos | Un **contrato**: esto es lo que cada uno promete          |
| **Quién la impone** | La ley y los proveedores (Google, Stripe)                 | La empresa, para protegerse y para fijar reglas           |
| **Cómo obliga**     | Obliga **a la empresa**: incumplirla es engaño            | Obliga **a las dos partes**, si se acepta bien            |
| **Si no se acepta** | Sigue aplicando: es información, no un pacto              | No hay contrato que oponer al cliente                     |
| **Se cambia**       | Avisando, y hacia adelante                                | Avisando, y **nunca hacia atrás** sobre una reserva hecha |

La consecuencia práctica, y la razón de que estén en archivos separados: una
política de privacidad **no se negocia**, se publica; un contrato **se
acepta**. Meter el contrato dentro de la política hace que el cliente acepte
una descripción, y meter la descripción dentro del contrato hace que una
obligación legal dependa de que alguien marque una casilla.

### Por qué la privacidad obliga incluso sin firma

La Sección 5 de la _FTC Act_ prohíbe las prácticas desleales o engañosas. Una
política de privacidad publicada es una **afirmación pública**: si dice «no
vendemos sus datos» y se venden, eso no es un incumplimiento contractual, es
publicidad engañosa, y lo persigue la FTC. Es la razón por la que estos
borradores solo afirman lo que se ha verificado en el código (§4).

---

## 2. Qué exige la ley en nuestro caso concreto

Esto es lo que se investigó, con lo que aplica y lo que no.

### 2.1 Georgia: NO tiene ley general de privacidad

Es el hallazgo que más condiciona el documento. Georgia **no tiene** una ley
integral de privacidad del consumidor en vigor. El proyecto que la habría
creado —**SB 111**, «Georgia Consumer Privacy Protection Act»— fue vaciado en
comisión en la Cámara en marzo de 2026; el texto sustituto que el gobernador
firmó el 11 de mayo de 2026 es una medida de crédito fiscal hospitalario rural
sin relación con la privacidad.

**Consecuencia:** no hay obligación estatal de ofrecer derechos de acceso,
rectificación o borrado. Los borradores los ofrecen igualmente, **como
política propia y dicho así expresamente** (§10 de la política). Ofrecerlos
cuesta poco, se parece a lo que la clientela ya espera de cualquier empresa, y
evita rehacer el documento el día que Georgia apruebe su ley.

**Lo que Georgia sí tiene** es ley de notificación de brechas, O.C.G.A.
§ 10-1-910 y siguientes: si se accede sin autorización a información personal
**no cifrada** en formato informático, hay que notificar «en el plazo más
expedito posible», y la obligación **no depende** de que haya riesgo de daño.
Por eso la política lo cita por su número: un cliente que lo busque encuentra
exactamente la misma norma.

### 2.2 California (CCPA): no aplica, y conviene saber por qué

La CCPA no tiene exención general para pequeñas empresas: se aplica si se
cumple **cualquiera** de tres umbrales. Ninguno se cumple:

| Umbral                                                                                     | Freshness Touch |
| ------------------------------------------------------------------------------------------ | --------------- |
| Ingresos anuales brutos por encima de ~26,6 M USD (cifra ajustada por inflación para 2026) | No              |
| Compra, venta o cesión de datos de 100.000 consumidores de California al año               | No              |
| 50 % o más de los ingresos procedentes de vender o ceder datos personales                  | No, y jamás     |

**Pero el tercero importa como regla de diseño:** el día que se venda un
listado de clientes, se cruza una línea que no es solo ética. Los borradores
afirman que no se venden datos, y esa afirmación hay que mantenerla verdadera.

### 2.3 GDPR: no aplica

El servicio se presta físicamente en Georgia y no se ofrece a residentes de la
Unión Europea. Que alguien de Europa visite el sitio no activa el RGPD por sí
solo. **No se inventa un apartado de RGPD** para parecer más serio: un
documento que promete derechos europeos que la empresa no sabe atender es una
promesa incumplible por escrito.

### 2.4 Lo que sí obliga, que es federal y contractual

| Fuente                               | Qué obliga                                                                                               | Dónde se cumple                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **FTC Act § 5**                      | No engañar. Lo que diga la política tiene que ser verdad                                                 | Todo el documento (§1 de aquí)     |
| **Términos de Google Maps Platform** | Publicar una política de privacidad que **informe del uso de las API de Maps** e incorpore la de Google  | Privacidad §4, fila de Google      |
| **CAN-SPAM**                         | En el correo comercial: baja clara y **dirección postal física** válida                                  | Privacidad §8; `[MAILING ADDRESS]` |
| **TCPA**                             | Consentimiento **expreso y por escrito** antes de un SMS comercial, y revocación atendida                | Privacidad §8 (hoy: no se mandan)  |
| **ROSCA**                            | En renovaciones automáticas por internet: términos claros, consentimiento expreso y cancelación sencilla | Términos §9 (hoy: no hay ninguna)  |
| **COPPA**                            | No recoger datos de menores de 13 a sabiendas                                                            | Privacidad §11                     |
| **Reglas de las redes de tarjetas**  | No almacenar datos de tarjeta; informar de lo que se autoriza                                            | Privacidad §3.3; Términos §3       |
| **E-SIGN Act**                       | Da validez a la aceptación electrónica, si se registra                                                   | §5 de aquí                         |

#### El SMS, en detalle, porque el terreno se movió

El 24 de enero de 2025 el Undécimo Circuito —el que cubre Georgia— anuló en
_Insurance Marketing Coalition v. FCC_ la regla de «consentimiento uno a uno»
de la FCC. **Lo que no cambió** es que un SMS comercial sigue exigiendo
consentimiento expreso por escrito, que una revocación se atiende por
cualquier vía razonable y en 10 días hábiles, y que la regla de «revocar para
uno vale para todos» está pospuesta al 31 de enero de 2027.

**Consecuencia:** como el sistema **no manda SMS todavía** (bloqueado por el
trámite A2P 10DLC, ver `docs/00-alcance-y-etapas.md`), la política lo dice así
y promete pedir consentimiento aparte el día que se manden. Es la redacción
que no hay que cambiar cuando llegue ese día.

#### Las renovaciones automáticas, y por qué nos salvamos

La regla _click-to-cancel_ de la FTC de 2024 fue **anulada íntegramente** por
el Octavo Circuito en julio de 2025 por defectos de procedimiento, y la FTC
reabrió el expediente con un aviso previo en marzo de 2026 sin texto todavía.
Lo que sigue plenamente vigente es **ROSCA**.

Al leer el código: `RecurringSeries` **existe en el esquema pero no la usa
ningún servicio de la API**. Elegir «semanal» solo aplica un descuento de
frecuencia al precio; cada cita se reserva y se cobra por separado. **No hay
suscripción, no hay cargo recurrente y por tanto no hay renovación automática
que regular.** Los Términos §9 lo dicen explícitamente, que es la mejor
posición posible: no hay nada que cancelar.

> Esto abre una decisión de negocio, no técnica: el descuento por recurrencia
> se cobra sin que la recurrencia esté garantizada. Ver §6.

---

## 3. Cómo se redactan: las reglas que se siguieron

### 3.1 Primero el inventario, después el texto

Es la regla que más trabajo dio y la que evita el fallo grave. **No se puede
redactar una política de privacidad desde una plantilla**, porque entonces
describe el sistema de otro. Lo que se hizo fue leer el esquema de la base de
datos campo por campo, los proveedores externos uno por uno y los plazos de
borrado en el código, y **solo entonces** escribir. El inventario está en §4.

Se descartaron frases de plantilla que habrían sido falsas:

| Frase típica de plantilla                          | Por qué se quitó                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| «Usamos cookies para mejorar su experiencia»       | **No hay cookies.** Solo dos claves de `localStorage`: idioma y tema          |
| «Podemos usar Google Analytics»                    | No está instalado. Se verificó con `grep`: no hay `gtag`, ni píxel, ni Hotjar |
| «Compartimos datos con socios de publicidad»       | No existe ninguno                                                             |
| «Puede acceder a su cuenta para cambiar sus datos» | **No hay cuentas de cliente.** `Customer.authUserId` no lo escribe nadie      |
| «Transferencias internacionales de datos»          | Todos los proveedores son estadounidenses                                     |

Que el documento diga «no usamos cookies de publicidad ni analítica» es
además lo más valioso que puede decir: es una ventaja competitiva real y es
verdad.

### 3.2 Lenguaje claro, y en el idioma de quien lee

El sitio es bilingüe. **Nadie debería tener que aceptar un contrato que no
puede leer**, así que hay versión española. Y porque dos traducciones nunca
son idénticas, cada documento dice en su penúltima sección que **la inglesa
gobierna**: el servicio se presta en Georgia, el contrato se rige por la ley
de Georgia y un tribunal de Georgia trabaja en inglés.

### 3.3 Lo que se promete aquí tiene que ser verdad en el sitio

El sitio ya hace promesas concretas, y un contrato que las contradiga es peor
que no tener contrato. Se fueron a buscar y se repiten **literalmente**:

| Promesa que ya está publicada                                              | Dónde está                    | Dónde se repite             |
| -------------------------------------------------------------------------- | ----------------------------- | --------------------------- |
| El depósito «solo se cobra si cancela cuando el equipo ya va de camino»    | `faq.q2.a`                    | Términos §3                 |
| «Contáctenos con 24 horas de antelación y la movemos sin coste»            | `faq.q6.a`                    | Términos §5                 |
| «Díganoslo en 24 horas y volvemos a arreglarlo»                            | `whyUs.guarantee.body`        | Términos §10                |
| Los servicios de limpieza están exentos del impuesto sobre ventas          | `faq.q1.a`                    | Términos §2                 |
| La propina nunca es obligatoria                                            | `faq.q5.a`                    | Términos §4                 |
| «Con licencia · Asegurados» —y **nunca** «afianzados»                      | `hero.badge`, `whyUs.insured` | Términos §11                |
| Verificación de antecedentes antes del primer trabajo                      | `whyUs.vetted.body`           | Privacidad §9, Términos §14 |
| Lo que no se limpia: patios, porches, ventanas por fuera, platos, paredes… | `scope.notIncluded`           | Términos §8                 |

### 3.3.1 Un texto del sitio que ya no es verdad, y que hay que arreglar

Al cotejar promesas apareció una que **el código contradice**. La pregunta
frecuente `faq.q2.a` dice del depósito:

> «It is a refundable hold **based on how far your home is from our base**.»

Pero `packages/pricing/src/config.ts` dice `deposit: { amountCents: 3500 }`, y
su comentario es explícito: _«EL DEPÓSITO ES UNA CANTIDAD FIJA, y ya no depende
de la distancia»_. Se cambió en su día y **la pregunta frecuente se quedó
atrás**.

No es grave —35 dólares fijos son menos de lo que un cliente lejano esperaría
leyendo esa frase— pero es una afirmación falsa sobre un cargo.

Y al decidirse la política de cancelación apareció una **segunda**
contradicción en la misma frase, ésta sí importante: decía que el depósito
_«solo se cobra si cancelas cuando el equipo ya va en camino»_, y la política
acordada el 27 de octubre de 2026 es que **también se cobra al cancelar dentro
de las 24 horas previas**. Un cliente que lea la pregunta frecuente y cancele
nueve horas antes esperando no pagar nada tiene razón: eso es lo que le
dijimos.

**Las dos quedaron corregidas**, en inglés y en español, y de paso `faq.q6.a`,
que hablaba de mover la cita con 24 horas «sin costo» y se callaba qué pasa
dentro de ese margen.

> ⚠️ **OJO CON EL PANEL**, igual que pasó con la fianza. Las claves `faq.*`
> **son editables** desde _Datos del negocio → Textos del sitio_
> (`SITE_COPY_KEYS` las incluye), y **lo guardado ahí gana sobre el código**.
> Corregir estos textos arregla el respaldo; si alguien había guardado su
> propia versión, el sitio seguirá enseñando la vieja. **Hay que mirarlo en el
> panel.**

La fianza merece un párrafo propio. El 11 de octubre de 2026 se retiró del
sitio porque **la empresa no la tiene contratada** (ver
`docs/07-cumplimiento-georgia.md`). Los Términos §11 **dicen expresamente que
no estamos afianzados**. Es deliberado: si el sitio alguna vez vuelve a
anunciarlo por un texto editado en el panel, el contrato lo contradice y la
contradicción se ve.

### 3.4 Versión y fecha, siempre

Cada documento lleva número de versión y fecha de entrada en vigor. Sin eso no
se puede responder a la única pregunta que importa en una reclamación: **¿qué
aceptó exactamente este cliente?**

---

## 4. El inventario: qué hace el sistema de verdad

Leído del código el 27 de octubre de 2026. Si esto cambia, cambian los
documentos.

### 4.1 Datos de cliente que se guardan

| Tabla            | Campos personales                                                                                                | Notas                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `customers`      | `email`, `firstName`, `lastName`, `phone`, `locale`, `marketingOptIn`, `internalNotes`                           | `internalNotes` son notas del equipo y **nunca se muestran al cliente**        |
| `addresses`      | `line1`, `line2`, `city`, `state`, `postalCode`, `accessNotes`, `latitude`, `longitude`, `geocodeMatchedAddress` | `accessNotes` = códigos de puerta, sitio de la llave, perro. **Dato sensible** |
| `quotes`         | `postalCode`, datos del inmueble, desglose del precio                                                            | `customerId` **nulo** si se cotizó sin dejar datos                             |
| `bookings`       | `customerNotes`, `doorPinLatitude`, `doorPinLongitude`, cita, precio pactado                                     | El pin **se borra 24 h después** del trabajo                                   |
| `payments`       | `cardBrand`, `cardLast4`, identificadores de Stripe, importes, código de error                                   | **Nunca el número de tarjeta**                                                 |
| `notifications`  | `target` (el correo de destino), estado del envío                                                                | Registro de envíos                                                             |
| `audit_logs`     | `ipAddress`, quién hizo qué                                                                                      | A propósito **sin** tarjetas, contraseñas ni códigos de puerta                 |
| `media_consents` | `customerName`, `customerEmail`, `propertyAddress`, firma y prueba                                               | RLS activo; nunca sale al sitio público                                        |

**La IP del cliente** se registra en dos sitios, y los dos están declarados en
la política: al crear una reserva (`POST /bookings`) y al pedir la retirada de
sus fotos (`POST /media-removal`). Ambos llevan `@Ip()`.

### 4.2 Proveedores externos

| Proveedor                           | Qué recibe de verdad                                                             | Verificado en                                          |
| ----------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Stripe                              | La tarjeta (directa del navegador), el correo para el recibo, los importes       | `stripe-payment.provider.ts`                           |
| Supabase                            | La base entera y los archivos                                                    | `render.yaml`, proveedores de almacenamiento           |
| Render                              | Ejecuta la API                                                                   | `render.yaml`                                          |
| Vercel                              | Sirve el sitio y el panel                                                        | `vercel.json`                                          |
| Resend                              | Nombre, correo, referencia, hora y dirección                                     | `resend-email.provider.ts`, plantillas                 |
| Google Maps Platform                | **Al cotizar: solo código postal y estado. Al reservar: también calle y ciudad** | `formatDestination()` en `google-distance.provider.ts` |
| Geocodificador del Censo de EE. UU. | La dirección completa en una línea                                               | `census-geocoding.provider.ts`                         |
| Telegram                            | Avisos internos con nombre, hora y **dirección**                                 | `booking-emails.ts`, `Donde: ${addressLine}, ${city}`  |

Que Google reciba **menos** al cotizar que al reservar no es un detalle: es la
diferencia entre «un código postal» y «la casa de alguien», y por eso la
política lo distingue en la misma fila en lugar de decir «su dirección».

### 4.3 Plazos que el código ya cumple

| Plazo                                      | Dónde vive                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Pin de la puerta: **24 h** tras el trabajo | `door-pin.ts`, calculado de `completedAt`/`cancelledAt`/`scheduledEnd`         |
| Retención de tarjeta: **7 días** máximo    | Límite de las redes; barrido en `hold-expiry-sweep.service.ts`                 |
| Presupuesto: **7 días** de validez         | `validityDays: 7` en `packages/pricing/src/config.ts`                          |
| Retirada de fotos: **5 días**              | `CONSENT_REMOVAL_DAYS_DEFAULT`, barrido en `removal-deadline-sweep.service.ts` |
| Depósito: **35,00 USD** fijos              | `deposit: { amountCents: 3500 }`                                               |

Son los únicos plazos que la política afirma con número, porque son los únicos
que el sistema garantiza por sí mismo. Para el resto dice «el tiempo que lo
necesitemos a efectos fiscales, contables, de seguro y legales» **y la §6 de
aquí lo deja como decisión pendiente**: un número concreto de años lo tiene
que dar el contador, no el programador.

### 4.4 Lo que el navegador guarda

Dos claves de `localStorage`: idioma (`i18n.ts`) y tema (`useTheme.ts`).
**Cero cookies, cero analítica, cero publicidad.** Verificado con `grep` sobre
`apps/landing`.

---

## 5. Cómo se registra la aceptación (plan, etapa siguiente)

Los borradores no sirven de nada si no se puede demostrar que el cliente los
aceptó. Esto es lo que exige un _clickwrap_ para ser ejecutable y cómo se va a
construir.

### 5.1 Qué exige un tribunal

Dos cosas, y las dos son de interfaz antes que de base de datos:

1. **Aviso razonable.** Los enlaces tienen que ser visibles de verdad: no en
   gris claro, no a seis pantallas de distancia, y **funcionando en móvil**. El
   Noveno Circuito en _Nguyen v. Barnes & Noble_ dejó claro que un enlace
   conspicuo **sin** ningún acto de aceptación no basta.
2. **Aceptación inequívoca y afirmativa.** Una casilla que el cliente marca él.

Y tres cosas que lo rompen:

| Error                                         | Por qué rompe                                       |
| --------------------------------------------- | --------------------------------------------------- |
| **Casilla ya marcada por defecto**            | No hay acto del cliente. Es el fallo más frecuente  |
| Un botón «Continuar» que no diga a qué obliga | El clic no significa aceptación de nada en concreto |
| «Usando este sitio acepta…» en el pie         | Es _browsewrap_: no hay acto                        |

### 5.2 Lo que se va a construir

**Etapa A — el contrato (en `@freshness/types`).** Constantes
`TERMS_VERSION` y `PRIVACY_VERSION`, y un `LegalAcceptanceSchema` con la
versión de cada documento. **Sin `.default()` que lo haga opcional**: aceptar
tiene que ser obligatorio para reservar, y si el esquema admite su ausencia,
el día que el formulario tenga un fallo se reservará sin aceptación y nadie se
enterará.

**Etapa B — la base.** Columnas en `bookings`: `termsVersion`,
`privacyVersion`, `legalAcceptedAt`. En la reserva y **dentro de su misma
transacción**, como la auditoría: una reserva sin constancia de aceptación es
exactamente lo que no debe poder existir. Más una fila de auditoría con
`surface: 'SITE'` y `actorType: 'CUSTOMER'`, que ya guarda la IP y la hora.
`'PUBLIC'` no existe en `AuditSurfaceSchema`: las cuatro superficies son
`PANEL`, `SITE`, `SYSTEM` y `FIELD`.

**Etapa C — el formulario.** Una casilla **sin marcar**, obligatoria, con los
dos enlaces abriendo en pestaña nueva (que no se pierda la reserva a medias),
y el mismo aviso en línea que se acaba de construir para el motivo de
cancelación cuando falta por marcar. El texto propuesto:

> **ES** — He leído y acepto los [Términos y Condiciones] y la [Política de
> Privacidad].
>
> **EN** — I have read and accept the [Terms of Service] and the [Privacy
> Policy].

**Etapa D — las dos páginas.** `/terms` y `/privacy` en el sitio público.
`apps/landing/src/App.tsx` ya compara rutas a mano para `/retirar-fotos` y su
comentario dice _«el día que haya tres, se mete»_ un enrutador: con éstas son
tres, así que toca. Y los enlaces al pie: **las claves `footer.privacy` y
`footer.terms` ya existen en los dos idiomas y no las usa nadie** —`Footer.tsx`
solo pinta `footer.rights` y `footer.legalNote`—, así que se escribieron para
esto y están esperando.

**Etapa E — el panel.** En la ficha de la reserva, qué versión aceptó y
cuándo. Es lo que se mira cuando hay una reclamación.

**Etapa F — pruebas.** Que una reserva sin aceptación se rechace con 400; que
la versión guardada sea la del momento de reservar y no la actual; que la
casilla nazca desmarcada (si alguien la marca por defecto, la prueba falla).

### 5.3 Seguridad de lo que se añade

- **No se guarda el texto completo** en cada reserva: se guarda la **versión**,
  y las versiones son archivos del repositorio con su historia en git. Guardar
  el texto multiplicaría por cada reserva un documento de 300 líneas.
- **La versión no se toca nunca hacia atrás.** Corregir la v1 publicada no es
  editar el archivo: es publicar la v2. Si no, lo guardado apunta a un texto
  que ya no es el que se aceptó.
- La aceptación **no es dato sensible** y puede salir en el panel: son dos
  números y una fecha. No añade superficie.
- La IP ya se registra hoy en esa misma ruta; no se recoge nada nuevo.

---

## 6. Lo que tiene que decidir la dueña (y no puede decidir el sistema)

Están marcados entre corchetes en los borradores.

| #   | Decisión                                                                             | Por qué no la puede tomar el sistema                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Razón social, dirección postal, teléfono, correo y condado**                       | Son datos de la empresa. La dirección postal **la exige CAN-SPAM** en el correo comercial                                                                                                                   |
| 2   | ~~**Qué se cobra al cancelar con menos de 24 h**~~                                   | **DECIDIDO (27/10/2026): se cobra el depósito de 35 USD.** Ya está escrito en los Términos §5 y el panel ya tiene el botón de capturar la retención. Obligó a corregir dos textos del sitio: ver §3.3.1     |
| 3   | **`[RECURRING RATE RULE]`: el descuento por frecuencia sin recurrencia garantizada** | El sistema aplica el descuento de «semanal» a una cita única. Hay que decidir si se reajusta el precio cuando alguien deja el plan, o si se acepta como coste de captación                                  |
| 4   | **`[NON-SOLICITATION]`: contratar a nuestro personal directamente**                  | Es común en el sector y es de las cláusulas que un tribunal mira con lupa. Decisión de la dueña **con el abogado**                                                                                          |
| 5   | **`[ARBITRATION]`: arbitraje obligatorio y renuncia a acción colectiva**             | Se dejó **fuera** a propósito. Para un negocio local de servicios añade poco y atrae escrutinio; la cláusula de ley y jurisdicción de Georgia ya resuelve el caso normal. Si el abogado la quiere, se añade |
| 6   | **Cuántos años se conservan reservas y pagos**                                       | Lo dice el contador (CPA), no el programador. Hoy la política dice «el tiempo necesario a efectos fiscales, contables, de seguro y legales», que es cierto pero vago                                        |
| 7   | **Quién atiende las peticiones de privacidad**                                       | La política promete responder en 30 días. Alguien tiene que leer ese buzón                                                                                                                                  |
| 8   | ~~**Corregir `faq.q2.a`**~~                                                          | **HECHO (27/10/2026)**, junto con `faq.q6.a`, que tampoco decía qué pasa dentro de las 24 h. Ver §3.3.1                                                                                                     |

Y dos verificaciones previas que ya estaban pendientes en
`docs/07-cumplimiento-georgia.md` y que estos documentos vuelven a afirmar por
escrito, así que ahora **pesan más**:

- Que la póliza de responsabilidad civil esté **vigente**.
- Que la verificación de antecedentes esté **realmente implantada** antes del
  primer trabajo de cada persona.

---

## 7. Lo que estos documentos NO hacen

- **No son asesoría legal** y no sustituyen la revisión de un abogado de
  Georgia.
- **No cubren la relación laboral** con el personal: el fichaje con ubicación,
  las fotos que el equipo sube y el registro de quién hizo qué son datos de
  empleados y necesitan su propia política interna, que no existe todavía.
- **No cubren WhatsApp.** Si un cliente escribe por WhatsApp, lo que mande lo
  procesa Meta bajo sus propias condiciones. La política lo dice y no promete
  más.
- **No hay aviso de cookies** porque no hay cookies. Si algún día se instala
  analítica, hace falta el aviso **y** cambiar la §2 de la política, que hoy
  afirma lo contrario.

---

## 8. Fuentes de la investigación

Legislación y jurisprudencia citada en el texto: O.C.G.A. §§ 10-1-910 y ss.
(brechas), §§ 48-8-2(31) y 48-8-30(f)(1) (exención del impuesto sobre
ventas), FTC Act § 5, CAN-SPAM (16 CFR parte 316), TCPA (47 C.F.R.
§ 64.1200), ROSCA, COPPA, E-SIGN Act.

Material consultado:

- [GA SB111 (LegiScan)](https://legiscan.com/GA/bill/SB111/2025) y
  [Georgia Data Privacy Law 2026: No Comprehensive Privacy Law](https://datatactic.net/privacy-law/ga)
- [Georgia Data Privacy Laws: Breach Notification & Consumer Rights](https://www.recordinglaw.com/us-laws/data-privacy-laws/georgia-data-privacy-laws/)
  y [Georgia Code § 10-1-912 (Justia)](https://law.justia.com/codes/georgia/2020/title-10/chapter-1/article-34/section-10-1-912/)
- [Eighth Circuit Vacates the FTC's "Click to Cancel" Rule (WilmerHale)](https://www.wilmerhale.com/en/insights/client-alerts/20250801-eighth-circuit-vacates-the-ftcs-click-to-cancel-rule-but-federal-and-state-regulators-likely-to-remain-active)
  y [FTC Launches New Rulemaking on the Negative Option Rule (Covington)](https://www.cov.com/en/news-and-insights/insights/2026/03/ftc-launches-new-rulemaking-on-the-negative-option-rule)
- [Eleventh Circuit Vacates FCC's 'One-to-One' Consent Rule (Day Pitney)](https://www.daypitney.com/eleventh-circuit-vacates-fccs-one-to-one-consent-rule)
  y [Eleventh Circuit Vacates TCPA 1:1 Consent Rule (Kelley Drye)](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/eleventh-circuit-vacates-tcpa-11-consent-rule)
- [6 Components of Clickwrap Enforceability (Ironclad)](https://ironcladapp.com/journal/contract-management/6-components-of-clickwrap-enforceability)
  y [Nguyen v. Barnes & Noble](https://en.wikipedia.org/wiki/Nguyen_v._Barnes_%26_Noble,_Inc.)
- [Google Maps APIs Terms of Service](https://developers.google.com/maps/terms-20180207)
- [CAN-SPAM Act: what is it, when does it apply (Iubenda)](https://www.iubenda.com/en/blog/can-spam-act/)
- [CCPA applicability guide (Clym)](https://www.clym.io/blog/ccpa-applicability-guide)
  y [Navigating the CCPA: 30 essential FAQs (Jackson Lewis)](https://www.jacksonlewis.com/insights/navigating-california-consumer-privacy-act-30-essential-faqs-covered-businesses-including-clarifying-regulations-effective-1126)

Buena parte son comentarios de despachos y de proveedores, no fuentes
primarias, y en algún punto se contradicen entre sí —sobre todo en el estado
exacto de la normativa de la FTC en 2026—. Donde eso pasó, el borrador se
escribió **por la vía conservadora**: describir lo que el sistema hace hoy y
prometer el consentimiento aparte el día que haga algo nuevo. Esa redacción es
correcta con cualquiera de las versiones del estado normativo.
