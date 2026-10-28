import { z } from 'zod';
import { FrequencySchema, LocaleSchema, ServiceTypeSchema } from './enums';
import { PaymentIntentSchema } from './payment';
import { DoorPinSchema } from './door-pin';
import { BOOKING_CONSENT_NONE, BookingMediaConsentSchema } from './media-consent';
import { LegalAcceptanceSchema } from './legal';
import { QuoteAddOnInputSchema, QuoteDepositSchema, QuoteTotalsSchema } from './quote';

/**
 * CONTRATOS DE RESERVA
 * --------------------
 * Aqui SI se pide la direccion completa, a diferencia del cotizador, que solo
 * necesita el codigo postal. El cambio es deliberado: ahora hay una relacion
 * comercial y hace falta saber a donde ir.
 *
 * No se pide contrasena: se reserva como invitado. La cuenta es opcional y
 * posterior, porque cada paso extra en el formulario pierde clientes.
 */

/** Datos de contacto de quien reserva. */
export const BookingContactSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  /** Telefono de EE. UU. en cualquier formato legible; se normaliza despues. */
  phone: z
    .string()
    .trim()
    .min(7)
    .max(25)
    .regex(/^[+()\d\s.-]+$/, 'El telefono solo puede contener numeros y separadores'),
  locale: LocaleSchema.default('en'),
  /**
   * Consentimiento para comunicaciones comerciales. Separado del correo
   * transaccional (confirmacion, recordatorio), que no lo necesita.
   */
  marketingOptIn: z.boolean().default(false),
});
export type BookingContact = z.infer<typeof BookingContactSchema>;

/** Direccion del servicio. */
export const BookingAddressSchema = z.strictObject({
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .default('GA'),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El codigo postal debe tener 5 digitos (formato USA)'),
  /**
   * Codigo de puerta, donde esta la llave, si hay perro en el jardin.
   * DATO SENSIBLE: solo debe verlo el equipo asignado y administracion.
   */
  accessNotes: z.string().trim().max(500).optional(),
});
export type BookingAddress = z.infer<typeof BookingAddressSchema>;

/** Peticion de reserva. */
export const BookingRequestSchema = z
  .strictObject({
    // --- Que servicio ---
    service: ServiceTypeSchema,
    frequency: FrequencySchema.default('ONE_TIME'),
    bedrooms: z.int().min(0).max(12),
    bathrooms: z.int().min(0).max(12),
    squareFeet: z.int().min(200).max(20000),
    addOns: z.array(QuoteAddOnInputSchema).max(20).default([]),

    // --- Cuando ---
    /** Inicio de la cita, en UTC. Debe coincidir con una franja disponible. */
    startsAt: z.iso.datetime(),

    // --- Quien y donde ---
    contact: BookingContactSchema,
    address: BookingAddressSchema,

    customerNotes: z.string().trim().max(1000).optional(),

    /**
     * DONDE ESTA LA PUERTA, si el cliente se molesto en marcarlo.
     *
     * OPCIONAL Y SIN CONSECUENCIAS. Reservar no puede depender de que
     * alguien sepa usar un mapa: quien lo salta reserva igual y el equipo
     * llega con la direccion, como hasta ahora.
     *
     * NO TOCA EL PRECIO. La cotizacion ya esta hecha cuando esto se manda, y
     * la distancia sale del codigo postal. Ver `door-pin.ts`.
     */
    doorPin: DoorPinSchema.optional(),

    /**
     * EL PERMISO DE IMAGEN, si el cliente lo da al reservar.
     *
     * Aqui, y no el dia del servicio, porque el caso NORMAL es que ese dia
     * no haya nadie en casa: en una mudanza esta vacia, en una recurrente el
     * cliente esta trabajando, y hay quien contrata desde otro estado. Y
     * ademas es cuando el permiso es mas libre: pedirlo despues, delante de
     * la casa recien limpia, pone al cliente en una situacion en la que se
     * siente obligado a decir que si.
     *
     * OPCIONAL Y SIN CONSECUENCIAS, igual que el pin de la puerta: no toca
     * el precio, no toca el servicio y quien no lo marca reserva igual. Un
     * permiso que condiciona lo que se contrata no es un permiso libre.
     *
     * CON VALOR POR DEFECTO porque el sitio y la API se despliegan por
     * separado: una reserva enviada por una version anterior del formulario
     * no trae este campo, y entonces lo que tiene que pasar es que no haya
     * permiso.
     */
    mediaConsent: BookingMediaConsentSchema.default(BOOKING_CONSENT_NONE),

    /**
     * LO QUE ACEPTO: condiciones y privacidad, con su version.
     *
     * ======================================================================
     * OPCIONAL AQUI Y OBLIGATORIO EN EL SITIO PUBLICO
     * ======================================================================
     * Es la unica parte del contrato que depende de QUIEN reserva, y por eso
     * la regla no vive en el esquema sino en el servicio:
     *
     *   - Desde el sitio publico ES OBLIGATORIA. Sin casilla marcada no hay
     *     reserva, y el servicio responde con su propio error en vez de un
     *     fallo de validacion generico, para poder decirle a quien tenga una
     *     pestana vieja abierta que recargue.
     *
     *   - Desde el panel NO EXISTE. Una clienta que llama por telefono no
     *     marca ninguna casilla; inventarle una aceptacion seria escribir
     *     que hizo algo que no hizo, y eso es peor que no tener el dato.
     *     Esas reservas se guardan SIN aceptacion, y el panel lo dice.
     *
     * Si estuviera obligatoria en el esquema, el panel tendria que fabricar
     * una. Si tuviera valor por defecto, un fallo del formulario reservaria
     * sin que nadie aceptara nada y la fila diria que si.
     */
    legal: LegalAcceptanceSchema.optional(),
  })
  .refine(
    (value) => new Set(value.addOns.map((addOn) => addOn.code)).size === value.addOns.length,
    { message: 'No se puede repetir el mismo extra', path: ['addOns'] },
  );
