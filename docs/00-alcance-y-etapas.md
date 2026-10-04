# 00 — Alcance y etapas

## Principio de trabajo

El proyecto se construye por etapas cerradas. Cada etapa entrega algo que
funciona de verdad, está probado y documentado, antes de empezar la siguiente.
No se escribe infraestructura "por si acaso": cada pieza entra cuando hay una
funcionalidad que la necesita.

---

## Etapa 1 — Captación: sitio público y cotizador ✅ COMPLETADA

**Objetivo de negocio:** que un visitante obtenga un precio real sin llamar a
nadie, a cualquier hora, y que la empresa deje de perder consultas fuera del
horario de oficina.

### Entregado

| Pieza                | Detalle                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| Monorepo             | Turborepo + pnpm, TypeScript estricto, ESLint, Prettier, CI en GitHub Actions |
| `@freshness/types`   | Contratos Zod compartidos entre API y web                                     |
| `@freshness/pricing` | Motor de precios puro: tarifas, extras, descuentos, mínimos, zonas y depósito |
| `@freshness/i18n`    | Textos EN/ES con paridad de claves verificada por tipos y por test            |
| `@freshness/api`     | NestJS: `/health`, catálogo de precios y cotización instantánea               |
| `@freshness/landing` | Sitio público bilingüe con modo claro/oscuro y cotizador                      |
| Despliegue           | `render.yaml` para la API y `vercel.json` para el sitio                       |
| Pruebas              | 54 tests automáticos, más verificación en navegador real                      |

### Decisión importante: sin base de datos

La Etapa 1 **no persiste nada**. Un cotizador no necesita guardar información:
recibe datos, calcula y responde. Esto tiene tres ventajas concretas:

1. **Seguridad:** no hay datos personales almacenados, así que no hay nada que
   filtrar ni que proteger en reposo.
2. **Coste:** no hay factura de base de datos hasta que exista una funcionalidad
   que la justifique.
3. **Simplicidad:** menos piezas que desplegar, monitorizar y respaldar.

Supabase (autenticación, base de datos y almacenamiento) entra en la Etapa 2,
cuando aparecen clientes y reservas que sí hay que guardar.

### Cómo se mide el éxito de esta etapa

- Porcentaje de visitantes que completan una cotización.
- Cotizaciones que terminan en revisión manual (si son muchas, hay que ampliar
  la zona de servicio o ajustar los límites).
- Distribución de zonas: indica dónde conviene concentrar la publicidad.

---

## Etapa 2 — Reservas y pagos (en curso)

**Objetivo:** convertir la cotización en una cita confirmada y cobrada.

Decisiones tomadas con la dirección:

- **Reserva como invitado**, sin obligar a crear cuenta: cada paso extra en el
  formulario pierde clientes. La cuenta se podrá añadir después.
- **Tarjeta obligatoria al reservar** para retener el depósito de traslado, que
  es justo para lo que se diseñó: protege a la empresa si el cliente cancela
  con el equipo ya en camino.

Progreso:

- ✅ **Modelo de datos** (`docs/10-modelo-de-datos.md`): esquema completo de 11
  tablas, migración inicial y prueba automática que la aplica sobre un
  PostgreSQL real sin necesidad de servidor ni credenciales.
- ✅ **Conexión de la aplicación a la base de datos**, opcional en tiempo de
  ejecución: si falta o se cae, el cotizador sigue funcionando.
- ✅ **Seguridad de la base de datos**: acceso público cerrado y guardia
  automático para las tablas futuras (`docs/04-seguridad.md`).
- ✅ **API de reserva** (`docs/11-flujo-de-reserva.md`): disponibilidad por
  franjas, recálculo de distancia con la dirección completa y tres capas
  contra la doble reserva.
- ✅ **Pagos y depósito** (`docs/12-pagos-y-deposito.md`): retención del
  depósito al reservar, webhook con verificación de firma e idempotencia, y
  proveedor simulado que permite probarlo todo sin cuenta de Stripe.
- ✅ **Formulario de reserva en el sitio** (`docs/11-flujo-de-reserva.md`):
  tres pasos, accesible con teclado, bilingüe y verificado en navegador real.
