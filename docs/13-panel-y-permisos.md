# 13 — Panel de administración y permisos

> Etapa 2.3, primer bloque. Autenticación, control de acceso y las vistas de
> lectura de la agenda. Las acciones que cambian cosas (cambiar estado,
> capturar el depósito, editar la configuración) llegan en el bloque
> siguiente.

---

## 1. Identidad y autoridad no son lo mismo

Es la distinción que sostiene toda la seguridad del panel, y confundirlas es
el error clásico:

|               | Qué responde       | Quién la da                  |
| ------------- | ------------------ | ---------------------------- |
| **Identidad** | ¿Quién dices ser?  | Un token firmado             |
| **Autoridad** | ¿Qué puedes hacer? | La ficha en la tabla `staff` |

**Un token válido no basta.** Cualquiera puede registrarse en Supabase y
obtener uno impecablemente firmado. Si eso diera acceso, el panel estaría
abierto a todo internet. La autoridad solo la concede figurar como personal
**activo**.

Eso hace además que dar de baja a alguien sea inmediato: poner `isActive` en
`false` le cierra la puerta en la siguiente petición, sin esperar a que caduque
su token ni tener que revocarlo en el proveedor.

---

## 2. Cerrado por defecto

La guarda se registra como **global**, pero solo actúa sobre las rutas que
cuelgan del segmento `admin`. La alternativa era poner `@UseGuards()` en cada
controlador:

| Si olvidas…                                         | Qué pasa                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| …un `@UseGuards()` en un controlador nuevo          | Datos de clientes al descubierto **en silencio**. Nada falla, nada avisa |
| …marcar público un endpoint (guarda en toda la API) | Se rompe el cotizador. Ruidoso, visible al instante                      |

Ninguna de las dos es buena, pero la primera es la que no se descubre hasta que
es tarde. Por eso la zona protegida la define **la ruta**: cualquier endpoint
que nazca bajo `/admin` está cerrado desde el primer minuto.

Hay un test que lo demuestra con un controlador **sin guarda, sin rol y sin
decorador alguno**: responde `401`. Y otro que comprueba el límite contrario,
que una ruta pública cuyo nombre solo se parece (`/administradores-de-fincas`)
sigue abierta: la comparación es de segmento completo, no de subcadena.

---

## 3. Qué protege cada comprobación

Se midió una por una, porque atribuir una protección a la línea equivocada da
una falsa sensación de seguridad. Lo que hace la librería por su cuenta y lo
que hay que pedirle **no es lo mismo**:

| Comprobación                             | ¿Quién protege?                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Firma válida                             | La librería                                                                                  |
| `alg: none` rechazado                    | La librería, por su cuenta                                                                   |
| HS256 contra un juego de claves públicas | La librería, por su cuenta                                                                   |
| **Emisor (`iss`)**                       | **Nosotros.** Sin pedirlo, un token de otro proyecto de Supabase **se acepta**               |
| **Audiencia (`aud`)**                    | **Nosotros.** Sin pedirlo, un token `service_role` **se acepta**                             |
| **Que exista `exp`**                     | **Nosotros.** Sin pedirlo, un token sin caducidad **se acepta**, y no hay forma de revocarlo |
| **Un solo modo de verificación**         | **Nosotros.** Ver abajo                                                                      |
| **Ficha de personal activa**             | **Nosotros.** Es el control que de verdad cierra el panel                                    |

La lista de algoritmos permitidos se fija igualmente: es defensa en
profundidad, para que la garantía no dependa de una decisión interna de la
librería que pueda cambiar al actualizar.

### Confusión de algoritmos: un solo modo, nunca los dos

La clave pública **es pública**. Un atacante puede descargarla del JWKS y
firmar un token con HS256 **usándola como secreto**: la misma cadena sirve de
clave pública para RSA y de secreto compartido para HMAC.

Contra el juego de claves públicas ese ataque no funciona (la librería rechaza
los algoritmos simétricos ahí). El riesgo real aparecería si se aceptaran **los
dos caminos a la vez**: bastaría con que uno diera el visto bueno.

Por eso el modo se decide **una sola vez al arrancar**: o claves asimétricas, o
secreto compartido heredado. Nunca ambos. Un test lo fija.

---

## 4. Roles

| Rol          | Alcance                                     |
| ------------ | ------------------------------------------- |
| `ADMIN`      | Todo, incluida la configuración y el dinero |
| `DISPATCHER` | Agenda y asignación de equipos              |
| `CLEANER`    | Solo sus propios trabajos                   |

Sin `@Roles(...)` en un endpoint, entra cualquier miembro del personal activo.
Es deliberado: la puerta ya está cerrada y lo que se afina ahí es **quién de
dentro** pasa, no si hay que comprobar algo.

De momento `CLEANER` **no** puede listar la agenda: su vista propia llega en el
bloque siguiente, y es preferible que no vea nada a que vea la agenda completa
con los datos de todos los clientes.

---

## 5. Privacidad en las respuestas

Dos reglas, y las dos tienen test:

1. **El listado no lleva datos sensibles.** Ni la calle ni las instrucciones de
   acceso (códigos de puerta, dónde está la llave). Un listado se puede
   exportar entero de un tirón; el detalle de una reserva, no.
2. **Nunca salen credenciales.** El identificador del pago en el proveedor y el
   `client_secret` son credenciales, no información, y no pintan nada en una
   pantalla.

La paginación tiene **tope duro** de 100: sin él, `limit=999999` descargaría la
base de clientes completa en una sola petición.

---

## 6. El proveedor local no arranca en producción

Para desarrollar sin un proyecto de Supabase hay un proveedor que emite y
verifica sus propios tokens con un secreto compartido.

> 🔒 **La API se niega a arrancar con él en producción.** No es una precaución
> de más: quien conozca el secreto puede fabricarse un token de administrador.
> Con el simulador de pagos lo peor que pasa es una reserva sin cobrar; aquí
> sería entregar los datos de todos los clientes.

Se eligió **fallar al arrancar** en vez de avisar en el registro: un aviso se
pasa por alto, un despliegue que no levanta no.

Comprobado contra el binario de producción: con `AUTH_PROVIDER=local` y
`NODE_ENV=production`, la aplicación no levanta y dice exactamente por qué.

---

## 7. Auditoría

Toda acción administrativa que cambie algo deja rastro en `audit_logs`: quién,
qué, sobre qué y desde qué IP.

Se escribe **dentro de la misma transacción** que el cambio siempre que se
puede: o quedan los dos o no queda ninguno. Un registro de auditoría que puede
faltar justo cuando algo salió mal no sirve de nada.

---

## 8. Qué está probado

`pnpm --filter @freshness/api test` — 151 pruebas, de las cuales 43 son de esta
etapa.

**Verificación de tokens** (unitarias, con claves reales): firmado con otro
secreto, caducado, de otro emisor, para otra audiencia, sin usuario, sin
caducidad, `alg: none`, texto que no es un token. Para Supabase, además: un
servidor JWKS local con un par de claves generado al vuelo, confusión de
algoritmos, token de otro proyecto, token `service_role`, y que el juego de
claves **no se descarga en cada petición**.

