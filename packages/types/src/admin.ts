import { z } from 'zod';
import { BookingStatusSchema } from './booking';
import { FrequencySchema, ServiceTypeSchema, ServiceZoneSchema } from './enums';
import { QuoteLineSchema } from './quote';
import { PaymentStatusSchema } from './payment';

/**
 * CONTRATOS DEL PANEL DE ADMINISTRACION
 * -------------------------------------
 * Aqui SI viajan datos personales, porque el panel existe para trabajar con
 * ellos. Dos reglas gobiernan que se devuelve:
 *
 *   1. EL LISTADO NO LLEVA DATOS SENSIBLES. Las instrucciones de acceso
 *      (codigos de puerta, donde esta la llave) solo salen en el detalle de
 *      una reserva concreta, nunca en una lista que se puede exportar entera.
 *
 *   2. NUNCA SALEN CREDENCIALES. Ni el identificador del pago en el
 *      proveedor, ni el client_secret: son credenciales, no informacion.
 */

/** Filtros del listado de reservas. */
export const AdminBookingQuerySchema = z.strictObject({
  /** Dia concreto en la zona horaria de la empresa (AAAA-MM-DD). */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD')
    .optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: BookingStatusSchema.optional(),
  /** Busca por referencia, nombre o correo del cliente. */
  search: z.string().trim().min(2).max(80).optional(),
  /**
   * Paginacion. El limite tiene tope: sin el, una sola peticion podria
   * descargar la base de clientes entera.
   */
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
});
export type AdminBookingQuery = z.infer<typeof AdminBookingQuerySchema>;
export type AdminBookingQueryInput = z.input<typeof AdminBookingQuerySchema>;

/** Una reserva tal y como aparece en el listado. */
export const AdminBookingListItemSchema = z.strictObject({
  bookingId: z.uuid(),
  reference: z.string(),
  status: BookingStatusSchema,
  scheduledStart: z.iso.datetime(),
  scheduledEnd: z.iso.datetime(),
  timezone: z.string(),
  service: ServiceTypeSchema,
  frequency: FrequencySchema,
  zone: ServiceZoneSchema,
  customerName: z.string(),
  /** Solo ciudad y codigo postal: la calle es del detalle. */
  city: z.string(),
  postalCode: z.string(),
  totalCents: z.int(),
  depositCents: z.int(),
  balanceDueCents: z.int(),
  /** Estado del deposito, o null si nunca se llego a crear. */
  paymentStatus: PaymentStatusSchema.nullable(),
  /**
   * Quien va al trabajo. Lleva `isLead` tambien en el listado —no solo en el
   * detalle— porque la agenda es donde coordinacion mira de un vistazo quien
   * manda en cada casa del dia.
   */
  assignedStaff: z.array(
    z.strictObject({ staffId: z.uuid(), name: z.string(), isLead: z.boolean() }),
  ),
  createdAt: z.iso.datetime(),
});
export type AdminBookingListItem = z.infer<typeof AdminBookingListItemSchema>;

export const AdminBookingListSchema = z.strictObject({
  items: z.array(AdminBookingListItemSchema),
  /** Identificador desde el que pedir la pagina siguiente, o null. */
  nextCursor: z.uuid().nullable(),
});
export type AdminBookingList = z.infer<typeof AdminBookingListSchema>;

