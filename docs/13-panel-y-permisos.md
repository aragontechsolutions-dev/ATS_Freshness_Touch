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

| Tarea                                                   | Bloque |
| ------------------------------------------------------- | ------ |
| Cambiar estado, asignar equipo                          | 2.3.b  |
| Capturar y liberar el depósito desde el panel           | 2.3.b  |
| Configuración del negocio (contacto, horarios) editable | 2.3.b  |
| Liberar franjas cuyo `holdExpiresAt` ya venció          | 2.3.b  |
| Vista propia del personal de limpieza                   | 2.3.b  |
| El panel en sí (aplicación web)                         | 2.3.c  |

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
