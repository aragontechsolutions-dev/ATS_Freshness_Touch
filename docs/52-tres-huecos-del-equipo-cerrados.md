# 52 — Tres huecos del equipo de limpieza, cerrados

> Qué se construyó el 31/10/2026 sobre la auditoría de `docs/51`: **H4**
> (confirmar «he terminado»), **H5** (los dos botones muertos de la campana) y
> **H7** (la sesión que caduca a mitad de turno).
>
> Los tres se eligieron por la misma razón: son los que no dependen de una
> decisión de la dueña. H1 necesita las tareas de la lista de verificación,
> H2 necesita que ella decida quién puede declarar «no había nadie» y H6
> necesita su permiso para dar el teléfono de una empleada a otra. Ninguno de
> esos tres es código, y ponerlos por mi cuenta sería inventarme su negocio.

---

## 1. H4 — «He terminado» ya pregunta antes

### El fallo

```tsx
// MyJobs.tsx, antes
onClick={() => void onMarcar(job, 'COMPLETED')}
```

Un toque, sin confirmación, sobre un **estado final**: `COMPLETED` no tiene
transición de salida ni para el equipo ni para coordinación, porque el
histórico tiene que contar lo que de verdad pasó. El móvil en el bolsillo, las
manos mojadas o el dedo que resbala cerraban un trabajo a mitad y lo único que
quedaba era una llamada a la oficina.

No es simétrico con «He llegado», y por eso ese botón sigue sin preguntar: una
llegada marcada sin querer se arregla fichando la salida cuando toque. Una
salida marcada sin querer no se arregla.

### Lo que hay ahora

`apps/admin/src/components/DialogoFinal.tsx`, construido sobre el mismo
`<dialog>` del navegador que `DialogoLlegada` — foco atrapado dentro, escape
para cerrar, fondo inerte — con tres decisiones que importan:

| Decisión                                                        | Por qué                                                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Dice **las tareas que quedan sin marcar**                       | «¿Seguro?» a secas se contesta «sí» sin leerlo. El dato inesperado («te quedan 4») es lo único que distingue el toque bueno del accidental. |
| **No bloquea** si quedan tareas                                 | Misma regla que el fichaje: negarlo deja a la persona en la puerta de una casa sin poder cerrar su trabajo. Avisa, no impide.               |
| Con cero pendientes **no pinta la línea**                       | «Te quedan 0 tareas» es ruido que le resta fuerza a la única línea que tenía que leerse.                                                    |
| El escape y el gesto de atrás **descartan**, no confirman       | Es la dirección segura. Si el gesto de salir confirmara, el cuadro sería peor que no tenerlo.                                               |
| El cuadro se cierra **al salir bien la petición**, no al pulsar | Sin cobertura la petición falla, y cerrando al pulsar el fallo dejaría la pantalla como si nada. Se puede reintentar.                       |

El trabajo se busca **por su identificador en la lista de ahora**, no se
guarda al pulsar: la lista se refresca cada treinta segundos y las tareas
pendientes que enseña el cuadro son las de este momento, incluso si un
compañero marcó una mientras el cuadro estaba abierto.

---

## 2. H5 — Los dos botones muertos de la campana

### El fallo

```ts
// App.tsx:261, antes
const actual: Vista = soloMisTrabajos ? 'myJobs' : vista;
```

La campana **sí** se pinta para el puesto `CLEANER` y **sí** recibe sus avisos
(`job.assigned`). Pero sus dos acciones —«ver todas» y «abrir la reserva»—
cambian `vista`, y con esa línea `vista` no se miraba nunca. **No pasaba nada
al pulsar.**

No era un agujero de seguridad: la ficha completa de una reserva está cerrada
por rol en la API (`@Roles('ADMIN','DISPATCHER')`), así que ni abriéndola a
mano se cargaría. Era algo distinto y también malo: un botón que no responde
es lo que hace que alguien deje de confiar en una aplicación.

### Lo que hay ahora

**Dos pantallas para el puesto, no una.** La bandeja entra en la lista porque
es la única forma de volver a leer un aviso ya leído, y lo que sirve ahí son
los propios: la API filtra por audiencia, así que un puesto de limpieza no ve
los avisos de dinero ni los de administración.

```ts
const VISTAS_DE_LIMPIEZA: readonly Vista[] = ['myJobs', 'notifications'];
const actual: Vista = soloMisTrabajos && !VISTAS_DE_LIMPIEZA.includes(vista) ? 'myJobs' : vista;
```

**El aviso que señala una reserva lleva al trabajo, no a la ficha.** Para
coordinación y administración nada cambia. Para limpieza, el destino correcto
nunca fue la ficha —cerrada por rol— sino _su_ trabajo dentro de «Mis
trabajos»: `MyJobs` recibe `destacado`, trae la tarjeta a la vista con
`scrollIntoView` y la rodea con un borde de color.