- ⬜ Probar el pago real con credenciales de Stripe (el código está, falta
  recorrerlo con tarjetas de prueba).
- ✅ **Autenticación y panel de administración** (`docs/13-panel-y-permisos.md`):
  control de acceso por rol, aplicación del panel, agenda con su detalle,
  acciones sobre la reserva (cambio de estado, cobro y liberación del
  depósito) y configuración del negocio editable —teléfono, correo y
  horario—, todo con auditoría. Queda fuera de esta etapa la vista propia del
  personal de limpieza.
- 🔄 **Dinero desde el panel**: hechos el cobro y la liberación del depósito; faltan el cobro del importe final y las devoluciones.
- ✅ **Avisos por correo y Telegram** (`docs/14-avisos.md`): confirmación y
  cancelación al cliente en su idioma, y aviso interno por Telegram al entrar
  una reserva pagada. Configurable desde el panel, con registro de envíos.
- ✅ **Recordatorio de la víspera** (`docs/14-avisos.md` §11): barrido cada 15
  minutos dentro de la propia API, sin servicio de cron aparte. Sobrevive a
  reinicios y caídas porque recalcula desde la base en cada pasada.
- ✅ **Asignar equipo desde el panel** (`docs/13-panel-y-permisos.md` §13):
  quién va a cada trabajo y quién es el responsable, con una guardia que
  impide poner a la misma persona en dos casas a la vez. Auditado, y el
  selector de personal no expone datos de contacto.
- ✅ **Alta de personal e invitación al panel** (`docs/13-panel-y-permisos.md`
  §14): dar de alta, editar y dar de baja desde el panel, con invitación por
  correo para conceder acceso. Existir y poder entrar son cosas separadas, y
  hay tres capas para que el sistema no se quede sin administración.
- ✅ **Recuperación de contraseña e invitación utilizable**
  (`docs/13-panel-y-permisos.md` §15): pantalla para pedir un enlace, con la
  misma respuesta exista o no la cuenta, y pantalla para elegir contraseña que
  sirve tanto para la invitación como para la recuperación. La sesión del
  enlace solo se acepta ahí, nunca en el resto del panel.
- ✅ **Correo de invitación propio** (`docs/13-panel-y-permisos.md` §16): el
  enlace se pide sin correo y la plantilla es nuestra, en el idioma de la
  persona. La ficha de personal tiene ahora idioma, como los clientes.
- ✅ **Pantalla del equipo de limpieza** (`docs/13-panel-y-permisos.md` §17):
  sus trabajos, con dirección, cómo entrar y teléfono, y los botones de «he
  llegado» y «he terminado». Nunca ve importes ni trabajos ajenos: el filtro
  va en la consulta, no al pintar.
- ✅ **Registro de auditoría completo** (`docs/16-auditoria.md`): quién hizo
  qué, desde dónde y cuándo, con pantalla propia para administración. Cubre el
  acceso al panel, las reservas del sitio y las lecturas de datos sensibles.
  Consultarlo deja rastro, no guarda nada sensible y se purga solo al año.
  Queda fuera el registro de intentos fallidos de contraseña, que ocurre
  dentro de Supabase.
- ✅ **Auditoría legible para quien no programa** (`docs/16-auditoria.md`
  §8 bis): la pantalla ya no vuelca JSON. Los identificadores salen como
  nombres, el dinero como dinero y los estados por su nombre; la lista va
  agrupada por día y el filtro por categorías. Lo técnico —IP, identificadores
  y el volcado entero— se aparta a un desplegable, no se borra.
- ✅ **Invitaciones reenviables** (`docs/13-panel-y-permisos.md` §18 bis): a
  raíz de un incidente real. El enlace de invitación caduca y no había forma
  de reenviarlo; ahora sí, y el panel avisa cuando el correo de contacto de
  alguien ya no es el correo con el que entra. Un 500 ilegible pasa a ser un
  mensaje que dice de quién es la cuenta.
- ✅ **Todo Georgia, con las zonas en un mapa** (`docs/17-area-de-servicio.md`):
  la empresa pasa a operar en todo el estado. Cerca el precio sale al
  instante como siempre; lejos se atiende igual pero el precio se da en
  persona, porque a trescientas millas el traslado pesa más que la limpieza.
  Las zonas se editan desde el panel y se ven en un mapa (Leaflet y
  OpenStreetMap, sin clave de API) tanto en el sitio como en el panel.