**Control de acceso** (punta a punta, contra PostgreSQL real): sin cabecera,
cabecera mal formada, token caducado, **token válido de alguien que no es
personal**, **personal dado de baja**, rol insuficiente, y que la respuesta de
error **no dice por qué falló** (distinguir «ha caducado» de «la firma no
cuadra» le ahorra trabajo a quien prueba tokens).

**Privacidad**: que el listado no contiene el código de puerta ni la calle, que
el detalle sí, y que ninguna respuesta contiene credenciales del proveedor de
pago.

**Contra el binario de producción**: que no arranca con el proveedor local, y
que el preflight de CORS permite la cabecera `Authorization` (un fallo que solo
se ve en un navegador, no con curl ni en los tests de la API).

---

## 9. Pendiente

Lo que queda al cerrar la Etapa 2.3:

| Tarea                                 | Por qué no está hecho                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Asignar equipo a una reserva          | La tabla `booking_assignments` existe y el detalle ya muestra quién está asignado, pero no hay forma de cambiarlo desde el panel. |
| Vista propia del personal de limpieza | El rol `CLEANER` no tiene acceso: hoy solo ve un 403. Necesita su propia pantalla, con lo justo para trabajar.                    |

Ya **no** está pendiente lo que decía este apartado antes: cambiar estado,
cobrar y liberar el depósito (§11) y la configuración del negocio (§12).

> **Lo que no hace falta.** Este apartado listaba «liberar franjas cuyo
> `holdExpiresAt` ya venció». Se comprobó y **no hace falta ninguna tarea de
> fondo**: `findOccupied` solo cuenta las reservas pendientes de pago dentro
> del plazo, así que el hueco vuelve a ofrecerse solo. Se deja escrito para
> que nadie vuelva a plantearlo.

---

## 10. El panel (aplicación `apps/admin`)

> Segundo bloque de la Etapa 2.3.

### Por qué es una aplicación aparte, y no una ruta del sitio público

|                                   | Si viviera en el landing            | Aplicación aparte         |
| --------------------------------- | ----------------------------------- | ------------------------- |
| Código de sesión                  | Lo descarga **cada visitante**      | Solo quien entra al panel |
| Política de contenido del landing | Hay que abrirla a Supabase          | Sigue igual de estricta   |
| El token                          | Habría que pasarlo entre orígenes   | Nunca sale de su origen   |
| Indexación                        | El sitio público **debe** indexarse | El panel lleva `noindex`  |

Poner un formulario de acceso en la página de marketing significa que el
código de autenticación acaba en el paquete de todo el mundo, y que el sitio
que más superficie de ataque tiene es el que custodia la sesión.

### La puerta de servicio

El panel no aparece en ningún enlace. Se entra con **Shift + Ctrl (o Cmd) +
clic sobre el logotipo** de la cabecera, o con **Shift + Ctrl + Enter** si el
logotipo está enfocado (quien no usa ratón también tiene que poder entrar).

> ⚠️ **Esto NO es una medida de seguridad y no debe tratarse como tal.** La
> dirección del panel viaja en el paquete que descarga el navegador:
> cualquiera que abra las herramientas de desarrollo la encuentra en un
> minuto. Lo único que aporta es que el sitio público no enseñe una puerta de
> personal a los clientes.
>
> Lo que protege el panel es lo de las secciones 1 a 3 de este documento. Si
> eso fallara, ocultar el enlace no salvaría nada.

Detalles que parecen menores y no lo son:

- **Se acepta Ctrl o Cmd.** En macOS `Ctrl + clic` es la forma estándar de
  abrir el menú contextual; exigir Ctrl allí haría el gesto incómodo o
  imposible. Además se suprime el menú contextual **solo** cuando los
  modificadores están pulsados.
- **Alt queda fuera.** Con Alt, varios navegadores interpretan el clic como
  «descargar el destino» y el gesto se volvería impredecible.
- **El clic normal sigue funcionando.** Verificado en navegador: clic normal,
  solo Shift, solo Ctrl y Shift+Ctrl+Alt se quedan en el landing.
- **Se navega en la misma pestaña.** `window.open` hacia otro origen deja al
  panel una referencia a la ventana de origen; navegar directamente evita el
  problema de raíz y no lo bloquean los bloqueadores de ventanas emergentes.

### Decisiones de seguridad del panel

**La sesión se guarda en `sessionStorage`, no en `localStorage`.** Es lo
contrario del valor por defecto de la librería, y a propósito: `localStorage`
sobrevive a cerrar el navegador, así que en un ordenador compartido de oficina
la siguiente persona entra con la sesión de quien lo usó antes.
`sessionStorage` muere al cerrar la pestaña.

> Lo honesto: esto **reduce la ventana de exposición, no la elimina**. Un guion
> inyectado (XSS) puede leer cualquiera de los dos. Contra eso protegen la
> política de contenido estricta y que React escapa todo lo que pinta.

**Cierre por inactividad a los 30 minutos.** El panel enseña nombres,
teléfonos, direcciones y códigos de puerta. Una pestaña abierta mientras el
equipo está fuera es una carpeta abierta encima de la mesa. Recuperar el foco
de la pestaña **no** cuenta como actividad: si contara, bastaría con pasar por
encima de ella para mantener la sesión viva indefinidamente.

**El mensaje de acceso fallido es siempre el mismo.** Distinguir «ese correo no
existe» de «la contraseña es incorrecta» permite averiguar quién trabaja en la
empresa probando correos, que es el primer paso de cualquier ataque dirigido.

**No hay registro.** Al personal lo da de alta administración. Una cuenta que
se crea sola nunca llega a tener ficha de personal.

**Solo se usa la parte de autenticación de Supabase** (`@supabase/auth-js`), no
el cliente completo. El panel nunca lee datos con él —para eso está la API, que
aplica los permisos— y el cliente completo arrastra consultas a tablas,
almacenamiento y tiempo real que aquí no se llaman nunca. Medido: 118 KB menos
que descargar cada mañana.

**Cabeceras propias** (`apps/admin/vercel.json`): `noindex` en todas sus
formas, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` en el
documento y una política de contenido que solo permite hablar con la API y con
Supabase.

### Un fallo que solo apareció al usarlo de verdad

El contrato del panel declaraba una **copia recortada** de la línea de precio
en vez de reutilizar la del cotizador. Como la reserva guarda la línea
completa, el esquema estricto rechazaba la respuesta entera y el detalle no se
podía abrir: en pantalla solo salía «algo salió mal».

Los tests de la API pasaban porque comprobaban campo a campo. Ahora hay uno que
valida la respuesta **entera** contra el mismo contrato que usa el panel, y el
cliente escribe en la consola qué campo sobra o falta cuando eso ocurre.

### Qué se verificó en navegador real

Acceso con credenciales incorrectas (mensaje genérico, contraseña borrada),
cuenta válida **sin ficha de personal** (se queda fuera), personal válido
(entra con su nombre y rol), búsqueda, detalle con las instrucciones de acceso
destacadas, cambio a español y cierre de sesión — comprobando que
`sessionStorage` queda vacío y que no hay ningún token en `localStorage`.

Y la puerta de servicio: los cuatro gestos que **no** deben abrirla, los dos
que sí, el equivalente de teclado, y que la palabra «admin» no aparece en el
texto visible del landing ni hay ningún enlace al panel.

---

## 11. Acciones sobre la reserva

> Tercer bloque de la Etapa 2.3.

### El ciclo de vida está en el contrato, no en los botones

```
PENDING_PAYMENT ──► CONFIRMED ──► IN_PROGRESS ──► COMPLETED
       │                │              │
       └────────────────┴──────────────┴──► CANCELLED
                        │
                        └──► NO_SHOW
