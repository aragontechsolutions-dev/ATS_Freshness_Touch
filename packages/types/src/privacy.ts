import { z } from 'zod';
import { LocaleSchema } from './enums';

/**
 * LOS DERECHOS QUE LA POLITICA PROMETE
 * ====================================
 * La Politica de Privacidad dice que cualquiera puede pedir una copia de lo
 * que tenemos sobre el, corregirlo o borrarlo, y que se responde en 30 dias.
 * Hasta esta etapa eso era una promesa sin nada detras: no habia herramienta,
 * no habia proceso, y borrar un cliente era IMPOSIBLE porque sus reservas lo
 * sujetan con `onDelete: Restrict`.
 *
 * Es el hueco mas incomodo del sistema porque lo abrio el propio documento
 * que redactamos. Esto lo cierra.
 *
 * ========================================================================
 * BORRAR NO ES BORRAR: ES ANONIMIZAR
 * ========================================================================
 * Y no es una excusa tecnica, es lo que la politica ya dice: se borra «salvo
 * lo que estemos obligados a conservar —registros fiscales y contables, y lo
 * necesario para una reclamacion de seguro o un asunto legal abierto—».
 *
 * Una reserva sin cliente no significa nada, y una contabilidad con huecos no
 * es una contabilidad. Lo que se va es LO QUE IDENTIFICA A LA PERSONA; lo que
 * se queda es que el 4 de marzo se limpio una casa de 1.600 pies cuadrados en
 * el 30132 por 185 dolares.
 */

/** Lo que se escribe en lugar de un nombre. Ver `anonymizedCustomer()`. */
export const ANONYMIZED_NAME = 'Cliente';
export const ANONYMIZED_SURNAME = 'retirado';

/**
 * Los campos que se vacian al anonimizar, por tabla.
 *
 * ESTA LISTA ES EL DOCUMENTO. Es lo que se le contesta a alguien que pregunta
 * que se borro y que no, y por eso vive en el contrato y no escondida en un
 * servicio: si alguien anade una columna con datos personales y no la pone
 * aqui, el borrado deja de ser completo y nadie se entera.
 */
export const ANONYMIZED_FIELDS = {
  customers: ['firstName', 'lastName', 'email', 'phone'],
  addresses: ['line1', 'line2', 'accessNotes', 'latitude', 'longitude', 'geocodeMatchedAddress'],
  bookings: ['customerNotes', 'doorPinLatitude', 'doorPinLongitude'],
  notifications: ['target'],
  media_consents: ['customerName', 'customerEmail', 'propertyAddress', 'notes'],
} as const;

/**
 * Lo que SE QUEDA, y por que. Tan importante como lo anterior.
 *
 * La politica promete decirle a la persona que se conservo y por que, asi que
 * la respuesta tiene que existir escrita en algun sitio. Este es el sitio.
 */
export const ANONYMIZED_KEPT = [
  /** Sin esto no hay contabilidad: importes, fechas y estados de cada cita. */
  'bookings.amounts',
  /** Ciudad y codigo postal: sin calle no identifican, y sostienen la zona. */
  'addresses.area',
  /** Marca y ultimos cuatro digitos: hacen falta ante una reclamacion. */
  'payments.card',
  /** El rastro de quien hizo que, que nunca llevo nombres ni direcciones. */
  'audit',
] as const;

/** Lo que el panel ensena al buscar a alguien por su correo. */
export const PrivacyCustomerSchema = z.object({
  customerId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  locale: LocaleSchema.default('en'),
  marketingOptIn: z.boolean().default(false),
  createdAt: z.string(),
  /** Cuantas reservas tiene. Para saber que se va a tocar antes de tocarlo. */
  bookingCount: z.int().nonnegative().default(0),
  /** Si ya se anonimizo. Una segunda vez no hace nada, y conviene decirlo. */
  anonymized: z.boolean().default(false),
});
export type PrivacyCustomer = z.infer<typeof PrivacyCustomerSchema>;

export const PrivacySearchResultSchema = z.object({
  customers: z.array(PrivacyCustomerSchema).default([]),
});
export type PrivacySearchResult = z.infer<typeof PrivacySearchResultSchema>;

/**
 * La correccion.
 *
 * SOLO LO QUE LA PERSONA PUEDE PEDIR QUE SE CORRIJA: su nombre, su correo, su
 * telefono y si quiere ofertas. Nada de precios ni de estados de reserva —eso
 * no es una correccion de datos, es cambiar un contrato— y para eso ya estan
 * las acciones de la reserva, con sus permisos y su rastro.
 */
