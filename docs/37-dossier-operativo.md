# 37 — Dossier operativo: todo lo construido y cómo funciona

> **Para qué es este documento.** Es la base de hechos para una **revisión
> legal**: describe qué hace el sistema, qué datos toca, qué promete por
> escrito y qué decide cada persona, para que quien analice el riesgo no
> tenga que leer el código.
>
> **Esto no es asesoría legal, y lo que viene al final tampoco.** La sección 9
> plantea _preguntas_ y aporta los hechos que las sustentan; las respuestas las
> da un abogado de Georgia. Lo que sí garantiza este documento es que **los
> hechos son ciertos y verificables**: cada afirmación lleva el archivo donde
> se comprueba.
>
> Estado: **17 de octubre de 2026**, con las etapas 1 a 3.24 construidas.
> Lo ya investigado sobre cumplimiento (impuestos, seguros, clasificación de
> personal) está en `docs/07-cumplimiento-georgia.md` y **no se repite aquí**.

---

## 1. Qué es el sistema

Freshness Touch es una empresa de limpieza doméstica que opera en el estado de
**Georgia (EE. UU.)**, con base de operaciones configurable desde el panel
(hoy Powder Springs, 30127). El sistema tiene **tres superficies** y una API.

| Superficie                 | Quién la usa                                                 | Dónde se despliega                    |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| **Sitio público**          | Cualquiera, sin sesión                                       | Vercel                                |
| **Panel**                  | Personal con cuenta                                          | Vercel                                |
| **PWA del equipo**         | Personal de limpieza (el mismo panel, instalado en el móvil) | Vercel                                |
| **API**                    | —                                                            | Render                                |
| **Base de datos y acceso** | —                                                            | Supabase (PostgreSQL + autenticación) |

Dos idiomas en todas partes: **inglés y español**.

### 1.1 Los tres papeles

| Papel        | Qué puede hacer                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `ADMIN`      | Todo: dinero, tarifas, zonas, textos del sitio, personal, auditoría                            |
| `DISPATCHER` | La agenda: ver reservas, cambiar estados, asignar equipo, resolver ajustes. **No toca dinero** |
| `CLEANER`    | Solo sus trabajos del día, en la PWA. **Nunca ve importes**                                    |

La separación no es cosmética: está comprobada con pruebas que verifican que
coordinación recibe `403` en cada endpoint de dinero
(`apps/api/src/auth/admin-access.e2e.test.ts`).

### 1.2 El cliente no tiene cuenta

**Se reserva como invitado.** No hay registro, ni contraseña, ni área de
cliente: el campo `customers.authUserId` existe para el futuro y **ningún
flujo lo rellena hoy**. Esto
tiene consecuencias que la sección 9 recoge: el cliente **no puede** entrar a
ver sus datos, corregirlos, descargarlos ni borrarlos por sí mismo.

### 1.3 Qué hay construido

| Módulo                          | Qué hace                                                                                                           | Etapas                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| **Sitio público**               | Presentación, precios, zonas con mapa, preguntas frecuentes, cotizador y reserva por pasos, en dos idiomas         | 1, 2.2b                        |
| **Motor de precios**            | Tabla por tramos de tamaño, cadencias, extras, depósito fijo, traslado por milla con la tarifa del IRS, versionado | 2.22, 2.23, 3.4                |
| **Área de servicio**            | Zonas editables sobre el mapa, con precio automático o «te llamamos»; contorno real de Georgia                     | 2.18, 2.25, 2.26, 3.19, 3.20   |
| **Distancia y geocodificación** | Distancia real por carretera con caché; coordenadas de cada casa en segundo plano                                  | 3.2, 3.14                      |
| **Agenda y reservas**           | Disponibilidad por día según el horario guardado, estados con transiciones controladas                             | 2.2b, 2.3                      |
| **Pagos**                       | Retención del depósito, captura, liberación, cobro del saldo y devoluciones, con webhook firmado                   | 2.4, 3.21–3.24                 |
| **Avisos**                      | Correo al cliente (confirmación, cancelación, recordatorio) y Telegram interno con tres destinos                   | 2.5, 2.6, 2.21, 3.13           |
| **Panel**                       | Agenda, detalle, acciones, personal, tarifas, zonas, ubicación, textos, avisos, auditoría, estado                  | 2.3, 2.13–2.17, 2.28, 3.12     |
| **PWA del equipo**              | Mis trabajos, fichaje con ubicación, lista de verificación, ajustes de campo, navegación                           | 3.1, 3.3, 3.5, 3.6, 3.17, 3.18 |
| **Auditoría**                   | Quién hizo qué, legible para quien no programa, con purga al año                                                   | 2.15, 2.16                     |
| **Diagnóstico**                 | Comprobaciones de salud y alarma por Telegram con antirrebote                                                      | 3.12                           |

