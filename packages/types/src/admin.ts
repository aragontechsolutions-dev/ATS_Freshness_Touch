import { z } from 'zod';
import { ClockInRecordSchema } from './clock-in';
import { BookingStatusSchema } from './booking';
import { FieldAdjustmentSchema } from './field-adjustment';
import { JobChecklistEntrySchema } from './job-checklist';
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
  /**
   * La serie que la genero o a la que pertenece, si pertenece a alguna.
   *
   * El panel lo necesita para no ofrecer «esto se repite» en una cita que ya
   * se repite: sin esto, el unico aviso llegaria como un error 409 despues
   * de rellenar el formulario entero.
   */
  seriesId: z.uuid().nullable().default(null),
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
      /**
       * UNA DEVOLUCION QUE EL PROVEEDOR ACABO RECHAZANDO (etapa 3.22).
       *
       * Un si o un no, no el texto del proveedor: ese es tecnico, viene en
       * ingles y puede arrastrar detalles de la cuenta. Lo que la pantalla
       * necesita decir es «ese dinero sigue aqui y hay que devolverlo por
       * otra via», y para eso basta con saber que paso.
       */
      refundFailed: z.boolean(),
      /**
       * Si hay tarjeta guardada con la que cobrar el saldo sin el cliente.
       *
       * Un si o un no: la referencia del proveedor no pinta nada en una
       * pantalla. Las reservas anteriores a la etapa 3.23 no la tienen.
       */
      cardOnFile: z.boolean(),
      cardBrand: z.string().nullable(),
      cardLast4: z.string().nullable(),
      authorizedAt: z.iso.datetime().nullable(),
      capturedAt: z.iso.datetime().nullable(),
      /** La retencion caduca: pasada esa fecha ya no se puede capturar. */
      expiresAt: z.iso.datetime().nullable(),
    })
    .nullable(),

  /**
   * EL COBRO DEL SALDO FINAL, SI SE INTENTO (etapa 3.23).
   *
   * Va aparte de `payment` porque es otro movimiento: otra fila, otro
   * identificador en el proveedor y otro estado. Un cobro rechazado tambien
   * aparece aqui, que es justo cuando hace falta verlo.
   */
  finalCharge: z
    .strictObject({
      paymentId: z.uuid(),
      status: PaymentStatusSchema,
      /**
       * Lo cobrado.
       *
       * En un cobro inmediato —que es lo que es— lo autorizado y lo cobrado
       * son la misma cifra: aqui no hay nada que capturar despues. Por eso
       * basta una, y `refundableCents` la puede usar como lo cobrado.
       */
      amountCents: z.int(),
      /** Lo ya devuelto de ese cobro (etapa 3.24). */
      amountRefundedCents: z.int(),
      /** Una devolucion de este cobro que el banco acabo rechazando. */
      refundFailed: z.boolean(),
      chargedAt: z.iso.datetime().nullable(),
    })
    .nullable(),

  cancelledAt: z.iso.datetime().nullable(),
  cancelledBy: z.string().nullable(),
  cancellationReason: z.string().nullable(),

  /**
   * LOS FICHAJES DEL EQUIPO EN ESTE TRABAJO.
   *
   * Es para lo que existe toda la etapa 3.3: ante un «esto se cerro sin
   * hacerse», coordinacion ve a que hora llego cada persona y a que distancia
   * de la casa estaba.
   *
   * SIN AVISOS Y SIN DESTACADO EN LA AGENDA, que fue una decision explicita:
   * solo queda registrado. Con una precision interpolada de cientos de metros
   * en zonas rurales, una alarma automatica avisaria de cosas que no son.
   */
  clockIns: z.array(ClockInRecordSchema),

  /**
   * LA LISTA DE VERIFICACION, EN SOLO LECTURA.
   *
   * Que se marco, quien lo marco y cuando. Es lo que coordinacion mira
   * cuando un cliente llama diciendo que algo se quedo sin hacer, y es la
   * MISMA lista que ve el equipo en su pantalla: la monta el mismo codigo.
   *
   * NO SE PUEDE MARCAR DESDE EL PANEL, y no es un endpoint que falte: lo que
   * ocurre en la casa lo marca quien esta alli. Si coordinacion pudiera
   * marcar desde la oficina, la lista dejaria de ser el registro de lo que se
   * hizo y pasaria a ser el de lo que alguien cree que se hizo.
   */
  checklist: z.array(JobChecklistEntrySchema),

  /**
   * LOS AJUSTES DE CAMPO, CON SUS IMPORTES.
   *
   * Aquí sí van las cifras, al contrario que en la pantalla de limpieza: es
   * coordinación quien decide si se cobra la diferencia y quien habla con el
   * cliente. El más reciente va primero.
   */
  adjustments: z.array(FieldAdjustmentSchema),
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