/** Detalle completo de una reserva. */
export const AdminBookingDetailSchema = AdminBookingListItemSchema.extend({
  bedrooms: z.int(),
  bathrooms: z.int(),
  squareFeet: z.int(),
  addOns: z.array(z.strictObject({ code: z.string(), quantity: z.int() })),
  durationMinutes: z.int(),
  distanceMiles: z.number(),

  customer: z.strictObject({
    customerId: z.uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string(),
    locale: z.string(),
  }),

  address: z.strictObject({
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    /**
     * DATO SENSIBLE: codigos de puerta, donde esta la llave, perro en el
     * jardin. Solo aparece aqui, nunca en el listado.
     */
    accessNotes: z.string().nullable(),
  }),

  /**
   * Desglose del precio tal y como se le mostro al cliente.
   *
   * Se REUTILIZA el contrato de linea del cotizador en vez de declarar uno
   * propio: es el mismo dato, guardado tal cual al crear la reserva. Cuando
   * aqui habia una copia recortada, el panel rechazaba la respuesta entera
   * porque el esquema es estricto y llegaban campos de mas.
   */
  lines: z.array(QuoteLineSchema),
  serviceCents: z.int(),
  addOnsCents: z.int(),
  surchargesCents: z.int(),
  discountCents: z.int(),
  taxCents: z.int(),
  pricingVersion: z.string(),

  customerNotes: z.string().nullable(),

  /** Movimiento de dinero, sin ninguna credencial del proveedor. */
  payment: z
    .strictObject({
      paymentId: z.uuid(),
      provider: z.string(),
      status: PaymentStatusSchema,
      amountAuthorizedCents: z.int(),
      amountCapturedCents: z.int(),
      amountRefundedCents: z.int(),
      cardBrand: z.string().nullable(),
      cardLast4: z.string().nullable(),
      authorizedAt: z.iso.datetime().nullable(),
      capturedAt: z.iso.datetime().nullable(),
      /** La retencion caduca: pasada esa fecha ya no se puede capturar. */
      expiresAt: z.iso.datetime().nullable(),
    })
    .nullable(),

  cancelledAt: z.iso.datetime().nullable(),
  cancelledBy: z.string().nullable(),
  cancellationReason: z.string().nullable(),
});
export type AdminBookingDetail = z.infer<typeof AdminBookingDetailSchema>;

/* ========================================================================== */
/* ACCIONES DEL PANEL                                                         */
/* ========================================================================== */

/**
 * Cambio de estado de una reserva.
 *
 * El motivo es OBLIGATORIO al cancelar o marcar que no estaban: son los dos
 * casos que el cliente puede discutir despues, y sin una nota de quien lo hizo
 * y por que, la reclamacion se resuelve a base de memoria.
 */
export const AdminStatusChangeSchema = z
  .strictObject({
    status: BookingStatusSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .refine((value) => !['CANCELLED', 'NO_SHOW'].includes(value.status) || Boolean(value.reason), {
    message: 'Hace falta indicar el motivo para cancelar o marcar que no estaban',
    path: ['reason'],
  });
export type AdminStatusChange = z.infer<typeof AdminStatusChangeSchema>;
export type AdminStatusChangeInput = z.input<typeof AdminStatusChangeSchema>;

/**
 * Cobro del deposito retenido.
 *
 * Se cobra cuando el cliente cancela con el equipo ya en camino o no esta en
 * casa: es justo para lo que se retuvo. El motivo es obligatorio porque esto
 * mueve dinero de verdad de la tarjeta de una persona.
 */
export const AdminCaptureDepositSchema = z.strictObject({
  /**
   * Importe a cobrar, si es menor que el retenido. Sin indicar, se cobra
   * entero. Nunca puede superar lo autorizado: el servidor lo comprueba.
   */
  amountCents: z.int().positive().optional(),
  reason: z.string().trim().min(3).max(500),
});
export type AdminCaptureDeposit = z.infer<typeof AdminCaptureDepositSchema>;
export type AdminCaptureDepositInput = z.input<typeof AdminCaptureDepositSchema>;

/** Liberacion de la retencion sin cobrar nada: el caso normal. */
export const AdminReleaseDepositSchema = z.strictObject({
  reason: z.string().trim().min(3).max(500),
});
export type AdminReleaseDeposit = z.infer<typeof AdminReleaseDepositSchema>;
export type AdminReleaseDepositInput = z.input<typeof AdminReleaseDepositSchema>;