- ✅ **Recuperar el acceso de verdad** (`docs/18-acceso-y-recuperacion.md`): a
  raíz del mismo incidente, que no se cerró con lo anterior. «¿Has olvidado
  tu contraseña?» **no podía funcionar**: el enlace lo generaba el navegador
  con un verificador guardado en su pestaña, y un correo se abre siempre en
  otra. Ahora lo genera el servidor, llega con nuestra plantilla y en el
  idioma de la persona, y ninguna plantilla de Supabase dispara ya.
- ✅ **Los correos con la marca** (`docs/19-diseno-de-los-correos.md`): los
  cinco comparten una sola maqueta con el logotipo y los colores oficiales,
  pensada para que se entienda también con las imágenes bloqueadas, que es
  como la recibe media plantilla de clientes de correo.
- ✅ **Las tarifas salen del código** (`docs/20-tarifas-editables.md`): los
  precios se editan desde el panel y cada cambio queda como una versión que
  se puede volver a leer. Lo segundo no es un extra: `pricingVersion` se
  guarda en cada reserva desde el primer día prometiendo que un presupuesto
  antiguo se puede reproducir, y apuntando a un archivo del código esa
  promesa no se cumplía.
- ✅ **El modelo de operaciones** (`docs/21-modelo-de-operaciones.md`): la
  tarifa deja de ser una fórmula por habitaciones y pasa a ser un precio por
  servicio y frecuencia; el depósito, 35 $ fijos descontados del total; el
  traslado, las millas reales por encima de las 35 incluidas en vez de
  franjas con escalón. El sitio dice además **qué no se limpia**, que es de
  donde salen casi todas las quejas.
- ✅ **Los textos del sitio salen del código** (`docs/22-textos-editables.md`):
  las promesas y las preguntas frecuentes se reescriben desde el panel, en
  inglés y en español. Son compromisos, no adornos, así que van con las
  mismas guardias que las tarifas: solo administración, auditoría con acción
  propia y el texto nuevo, y el texto se pinta siempre **como texto**, nunca
  como HTML.
- ⬜ Avisos por SMS.
- Calendario de disponibilidad y reserva en línea.
- **Stripe**: retención del depósito con `capture_method: 'manual'` al reservar y
  captura parcial al finalizar el trabajo. Verificación de firma en los webhooks.
- Portal del cliente: historial, facturas, reprogramación y propinas opcionales.
- Panel de administración: clientes, trabajos, calendario y asignación de personal.
- **Configuración del negocio desde el panel**, para que la empresa no dependa
  del equipo técnico en el día a día:
  - ✅ Datos de contacto y horario: hechos en la Etapa 2.3
    (`docs/13-panel-y-permisos.md` §12). El horario que se guarda es además el
    que usa el motor de agenda, así que no puede desajustarse de lo que se
    anuncia.
  - ✅ Textos y afirmaciones del sitio que deben mantenerse veraces: hechos
    en la Etapa 2.28 (`docs/22-textos-editables.md`). Las cuatro promesas
    —seguro, verificación de antecedentes, precios transparentes y garantía—
    y las seis preguntas frecuentes se editan desde el panel, **en los dos
    idiomas**, y la pantalla avisa si uno se queda a medias: una garantía que
    dijera 24 horas en inglés y 48 en español es un problema de verdad. Lo
    que no se escriba conserva el texto del código. **Con esto la
    configuración queda cerrada.**
  - ✅ Zona de servicio: hecha en la Etapa 2.18
    (`docs/17-area-de-servicio.md`) y replanteada en la 2.23
    (`docs/21-modelo-de-operaciones.md` §2). Son tres bandas —dentro del
    radio incluido, con traslado por milla, y el resto de Georgia sin precio
    automático—, editables desde el panel con vista previa en el mapa; el
    cambio queda en la auditoría con las cifras de antes y después.
  - ✅ Las tarifas: hechas en la Etapa 2.22
    (`docs/20-tarifas-editables.md`) y con el modelo nuevo en la 2.23
    (`docs/21-modelo-de-operaciones.md`). El precio de cada servicio en cada
    cadencia, los extras, el depósito y el traslado se editan desde el panel;
    cada guardado crea una versión nueva y ninguna se borra, que es lo que
    permite reproducir un presupuesto antiguo.