---

## 2. Terceros que reciben datos

Esto es el inventario de subencargados que necesitaría cualquier política de
privacidad.

| Tercero                 | Qué recibe                                                                                                                          | Cuándo                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Supabase**            | Todo: la base de datos entera y las cuentas del personal                                                                            | Siempre                                                                        |
| **Render**              | Ejecuta la API; ve todo lo que pasa por ella                                                                                        | Siempre                                                                        |
| **Vercel**              | Sirve las dos aplicaciones web (no recibe datos de negocio)                                                                         | Siempre                                                                        |
| **Stripe**              | Nombre, correo y referencia de reserva del cliente; los datos de su tarjeta los recibe **del navegador, nunca de nuestro servidor** | Al reservar y en cada movimiento de dinero                                     |
| **Resend**              | Correo del cliente y el contenido del aviso                                                                                         | Confirmación, cancelación, recordatorio; invitación y recuperación al personal |
| **Telegram**            | Mensajes internos que incluyen **nombre del cliente, calle, ciudad e importe**                                                      | Reserva nueva, asignación, fichaje lejano, alarmas                             |
| **Google (Routes API)** | **La dirección del cliente** (calle, ciudad, estado, código postal) y las coordenadas de la base                                    | Al calcular la distancia de cada cotización no cacheada                        |
| **Censo de EE. UU.**    | **La dirección del cliente**, para obtener sus coordenadas                                                                          | Geocodificación, en segundo plano                                              |
| **OpenStreetMap**       | Las teselas del mapa las pide el navegador del visitante                                                                            | Al pintar cualquier mapa                                                       |

> El proveedor de distancia es conmutable (`DISTANCE_PROVIDER`): con `mock` no
> sale nada a Google. Hoy, en producción, está en `google`.

### 2.1 Lo que NO hay

- **Ni cookies, ni analítica, ni píxeles de seguimiento** en el sitio público.
  Comprobado: no hay `gtag`, ni Analytics, ni Hotjar, ni cookies propias.
- La sesión del panel vive en **`sessionStorage`**, no en una cookie, y muere
  al cerrar la pestaña (`apps/admin/src/lib/supabase-storage.ts`).

---

## 3. Qué datos se guardan, y cuánto tiempo

| Tabla                       | Qué contiene                                                                                                                                                                          | Retención                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `customers`                 | Nombre, apellidos, **correo**, **teléfono**, idioma, `marketingOptIn`, notas internas                                                                                                 | **Indefinida**                                            |
| `addresses`                 | Calle, piso, ciudad, estado, código postal, **`accessNotes`** (código de puerta, dónde está la llave, perro suelto), **coordenadas** y precisión del geocodificador, distancia y zona | **Indefinida**                                            |
| `bookings`                  | Fecha y hora, servicio, tamaño, extras, importes, notas del cliente, motivo de cancelación, **`doorPinLatitude/Longitude`**                                                           | **Indefinida**, salvo el pin                              |
| `quotes`                    | Cada presupuesto emitido, con su desglose y la versión de tarifas                                                                                                                     | **Indefinida**                                            |
| `payments`                  | Identificadores del proveedor, **marca y últimos 4 dígitos**, importes autorizado/cobrado/devuelto, referencias de cliente y tarjeta guardada                                         | **Indefinida**                                            |
| `webhook_events`            | **El cuerpo íntegro del evento del proveedor de pago**, tal cual llegó                                                                                                                | **Indefinida, sin purga**                                 |
| `notifications`             | Qué aviso se mandó, a qué dirección, con qué resultado                                                                                                                                | **Indefinida, sin purga**                                 |
| `booking_clock_ins`         | Quién fichó, cuándo, **la distancia en metros** a la casa y la precisión. **Nunca las coordenadas**                                                                                   | **Indefinida**                                            |
| `booking_checklist_items`   | Qué tarea marcó quién y cuándo                                                                                                                                                        | **Indefinida**                                            |
| `booking_field_adjustments` | Lo que el equipo encontró distinto, quién lo propuso y quién lo resolvió                                                                                                              | **Indefinida**                                            |
| `staff`                     | Nombre, correo, teléfono, papel, correo de la cuenta de acceso                                                                                                                        | **Indefinida**                                            |
| `audit_logs`                | Quién hizo qué, sobre qué, cuándo, **con su dirección IP**                                                                                                                            | **365 días** (configurable; 0 = sin purga, mínimo 30)     |
| `pricing_tables`            | Cada versión de tarifas y quién la guardó                                                                                                                                             | **Indefinida** (a propósito: reproduce facturas antiguas) |
| `business_settings`         | Horario, contacto, zonas, textos del sitio, ajustes de avisos                                                                                                                         | **Indefinida**                                            |