Y se decide **en un solo sitio** (`abrirLoQueSenala` en `App.tsx`), que es lo
que impide que la campana y la lista completa acaben discrepando.

**El caso incómodo tiene texto.** La lista de trabajos empieza en el día de
hoy, así que un aviso sin leer de la semana pasada señala un trabajo que ya no
se sirve. Sin una línea que lo dijera, pulsarlo dejaría la pantalla igual que
antes — _el síntoma exacto del botón muerto que esto venía a arreglar_. Ahora
sale «Ese trabajo ya no está en tu lista», y se puede cerrar.

**Y hay salida.** Para limpieza la cabecera no pinta pestañas, así que la
bandeja era un sitio sin retorno: lleva un botón «Volver a mis trabajos» que
solo se pinta para ese puesto, porque para los demás las pestañas siguen ahí.

---

## 3. H7 — La sesión que se acaba a mitad de turno

### El fallo, que eran dos

La API devuelve `sessionExpiresAt` en cada comprobación de sesión desde que
existe el panel. **El panel no lo miraba en ningún sitio.** Ese era el hueco
apuntado en `docs/51`.

Al ir a usarlo apareció el segundo, que no estaba en la auditoría y es más
grave: `useStaffSession` atendía `SIGNED_IN` y `SIGNED_OUT` pero **no
`TOKEN_REFRESHED`**. El cliente de Supabase renueva el token solo cada ~55 min
(`autoRefreshToken: true`) y el panel no se enteraba, así que
`state.staff.sessionExpiresAt` se quedaba congelado en el valor de la primera
comprobación durante toda la jornada.

Mientras nadie mirase esa fecha, no se notaba. En el momento en que se usa
para avisar, el fallo sale al revés de como se espera: **el aviso aparecería a
la hora de haber entrado, con el token ya renovado y una hora entera por
delante, y no habría forma de quitarlo.** Un aviso que miente es peor que no
tener aviso. Por eso lo primero fue arreglar eso.

### Por qué hace falta el aviso si el token se renueva solo

Porque la renovación automática **no siempre ocurre**, y en este producto los
casos en que falla son cotidianos:

- El móvil de quien limpia, en una casa sin cobertura: el reloj de renovación
  salta, la petición no sale, el token sigue caducando.
- La PWA en segundo plano horas: el navegador congela los temporizadores de
  una pestaña que no se está mirando.

Sin aviso, el síntoma es el peor posible: la persona se entera de que la
sesión murió **al intentar fichar la salida**, que es justo cuando ya no tiene
tiempo ni cobertura para volver a entrar.

### Lo que hay ahora

- `apps/admin/src/lib/sesion-caduca.ts` — tres funciones puras y un umbral
  (`AVISO_DE_SESION_MINUTOS = 5`). Puras a propósito: el reloj se les pasa
  como dato, así que se prueban con una fecha fija.
- `apps/admin/src/components/AvisoDeSesion.tsx` — una franja dentro de la
  cabecera pegajosa, con un botón que renueva.
- `useStaffSession` atiende `TOKEN_REFRESHED` y expone `renovar()`.

Decisiones que no se leen en el código:

| Decisión                                                          | Por qué                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una **franja**, no un cuadro modal                                | Puede aparecer con alguien de pie en la puerta a punto de fichar. Taparle el botón de fichar para avisarle de que podría perder la sesión sería provocar el daño que el aviso intenta evitar.                  |
| **No se puede cerrar**                                            | Es la única franja del panel que no lleva «cerrar»: cerrarla no arregla nada y lo único que conseguiría es que el aviso desapareciera justo cuando empieza a ser verdad. Se quita renovando.                   |
| `renovar()` llama a `refreshSession()`, **no solo a `refresh()`** | `getSession()` devuelve el token que ya hay. Con cuatro minutos por delante no renovaría nada: el aviso seguiría contando hacia atrás. Un botón que no hace lo que dice.                                       |
| Si la renovación **falla no se cierra la sesión**                 | Lo normal es que falle por no haber cobertura. Echar fuera a quien está en una casa por no haber podido renovar es exactamente el daño que esto evitaba.                                                       |
| Avisa también con la sesión **ya caducada**                       | Es el caso más urgente, y el que una comprobación escrita como «¿quedan entre 0 y 5 minutos?» se dejaría fuera.                                                                                                |
| Una fecha **ilegible NO avisa**                                   | Es el fallo seguro de los dos: tratarla como caducada sacaría la franja a toda la empresa, para siempre, sin corresponder a ningún hecho.                                                                      |
| El umbral son **5 minutos**                                       | Lo que tiene que caber dentro: pulsar un botón y que una petición salga adelante con mala cobertura. Más alto, con un token de una hora, convertiría el aviso en algo diario que se aprende a ignorar.         |
| El reloj usa `useRefrescoVisible`                                 | Ya hace lo único que importa: no contar con la pantalla apagada, y comprobar **en el acto** al volver a la aplicación — que es cuando el móvil sale del bolsillo y cuando la renovación puede haberse perdido. |

