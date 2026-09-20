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

## Etapa 2 — Reservas y pagos (siguiente)

**Objetivo:** convertir la cotización en una cita confirmada y cobrada.

- Supabase: autenticación, base de datos (PostgreSQL) y almacenamiento.
- Prisma con dos cadenas de conexión: agrupada para la aplicación y directa para
  las migraciones.
- Modelo de datos: clientes, direcciones, trabajos, citas, series recurrentes.
- Calendario de disponibilidad y reserva en línea.
- **Stripe**: retención del depósito con `capture_method: 'manual'` al reservar y
  captura parcial al finalizar el trabajo. Verificación de firma en los webhooks.
- Portal del cliente: historial, facturas, reprogramación y propinas opcionales.
- Panel de administración: clientes, trabajos, calendario y asignación de personal.
- **Configuración del negocio desde el panel**, para que la empresa no dependa
  del equipo técnico en el día a día:
  - Datos de contacto (teléfono, correo, horario), hoy en
    `apps/landing/src/config/company.ts`.
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
