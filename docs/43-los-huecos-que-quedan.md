# 43 — Los huecos que quedan

> Auditoría del 28 de octubre de 2026, hecha **leyendo el código**, no la
> memoria: qué modelos no usa nadie, qué rutas no tienen pantalla, qué
> promete el sitio que el sistema no cumple, y qué pasa cuando algo falla.
>
> Es una lista viva. Cuando un hueco se tape, se tacha aquí con el número de
> etapa, como se hizo con las series en `docs/41` §8.

---

## Cómo se hizo

| Qué se buscó                        | Cómo                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| Modelos declarados que no usa nadie | Contar `db.<modelo>.` y `tx.<modelo>.` en los servicios                               |
| Columnas que nadie escribe          | `grep` de cada campo sospechoso en todo el repositorio                                |
| Rutas sin pantalla                  | Listar todos los `@Get/@Post/@Patch/@Put` y cruzarlos con `apps/admin/src/lib/api.ts` |
| Promesas sin implementación         | Cruzar los textos del sitio y los documentos legales con el código                    |
| Qué pasa cuando algo falla          | Seguir cada `catch` hasta ver si alguien se entera                                    |

**El resultado tranquilizador primero:** de los 18 modelos de Prisma, **los 18
se usan**. Ya no hay ningún `RecurringSeries` esperando. Era el riesgo que más
miedo daba, porque es el que costó una sesión entera de diagnóstico con las
zonas de precio (`docs/36`).

---

## A. Promesas por escrito que el sistema todavía no cumple

Son las primeras porque no son deuda técnica: son cosas que ya se le dicen a
alguien.

### A1. Los textos legales están escritos y no están publicados

`docs/legal/` tiene las cuatro versiones y `docs/40` §5 tiene el plan de la
aceptación. Nada de eso está en el sitio: **no hay `/terms`, no hay
`/privacy`, no hay casilla, y el pie no enlaza nada** —las claves
`footer.privacy` y `footer.terms` existen en los dos idiomas y `Footer.tsx` no
las usa—.

Mientras tanto, el sitio cobra y recoge direcciones sin que nadie acepte nada,
y **los términos de Google Maps Platform exigen una política de privacidad
publicada** que informe del uso de sus API.

Falta rellenar los siete huecos entre corchetes, que son decisión de la dueña.

### A2. Se prometen derechos de privacidad que no se pueden ejercer

La política promete acceso, corrección y **borrado** en 30 días. En el sistema:

- No hay ninguna herramienta, ni pantalla, ni endpoint.
- **Borrar un cliente es imposible**: `Booking.customer` y
  `RecurringSeries.customer` son `onDelete: Restrict`. Es correcto —una
  reserva sin cliente no significa nada— pero implica que la única forma
  honesta de cumplir es **anonimizar**, y eso no existe.
- No hay nadie designado para leer el buzón de privacidad (decisión 7 de
  `docs/40` §6).

Es el hueco más incómodo de la lista, porque lo abrió el propio documento que
redactamos.

### A3. Las propinas se mencionan y no se pueden dar

La pregunta frecuente dice que no son obligatorias y sugiere 15-20 %;
`docs/07` las planificó como «opcionales y configurables» para la etapa 2. En
el código **no hay nada**: ni campo, ni línea de precio, ni cobro. Se pagan en
efectivo, que es legítimo, pero el sistema no lo registra.

### A4. El cobro real nunca se ha probado

`docs/12` §10 lo dice y sigue siendo verdad: las claves de producción están
puestas y **el flujo nunca se ha ejecutado con una tarjeta**. Faltan las tres
pruebas de siempre: `4242…` feliz, `4000 0000 0000 0002` rechazo y
`4000 0025 0000 3155` 3D Secure.

---

## B. Lo que muerde el día que algo va mal

### B1. Un correo que falla se pierde en silencio

`NotificationsService` guarda la fila con `status: 'FAILED'` y el motivo. Y
hasta ahí.

**No hay reintento y no hay aviso.** Si Resend está caído el minuto en que
alguien confirma su reserva, esa persona ha pagado y no tiene **nada por
escrito**, y nadie se entera hasta que alguien mire el registro de envíos —que
no tiene pantalla—.

El recordatorio de la víspera sí se reintenta, porque lo manda un barrido que
vuelve a pasar (`docs/14` §11.7). La confirmación no vuelve a pasar nunca.

Lo que hace que esto sea arreglable hoy y no antes: **ya existe la bandeja**
(`docs/39`). Un `notification.failed` dirigido a administración es media hora
de trabajo y convierte un fallo mudo en una cosa que alguien ve al entrar.

### B2. No hay monitorización de errores

No hay Sentry ni equivalente: lo comprobé, no hay ninguna dependencia de ese
tipo. Una excepción no controlada en producción vive en los logs de Render y
nadie los lee.

