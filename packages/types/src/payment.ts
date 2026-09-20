import { z } from 'zod';

/**
 * CONTRATOS DE PAGO
 * -----------------
 * El deposito de traslado se AUTORIZA, no se cobra: es una retencion en la
 * tarjeta que protege a la empresa si el cliente cancela con el equipo ya en
 * camino, y que se acredita integramente contra la factura final.
 *
 * El navegador nunca ve ni envia importes: recibe un identificador de sesion
 * de pago y confirma la tarjeta directamente contra el proveedor, de modo que
 * los datos de la tarjeta no pasan por nuestro servidor.
 */

export const PaymentProviderNameSchema = z.enum(['mock', 'stripe']);
export type PaymentProviderName = z.infer<typeof PaymentProviderNameSchema>;

export const PaymentStatusSchema = z.enum([
  /** Falta la tarjeta. */
  'REQUIRES_PAYMENT_METHOD',
  /** Hay tarjeta y falta confirmarla. */
  'REQUIRES_CONFIRMATION',
  /** El banco pide una verificacion adicional al titular (3D Secure). */
  'REQUIRES_ACTION',
  /** En curso en el banco. Ni aprobado ni rechazado todavia. */
  'PROCESSING',
  /** Autorizado y a la espera de captura: el estado del deposito retenido. */
  'REQUIRES_CAPTURE',
  'SUCCEEDED',
  'CANCELED',
  'FAILED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/** Lo que necesita el navegador para completar el pago. */
export const PaymentIntentSchema = z.strictObject({
  paymentId: z.uuid(),
  provider: PaymentProviderNameSchema,
  status: PaymentStatusSchema,
  amountCents: z.int().nonnegative(),
  currency: z.literal('USD'),
  /**
   * Credencial de un solo uso con la que el navegador confirma la tarjeta
   * contra el proveedor. No sirve para nada mas: no permite cobrar, ni
   * consultar otros pagos, ni acceder a datos del cliente.
   */
  clientSecret: z.string().nullable(),
  /** La retencion caduca: pasada esa fecha hay que volver a pedir la tarjeta. */
  expiresAt: z.iso.datetime().nullable(),
});
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;
