# 47 — El error que nadie ve

> Etapa 3.31. Tapa el hueco **B2** de `docs/43-los-huecos-que-quedan.md`.
>
> Código: `packages/types/src/error-monitor.ts`,
> `apps/api/src/health/error-monitor.service.ts`,
> `apps/api/src/common/filters/error-recorder.ts`,
> `apps/admin/src/components/ErroresRecientes.tsx`.
>
> **No hay migración y no hay variable de entorno nueva.** Es a propósito, y
> el §4 explica por qué.

---

## 1. Qué faltaba

`AllExceptionsFilter` ya convertía cualquier excepción en una respuesta
limpia, y ya escribía el fallo con su traza completa en el log. Lo que no
hacía nadie era **leer ese log**.

Es la misma historia que creó `SystemAlertService` (`docs/30` §1): las dos
caídas de aquella semana estaban las dos escritas, en castellano claro, con el
nombre de la columna que faltaba. Una llevaba horas en el log; la otra, diez
días. Y la conclusión de entonces sigue valiendo:

> Nadie entra a Render a leer logs un martes por la tarde sin un motivo. El
> motivo tiene que venir a buscarte.

La alarma de estado resolvió eso para la **salud**: cinco preguntas con
respuesta de sí o no, mirándose cada pocos minutos. Pero las cinco pueden
decir «todo bien» mientras una ruta devuelve 500 en cada petición. Una
excepción no deja la base caída ni las migraciones pendientes:

**deja a una persona sin poder reservar, y no se nota desde dentro.** El
cliente ve un mensaje genérico, cierra la pestaña y se va.

---

## 2. Qué se construyó

Tres piezas y ninguna más:

| Pieza                                    | Qué hace                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `huellaDelError()` en `@freshness/types` | Convierte un fallo en una etiqueta sin datos dentro                      |
| `ErrorMonitorService`                    | Cuenta en memoria, agrupa por huella, contesta la **sexta** comprobación |
| `ErroresRecientes` (panel)               | Enseña **qué** falló, no solo cuántos                                    |

El cable que lo une es el filtro de excepciones, que es la única pieza por la
que pasan todas las excepciones de la API.

### La sexta comprobación

```
errors   →  ok        ningún 5xx en la última hora
            degraded  de 1 a 9      → errors.recent
            down      10 o más      → errors.many
```

Al colgarse de `SystemChecksService`, **hereda la alarma entera sin escribir
una línea de alarma nueva**: aviso solo en la transición, silencio mínimo de
seis horas si el problema persiste, aviso también al recuperarse, y el chat
técnico de Telegram en vez del de operaciones (`docs/30` §6).

Tres estados y no dos porque a un 500 suelto y a veinte no se responde igual:
el primero es algo que mirar hoy, los veinte son algo roto ahora mismo. Si la
fila y el aviso dijeran lo mismo en los dos casos, no ayudarían a decidir cuál
de las dos cosas es.

### Lo que NO se cuenta

Solo los **5xx**. Un 404 de un robot buscando `/wp-login.php`, un 429 de
alguien que pulsa dos veces, un 400 de un formulario a medio rellenar: son
peticiones que no tenían que funcionar, no fallos del sistema.

Contarlas haría sonar la alarma todos los días y, a las dos semanas, nadie la
leería. **El mismo final que tuvo el log.**

---

## 3. Por qué no hay Sentry

La respuesta normal a «no hay monitorización de errores» es instalar Sentry.
Aquí no, y la razón no es el precio.

Un monitor de errores de los de verdad manda **el stack trace completo** a un
servidor ajeno, y un stack trace de esta API lleva dentro, muchas veces, los
argumentos de la llamada que falló: un correo, una dirección, el cuerpo de una
reserva. Eso convierte al servicio en un **subencargado del tratamiento** con
datos personales de clientes de Georgia, y entonces:

- hay que nombrarlo en la política de privacidad (`apps/landing/src/legal/`),
- hay que subir `PRIVACY_VERSION`, con lo que **todas las aceptaciones ya
  guardadas dejan de estar al día** (`docs/44` §6),
- y hay una credencial más que proteger en Render.

Para una empresa de limpieza con un servidor y dos aplicaciones web, eso no
vale lo que se compra. Lo que de verdad hacía falta —que alguien se entere sin
tener que mirar— **ya estaba construido**: la alarma, el chat técnico y la
pantalla de estado.

### Qué cambiaría la decisión

Que la empresa tenga varios servidores, un equipo técnico de verdad, o que
haga falta reproducir fallos antiguos con su traza completa. Entonces toca
Sentry (o el que sea) con su cláusula de subencargado, su versión nueva de
política y su `beforeSend` recortando cuerpos.