/**
 * COBRO DEL SALDO FINAL DE UN TRABAJO TERMINADO.
 *
 * NO LLEVA IMPORTE, y es la diferencia con el resto de acciones de dinero: lo
 * que se cobra es lo que la reserva dice que se debe. Dejar teclear la cifra
 * invitaria a cobrar algo distinto de lo que el cliente acepto, y para eso ya
 * estan los ajustes de campo, que re-tarifican la reserva ANTES con su propia
 * aprobacion.
 *
 * TAMPOCO LLEVA MOTIVO. Cobrar el saldo acordado al terminar el trabajo es el
 * curso normal del negocio, no una excepcion que haya que explicar: el motivo
 * es la reserva. Queda auditado igual, con el importe y con quien lo hizo.
 */
export const AdminChargeBalanceSchema = z.strictObject({});
export type AdminChargeBalance = z.infer<typeof AdminChargeBalanceSchema>;
export type AdminChargeBalanceInput = z.input<typeof AdminChargeBalanceSchema>;

/**
 * QUE MOVIMIENTO SE DEVUELVE.
 *
 * Desde la etapa 3.23 una reserva puede tener dos cobros —el deposito de 35
 * y el saldo de 150— y son dinero distinto: el primero se cobra cuando algo
 * sale mal, el segundo es el precio del trabajo. Devolver uno u otro son dos
 * conversaciones distintas con el cliente, y el historico tiene que poder
 * distinguirlas.
 *
 * `DEPOSIT` por defecto para no romper nada de lo que ya llamaba a esto
 * cuando el deposito era lo unico que se podia devolver.
 */
export const RefundTargetSchema = z.enum(['DEPOSIT', 'BALANCE']).default('DEPOSIT');
export type RefundTarget = z.infer<typeof RefundTargetSchema>;

/**
 * DEVOLUCION DE UN COBRO YA HECHO.
 *
 * Es la unica operacion de pago que devuelve dinero al cliente, y por eso la
 * unica donde el importe parcial es lo normal y no la excepcion: «te cobramos
 * los 35 del viaje en balde, te devolvemos 20 porque el equipo ya habia
 * salido» es una conversacion real. Sin indicar importe se devuelve todo lo
 * que quede.
 *
 * NO SIRVE PARA UNA RETENCION VIVA. Esa se libera (`AdminReleaseDeposit`): no
 * ha salido dinero de ninguna cuenta y devolverlo no significaria nada.
 */
export const AdminRefundPaymentSchema = z.strictObject({
  /** El deposito o el saldo final. Ver `RefundTargetSchema`. */
  target: RefundTargetSchema,
  /**
   * Importe a devolver, si es menor que lo que queda. Sin indicar, se
   * devuelve todo lo pendiente. Nunca puede superarlo: el servidor lo
   * comprueba con el mismo `refundableCents` que usa el panel.
   */
  amountCents: z.int().positive().optional(),
  /**
   * OBLIGATORIO, igual que para cobrar. Una devolucion es dinero que sale de
   * la empresa, y a los tres meses la pregunta siempre es la misma: quien la
   * autorizo y por que.
   */
  reason: z.string().trim().min(3).max(500),
});
export type AdminRefundPayment = z.infer<typeof AdminRefundPaymentSchema>;
export type AdminRefundPaymentInput = z.input<typeof AdminRefundPaymentSchema>;
