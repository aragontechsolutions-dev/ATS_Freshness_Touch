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

/**
 * CONFIRMACION SIMULADA
 * ---------------------
 * Con el proveedor real, el navegador confirma la tarjeta contra sus
 * servidores y estos nos avisan por webhook. El simulador no tiene servidores,
 * asi que la API expone el equivalente: un endpoint que hace de "el cliente
 * acaba de confirmar su tarjeta" y dispara el mismo procesamiento.
 *
 * Solo existe cuando el proveedor activo es el simulador. Con Stripe la ruta
 * responde 404, como si no estuviera escrita.
 */
export const MockPaymentConfirmRequestSchema = z.strictObject({
  /** La misma credencial que recibio el navegador al crear la reserva. */
  clientSecret: z.string().trim().min(10).max(200),
  /**
   * Permite simular tambien el rechazo del banco. Sin esto solo se podria
   * probar el camino feliz, que es justo el que nunca falla en produccion.
   */
  outcome: z.enum(['AUTHORIZE', 'DECLINE']).default('AUTHORIZE'),
});
export type MockPaymentConfirmRequest = z.infer<typeof MockPaymentConfirmRequestSchema>;
export type MockPaymentConfirmRequestInput = z.input<typeof MockPaymentConfirmRequestSchema>;

export const MockPaymentConfirmResponseSchema = z.strictObject({
  status: PaymentStatusSchema,
  /** Estado en que queda la reserva tras la confirmacion. */
  bookingStatus: z.enum(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED']),
});
export type MockPaymentConfirmResponse = z.infer<typeof MockPaymentConfirmResponseSchema>;