### 3.1 Los dos únicos datos que se borran solos

1. **El pin de la puerta**: se borra **24 horas después de terminar el
   trabajo**, con dos defensas —deja de devolverse al leerlo aunque el barrido
   aún no haya corrido, y un barrido lo borra de la fila—
   (`apps/api/src/bookings/door-pin.helper.ts`, `docs/29-pin-de-la-puerta.md`).
   **Es la única promesa de borrado que el sitio le hace al cliente**, y se
   cumple.
2. **La auditoría**: purga diaria de lo anterior a 365 días
   (`apps/api/src/audit/audit-purge.service.ts`).

Todo lo demás **se guarda para siempre**, incluidos los códigos de puerta.

### 3.2 Lo que deliberadamente no se guarda

- **Números de tarjeta.** Nunca pasan por el servidor: el navegador los manda
  directamente al proveedor. Lo que se guarda son referencias opacas
  (`pi_…`, `cus_…`, `pm_…`) inservibles sin la clave secreta, más la marca y
  los cuatro últimos dígitos.
- **Las coordenadas del personal.** El móvil las obtiene, el servidor calcula
  la distancia a la casa y **las descarta**: no están en ninguna tabla, ni en
  la auditoría, ni en los registros, ni en los mensajes de Telegram
  (`docs/25-fichaje-con-ubicacion.md`).
- **Contraseñas.** Las custodia el proveedor de identidad.

---

## 4. Flujos operativos, acción por acción

### 4.1 Sitio público — sin sesión

| #   | Acción                                       | Qué ocurre                                                                                                                                                                          | Qué sale fuera                             |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | **Ver precios**                              | `GET /pricing/catalog`: servicios ofrecidos, tramos de tamaño, extras, depósito, radio sin recargo y tarifa por milla                                                               | —                                          |
| 2   | **Cotizar**                                  | `POST /quotes/estimate` con servicio, cadencia, pies cuadrados, extras y **código postal**. Limitado a 10/min por IP. Calcula distancia (con caché) y devuelve el desglose          | **La dirección al proveedor de distancia** |
| 3   | **Ver huecos**                               | `GET /availability` para un día: franjas libres según el horario guardado                                                                                                           | —                                          |
| 4   | **Reservar**                                 | `POST /bookings`: crea o reutiliza cliente y dirección, re-calcula el precio **con la dirección completa**, guarda la reserva en `PENDING_PAYMENT` y pide la retención del depósito | Stripe, Resend, Telegram                   |
| 5   | **Confirmar la tarjeta**                     | Con Stripe, el navegador contra Stripe. Con el simulador, `POST /payments/mock/confirm`                                                                                             | Stripe                                     |
| 6   | **Marcar la puerta** (opcional)              | Un pin en un mapa. Se guarda en la reserva y **se borra al día siguiente**                                                                                                          | Teselas de OpenStreetMap                   |
| 7   | **Dejar instrucciones de acceso** (opcional) | Texto libre hasta 500 caracteres: código de puerta, dónde está la llave                                                                                                             | —                                          |
| 8   | **Recibir ofertas** (opcional)               | Casilla **desmarcada por defecto**. Hoy solo se guarda: no hay ningún envío comercial                                                                                               | —                                          |

**Al reservar, en una sola operación**: se crea el cliente si no existía (por
correo), se guarda la dirección, se congela el precio y la versión de tarifas,
se retiene el depósito, se manda **correo de confirmación al cliente** y
**aviso interno por Telegram** con nombre, calle, ciudad e importe.

> Si el proveedor de pago falla, **la reserva no se pierde**: queda sin pago y
> alguien la gestiona. Se eligió así a propósito.

### 4.2 Panel — coordinación (`DISPATCHER`) y administración (`ADMIN`)