Mientras no sea así, esto es suficiente. **Y queda escrito para que la
pregunta no se vuelva a abrir desde cero.**

---

## 4. En memoria, sin tabla

La decisión importante del archivo, y es contraintuitiva.

**Esto corre dentro del manejador de errores.** El día que la base no
responda, cada petición acabará en 500 y cada 500 intentaría escribir una fila
en la base que no responde. O sea: justo cuando más falta hace, no
funcionaría, y encima duplicaría las conexiones agotadas.

Un contador en memoria no puede fallar por nada de eso. Es el mismo patrón, y
por el mismo motivo, que `SweepHeartbeatService` (`docs/30` §7).

**Lo que se paga:** al reiniciarse el proceso —cada despliegue— la cuenta
vuelve a cero. Se acepta porque el aviso ya se mandó cuando pasó; lo que se
pierde es el historial de la pantalla, no la alarma. Y se dice en pantalla,
para que nadie lea «ningún error» como «no ha pasado nada nunca».

### La memoria está acotada por los dos lados

Un bucle de peticiones raras —o un robot buscando agujeros— podría inventar
huellas sin parar. Hay dos topes:

- **50 huellas distintas.** Al llenarse se tira la más antigua.
- **Un contador por minuto** para la ventana, que se poda a los 60.

Lo que no se pierde nunca es la **cifra**: que no quepan todas las huellas es
una molestia para diagnosticar; que la cuenta mintiera hacia abajo sería una
alarma que no suena. Hay una prueba para eso.

### Dos plazos, a propósito

| Plazo      | Para qué                              |
| ---------- | ------------------------------------- |
| **60 min** | La ventana de la alarma               |
| **24 h**   | Lo que conserva la pantalla del panel |

Quien abre el panel por la mañana tiene que poder ver el fallo de las tres de
la madrugada, aunque la alarma ya dijera «resuelto» a las cuatro.

**Cuidado al leer ese «resuelto»: aquí significa «ya no pasa», no «está
arreglado».** Es la única lectura rara de la etapa y se eligió a sabiendas: la
alternativa era un botón de «visto» en el panel, o sea un estado más que
guardar y una pantalla más que atender.

---

## 5. La huella, que es donde está la seguridad

Lo cómodo sería guardar `${request.method} ${request.url}: ${error.message}` y
enseñarlo. **Las dos mitades de eso son una fuga:**

- `request.url` trae la ruta **real**, con el identificador de la reserva
  dentro y, si alguien puso una, la cadena de consulta entera.
- `error.message` de Postgres trae el nombre del servidor y de la tabla; el de
  Stripe puede traer el identificador de un cobro.

Es el mismo razonamiento que convirtió `detailKey` en una lista cerrada
(`docs/30` §5). Aquí no cabe una lista cerrada —las rutas son muchas y
cambian— así que la huella se **monta** a partir de tres piezas saneadas:

```
POST /api/v1/bookings PrismaClientKnownRequestError
└┬─┘ └───────┬──────┘ └──────────────┬────────────┘
 │           │                       └── error.name, NUNCA error.message
 │           └── request.route.path: el PATRÓN, que es código nuestro
 └── de una lista cerrada de métodos
```

Y `ErrorFingerprintSchema` vuelve a comprobar el resultado, porque el saneado
se puede saltar escribiendo la cadena a mano. Lo que no encaja se sustituye
por `desconocida`.

### La regla que escribió una prueba que falló

El patrón de ruta admitía `[A-Za-z0-9/:-]`, que parecía suficiente. No lo es:

```
/api/v1/bookings/8f2c1a94-1d3e-4f55-9b77-2c0a5e6d7f88
```

Un UUID son letras, cifras y guiones. Encajaba perfectamente.

La regla pasó a ser **por trozos**: o un parámetro (`:bookingId`) o una
palabra, o varias unidas por guiones, **cada una empezando por letra**. Eso
tumba el UUID y tumba también `abc-123`. Lo que queda son nombres de ruta.

Hay dos pruebas, y hacen falta las dos:

- URLs **reales** de este sistema acaban en `desconocida`.
- Rutas **reales** de esta API se conservan tal cual. Un saneado demasiado
  estricto no es seguro, es inútil: si todo acabara en `desconocida`, el panel
  diría «algo falló en alguna parte» y habría que volver al log de Render, que
  es justo lo que esto viene a evitar.

Y una tercera, de extremo a extremo, con una aplicación de verdad y una ruta
que revienta a propósito: `error-monitor.e2e.test.ts` comprueba que lo que
queda anotado al pedir `/revienta/8f2c1a94-…` es
`GET /api/v1/revienta/:bookingId TypeError`.