```

La tabla vive en `packages/types/src/booking-transitions.ts`, de donde la leen
**a la vez** el servidor (que la impone) y el panel (que decide qué botones
pintar). El panel puede equivocarse; el servidor no le deja.

Por qué importa cada regla:

- **Los estados finales no admiten vuelta atrás.** Reabrir una reserva
  completada descuadra la facturación; revivir una cancelada ocupa un hueco que
  el sistema ya dio por libre y puede estar vendido. Un error se corrige creando
  una reserva nueva, y así el histórico sigue contando lo que de verdad pasó.
- **No se puede saltar la ejecución del trabajo.** De confirmada a completada
  sin pasar por «en curso» dejaría sin registrar cuándo empezó y acabó el
  equipo.
- **«No estaban» solo desde confirmada.** Sin confirmar no hay cita a la que
  faltar; y si el equipo ya entró, el cliente sí estaba.

Un test comprueba que la tabla cubre **todos** los estados del contrato: si
mañana se añade uno y se olvida aquí, salta antes de llegar a producción.

### Quién puede qué

| Acción                   | ADMIN | DISPATCHER | CLEANER |
| ------------------------ | :---: | :--------: | :-----: |
| Ver la agenda            |  ✅   |     ✅     |   ❌    |
| Cambiar el estado        |  ✅   |     ✅     |   ❌    |
| **Cobrar el depósito**   |  ✅   |     ❌     |   ❌    |
| **Liberar la retención** |  ✅   |     ❌     |   ❌    |

**Mover la agenda y mover dinero son permisos distintos.** Quien puede cambiar
una cita no tiene por qué poder cobrarle a un cliente: es la separación que
evita que un error de agenda se convierta en un cargo indebido.

Verificado en navegador: con sesión de coordinación, los botones de dinero
**no se pintan**; y aunque se llame al endpoint directamente, responde `403`.

### El motivo es obligatorio donde duele

Cancelar, marcar «no estaban», cobrar y liberar **exigen una nota**. Son los
casos que el cliente puede discutir después, y sin saber quién lo hizo y por
qué, la reclamación se resuelve a base de memoria.

El botón se queda desactivado hasta que hay motivo, y explica por qué en su
título: un botón apagado sin explicación es una trampa.

### Auditoría atómica

El cambio y su registro van en la **misma transacción**: o quedan los dos o no
queda ninguno. Un cambio de estado sin rastro es justo lo que no sirve cuando
hay una reclamación.

La auditoría guarda el importe y el motivo, **nunca el identificador del
movimiento en el proveedor**: es una credencial, no información. Hay un test
que lo comprueba.

### Cobrar y liberar

| Situación                                     | Acción                   |
| --------------------------------------------- | ------------------------ |
| El servicio se prestó con normalidad          | **Liberar** la retención |
| El cliente canceló con el equipo ya en camino | **Cobrar** el depósito   |
| El cliente no estaba en casa                  | **Cobrar** el depósito   |

Solo se puede actuar sobre una retención **autorizada y sin cobrar**. Una ya
cobrada no se cobra dos veces y una liberada ya no existe en el proveedor: en
ambos casos la API responde `409` con un mensaje que se entiende.

Una retención **caduca a los 7 días**. Pasada esa fecha el proveedor la
rechazaría igualmente, pero se avisa antes para no devolver un error suyo que
nadie entiende.

Tampoco se puede cobrar **más de lo retenido**: una retención no se amplía. Si
hiciera falta cobrar más, es un cobro aparte.

### Un fallo del que conviene acordarse

Los primeros endpoints respondían `400` a todo. La causa: `@UsePipes()` a nivel
de método aplica el esquema **a todos los parámetros**, incluido el
identificador de la URL, que obviamente no cumple el esquema del cuerpo.

La solución es poner el pipe en el parámetro (`@Body(new ZodValidationPipe(...))`)
en vez de en el método. Se revisó el resto de controladores: ninguno más
combinaba `@UsePipes` con `@Param`.

### Qué está probado

**Contra PostgreSQL real**: transición imposible → `409`; cancelar sin motivo →
`400`; confirmar devuelve el detalle ya actualizado; la auditoría guarda quién,
desde qué estado y a cuál; coordinación puede mover la agenda pero **no** el
dinero; no se cobra una retención sin autorizar, ni dos veces, ni más de lo
retenido, ni una caducada; y las acciones también exigen sesión.

**En navegador real**: el ciclo entero de una reserva —confirmada por el pago,
equipo llegado, retención liberada, trabajo completado— comprobando que al
final no queda ninguna acción disponible y que los botones de dinero solo
aparecen para administración.

---

## 12. Configuración del negocio

> Tercer y último bloque de la Etapa 2.3. Código: `apps/api/src/settings/`,
> `apps/admin/src/pages/Settings.tsx`, `packages/types/src/business-settings.ts`.

El teléfono, el correo y el horario dejan de estar escritos en el código y
pasan a editarse desde el panel.

### 12.1. Por qué esto no era un capricho

Hasta ahora, `apps/landing/src/config/company.ts` contenía esto:

```ts
// TODO: telefono real de la empresa
phoneDisplay: '+1 (000) 000-0000',
// TODO: correo real de la empresa
email: 'contact@example.com',
```

Dos marcadores inventados esperando a que alguien se acordara de sustituirlos
**antes de publicar**. Y aunque se hubieran sustituido, cada corrección
posterior habría exigido tocar código y desplegar.

Peor todavía: el horario comercial estaba **duplicado** en dos sitios que
nadie garantizaba que coincidieran —la constante que usa el motor de agenda y
una frase traducida (`'Monday to Saturday, 8:00 AM - 6:00 PM'`) en cada
idioma—. Anunciar un horario distinto del que de verdad acepta reservas es
peor que no anunciar ninguno.

### 12.2. Tres decisiones del contrato

**1. El teléfono se guarda una sola vez, en formato internacional.**

De `+14045550123` se derivan lo que se ve (`+1 (404) 555-0123`) y lo que se
marca (`tel:+14045550123`). Guardar los dos por separado invita al fallo más
caro posible: que el sitio **enseñe** un número y **marque** otro porque
alguien editó uno y olvidó el otro.

**2. No hay valores de relleno.** Un teléfono sin configurar es `null`, no
`'+1 (000) 000-0000'`. El sitio esconde el botón de llamar. No dar teléfono es
molesto; dar uno falso destruye la confianza y puede acabar en el teléfono de
un tercero que no tiene nada que ver.

**3. El horario es dato, no texto traducido.** La frase se compone en pantalla
a partir de las horas reales, agrupando días seguidos que comparten horario:

```
Monday – Friday: 8:00 AM – 6:00 PM        Lunes – Viernes: 8:00 a.m. – 6:00 p.m.
Saturday: 9:00 AM – 4:00 PM               Sábado: 9:00 a.m. – 4:00 p.m.
Sunday: Closed                            Domingo: Cerrado
```

### 12.3. Qué se edita y qué no

| Dato                                      | ¿Editable? | Razón                                                                                                                             |
| ----------------------------------------- | :--------: | --------------------------------------------------------------------------------------------------------------------------------- |
| Teléfono, correo                          |     Sí     | Datos de contacto. Cambian y no afectan a ningún cálculo.                                                                         |
| Horario comercial                         |     Sí     | Decisión del negocio que cambia con las estaciones.                                                                               |
| Zona horaria                              |   **No**   | Cambiarla reinterpretaría la hora local de **todas** las citas ya guardadas, incluidas las confirmadas con el cliente.            |
| Equipos, antelación mínima, plazo de pago |   **No**   | Modificarlos cambia lo que el sistema le **promete** al cliente. Merecen un cambio pensado y revisado, no un campo de formulario. |
| Ciudad y estado de la base de operaciones |   **No**   | Es el origen desde el que se calculan distancias y recargos por zona: moverla cambia todos los precios.                           |

### 12.4. Permisos: solo administración, también para leer

| Acción                                          | ADMIN | DISPATCHER | CLEANER |
| ----------------------------------------------- | :---: | :--------: | :-----: |
| Leer el teléfono público (`/business-settings`) |  ✅   |     ✅     |   ✅    |
| Abrir la pantalla de configuración              |  ✅   |     ❌     |   ❌    |
| Guardar cambios                                 |  ✅   |     ❌     |   ❌    |

Que solo administración pueda **escribir** es lo evidente: quien pudiera
cambiar el teléfono podría desviar las llamadas de todos los clientes a otro
número, y el sitio lo anunciaría con total naturalidad. Es una suplantación de
la empresa hecha desde dentro, y no tiene nada que ver con coordinar una
agenda.

Que solo administración pueda **leer la pantalla** es menos evidente, porque
el teléfono es público. La diferencia es lo que lo acompaña: esa pantalla dice
además **quién lo cambió y cuándo**, y eso sí es información interna. Quien
solo necesita el teléfono lo tiene en el endpoint público.

### 12.5. Dónde se guarda

Todo vive en **una sola fila** de `business_settings`, con la clave
`business`. La tabla es de clave y valor, así que se podría repartir; se
guarda junto porque los tres datos cambian a la vez y **una escritura de una
fila no puede quedarse a medias**. Con tres filas, un fallo entre la segunda y
la tercera dejaría el negocio con el horario nuevo y el teléfono viejo, y
nadie se enteraría.

El cambio y su auditoría van en la misma transacción. El registro guarda **qué
campos** cambiaron, no solo que «se guardó algo»: ante una reclamación, lo
primero responde y lo segundo obliga a comparar dos volcados a mano.

### 12.6. Nunca tumba el sitio público

`BusinessSettingsService.get()` **no falla jamás**. Si la fila no existe, si
tiene datos de una versión anterior del contrato o si la base no responde,
devuelve los valores de partida y deja constancia en el log del servidor.

El sitio público hace lo mismo por su lado: si la API no contesta, pinta la
página entera con el horario de partida y **sin teléfono**. Está comprobado
cortando toda comunicación con la API en un navegador real: portada,
cotizador y contacto siguen visibles, sin un solo error de JavaScript.

El motivo es duro pero claro: ésta es la página que genera los ingresos.
Tumbarla porque no se pudo leer un número de teléfono sería un intercambio
pésimo.

Se lee con una caché en memoria de 30 segundos, porque el motor de agenda
consulta el horario en **cada** petición de disponibilidad. Es por instancia:
con varias instancias, 30 segundos es el retardo máximo hasta que todas ven un
cambio.

### 12.7. El horario manda de verdad sobre la agenda

No es decorativo. `AvailabilityService.schedulingConfig()` resuelve el horario
guardado en cada petición, y `BookingsService` lo recibe **ya resuelto** para
que la comprobación final de la franja use el mismo horario que la primera. Si
se volviera a leer dentro de la transacción, un cambio hecho en ese instante
podría tumbar una reserva que acababa de darse por buena.

> **Cerrar un día NO cancela lo ya agendado.** Es deliberado, y la pantalla lo
> avisa. Una reserva confirmada es un compromiso con un cliente; el horario
> decide qué se puede reservar **a partir de ahora**. Sin ese aviso, alguien
> cierra el domingo dando por hecho que las citas de ese domingo desaparecen.

### 12.8. Seguridad: el teléfono acaba dentro de un enlace

Éste es el riesgo real de la funcionalidad. El valor guardado termina en
`href={`tel:${phone}`}` en todas las páginas del sitio. Si se admitiera texto
libre, alguien con acceso al panel podría guardar `javascript:...` y convertir
el botón de llamar del sitio entero en un ataque contra cada visitante que lo
pulse.

Por eso el esquema exige `^\+[1-9]\d{7,14}$`: empieza por `+` y sigue con
dígitos. **No existe forma de colar otro esquema de URL.** Hay pruebas con las
formas que un atacante intentaría de verdad, no solo con «texto feo»:

```
javascript:alert(1)   tel:+14045550123   "><script>alert(1)</script>
```

El correo sigue el mismo criterio, validado y normalizado a minúsculas.

**Normalizar no es validar.** El campo acepta `(404) 555-0123` porque es como
lo escribe una persona, y lo convierte al guardar. Pero lo que sale de esa
conversión **pasa igualmente por el esquema**. Hay una prueba dedicada a
recordarlo, porque confundir las dos cosas es exactamente como se cuelan
valores que «parecían limpios».

### 12.9. Un fallo que sólo se ve en un navegador

Los primeros guardados fallaban con «no se pudo contactar con el servidor»,
como si la API estuviera caída. No lo estaba: **`PUT` no figuraba en los
métodos permitidos de CORS**. El navegador bloqueaba la petición tras el
preflight y la aplicación solo veía un fallo de red.

Ni `curl` ni las pruebas de la API lo detectan, porque ninguno de los dos hace
preflight. Es el segundo fallo de esta familia en el proyecto (el primero fue
la cabecera `Authorization`, en §10). Ambos sólo aparecen probando en un
navegador de verdad.

Al arreglarlo salió un segundo problema visible en la misma pantalla: los
errores de validación se mostraban **con el texto del esquema, en español**, a
alguien con el panel en inglés. Ahora el formulario traduce por campo; los
mensajes del esquema son para quien programa.

### 12.10. Qué está probado

**Contra PostgreSQL real** (28 pruebas): coordinación no puede guardar aunque
tenga sesión válida (403) ni ver quién cambió qué; un intento rechazado no
deja el cambio a medias; la auditoría registra qué campos cambiaron; se
rechazan teléfono con otro esquema, correo inválido, cierre anterior a la
apertura, horas imposibles (`25:00`), semana incompleta y campos que no
existen en el contrato; el endpoint público **no** filtra quién lo cambió; una
fila corrupta no tumba el sitio ni la agenda, y guardar de nuevo la repara.

**Del contrato** (47 pruebas en `@freshness/types`): formato del teléfono,
normalización de lo que se teclea, agrupación de días y formato de horas por
idioma.

**En navegador real**: coordinación no ve el botón de configuración y
administración sí; se teclea `(404) 555-0123` y la pantalla anuncia que
guardará `+1 (404) 555-0123`; un teléfono imposible se rechaza antes de
enviarse, con el mensaje en el idioma del panel; al guardar aparece quién lo
cambió y cuándo; **cerrar el lunes deja ese día con cero franjas mientras el
martes conserva 17**; y el sitio público recoge teléfono, correo y horario sin
desplegar nada, en inglés y en español.

---

## 13. Asignar equipo a una reserva

> Etapa 2.7. Quién va a cada trabajo y quién manda, editable desde el detalle
> de la reserva.

### 13.1. El problema que resuelve

Hasta aquí la agenda decía **qué** hay que limpiar y **cuándo**, pero no
**quién** va. Eso se organizaba por fuera —un mensaje, una llamada, la
memoria de quien coordina— y lo que se organiza por fuera se olvida.

La guardia que justifica el módulo entero es la del **solapamiento**. Una
lista de nombres sin comprobaciones la lleva cualquiera en una libreta; lo que
una libreta no hace es avisarte de que acabas de poner a la misma persona en
dos casas a la vez. Ese error no se descubre hasta que el equipo llega a la
segunda casa y no hay nadie: con el desplazamiento ya pagado y el cliente
esperando.

### 13.2. El equipo se guarda entero, no persona a persona

`PUT /admin/bookings/:id/assignments` recibe el conjunto completo y reemplaza
lo que hubiera. No hay altas ni bajas sueltas, por tres motivos:

- **El equipo es una decisión conjunta.** «Van Ana y Beto, manda Ana» se
  piensa de golpe.
- **La regla del responsable solo tiene sentido sobre el conjunto.** Con
  operaciones sueltas habría instantes con dos responsables o con ninguno.
- **Una escritura de todo el conjunto no puede quedarse a medias.** Se borra y
  se reescribe dentro de una transacción: si algo falla, la reserva conserva
  el equipo anterior en vez de quedarse con medio equipo, que es justo lo que
  provocaría que alguien no se presentara.

### 13.3. El solapamiento se mide con desigualdades estrictas

Dos trabajos se pisan si `inicioA < finB` **y** `finA > inicioB`.

Usar `<=` haría que dos limpiezas consecutivas —una termina a las 13:00 y la
siguiente empieza a las 13:00— contaran como choque, y encadenar limpiezas es
exactamente como trabaja este negocio. Hay una prueba dedicada a ese caso.

Quedan fuera de la comprobación las reservas **canceladas**: a una cancelada
no va nadie, y contarla dejaría a alguien "ocupado" en una franja que en
realidad está libre, rechazando trabajos reales por culpa de uno que no
existe.

### 13.4. El error nombra a quién choca y con qué reserva

Un «no se puede asignar» a secas obliga a buscar el choque a mano por toda la
agenda. El `409` de `STAFF_DOUBLE_BOOKED` trae en `fields[0].message` el
nombre de la persona y la referencia del otro trabajo —`Cleo Limpia ·
FT-2026-0002`— y el panel lo pinta bajo el mensaje traducido.

Es la **única excepción** a la regla de que `fields[].message` es texto
técnico que no se enseña: aquí son datos, no una frase, así que no hay nada
que traducir. Está anotado en `packages/types/src/errors.ts` para que nadie lo
tome por un descuido.

Al fallar, **el formulario no se cierra**: se conserva lo elegido para poder
quitar solo a quien choca en vez de rehacer el equipo entero.

### 13.5. Privacidad: el selector no es la agenda telefónica

`GET /admin/staff` devuelve **identificador, nombre, apellido y puesto. Nada
más.** Ni correo ni teléfono.

Para decidir a quién mandas a una casa basta el nombre y el puesto. Incluirlos
convertiría una pantalla que se abre a diario en la lista de contacto de toda
la plantilla, expuesta a cualquiera con acceso al panel y a cualquier sesión
que se quede abierta en un portátil.

El contrato es estricto, así que un `email` añadido «porque es útil» **no
pasa la validación** en vez de colarse sin que nadie lo revise. Hay dos
pruebas dedicadas a eso.

Solo aparece personal **activo**: quien causó baja no puede ir a ninguna casa,
y ofrecerlo solo genera asignaciones que hay que deshacer. Sus asignaciones
antiguas **se conservan**: el historial cuenta lo que de verdad pasó, y
borrarlo dejaría trabajos sin responsable.

### 13.6. Permisos

| Acción                    | ADMIN | DISPATCHER | CLEANER |
| ------------------------- | :---: | :--------: | :-----: |
| Ver el equipo asignado    |  sí   |     sí     |   no    |
| Cambiar el equipo         |  sí   |     sí     |   no    |
| Ver el personal asignable |  sí   |     sí     |   no    |

**Limpieza queda fuera**, y no por desconfianza: asignarse trabajos a uno
mismo cambia quién cobra qué y de quién es la responsabilidad si algo sale mal
en esa casa. Esa decisión la toma quien coordina. Hoy `CLEANER` no llega
siquiera al detalle de la reserva, así que la comprobación de rol en el panel
es una segunda capa; la puerta la cierra el servidor con un `403`.

Administración y coordinación **sí aparecen en el selector**. En un negocio
pequeño quien manda también limpia, y el puesto va escrito junto al nombre,
así que es una elección informada, no un descuido.

### 13.7. Qué se puede y qué no

- **Vaciar el equipo es válido.** Cuando alguien causa baja o se reorganiza el
  día hay que poder dejar la reserva sin nadie mientras se decide.
- **Un equipo sin responsable es válido**, pero el panel lo avisa en cuanto
  hay más de una persona: si surge un imprevisto en la casa, nadie sabe quién
  decide.
- **Dos responsables no.** El contrato lo rechaza, y el panel usa un botón de
  radio en vez de casillas para que ese estado no llegue a formarse.
- **Una reserva cancelada no admite equipo.** El panel no ofrece el botón y el
  servidor responde `400`.
- **Una completada sí se puede corregir.** Arreglar quién hizo un trabajo ya
  hecho es mantenimiento legítimo del historial.
- **Tope de diez personas.** No es un límite del negocio, sino una defensa:
  sin él, una petición podría pedir asignar a toda la plantilla y obligar a
  comprobar solapamientos de cada una contra toda la agenda.

### 13.8. Auditoría: se guarda el antes y el después

`booking.team_changed` registra `reference`, `before`, `after` y la IP, dentro
de la misma transacción que el cambio.

Ante un «nadie se presentó», la pregunta no es solo quién estaba asignado
ahora, sino **quién lo estaba antes y quién lo cambió**. Un intento rechazado
—por choque de horarios o por personal de baja— no deja registro **ni
asignación**: la comprobación va antes de la transacción.

### 13.9. Un fallo que esta etapa destapó y que ya estaba en producción

Al escribir las pruebas, catorce fallaban con `429 RATE_LIMITED`. La primera
sospecha fue el limitador global de 60 peticiones por minuto, y subirlo **no
cambió nada**.

La causa era el otro: **con limitadores con nombre propio, el de cotizaciones
(10/min) se aplica a TODA la API**, no solo a `/quotes`. Cubre cualquier ruta
que no lo desactive con `@SkipThrottle({ quotes: true })`, y los controladores
de reservas del panel no lo desactivaban.

**No era un problema de la prueba: era el panel real cayéndose.** Cualquiera
coordinando —abrir la agenda, entrar en una reserva, volver, entrar en otra—
recibía un `429` en la petición número 11 de cada minuto. Venía de la etapa
2.3 y nadie lo había notado porque ninguna sesión de prueba había hecho once
peticiones seguidas.

Tres cambios, ninguno toca el límite real:

1. La exención vive en `SKIP_QUOTE_THROTTLER` (`common/throttling.ts`), con el
   porqué al lado.
2. Se pone **a nivel de clase** en los seis controladores de `/admin`. Puesta
   método a método se olvida al añadir un endpoint; puesta en la clase, los
   endpoints futuros nacen cubiertos.
3. Dos guardias para que no se repita:
   - `assignments.e2e.test.ts` deja el limitador de cotizaciones **en su valor
     real de 10** y hace más de sesenta llamadas al panel. Si alguien quita la
     exención, se pone rojo solo.
   - `admin-throttling.test.ts` recorre los controladores declarados en
     `AdminModule` y comprueba **ruta por ruta** que están exentas. Recorre el
     módulo en vez de una lista escrita a mano, así que un controlador nuevo
     queda cubierto el día que se añade.

Es el mismo patrón que el `PUT` que faltaba en CORS (§12.9): un fallo que
ninguna prueba corta detecta y que solo aparece usando el panel de verdad un
rato seguido.

### 13.10. Qué está probado

**Contra PostgreSQL real** (25 pruebas): se rechaza asignar a alguien que ya
tiene un trabajo que se pisa, con el nombre y la referencia en el error; **dos
trabajos consecutivos sí se permiten**; coordinación puede y limpieza recibe
`403`; el listado de personal no trae correo ni teléfono; no se puede asignar
a quien está de baja ni a un identificador inventado; una reserva cancelada se
rechaza y una completada se acepta; dos responsables, la misma persona dos
veces y los campos fuera de contrato se rechazan; vaciar el equipo funciona; y
un intento rechazado no deja ni asignación ni registro.

**Del contrato** (14 pruebas en `@freshness/types`): las dos reglas del
conjunto, el tope de diez, los campos estrictos y —dos pruebas dedicadas— que
el selector de personal **no admite correo ni teléfono**.

**De los limitadores** (13 comprobaciones): cada ruta de cada controlador del
panel está exenta del limitador de cotizaciones.

**En navegador real**, con base PostgreSQL y dos trabajos que se pisan
sembrados a propósito:

1. Coordinación abre una reserva sin equipo y ve «Todavía no hay nadie
   asignado a este trabajo».
2. El selector ofrece a las cuatro personas activas con su puesto; la que está
   de baja **no aparece**.
3. Marcar a quien ya tiene otro trabajo a la misma hora devuelve `409` y la
   pantalla muestra el mensaje traducido más `Cleo Limpia · FT-2026-0002`.
4. Se quita a esa persona **sin perder el resto de lo elegido**, se marca a
   otra, se le hace responsable y se guarda.
5. Marcar responsable a otra persona desmarca a la anterior: nunca hay dos.
6. La agenda muestra «Assigned to Dario Limpia, Ada Jefa».
7. Una reserva cancelada **no ofrece el botón** de cambiar equipo.
8. Limpieza recibe `403` y no llega ni a la agenda.
9. En español y a 390 px de ancho, sin desbordamiento horizontal.

Y en la base de datos, tras el recorrido: **un** registro `booking.team_changed`
con `before: []`, el `after` correcto y la IP; el intento rechazado no dejó
rastro.

---

## 14. Dar de alta personal e invitarlo al panel

> Etapa 2.8. Hasta aquí, la única forma de que alguien existiera en el sistema
> era meterlo a mano en la base de datos. La etapa 2.7 dejó asignar equipos,
> pero no había a quién.

### 14.1. Existir y poder entrar son dos cosas distintas

Es la distinción que sostiene toda esta etapa, igual que «identidad y
autoridad» (§1) sostiene el acceso:

|                                | Qué hace falta                              | Quién lo concede      |
| ------------------------------ | ------------------------------------------- | --------------------- |
| **Recibir trabajos asignados** | una ficha en `staff`                        | el alta               |
| **Entrar al panel**            | además, una cuenta vinculada (`authUserId`) | la invitación, aparte |

**`authUserId` nulo es un estado legítimo, no un dato a medias.** Una
limpiadora necesita existir para que se le asignen trabajos, no para iniciar
sesión. Hoy, de hecho, no tiene ninguna pantalla que mirar.

Y la sesión se resuelve **por ese identificador, nunca por el correo**. Dar de
alta a alguien con su correo **no le abre ninguna puerta por sí solo**. Merece
la pena tenerlo claro también en sentido contrario: cambiarle el correo a
alguien que ya entra **no le revoca nada**, porque no es su llave. Para eso
está darle de baja.

### 14.2. Alta e invitación son dos botones, y el segundo pregunta

Crear una ficha es decir «esta persona trabaja aquí». Invitarla es decir
«esta persona puede ver los datos de todos los clientes». Son decisiones de
peso muy distinto.

Si fueran el mismo formulario, la segunda se tomaría **por inercia de estar
rellenando campos**, que es exactamente como se reparten accesos sin querer.
Por eso el alta no pide nada relacionado con credenciales —no hay contraseña
que escribir en ninguna pantalla— e invitar es una acción aparte que además
**pide confirmación**, porque no tiene deshacer: la cuenta queda creada en el
proveedor aunque luego se dé de baja la ficha.

El botón de invitar solo se pinta donde tiene sentido: alguien **activo**, **sin
cuenta todavía**, y en un despliegue que **pueda** mandar invitaciones.

### 14.3. Por qué invitar y no vincular por correo

Se valoraron tres caminos para conceder acceso:

| Camino                               | Coste                                       | Riesgo                                                                                 |
| ------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Invitar desde el panel** ✅        | guardar la clave de servicio en el servidor | esa clave salta todas las reglas de la base; si se filtra, se filtra todo              |
| Vincular por correo al primer acceso | ninguno                                     | depende de dos ajustes **fuera del código** (confirmación de correo, registro cerrado) |
| Pegar el identificador a mano        | ninguno                                     | obliga a entrar en Supabase cada vez, y es justo la dependencia que el panel elimina   |

Se eligió **invitar**. El motivo de descartar la vinculación por correo no es
que sea insegura hoy, sino que **su seguridad vive fuera del repositorio**:
basta con que alguien active el registro público en el proyecto para que
cualquiera pueda reclamar la ficha de un empleado. Invitando, la cuenta la
crea la API y no hay ningún correo en el que confiar.

La clave de servicio vive **solo** en el entorno del servidor, como la de
Stripe (`docs/08-variables-de-entorno.md`), nunca llega al navegador y **no se
escribe jamás en un registro**, ni siquiera recortada.

### 14.4. Qué pasa sin la clave configurada

La aplicación **arranca igual**. La clave es opcional a propósito: el alta de
personal, las asignaciones y todo lo demás funcionan, y lo único que no se
puede es invitar. El directorio devuelve `canInvite: false`, el panel esconde
el botón y explica por qué, y llamar al endpoint directamente responde `503`
con un motivo claro en vez de un error del proveedor.

**No existe un «proveedor simulado de invitaciones»**, y es deliberado: uno
así podría quedarse encendido en producción y vincularía fichas a cuentas
inventadas que _parecen_ tener acceso y no lo tienen. Las pruebas apuntan
`SUPABASE_URL` a un servidor de mentira y recorren el mismo código que
producción.

### 14.5. El orden importa: primero invitar, después guardar

Se manda la invitación y **solo si sale bien** se guarda el vínculo. Al revés,
un fallo del proveedor dejaría una ficha marcada como «con acceso» sin cuenta
detrás, y nadie se enteraría hasta que esa persona intentara entrar, que suele
ser el peor día posible.

Por el mismo motivo, este adaptador **sí propaga el fallo**, al contrario que
el de correo (`docs/14-avisos.md`), que se los traga: un correo que no sale no
puede tumbar una reserva ya pagada, pero una invitación que no sale tiene que
enterarse quien creía estar dando acceso.

### 14.6. No quedarse sin administración

Todas las demás puertas de este panel se pueden volver a abrir desde dentro:
si cancelas una reserva por error la vuelves a crear, si apagas un aviso lo
enciendes. **Quedarse sin ningún administrador activo no se deshace desde el
panel**, porque hace falta ser administrador para crear otro, y la única
salida sería entrar a la base de datos a mano.

Se protege con **tres capas**, y conviene saber cuál salta:

1. **Nadie se cambia a sí mismo el puesto ni se da de baja.** Esto solo ya
   basta para cualquier petición suelta: quien pide el cambio es
   administración activa y sigue siéndolo después. (Sí puede corregir su
   propio nombre, teléfono o correo: la guardia cierra lo que te deja fuera,
   no la edición de tu ficha.)
2. **El recuento posterior a la escritura**, con las filas de administración
   bloqueadas, cubre la carrera: dos administradoras degradándose a la vez.
   Se cuenta **después** de escribir y no antes, porque contar antes obliga a
   simular mentalmente el efecto del cambio, y esa simulación es justo donde
   se cuelan los casos no previstos.
3. **La comprobación de rol relee la ficha en cada petición**, así que quien
   acaba de dejar de ser administradora ni siquiera llega al servicio.

La segunda es **defensa en profundidad**: con la primera y la tercera en pie
no se ha conseguido provocar que salte, y la prueba de concurrencia no fija
cuál de las tres responde —eso sería fijar una carrera— sino la propiedad que
importa: **una de las dos peticiones pasa, la otra no, y queda alguien que
pueda administrar**. Se mantiene porque las tres protegen cosas distintas y la
primera es la candidata evidente a relajarse el día que alguien quiera «ceder
la administración a otra persona».

### 14.7. Dar de baja, no borrar

`isActive: false` conserva la ficha y su historial. Borrar dejaría trabajos
pasados sin responsable y el registro de auditoría contaría una historia
incompleta.

La baja **cierra el acceso en la petición siguiente**, sin esperar a que
caduque ningún token, porque la sesión comprueba `isActive` cada vez (§1). Y
esa persona desaparece del selector de asignación, aunque sus asignaciones
antiguas se conservan (§13.5).

### 14.8. Privacidad: tres pantallas, tres niveles

| Pantalla                       | Quién              | Qué ve                                     |
| ------------------------------ | ------------------ | ------------------------------------------ |
| Selector de asignación (§13.5) | ADMIN + DISPATCHER | nombre, apellido, puesto                   |
| Directorio de personal         | **solo ADMIN**     | además correo, teléfono y estado de acceso |
| —                              | nadie              | el identificador de la cuenta              |

Que el directorio sea **solo de administración incluso para leer** es menos
evidente que lo demás, porque coordinación ya ve los nombres de la plantilla.
La diferencia es **quién tiene acceso al panel**: eso es un mapa de qué
cuentas existen, que es por donde empieza quien quiera colarse.

El **identificador de la cuenta no sale nunca**. Se traduce a un estado —«sin
acceso», «invitada», «con acceso»— antes de responder: al panel no le sirve
para pintar nada y en cambio ayuda a suplantar. Tampoco se guarda en el
registro de auditoría, que registra a quién se invitó y con qué puesto.

### 14.9. Un mensaje que mentía

Al probar esto en un navegador apareció un fallo anterior. Una cuenta de
limpieza **entra correctamente** —es personal activo— pero cada pantalla del
panel le responde `403` porque ninguna es para su puesto. El panel la
expulsaba diciendo **«tu sesión ha terminado, vuelve a iniciar sesión»**.

Volver a entrar no arregla nada: la deja reintentando ante una puerta que no
se le va a abrir. El texto correcto ya existía sin usar
(`admin.signedOut.noAccess`), y el enganche de sesión ya distinguía bien los
dos casos; lo que estaba fijo en «caducada» era el contenedor del panel.

Ahora el motivo lo decide quien recibe el error: `401` es «tu sesión ha
caducado» y `403` es «tu cuenta no puede ver esto». Es un arreglo del mensaje,
**no** de la causa: el personal de limpieza seguirá sin tener a dónde ir hasta
que exista su vista propia.

### 14.10. Qué está probado

**Contra PostgreSQL real** (37 pruebas en dos ficheros): coordinación no ve el
directorio ni puede dar de alta o invitar; el alta **nace sin acceso**; el
correo se normaliza y el repetido se rechaza; un alta que traiga
`authUserId` se rechaza; nadie se cambia su propio puesto ni se da de baja,
pero sí corrige su nombre; dos administradoras degradándose a la vez dejan
siempre una en pie; un rechazo no deja el cambio a medias; la baja cierra el
acceso en la petición siguiente; la invitación manda la clave en las dos
cabeceras y guarda el identificador; no se invita dos veces ni a quien está de
baja; **si el proveedor rechaza, la ficha se queda sin acceso**; la auditoría
no guarda el identificador de la cuenta; y el directorio nunca lo devuelve.

**Sin la clave configurada** (fichero aparte, porque la configuración se
congela al importar): la aplicación arranca, el directorio avisa con
`canInvite: false`, invitar responde `503` con motivo claro, y **dar de alta
sigue funcionando**.

**Del contrato** (19 pruebas): normalización de correo y nombre, teléfono en
formato internacional, y —lo que importa— que por el alta y la edición **no
pueda colarse `password`, `authUserId`, `isActive` ni `invitedAt`**.

**En navegador real**, con PostgreSQL y un servidor que imita la API de
administración de Supabase: se da de alta tecleando `DARIO@Example.COM` y
`(404) 555-0199`, y se guarda normalizado; la ficha nace diciendo «sin
acceso»; el correo repetido se rechaza con su mensaje; al invitar pasa a
«Invitada el …» y el botón desaparece; en la propia ficha el puesto y la
casilla de activa están bloqueados; dar de baja a coordinación la mueve a «De
baja» y **esa cuenta deja de entrar en el acto**, viendo ahora el mensaje
correcto; y todo en español a 390 px sin desbordamiento horizontal.

En la base, tras el recorrido: `staff.created`, `staff.invited` y
`staff.updated` con el antes y el después, y **ningún identificador de cuenta
en el registro**.

---

## 15. Elegir contraseña: invitación y recuperación

> Etapa 2.9. Cierra un hueco que dejó la anterior: se podía invitar a alguien,
> pero el enlace de la invitación no llevaba a ninguna parte, y quien perdía
> ese correo se quedaba fuera para siempre.

### 15.1. El hueco que dejó la etapa 2.8

El cliente del panel tiene **`detectSessionInUrl: false`**, una decisión de
seguridad tomada en la etapa 2.3 con este razonamiento: «no hay inicio de
sesión por enlace, así que desactivarlo evita que un enlace manipulado con
parámetros de sesión tenga ningún efecto».

Era correcto entonces. Dejó de serlo al añadir las invitaciones, porque **una
invitación es exactamente eso: un inicio de sesión por enlace**. Con la opción
apagada, quien recibía la invitación pulsaba el enlace, aterrizaba en el panel
y **no pasaba nada**.

### 15.2. Se lee a mano, y solo en una pantalla

La salida fácil era encender `detectSessionInUrl`. No se ha hecho, porque
entonces **cualquier pantalla del panel aceptaría una sesión metida en la
dirección**: bastaría con mandarle a alguien un enlace a la agenda con un
token pegado para que se quedara trabajando dentro de la sesión de otra
persona sin notarlo.

En su lugar, `lib/password-link.ts` lee el enlace **a mano**, y la sesión solo
se abre en **un sitio y tras una decisión explícita**: la pantalla de elegir
contraseña. La puerta es estrecha a propósito:

- solo `type=invite` y `type=recovery`; `magiclink`, `signup` y cualquier otro
  se ignoran;
- hacen falta **los dos** tokens, el de acceso y el de renovación;
- y hay una prueba por cada tipo rechazado, porque esa lista es justo lo que
  alguien ampliaría sin pensarlo.

En el resto del panel, un enlace manipulado **no hace absolutamente nada**, y
hay una prueba en navegador que lo comprueba: se abre la agenda con un token
pegado y sigue apareciendo la pantalla de acceso.

### 15.3. Dos caminos, y no son iguales

|                  | Quién lo inicia                       | Cómo vuelve                   | Por qué                                                                  |
| ---------------- | ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ |
| **Invitación**   | el servidor, con la clave de servicio | tokens en el fragmento        | el navegador de quien la recibe no participó, así que no hay verificador |
| **Recuperación** | la propia persona                     | un `code` que hay que canjear | su navegador sí guardó el verificador                                    |

La recuperación es el camino bueno: **los tokens no viajan nunca en la
dirección**, así que no quedan en el historial. La invitación no puede usarlo
por construcción.

De ahí un caso que merece su propio mensaje: si alguien pide el enlace en el
ordenador y lo abre **en el móvil**, el verificador no está y el canje falla.
Decirle «caducado» lo mandaría a pedir otro enlace para repetir el mismo
error, así que se le dice que lo abra en el mismo navegador desde el que lo
pidió.

Y en cuanto se lee el enlace, **lo primero que se hace es borrarlo de la barra
de direcciones**: mientras siga ahí, el token está en el historial del
navegador y en cualquier captura de pantalla.

### 15.4. El mismo mensaje exista o no la cuenta

Pedir el enlace responde **siempre lo mismo**, palabra por palabra, y sin
mirar lo que contesta el proveedor.

Decir «ese correo no está registrado» convertiría esa pantalla en una forma de
averiguar quién trabaja aquí, probando direcciones una a una. En una empresa
pequeña eso no es teórico: con cuatro apellidos se saca la plantilla entera, y
con la plantilla se sabe a quién suplantar. Es la misma regla que el mensaje
único de la pantalla de acceso (§10).

Tampoco se distingue un fallo del proveedor. Es tentador («ha fallado el
envío, reinténtalo»), pero el proveedor limita por dirección: un error
distinto para un correo que existe y otro para uno que no volvería a filtrar
lo mismo por la puerta de atrás. Hay una prueba en navegador que compara las
dos respuestas carácter a carácter.

### 15.5. La regla de la contraseña: largo y nada más

**Doce caracteres, sin exigir mayúsculas, números ni símbolos.**

Esas reglas producen `Password1!` una y otra vez, que es corta y adivinable, y
empujan a apuntarla en un papel pegado al monitor. Doce caracteres
cualesquiera resisten mucho más que ocho con adornos, y una frase que se
recuerda es mejor contraseña que una palabra con signos.

Quien manda de verdad es el proveedor de identidad, que aplica su propio
mínimo en el servidor. Esto es una **guardia de interfaz**: evita que alguien
elija algo débil y se entere después, con un error del proveedor en su idioma.
No sustituye a la comprobación del servidor, la adelanta.

Se pide **dos veces** porque el campo va oculto: una errata al elegirla no se
ve, y se descubriría al siguiente intento de entrar, cuando ya no hay forma de
saber qué se tecleó. También hay un botón de ver la contraseña, que es el
remedio al mismo problema.

### 15.6. Dos detalles pequeños que evitan llamadas

- **Se confirma antes de seguir.** Al guardar, la pantalla dice «contraseña
  guardada» y espera. Si esta cuenta resultara no ser personal del panel —le
  puede pasar a quien fue dado de baja después de pedir el enlace— lo
  siguiente que vería sería la pantalla de acceso diciendo que no tiene
  permiso, y parecería que la contraseña tampoco se guardó. Se guardó.
- **Se escucha el cambio de fragmento.** Si el panel ya está abierto en la
  pestaña donde se pulsa el enlace, el navegador **no recarga**: la dirección
  pasa de `/` a `/#access_token=…`, que para él es la misma página con otro
  ancla. Sin esto el enlace no haría nada. Apareció probando en navegador, no
  razonando.