| #   | Acción                               | Quién             | Qué ocurre                                                                                                                                                     |
| --- | ------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | **Ver la agenda**                    | ADMIN, DISPATCHER | Listado por día con estado, equipo asignado e importes                                                                                                         |
| 10  | **Abrir una reserva**                | ADMIN, DISPATCHER | Detalle completo. **Se audita la lectura** (`booking.viewed`)                                                                                                  |
| 11  | **Ver las instrucciones de acceso**  | ADMIN, DISPATCHER | Marcadas como dato sensible; **su lectura se audita aparte** (`access_notes.viewed`)                                                                           |
| 12  | **Cambiar el estado**                | ADMIN, DISPATCHER | Confirmada → en curso → completada; o cancelada / no estaban. **Motivo obligatorio** al cancelar o marcar que no estaban. Solo la cancelación avisa al cliente |
| 13  | **Asignar equipo**                   | ADMIN, DISPATCHER | Con guardia de solapamiento. Avisa al **grupo de limpieza** por Telegram (sin importes)                                                                        |
| 14  | **Resolver un ajuste de campo**      | ADMIN, DISPATCHER | Aprobar re-tarifica la reserva con **la tabla que tenía**, no con la vigente. Rechazar guarda el motivo                                                        |
| 15  | **Poner un importe a mano**          | ADMIN             | Para las reservas sin precio automático (casi toda Georgia fuera de 35 millas)                                                                                 |
| 16  | **Cobrar el depósito**               | **ADMIN**         | Motivo obligatorio. Audita `payment.captured`                                                                                                                  |
| 17  | **Liberar la retención**             | **ADMIN**         | Motivo obligatorio. Audita `payment.released`                                                                                                                  |
| 18  | **Cobrar el saldo final**            | **ADMIN**         | Solo con el trabajo `COMPLETED` y tarjeta guardada. Audita `payment.balance_charged`                                                                           |
| 19  | **Devolver** (depósito o saldo)      | **ADMIN**         | Total o parcial, motivo obligatorio. Audita `payment.refunded` / `payment.balance_refunded`                                                                    |
| 20  | **Editar tarifas**                   | ADMIN             | Crea una **versión nueva**; las reservas antiguas conservan la suya                                                                                            |
| 21  | **Editar el área de servicio**       | ADMIN             | Hasta dónde se va y hasta dónde hay precio automático                                                                                                          |
| 22  | **Mover la ubicación de la empresa** | ADMIN             | El punto desde el que se mide cada distancia                                                                                                                   |
| 23  | **Editar los textos del sitio**      | ADMIN             | **Lo guardado aquí gana sobre el código**: incluye afirmaciones comerciales (ver §6)                                                                           |
| 24  | **Editar horario y contacto**        | ADMIN             | El mismo horario que usa la agenda: no se puede anunciar uno y aceptar reservas en otro                                                                        |
| 25  | **Configurar avisos**                | ADMIN             | Qué se manda y a qué chats de Telegram                                                                                                                         |
| 26  | **Alta y edición de personal**       | ADMIN             | Con guardias: no quedarse sin administradores, nadie se cambia a sí mismo el puesto                                                                            |
| 27  | **Invitar al panel**                 | ADMIN             | Correo propio con enlace de un solo uso                                                                                                                        |
| 28  | **Consultar la auditoría**           | **ADMIN**         | Quién hizo qué, con filtros y en lenguaje llano                                                                                                                |
| 29  | **Ver el estado del sistema**        | ADMIN             | Diagnóstico técnico                                                                                                                                            |

### 4.3 PWA del equipo de limpieza (`CLEANER`)

| #   | Acción                                   | Qué ocurre                                                                                                                                                                |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30  | **Ver mis trabajos**                     | Solo los suyos, solo del día. Dirección, hora, tamaño, extras, instrucciones de acceso y pin. **Ningún importe, por contrato**                                            |
| 31  | **Fichar «he llegado» / «he terminado»** | Pide la ubicación del móvil. El servidor calcula **la distancia a la casa y descarta las coordenadas**. **Nunca bloquea**: sin ubicación se ficha igual, anotando por qué |
| 32  | **Marcar la lista de verificación**      | Una fila por tarea hecha, con quién y cuándo. _(El catálogo de tareas está vacío a la espera de las plantillas del cliente)_                                              |
| 33  | **Proponer un ajuste de campo**          | «Esto no es lo contratado»: 900 pies que son 1.300. **No cambia la reserva**: la decide coordinación                                                                      |
| 34  | **Llévame allí**                         | Abre Google Maps o Apple Maps con el pin o la dirección. **La dirección sale al proveedor de mapas del teléfono**                                                         |

### 4.4 Automático, sin que nadie lo pida