export type BookingRequest = z.infer<typeof BookingRequestSchema>;
export type BookingRequestInput = z.input<typeof BookingRequestSchema>;

export const BookingStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

/** Respuesta al crear una reserva. */
export const BookingResponseSchema = z.strictObject({
  bookingId: z.uuid(),
  /** Referencia legible para hablar por telefono: FT-2026-0001. */
  reference: z.string(),
  status: BookingStatusSchema,

  scheduledStart: z.iso.datetime(),
  scheduledEnd: z.iso.datetime(),
  timezone: z.string(),
  durationMinutes: z.int().positive(),

  currency: z.literal('USD'),
  totals: QuoteTotalsSchema,
  deposit: QuoteDepositSchema,
  balanceDueAtServiceCents: z.int(),

  /**
   * Que falta para que la cita quede en firme. Mientras sea PAYMENT, la
   * reserva NO esta confirmada: solo retiene la franja un tiempo limitado.
   */
  nextStep: z.enum(['PAYMENT', 'NONE']),
  /** Momento en que se libera la franja si no se completa el pago. */
  holdExpiresAt: z.iso.datetime().nullable(),
  /**
   * Sesion para autorizar el deposito. Es null si el pago no esta
   * configurado, en cuyo caso la reserva queda pendiente de gestion manual.
   */
  payment: PaymentIntentSchema.nullable(),
});
export type BookingResponse = z.infer<typeof BookingResponseSchema>;

/* ========================================================================== */
/*  LA RESERVA QUE CREA EL PANEL                                              */
/* ========================================================================== */

/**
 * LAS CLIENTAS DE SIEMPRE NO PASAN POR EL FORMULARIO
 * ==================================================
 * Llaman, mandan un mensaje, dicen «el martes a las nueve como siempre». Y
 * hasta ahora el sistema no se enteraba, con una consecuencia que no es
 * administrativa sino operativa: `findOccupied` solo cuenta reservas de la
 * base, asi que ese martes a las nueve el cotizador publico lo sigue
 * ofreciendo. Dos clientas, un equipo, la misma hora.
 *
 * Por eso esto no es «apuntar un recordatorio»: es crear una reserva de
 * verdad, con su precio, su equipo, su lista de tareas y su factura. La
 * unica diferencia es por donde entro.
 *
 * ==========================================================================
 * LO QUE EL PANEL PUEDE SALTARSE, Y POR QUE EL FORMULARIO NO
 * ==========================================================================
 * Las reglas del sitio publico protegen de un desconocido. Quien entra al
 * panel no es un desconocido: es quien conoce su agenda, sus equipos y a sus
 * clientas. Cada salto va en su campo, con motivo, y queda en la auditoria.
 */