### 15.7. Qué está probado

**Del contrato** (11 pruebas): el mínimo de doce, que se acepta una de solo
minúsculas si es larga, el tope alto que evita hacer calcular el hash de
megabytes, las dos vueltas y que se avisa de la longitud antes que de la
coincidencia.

**De la lectura del enlace** (15 pruebas, sin navegador porque es una función
pura sobre una cadena): invitación, recuperación por código, enlace caducado,
que el error manda sobre cualquier token que venga en el mismo enlace, y
—**las que importan**— que se ignoran `magiclink`, `signup`, `email_change`,
un tipo vacío y un fragmento al que le falta el token de renovación.

**En navegador real**, contra un servidor que imita al proveedor: el acceso
ofrece recuperar; la respuesta es **idéntica carácter a carácter** para un
correo que existe y para uno que no; un enlace de invitación abre la pantalla
y **la dirección queda limpia**; una contraseña corta y dos que no coinciden
se rechazan con su mensaje; el botón de ver funciona; al guardar se confirma;
un enlace caducado explica qué hacer; **un token pegado a la agenda no abre
sesión**; y todo en español, en un navegador en español, a 390 px sin
desbordamiento.

### 15.8. Lo que sigue sin existir

- **No hay segundo factor.** Para un panel que ve los datos de todos los
  clientes, es la siguiente pieza de seguridad que conviene.
- **No hay selector de idioma en la pantalla de acceso.** El idioma sale del
  navegador, que acierta casi siempre, pero quien tenga el navegador en inglés
  y prefiera español no puede cambiarlo hasta entrar.