| #   | Proceso                            | Cada cuánto         | Qué hace                                                                                                  |
| --- | ---------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| 35  | **Recordatorio**                   | Barrido periódico   | Correo al cliente 24 h antes (configurable, 2-72 h)                                                       |
| 36  | **Geocodificación**                | Barrido periódico   | Convierte direcciones nuevas en coordenadas. **Fuera del camino del dinero**                              |
| 37  | **Borrado del pin**                | Barrido periódico   | Borra el pin 24 h después del trabajo                                                                     |
| 38  | **Purga de auditoría**             | Diaria              | Borra lo anterior a 365 días y lo deja anotado                                                            |
| 39  | **Alarma de estado**               | Cada 5 min          | Avisa al chat técnico si algo está roto, con silencio de 6 h por problema                                 |
| 40  | **Webhooks del proveedor de pago** | Cuando Stripe avisa | Confirma o cancela reservas, y deshace devoluciones rechazadas. **Endpoint público con firma verificada** |

---

## 5. El dinero, de principio a fin

Es donde hay más exposición, así que va completo. Una limpieza estándar de
1.800 pies son **185 $**: **35 de depósito** y **150 de saldo**.

| Paso | Qué pasa                                                                     | Quién lo decide   |
| ---- | ---------------------------------------------------------------------------- | ----------------- |
| 1    | **Se retienen 35 $** en la tarjeta al reservar. No es un cargo               | Automático        |
| 2    | La retención **caduca a los 7 días**                                         | El proveedor      |
| 3    | **Se libera** si el servicio se presta con normalidad                        | ADMIN             |
| 4    | **Se cobra** si el cliente cancela con el equipo en camino o no está en casa | ADMIN, con motivo |
| 5    | **Se cobra el saldo** con la tarjeta guardada, con el trabajo terminado      | ADMIN             |
| 6    | **Se devuelve** lo cobrado, entero o en parte                                | ADMIN, con motivo |

**Lo que el cliente acepta al reservar**, tal y como lo lee en el paso de pago:

> «Retenemos {importe} en tu tarjeta. No es un cargo: se acredita íntegro
> contra tu factura final, y solo lo cobramos si cancelas cuando nuestro
> equipo ya está en camino.»
>
> «Guardamos esta tarjeta para cobrar los {importe} restantes cuando
> terminemos tu limpieza. No se le cobra nada más, y puedes pedirnos que la
> quitemos cuando quieras.»

**El segundo texto es un párrafo informativo, no una casilla.** No se le pide
al cliente que marque nada para guardar su tarjeta (ver §9.B).

### 5.1 Las defensas que ya tiene

- **Idempotencia en todo**: retener, cobrar, devolver y cobrar el saldo
  derivan su clave de la reserva y el importe. Pulsar dos veces no cobra dos
  veces, y hay pruebas que lo comprueban.
- **El importe no lo manda el navegador**: lo calcula el servidor.
- **Nada se cobra sin que una persona lo pulse**, salvo la retención inicial.
- **Un rechazo del proveedor no se apunta**: ni un cobro ni una devolución
  quedan registrados si no ocurrieron de verdad.
- **Si el banco anula una devolución días después**, el sistema deshace el
  apunte y avisa por Telegram.
- Cada movimiento queda en la auditoría **con importe, motivo y persona**, y
  **sin ningún identificador del proveedor**.

### 5.2 Lo que el sistema NO hace con el dinero

- **No cobra automáticamente nada** salvo la retención del depósito.
- **No hay cobro recurrente.** El sitio vende planes semanal, quincenal y
  mensual con precio por cadencia, pero **cada limpieza es una reserva suelta**:
  la tabla `recurring_series` existe y **ningún código la usa**.
- **No hay propinas.**
- **No reclama** a quien no se le pudo cobrar: el saldo se queda pendiente.

---

## 6. Lo que el sitio promete por escrito

Son afirmaciones comerciales. **Si no son ciertas, son publicidad engañosa.**
Las cuatro primeras se pueden **editar desde el panel**, y lo guardado ahí
gana sobre el código: hay que comprobarlas **en el panel**, no solo aquí.

| Texto publicado                                                                                                                  | Qué exige que sea verdad                             |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| «Asegurados — la póliza de responsabilidad civil protege tu casa y tus bienes»                                                   | Póliza vigente                                       |
| «Equipo con verificación de antecedentes — cada limpiador pasa una verificación penal y de identidad antes de su primer trabajo» | Que el proceso exista **y se aplique a todos**       |
| «Garantía de repaso — dínoslo en 24 horas y volvemos»                                                                            | Que la empresa acepte esa política                   |
| «Precios transparentes — ves el desglose completo antes de reservar»                                                             | Que no haya cargos posteriores sin avisar (ver §9.E) |
| «Con licencia» (insignia de portada, **no editable**)                                                                            | Licencia local vigente                               |
| «Los precios mostrados son estimaciones y se confirman antes de empezar» (pie)                                                   | —                                                    |
| «Contáctanos al menos 24 horas antes y lo movemos sin coste» (FAQ)                                                               | Que se respete                                       |
| «Borramos este pin el día después de tu limpieza»                                                                                | **Cumplido por el sistema**                          |
| «Tu ubicación no se guarda» (al fichar, al personal)                                                                             | **Cumplido por el sistema**                          |