---

## 6. El vigilante no puede matar a lo que vigila

`anotar()` **no puede lanzar**, y quien la llama la envuelve de todas formas.

Esto corre dentro del manejador de errores, **antes de escribir la
respuesta**. Una excepción aquí dejaría la petición sin contestar: el cliente
esperando hasta que el proxy corte, y una pantalla en blanco, por no haber
podido apuntar un número.

Es el mismo razonamiento que ya está escrito en la alarma de estado y en los
barridos. Hay una prueba con un contador roto a propósito que comprueba que la
respuesta de error sale completa.

---

## 7. La pantalla

Ajustes → Estado del sistema, **solo administración**, dos tarjetas:

1. **Estado del sistema**, con la fila `errors` nueva.
2. **Qué ha fallado** — una línea por clase de fallo, con la huella, el código,
   cuántas veces y la última.

Son dos tarjetas y no una para que el fallo de una no apague a la otra: si el
contador de errores no se pudiera leer, el estado del sistema se sigue viendo.

**Solo administración**, por el mismo criterio que el resto de esa pantalla
(`docs/30` §8): saber qué ruta de la API está reventando es media invitación, y
coordinación mueve citas.

La nota al pie dice en pantalla que **esto no es el log**, para que quien venga
buscando «qué le pasó al cliente que llamó» no espere encontrar aquí el
mensaje del error ni a quién le pasó.

### Y una trampa que esta etapa destapó

El panel validaba el informe de estado con `SystemHealthSchema`, que lleva una
enumeración **cerrada** de comprobaciones. Al añadir `errors`, un panel todavía
sin desplegar habría recibido un identificador desconocido, `safeParse` habría
descartado **la respuesta entera** y la pantalla habría dicho «no se pudo leer
el estado del sistema».

**La pantalla que existe para decir si el sistema está sano, apagada por haber
añadido una comprobación más.** Es la misma trampa que ya costó un incidente
con la galería, en otra forma: allí era una clave de sobra, aquí un **valor**
de sobra.

Se arregló con `SystemHealthReadSchema`, que al leer descarta lo que no
entiende y conserva el resto. Lo que **construye** la API sigue siendo
estricto: la lista cerrada de `detailKey` no se relajó. Pruebas en
`lo-que-lee-la-web-tolera-campos-nuevos.test.ts`.

---

## 8. Repaso de seguridad

| Riesgo                                               | Cómo queda                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Un identificador de reserva en la huella             | El patrón se valida por trozos; cada palabra empieza por letra. Prueba con UUID real |
| El mensaje del error en la huella                    | Solo `error.name`, validado contra `^[A-Za-z][A-Za-z0-9]{0,48}$`                     |
| Una cadena de consulta (correo, nombre) en la huella | `?`, `=`, `&`, `@`, espacios y `_` no encajan en el patrón                           |
| Datos de cliente hacia Telegram                      | El aviso lleva la clave y una cifra, nada más (`docs/30` §6)                         |
| Datos de cliente hacia un tercero                    | No hay tercero: ver §3                                                               |
| Que lo vea quien no debe                             | `@Roles('ADMIN')` en el controlador; pruebas de 403 y 401                            |
| Fuga por las sondas públicas                         | La prueba de `/health` y `/health/ready` comprueba que no aparece `errors`           |
| Que el contador tumbe la API                         | `anotar()` no lanza, y quien la llama la envuelve. Prueba con contador roto          |
| Que el contador se coma la memoria                   | 50 huellas y 60 cubos de un minuto, podados. Prueba de los dos topes                 |
| Que la alarma se vuelva ruido                        | Solo 5xx, y la transición y el silencio de la alarma de estado                       |
| Que la cuenta mienta hacia abajo                     | Los topes tiran huellas, nunca la cifra. Prueba específica                           |

**No se auditó la lectura.** Mismo criterio que el informe de estado
(`docs/30` §8): lo que se mira aquí es una máquina, no los actos de una
persona, y la pantalla se refresca sola. Auditar cada refresco llenaría el
registro de ruido y enterraría lo que ese registro existe para conservar.

---

## 9. Lo que esto NO es

**No es un log.** No está el mensaje, no está la traza, no está quién lo
sufrió. Todo eso sigue en Render, al que solo se llega con credenciales, y
sigue siendo el sitio donde se arregla un fallo.

Lo que esto hace es **mandar a alguien a mirar**, con la ruta y la clase del
error ya en la mano. El log seguía siendo necesario; lo que faltaba era el
motivo para abrirlo.