export const PrivacyCorrectionSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: z.string().trim().min(7).max(25),
  marketingOptIn: z.boolean(),
  /** Por que se corrige. Queda en la auditoria, sin el dato viejo. */
  reason: z.string().trim().min(3).max(300),
});
export type PrivacyCorrection = z.infer<typeof PrivacyCorrectionSchema>;

/**
 * El borrado.
 *
 * ========================================================================
 * SE ESCRIBE EL CORREO A MANO, Y NO ES TEATRO
 * ========================================================================
 * Es irreversible y no hay deshacer: no se puede reconstruir un nombre que ya
 * no esta. Un boton con un «¿seguro?» se pulsa dos veces seguidas sin leer;
 * copiar el correo obliga a mirar A QUIEN se esta borrando, que es justo el
 * error que hay que evitar —el de la fila de al lado—.
 */
export const PrivacyErasureSchema = z.strictObject({
  /** Tiene que coincidir con el del cliente. Si no, no se hace nada. */
  confirmEmail: z.string().trim().toLowerCase().email().max(160),
  reason: z.string().trim().min(3).max(300),
});
export type PrivacyErasure = z.infer<typeof PrivacyErasureSchema>;

/** Lo que se devuelve tras anonimizar: lo que se toco, para poder contarlo. */
export const PrivacyErasureResultSchema = z.object({
  bookings: z.int().nonnegative().default(0),
  addresses: z.int().nonnegative().default(0),
  quotes: z.int().nonnegative().default(0),
  notifications: z.int().nonnegative().default(0),
  mediaConsents: z.int().nonnegative().default(0),
  /**
   * Permisos de imagen que ademas se REVOCARON.
   *
   * Borrar los datos de alguien sin retirar sus fotos dejaria las fotos
   * publicadas y el permiso que las amparaba sin nombre: lo peor de los dos
   * mundos. Ver `docs/45`.
   */
  mediaRevoked: z.int().nonnegative().default(0),
});
export type PrivacyErasureResult = z.infer<typeof PrivacyErasureResultSchema>;

/* ========================================================================== */
/*  LA COPIA DE LO QUE TENEMOS                                                */
/* ========================================================================== */

/**
 * EL ESQUEMA ES LA GUARDIA, no un adorno.
 *
 * Esto es un archivo que se le entrega a una persona. Lo peligroso de un
 * volcado no es que falte algo: es que SOBRE. Un `select` demasiado generoso
 * metería dentro los identificadores del proveedor de pago, el personal que
 * atendio cada reserva o las notas internas del equipo, y eso ya no es su
 * copia: es una filtracion con su nombre en la portada.
 *
 * Al ser `strictObject`, un campo de mas no se cuela: revienta aqui, en una
 * prueba, antes de llegarle a nadie.
 */
export const PrivacyExportSchema = z.strictObject({
  generatedAt: z.iso.datetime(),
  customer: z.strictObject({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string(),
    locale: LocaleSchema,
    marketingOptIn: z.boolean(),
    createdAt: z.string(),
  }),
  addresses: z.array(
    z.strictObject({
      line1: z.string(),
      line2: z.string().nullable(),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      accessNotes: z.string().nullable(),
    }),
  ),
  bookings: z.array(
    z.strictObject({
      reference: z.string(),
      status: z.string(),
      service: z.string(),
      scheduledStart: z.string(),
      totalCents: z.int(),
      customerNotes: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  /**
   * Los pagos, SIN los identificadores del proveedor.
   *
   * `pi_…` y `cus_…` no son datos de la persona: son nuestras referencias
   * internas con Stripe, y ensenarlas no le aporta nada y nos expone.
   */
  payments: z.array(
    z.strictObject({
      bookingReference: z.string(),
      kind: z.string(),
      status: z.string(),
      cardBrand: z.string().nullable(),
      cardLast4: z.string().nullable(),
      amountAuthorizedCents: z.int(),
      amountCapturedCents: z.int(),
      amountRefundedCents: z.int(),
      createdAt: z.string(),
    }),
  ),
  /** Que se le mando y cuando. Sin el identificador del proveedor de correo. */
  messages: z.array(
    z.strictObject({
      event: z.string(),
      channel: z.string(),
      status: z.string(),
      sentTo: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  mediaConsents: z.array(
    z.strictObject({
      reference: z.string(),
      signedAt: z.string(),
      serviceDate: z.string(),
      coversInterior: z.boolean(),
      coversExterior: z.boolean(),
      allowsBefore: z.boolean(),
      channels: z.array(z.string()),
      revokedAt: z.string().nullable(),
    }),
  ),
});
export type PrivacyExport = z.infer<typeof PrivacyExportSchema>;