> La **fianza de limpieza** se retiró del sitio el 11 de octubre de 2026 porque
> la empresa no la tiene contratada (`docs/07`). Es el precedente de por qué
> esta tabla importa.

---

## 7. Decisiones de privacidad y seguridad ya tomadas

Para que la revisión no proponga lo que ya está hecho:

- **Las coordenadas del personal no existen** en ninguna parte. Solo la
  distancia en metros.
- **El fichaje nunca bloquea**: sin permiso de ubicación se ficha igual.
- **El equipo de limpieza nunca ve importes**, ni en la pantalla ni en los
  mensajes del grupo de Telegram. Está impuesto por el contrato de tipos.
- **Las instrucciones de acceso nunca viajan en una URL** y su lectura se
  audita.
- **El pin de la puerta se borra solo**, con dos defensas independientes.
- **Ninguna credencial del proveedor de pago entra en la auditoría** ni en los
  registros del servidor. Hay pruebas que lo verifican.
- **El webhook público verifica firma y marca de tiempo**; sin firma válida no
  deja rastro en la base.
- La sesión del panel **no sobrevive al cierre de la pestaña** y hay cierre por
  inactividad.
- **Sin cookies, sin analítica, sin seguimiento.**
- Todo cambio de configuración, dinero o personal **queda auditado** con quien
  lo hizo, desde qué IP y con qué cambió.

---

## 8. Lo que no existe hoy

Hechos, no juicios:

1. **No hay política de privacidad.** Hay una clave de traducción
   (`footer.privacy`) que **no se pinta en ninguna parte**: el pie no enlaza a
   nada.
2. **No hay términos y condiciones.** Igual: `footer.terms` existe y no se
   muestra.
3. **No hay casilla de aceptación de nada** al reservar. La única casilla del
   formulario es la de ofertas comerciales, y está desmarcada por defecto.
4. **No hay aviso de cookies** — coherente, porque no hay cookies.
5. **El cliente no puede acceder, corregir, descargar ni borrar sus datos**:
   no hay cuenta ni procedimiento.
6. **No hay borrado por antigüedad** de clientes, direcciones, reservas,
   pagos, avisos ni eventos del proveedor.
7. **Los correos no llevan enlace de baja ni dirección postal** (hoy todos son
   transaccionales).
8. **No hay declaración de accesibilidad** ni auditoría WCAG, aunque la
   interfaz se construyó cuidando contraste, foco y tamaños táctiles.
9. **No hay fotos de antes y después** (estaba previsto con consentimiento).
10. **No hay SMS** (bloqueado por el trámite A2P 10DLC).
11. **No hay cobro recurrente** aunque se vendan planes recurrentes.
12. **No hay módulo de personal** (nóminas, accidentes laborales): la etapa 4.
13. **El catálogo de tareas de limpieza está vacío**, a la espera de las
    plantillas del cliente.
14. **El flujo de pago real nunca se ha ejecutado con credenciales de Stripe.**

---

## 9. Preguntas para la investigación legal

Cada bloque da **los hechos** y luego **lo que hay que resolver**. El orden es
de mayor a menor exposición a juicio del equipo técnico, no legal.

### A. El contrato con el cliente: no existe

**Hechos.** Se acepta una reserva, se guarda una tarjeta, se retiene dinero y
después se cobra, **sin que el cliente acepte ningún término**. No hay página
de condiciones, no hay casilla, y el único texto con aire legal es el pie:
«los precios son estimaciones y se confirman antes de empezar».

**A resolver.** ¿Qué documento mínimo hace falta y cómo debe aceptarse
(casilla, doble confirmación, copia por correo)? ¿Qué debe cubrir: política de
cancelación y no-presentación, la garantía de repaso de 24 h, daños y
responsabilidad, acceso a la vivienda, uso de la tarjeta guardada, resolución
de disputas? ¿Es exigible una política publicada después de reservar?

### B. Guardar la tarjeta y cobrar sin el cliente delante

