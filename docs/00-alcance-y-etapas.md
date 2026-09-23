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
  - Textos y afirmaciones del sitio que deben mantenerse veraces
    (seguros, verificación de antecedentes, garantía).
  - Zona de servicio y, más adelante, las tarifas: pasarlas de archivo a base
    de datos permite ajustar precios sin desplegar, pero exige registrar quién
    cambió qué y cuándo, porque afecta directamente a la facturación.

**Requisitos previos:** cuentas de Supabase y Stripe, y la dirección completa
del cliente (que en la Etapa 1 no se pide a propósito).

## Etapa 3 — Operación en campo

- Aplicación web instalable (PWA) para el personal de limpieza.
- Detalle del trabajo, listas de verificación, fotos antes y después.
- Fichaje de entrada y salida con ubicación.
- Funcionamiento sin conexión con cola de sincronización (zonas rurales de Georgia).
- Avisos automáticos por SMS y correo: confirmación, recordatorio, "vamos en
  camino", solicitud de reseña y de propina.

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