**Requisitos previos:** cuentas de Supabase y Stripe, y la dirección completa
del cliente (que en la Etapa 1 no se pide a propósito).

## Etapa 3 — Operación en campo 🔄 EN CURSO

- ✅ **Aplicación web instalable (PWA)** para el personal de limpieza
  (`docs/23-aplicacion-instalable.md`): el panel se instala en el móvil desde
  el navegador, con aviso cuando hay versión nueva. **La API no se cachea
  nunca**, a propósito.
- ✅ **Geocodificación de las direcciones** (`docs/24-geocodificacion.md`): cada
  casa tiene su punto en el mapa, resuelto por el geocodificador del Censo de
  EE. UU. No estaba en el plan original y salió al planificar el fichaje: sin
  saber dónde está la casa, no hay forma de decir si alguien estaba en ella.
- ✅ **Fichaje de entrada y salida con ubicación**
  (`docs/25-fichaje-con-ubicacion.md`): se guarda **solo la distancia a la
  casa** —las coordenadas del empleado se descartan en el servidor y no
  existen en ninguna tabla— y **nunca bloquea el fichaje**; sin ubicación se
  ficha igual, anotando por qué.
- ✅ **Precios por tamaño de casa** (`docs/26-tabla-de-precios.md`): el motor
  cotiza con la tabla que mandó el cliente, una fila por tramo de pies
  cuadrados. La post-obra, el cambio de Airbnb y el comercial se retiran del
  sitio, y la estándar pasa a venderse solo como plan recurrente.
- 🔄 **Listas de verificación por estancia**
  (`docs/27-listas-de-verificacion.md`): qué hay que hacer en cada parte de la
  casa, marcado a medida que se hace, visible para el equipo y para
  coordinación. **La maquinaria está terminada; el contenido no**: las tareas
  de las plantillas del cliente —áreas comunes (11), baños (7) y cocina (7)—
  siguen pendientes de transcribir desde la Etapa 2, y mientras tanto la
  sección no se pinta.
- ✅ **Ajustes de campo** (`docs/28-ajustes-de-campo.md`): el responsable avisa
  desde su móvil de que el trabajo no es el contratado —900 pies que son
  1.300, una nevera que son tres— y coordinación decide si se cobra la
  diferencia. **La reserva no se toca hasta que alguien aprueba**, y se
  re-tarifica con la tabla que tenía la reserva, no con la vigente.
- ⬜ Fotos antes y después. Requiere decidir dónde se almacenan.
- ⬜ Funcionamiento sin conexión con cola de sincronización (zonas rurales de
  Georgia).
- ⬜ Avisos por SMS: confirmación, recordatorio, "vamos en camino", solicitud
  de reseña y de propina. **Bloqueado por trámite externo**: el envío de
  SMS a números de EE. UU. exige registro A2P 10DLC, que lo tramita el
  titular del negocio y tarda semanas. Lo demás ya funciona por correo
  (`docs/14-avisos.md`).

## Etapa 4 — Escala y administración

- Rutas por zonas con día asignado y lista de espera por código postal.
- Módulo de personal: contratación, nóminas, seguimiento de seguro de accidentes
  laborales (obligatorio en Georgia a partir de 3 empleados).
- Informes y analítica; exportación contable.
- Punto de venta presencial (Stripe Terminal) si el cobro en sitio crece.

---

## Umbrales que cambian el plan

| Situación                                   | Consecuencia                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| La empresa llega a 3 empleados              | El seguro de accidentes laborales pasa a ser obligatorio: hay que construir el módulo de personal antes |
| Más de ~10.000 cotizaciones al mes          | Se supera la cuota gratuita de Google y hay que revisar la caché y el coste                             |
| El cobro presencial domina                  | Evaluar Stripe Terminal o un TPV complementario                                                         |
| El equipo de desarrollo supera ~10 personas | Reevaluar el monorepo (límites de módulo más estrictos)                                                 |
