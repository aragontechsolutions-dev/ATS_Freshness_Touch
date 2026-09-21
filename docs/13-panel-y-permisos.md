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