export const ADMIN_BOOKING_SOURCES = ['PHONE', 'ADMIN'] as const;
export const AdminBookingSourceSchema = z.enum(ADMIN_BOOKING_SOURCES);
export type AdminBookingSource = z.infer<typeof AdminBookingSourceSchema>;

/** Codigo de la linea que aparece cuando se pacta un precio distinto. */
export const AGREED_PRICE_LINE_CODE = 'AGREED_PRICE';

export const AdminBookingOverridesSchema = z
  .strictObject({
    /** Por donde llego el encargo. Se guarda en la cotizacion de origen. */
    source: AdminBookingSourceSchema.default('PHONE'),

    /**
     * Reservar fuera del horario o sin la antelacion minima.
     *
     * Las 24 horas de margen existen para que de tiempo a organizar al
     * equipo, y el horario para no prometer lo que no se puede cumplir. Las
     * dos son suposiciones razonables sobre un desconocido y ninguna lo es
     * sobre quien mira su propia agenda: si dice que manana a las nueve se
     * puede, se puede.
     */
    allowOutsideHours: z.boolean().default(false),

    /**
     * Reservar aunque la franja ya este llena.
     *
     * El limite de equipos simultaneos sale de la configuracion, y la
     * configuracion puede estar desactualizada un martes concreto en que
     * entra alguien a echar una mano. AVISA PRIMERO: la primera peticion
     * falla con el choque y solo la segunda, ya con esto marcado, lo pasa
     * por alto. Nunca se solapa sin que alguien lo haya visto.
     */
    allowOverlap: z.boolean().default(false),

    /**
     * El precio pactado, en centavos, cuando no es el del motor.
     *
     * Una clienta de siempre puede tener una tarifa de hace dos anos. Nulo
     * = manda el motor, que es lo normal y lo que no hay que justificar.
     */
    priceOverrideCents: z.int().nonnegative().max(10_000_00).nullable().default(null),

    /**
     * Si se le manda la confirmacion por correo.
     *
     * Encendido por defecto, porque un cliente con una cita y sin nada por
     * escrito es el problema que estos avisos vinieron a resolver. Pero a
     * una clienta que acaba de colgar el telefono y no usa el correo,
     * mandarselo no aporta nada.
     */
    notifyCustomer: z.boolean().default(true),

    /**
     * Por que se hizo asi. Obligatorio EN CUANTO SE SALTA ALGO.
     *
     * Es la misma regla que al cancelar: lo que cuesta dinero o rompe una
     * norma se explica en el momento, no se reconstruye medio ano despues
     * mirando una fila que solo dice que alguien lo hizo.
     */
    reason: z.string().trim().max(300).default(''),
  })
  .refine(
    (valor) =>
      valor.reason.length >= 3 ||
      (!valor.allowOutsideHours && !valor.allowOverlap && valor.priceOverrideCents === null),
    {
      message: 'Hace falta escribir por que se salta la norma',
      path: ['reason'],
    },
  );
export type AdminBookingOverrides = z.infer<typeof AdminBookingOverridesSchema>;
export type AdminBookingOverridesInput = z.input<typeof AdminBookingOverridesSchema>;

/**
 * La reserva del panel: la misma de siempre, mas lo que se salta.
 *
 * ANIDADA Y NO FUNDIDA EN UN SOLO OBJETO a proposito. Asi el contrato
 * publico —el que valida lo que manda un desconocido— sigue siendo
 * exactamente el mismo objeto, sin un solo campo mas que alguien pudiera
 * colar desde fuera. Un `allowOverlap` que viaje en la misma forma que usa
 * el sitio publico es un campo que algun dia se acepta por descuido.
 */
export const AdminBookingRequestSchema = z.strictObject({
  booking: BookingRequestSchema,
  overrides: AdminBookingOverridesSchema,
});
export type AdminBookingRequest = z.infer<typeof AdminBookingRequestSchema>;
export type AdminBookingRequestInput = z.input<typeof AdminBookingRequestSchema>;