**Hechos.** Desde la etapa 3.23 la tarjeta se guarda en Stripe con
`setup_future_usage: 'off_session'` y el saldo se cobra con un botón del panel,
días después, sin el cliente presente. Lo único que lo respalda es **un
párrafo informativo** en el paso de pago. No hay casilla, ni registro de que
lo haya leído, ni copia en el correo de confirmación.

**A resolver.** ¿Basta un aviso o hace falta consentimiento expreso y
registrado? ¿Qué exigen las reglas de red de tarjetas y el propio Stripe para
una _stored credential_ y un cobro _off-session_? ¿Debe el correo de
confirmación repetirlo? ¿Y el importe exacto que se cobrará y cuándo?

### C. El depósito: qué es y cuándo se queda la empresa con él

**Hechos.** Se anuncia como «retención reembolsable» que «solo se cobra si
cancelas cuando el equipo ya está en camino». Quién decide que ese supuesto se
cumple es **una persona pulsando un botón**, con un motivo escrito en texto
libre. El sistema no comprueba nada: ni la hora, ni si el equipo salió.

**A resolver.** ¿Es exigible esa retención sin una política de cancelación
publicada? ¿Hay que fijar plazos concretos (p. ej. «menos de 24 h») en vez de
«ya está en camino»? ¿Qué prueba hace falta conservar para defender el cargo
ante una reclamación al banco?

### D. Las afirmaciones del sitio

**Hechos.** Ver §6. Cuatro de ellas se editan desde el panel y lo guardado
gana sobre el código, así que **el texto publicado puede no ser el del
repositorio**.

**A resolver.** Riesgo bajo la FTC Act §5 y la Georgia Fair Business Practices
Act. En concreto: «background-checked» (¿todos?, ¿con qué alcance?), «fully
insured» (¿qué cubre y qué no?), la garantía de repaso (¿es una garantía
exigible?). ¿Conviene dejar constancia de quién y cuándo publicó cada texto?
_(La auditoría ya lo registra.)_

### E. El precio cambia después de empezar, y se cobra solo

**Hechos.** Un ajuste de campo —«la casa son 1.300 pies, no 900»— re-tarifica
la reserva cuando coordinación lo aprueba. Después, administración cobra el
saldo **ya actualizado** con la tarjeta guardada. **En ningún punto consta que
el cliente aceptara el importe nuevo**: el sistema no le pide nada ni le avisa.
Mientras tanto el sitio dice «ves el desglose completo antes de reservar».

**A resolver.** Esto es, a juicio del equipo técnico, **el hueco más probable
de acabar en una reclamación**. ¿Hace falta aceptación del cliente antes de
cobrar una diferencia? ¿Por qué medio y con qué registro? ¿Hay un umbral por
debajo del cual no haría falta?

### F. El personal

**Hechos.** El sistema asigna trabajos, fija horarios, registra la hora de
entrada y salida y **la distancia a la casa del cliente** en cada fichaje. Las
coordenadas no se guardan y el fichaje nunca se bloquea, pero el registro
existe y coordinación lo ve. La clasificación W-2 y el seguro de accidentes ya
están analizados en `docs/07`.

**A resolver.** ¿Hace falta aviso o consentimiento escrito para registrar la
ubicación del personal, aunque solo se guarde una distancia? ¿Los fichajes
constituyen el registro de jornada a efectos de la FLSA y, si es así, qué les
exige (conservación, acceso del trabajador, corrección de errores)? ¿Cómo debe
documentarse la verificación de antecedentes bajo la **FCRA** (aviso
independiente, autorización escrita, proceso de _adverse action_)?

### G. La seguridad de la casa del cliente

**Hechos.** `addresses.accessNotes` guarda en texto plano códigos de puerta y
dónde está la llave, **sin caducidad**. Lo ven administración, coordinación y
**el equipo asignado** a ese trabajo. Su lectura se audita.

**A resolver.** ¿Hay obligación de cifrar en reposo o de borrar tras un plazo?
¿Qué responsabilidad hay si se filtra y entran en una casa? ¿Debería
caducar como el pin? ¿Qué se le debe decir al cliente sobre quién lo ve?

### H. Protección de datos

**Hechos.** Retención indefinida de todo salvo auditoría y pin. Sin política,
sin derechos ejercitables, con nueve terceros que reciben datos (§2),
incluyendo **la dirección del cliente a Google y al Censo** y **nombre,
dirección e importe a Telegram**.