Hay un efecto lateral bueno y buscado: atender `TOKEN_REFRESHED` vuelve a
preguntar a la API cada ~55 min, y eso **revalida que la cuenta sigue siendo
personal activo**. La baja de una empleada deja de esperar a que caduque el
token.

---

## 4. Repaso de seguridad

Lo que se comprobó antes de dar esto por cerrado:

- **Ningún dato nuevo llega al móvil.** Las tres piezas trabajan con lo que el
  contrato `MyJob` ya traía (`checklist`, `addressLine1`, `city`) y con
  `sessionExpiresAt`, que ya venía en `AuthenticatedStaff`. No se amplió
  ningún contrato.
- **La bandeja no abre nada nuevo.** La API ya filtraba las notificaciones por
  audiencia; lo único que cambió es que el puesto puede ver la pantalla que
  las lista. Ninguna de las otras vistas (`settings`, `series`, `privacy`) se
  añadió, y la ficha de la reserva sigue cerrada por rol en el servidor: para
  limpieza, el aviso ni siquiera la intenta.
- **El identificador destacado no es una credencial.** Es un `bookingId` que
  el aviso ya llevaba y que esa persona ya recibe en su lista de trabajos. Si
  no es suyo, la lista no lo contiene y la pantalla lo dice.
- **Ningún texto nuevo lleva importes, apellidos ni correos.** El cuadro de
  confirmación enseña calle y ciudad, que es lo que la tarjeta ya enseña.
- **Nada nuevo se guarda en el móvil.** No se tocó la configuración del
  _service worker_: la API sigue sin cachearse a propósito.
- **El aviso de sesión no acorta ni alarga ninguna sesión.** Solo lee una
  fecha. Quien caduca el token es el servidor; quien cierra por descuido
  físico sigue siendo `useIdleSignOut`.
- **`renovar()` no puede dejar a nadie fuera.** Traga el fallo y conserva el
  estado.

---

## 5. Pruebas

| Archivo                                                      | Qué vigila                                                                                                                                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin/src/pages/MyJobs.terminar.test.tsx`              | Que un toque **no** fiche la salida; que la pregunta diga las tareas pendientes y calle con cero; que confirmar sí fiche y «todavía no» no; que el trabajo señalado se destaque y que, si no está, se diga. |
| `apps/admin/src/lib/sesion-caduca.test.ts`                   | El umbral, la sesión ya caducada, la fecha ilegible y el redondeo hacia arriba.                                                                                                                             |
| `apps/admin/src/hooks/useStaffSession.test.tsx`              | Que `TOKEN_REFRESHED` vuelva a preguntar y la fecha nueva llegue al estado; que «seguir conectada» pida un token **nuevo**; que un fallo de renovación no cierre la sesión.                                 |
| `apps/admin/src/la-campana-no-tiene-botones-muertos.test.ts` | Que no vuelva la línea que ignoraba `vista`, que la bandeja siga en la lista del puesto, que las demás pantallas sigan fuera y que el aviso pase por un solo camino.                                        |

Las cuatro se verificaron **rompiendo el código a propósito** y comprobando
que fallan. La última lee el fuente de `App.tsx` **sin sus comentarios**: ese
archivo documenta la línea que causaba el fallo, y la primera versión de la
guardia se disparaba con su propia explicación. Una guardia que un comentario
puede romper no vigila nada.

Los seis pasos de CI, en verde. 2.173 pruebas (antes 2.144).

---

## 6. Lo que sigue pendiente, y de quién depende

De `docs/51`, sin tocar:

| Hueco                                                                  | De quién depende                                                                                                                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H1** — la lista de verificación vacía (`JOB_CHECKLIST_CATALOG = []`) | **De la dueña.** Es una tarde escribiendo las tareas de cada estancia. El código está entero y probado. Es el hueco más grande de la lista.                                                  |
| **H2** — «no había nadie»                                              | **De la dueña.** Hoy `NO_SHOW` lo pone coordinación porque es uno de los dos casos que mueven dinero y que el cliente discute después. Cambiar eso es una decisión de negocio, no de código. |
| **H6** — contactar con un compañero                                    | **De la dueña.** Es dar el número de una persona a otra.                                                                                                                                     |
| **H3** — trabajar sin cobertura                                        | De código, y es el más caro: hay que guardar datos de clientes en el móvil a propósito, con su borrado al cerrar sesión. Merece su propia etapa y su repaso de seguridad entero.             |
| **H8** — fotos de prueba del trabajo                                   | De código, ya apuntado en `docs/38` §1.                                                                                                                                                      |