Es exactamente el problema que `SystemAlertService` resolvió para la **salud**
—se creó porque «dos caídas reales estuvieron escritas en el log durante horas
y días sin que nadie las leyera»— pero las excepciones siguen sin cubrir.

### B3. No hay copias de seguridad documentadas ni probadas

`docs/05-despliegue.md` no menciona copias de seguridad. Supabase las hace
según el plan contratado, pero **en ninguna parte está escrito cuál es ese
plan, cada cuánto se copia, cuánto se conserva ni cómo se restaura**. Y nadie
ha restaurado nunca una.

Una copia que no se ha restaurado nunca no es una copia: es una suposición.

### B4. No se puede mover una cita

Hoy reprogramar es **cancelar y crear otra**. Eso pierde el historial, obliga a
decidir qué hacer con la retención y deja dos filas donde hubo un servicio.
Siendo que la pregunta frecuente promete mover una cita sin coste con 24 h de
antelación, es la operación que más se va a pedir.

---

## C. Lo que el cliente no puede hacer

### C1. Después de reservar, el cliente no tiene nada

No hay cuenta —`Customer.authUserId` no lo escribe nadie—, no hay portal, el
correo de confirmación **no lleva ningún enlace** y la única ruta pública
aparte del sitio es `/retirar-fotos`.

Consecuencia: ver su cita, moverla, cancelarla o pedir una factura es **una
llamada de teléfono**, siempre. Para una empresa de dos personas puede ser una
decisión deliberada; conviene que lo sea, no que pase.

### C2. No hay factura descargable

Stripe manda su recibo de la tarjeta, que no es una factura. Para un cliente
`COMMERCIAL` —que es uno de los seis tipos de servicio— eso es un problema
real: necesita un documento con los datos de la empresa para su contabilidad.

### C3. No se pide reseña

No hay nada en el código. Para una empresa de limpieza local las reseñas de
Google son el canal de captación más barato que existe, y el momento de
pedirla es justo después de un servicio que salió bien, que es información que
el sistema tiene.

---

## D. Lo que ya estaba declarado pendiente y sigue

| Qué                                    | Por qué sigue                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `JOB_CHECKLIST_CATALOG` está **vacío** | Bloqueado por los textos de las tareas, que los da la clienta                                  |
| Avisos por SMS                         | Bloqueado por el trámite A2P 10DLC, que tarda semanas y lo tramita la titular                  |
| Funcionamiento sin conexión            | Zonas rurales de Georgia; necesita cola de sincronización                                      |
| Etapa 4 completa                       | Nóminas, seguro de accidentes (obligatorio a los 3 empleados), informes y exportación contable |

Ninguno es un descubrimiento: están en `docs/00`. Se listan para que la foto
esté completa.

---

## E. Deuda pequeña y papeles desactualizados

### E1. `Customer.internalNotes` no lo usa nadie

Cero apariciones en todo el repositorio fuera del esquema y del cliente
generado. Es el patrón de `RecurringSeries` en pequeño: una columna que
describe una función que no existe. O se usa —un campo de notas del equipo en
la ficha del cliente es útil— o se quita.

### E2. Documentos que listan como pendiente cosas que ya están

- `docs/00` marca con ⬜ **«Fotos antes y después»**, hecho en `docs/38`.
- `docs/13` §9 lista como pendientes **«asignar equipo»** y **«vista del
  personal de limpieza»**, las dos hechas.

Es exactamente lo que `docs/36` dejó escrito como regla: _«la documentación
que miente cuesta más que la que no está»_.

### E3. La política de privacidad puede ser más concreta

Dice que el registro de auditoría se conserva «como registro de seguridad». El
sistema lo sabe exactamente: **365 días** (`AUDIT_RETENTION_DAYS`), purgados
por un barrido que además deja constancia de sí mismo. Decir el número es
mejor que decir una vaguedad, y no cuesta nada.

### E4. `AuditSurface.FIELD` sigue sin uso

Está declarado y documentado como reservado para una futura aplicación de
campo. No es un fallo —está escrito a propósito— pero es un valor que ninguna
fila lleva, y conviene que siga siendo una decisión y no un olvido.

---

## Por dónde empezar, si hubiera que elegir

Ordenado por lo que cuesta si no se hace, no por lo que cuesta hacerlo:

1. **B1**, el correo que falla en silencio. Es el único de la lista donde
   alguien ya pagó y se queda sin nada, y hoy se arregla con una notificación
   en una bandeja que ya existe.
2. **A1**, publicar los textos legales. El trabajo está hecho; falta rellenar
   siete huecos y construir la casilla.
3. **B3**, saber qué copias de seguridad hay y restaurar una para comprobarlo.
   Media mañana, y es la diferencia entre tener negocio o no tenerlo el día
   malo.
4. **A4**, probar el cobro con tarjetas de prueba. El código lleva semanas
   escrito y nadie lo ha visto funcionar.
5. **B4**, mover una cita, porque es lo que el sitio promete y lo que más se
   pide.

El resto puede esperar a que lo pida el negocio.
