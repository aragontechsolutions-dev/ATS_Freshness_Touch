/**
 * LO QUE LE QUEDA A UNA RETENCION VIVA
 * ------------------------------------
 * Cancelar una reserva NO toca el dinero, y es deliberado: son dos
 * decisiones. Pero una retencion viva detras de una reserva que ya nadie va
 * a volver a mirar es dinero bloqueado en la tarjeta de alguien, asi que el
 * panel avisa con los dias que quedan.
 *
 * ========================================================================
 * VIVE AQUI Y NO DENTRO DEL COMPONENTE
 * ========================================================================
 * Porque es una cuenta con dos bordes que se escriben mal con mucha
 * facilidad —el redondeo y el dia del vencimiento— y montar la pantalla
 * entera para comprobarlos pide un andamiaje que nadie mantiene.
 */

/**
 * Dias enteros que le quedan a la retencion. Negativo si ya caduco.
 *
 * REDONDEA HACIA ARRIBA. Si caduca dentro de veintitres horas quedan "1 dia"
 * y no "0": decir cero cuando todavia se puede cobrar empuja a no intentarlo.
 */
export function diasDeRetencion(
  expiresAt: string | null,
  ahora: number = Date.now(),
): number | null {
  if (expiresAt === null) return null;

  const vence = Date.parse(expiresAt);
  if (Number.isNaN(vence)) return null;

  return Math.ceil((vence - ahora) / 86_400_000);
}

/**
 * Que texto toca segun lo que quede.
 *
 * EL DIA DEL VENCIMIENTO TODAVIA SE PUEDE COBRAR, igual que en el plazo de
 * retirada: cero dias es "caduca hoy", no "caducada". Se pasa al siguiente.
 *
 * Sin fecha se trata como caducada a proposito: una retencion de la que no
 * se sabe cuando vence no se puede prometer que siga sirviendo, y empujar a
 * cobrarla seria empujar a un fallo del proveedor.
 */
export function claveDeRetencion(dias: number | null): string {
  if (dias === null || dias < 0) return 'admin.holdStillOpenExpired';
  if (dias === 0) return 'admin.holdStillOpenToday';
  return 'admin.holdStillOpen';
}