**A resolver.** Georgia no tiene ley general de privacidad, pero: ¿qué exige
la ley de notificación de brechas de Georgia (O.C.G.A. §10-1-910 y ss.) y qué
habría que tener preparado? ¿Puede la empresa atender a clientes de otros
estados con leyes propias? ¿Hay obligaciones contractuales con los
subencargados (DPA con Stripe, Resend, Supabase)? **¿Es defendible mandar la
dirección de un cliente a un chat de Telegram?**

### I. Correo y futuras promociones

**Hechos.** `marketingOptIn` se guarda desde el primer día y **no se usa**.
Los correos actuales son transaccionales y **no llevan baja ni dirección
postal**.

**A resolver.** Qué exige la CAN-SPAM el día que se mande la primera oferta
(baja funcional, dirección física, asunto no engañoso) y si algún correo
actual ya cruza la línea de comercial.

### J. Accesibilidad

**Hechos.** Sin declaración ni auditoría. La interfaz cuida contraste, foco,
teclado y tamaños táctiles, pero nadie lo ha certificado.

**A resolver.** Exposición bajo el Título III de la ADA para el sitio de un
negocio físico en EE. UU., y si conviene una auditoría WCAG 2.1 AA y una
declaración.

### K. Fiscalidad del traslado y los extras

**Hechos.** El motor emite `taxCents: 0` por la exención de los servicios de
limpieza en Georgia, y cobra **el traslado como una línea más del
presupuesto** (millas de ida y vuelta por la tarifa del IRS).

**A resolver.** ¿El recargo por traslado y los extras (horno, nevera, ventanas)
comparten la exención del servicio, o alguno tributa por separado?

### L. Pagos: cumplimiento PCI y disputas

**Hechos.** El navegador manda la tarjeta directamente al proveedor; el
servidor nunca la ve. Se guardan marca y últimos cuatro dígitos.

**A resolver.** ¿Qué cuestionario PCI corresponde (SAQ-A) y qué hay que
documentar? Ante una disputa, ¿qué evidencia hace falta y la tenemos?
_(Hoy: fichajes con distancia, lista de verificación y auditoría; **no hay
fotos**.)_

### M. Lo que se vende frente a lo que se cobra

**Hechos.** El sitio vende planes semanal, quincenal y mensual con su precio
por cadencia, pero **no existe el cobro recurrente**: cada limpieza es una
reserva suelta.

**A resolver.** ¿Puede un cliente entender que ha contratado una suscripción?
Si en el futuro se automatiza, ¿qué exigen las normas de renovación
automática (ROSCA y equivalentes estatales): consentimiento expreso,
recordatorio previo, cancelación fácil?

---

## 10. Cómo usar este dossier

Para encargar la investigación, lo que mejor funciona es pedir **una por una**
las áreas de la §9, con esta estructura:

1. La norma aplicable concreta (federal, de Georgia, o de red de tarjetas).
2. Qué incumple hoy el sistema, citando el hecho de este documento.
3. El cambio mínimo que cierra el riesgo: texto, casilla, política o código.
4. La prioridad: qué impide operar y qué puede esperar.

Y conviene decirle a quien investigue **qué NO hace falta reinvestigar**:
impuestos sobre ventas, clasificación W-2, seguro de accidentes laborales,
licencias y verificación de antecedentes ya están en
`docs/07-cumplimiento-georgia.md`.

### Dónde comprobar cada cosa

| Tema                                  | Archivo                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| Alcance y etapas                      | `docs/00-alcance-y-etapas.md`                                    |
| Cumplimiento ya investigado           | `docs/07-cumplimiento-georgia.md`                                |
| Modelo de datos                       | `docs/10-modelo-de-datos.md`, `apps/api/prisma/schema.prisma`    |
| Pagos, depósito, saldo y devoluciones | `docs/12-pagos-y-deposito.md`                                    |
| Panel y permisos                      | `docs/13-panel-y-permisos.md`                                    |
| Avisos                                | `docs/14-avisos.md`, `docs/31-destinos-de-telegram.md`           |
| Auditoría                             | `docs/16-auditoria.md`                                           |
| Área de servicio y distancias         | `docs/17-area-de-servicio.md`, `docs/32-el-mapa-y-la-factura.md` |
| Geocodificación                       | `docs/24-geocodificacion.md`                                     |
| Fichaje con ubicación                 | `docs/25-fichaje-con-ubicacion.md`                               |
| Ajustes de campo                      | `docs/28-ajustes-de-campo.md`                                    |
| Pin de la puerta                      | `docs/29-pin-de-la-puerta.md`                                    |
| Textos editables del sitio            | `docs/22-textos-editables.md`                                    |
| Seguridad                             | `docs/04-seguridad.md`                                           |
