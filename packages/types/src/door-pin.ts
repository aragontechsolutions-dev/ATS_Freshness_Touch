import { z } from 'zod';

/**
 * EL PIN DE LA PUERTA
 * ===================
 * Donde el cliente marca, sobre un mapa, por donde se entra de verdad a su
 * casa: la puerta, el camino de coches, cual de los seis edificios del
 * complejo es el suyo.
 *
 * ========================================================================
 * POR QUE HACE FALTA, SI YA TENEMOS LA DIRECCION
 * ========================================================================
 * Porque la direccion no siempre basta. El geocodificador del Censo de
 * EE. UU. resuelve bien una calle de Atlanta y REGULAR una carretera
 * comarcal: interpola sobre el tramo de via, asi que en el campo deja la
 * casa a cientos de metros, a veces al otro lado de la carretera. En la
 * Georgia rural —que es casi todo nuestro territorio, ver
 * `docs/17-area-de-servicio.md`— eso es tiempo perdido dando vueltas con
 * una furgoneta.
 *
 * Quien sabe donde esta la puerta es quien vive alli. Esto solo le deja
 * decirlo.
 *
 * ========================================================================
 * ESTO NO TOCA EL PRECIO. NUNCA.
 * ========================================================================
 * Es la regla que mas protege de todo este archivo, y es de seguridad, no
 * de arquitectura.
 *
 * Hoy la distancia —y con ella el recargo por milla y la zona— sale del
 * CODIGO POSTAL, no de ninguna coordenada. Si alguna vez se conectara este
 * pin al calculo, el cliente podria ARRASTRARLO HACIA ATLANTA y pagarse un
 * descuento con el dedo: un fraude de un gesto, sin herramientas, desde el
 * movil, y sin dejar mas rastro que un punto en un mapa.
 *
 * Por eso el pin no entra en ningun contrato de cotizacion ni viaja junto a
 * una cifra. Hay una prueba que lee el codigo del motor de precios y falla
 * si alguien lo importa alli.
 *
 * ========================================================================
 * Y SE BORRA, DE VERDAD
 * ========================================================================
 * Vive lo que dura el trabajo y 24 horas mas. Ver `pinSigueVigente`.
 */

/** Cuanto sobrevive el pin despues de que el trabajo termine. */
export const HORAS_DE_VIDA_DEL_PIN = 24;

/**
 * Los limites de Georgia, con un margen generoso.
 *
 * NO es una comprobacion de area de servicio —de eso ya se encargan las
 * zonas— sino una guardia de cordura contra lo de siempre: intercambiar
 * latitud y longitud, que deja el estado en medio del oceano Indico, y
 * contra alguien que mande numeros a mano por la API.
 */
export const CAJA_DE_GEORGIA = {
  latMin: 29.5,
  latMax: 35.5,
  lonMin: -86.0,
  lonMax: -80.0,
} as const;

/**
 * El pin, tal y como lo manda el navegador al reservar.
 *
 * SEIS DECIMALES Y NI UNO MAS. A esa precision un grado son unos 11 cm, que
 * es mas fino que la puerta que se esta señalando. Guardar los quince
 * decimales que escupe el navegador no añade precision: añade un dato mas
 * exacto de lo necesario sobre la casa de una persona.
 */
export const DoorPinSchema = z.strictObject({
  latitude: z
    .number()
    .min(CAJA_DE_GEORGIA.latMin)
    .max(CAJA_DE_GEORGIA.latMax)
    .transform(redondearSeisDecimales),
  longitude: z
    .number()
    .min(CAJA_DE_GEORGIA.lonMin)
    .max(CAJA_DE_GEORGIA.lonMax)
    .transform(redondearSeisDecimales),
});
export type DoorPin = z.infer<typeof DoorPinSchema>;

/** A seis decimales, que son unos 11 cm. */
function redondearSeisDecimales(valor: number): number {
  return Math.round(valor * 1e6) / 1e6;
}

/**
 * CUANDO DEJA DE VALER EL PIN.
 *
 * ========================================================================
 * UNA SOLA EXPRESION, Y POR ESO NO HAY COLUMNA DE CADUCIDAD
 * ========================================================================
 * La alternativa era guardar un `pinExpiresAt` en la fila. Se descarto: esa
 * columna habria que recalcularla al completar, al cancelar y al mover la
 * cita, y bastaria olvidarse de UNO de esos tres sitios para que un pin
 * sobreviviera a la promesa que se le hizo al cliente. Un dato que se
 * calcula de lo que ya hay no se puede desincronizar.
 *
 * Se mide desde el final REAL cuando lo hay, y si no desde el previsto. Ese
 * «si no» es el que importa: si el equipo nunca marca que termino, el pin
 * muere igual al dia siguiente de la hora a la que debia acabar. La promesa
 * no depende de que nadie pulse nada.
 */
export function finDeLaVidaDelPin(reserva: {
  completedAt: Date | null;
  cancelledAt: Date | null;
  scheduledEnd: Date;
}): Date {
  const fin = reserva.completedAt ?? reserva.cancelledAt ?? reserva.scheduledEnd;
  return new Date(fin.getTime() + HORAS_DE_VIDA_DEL_PIN * 3_600_000);
}

/** Si el pin de esa reserva todavia se puede enseñar. */
export function pinSigueVigente(
  reserva: { completedAt: Date | null; cancelledAt: Date | null; scheduledEnd: Date },
  ahora: Date = new Date(),
): boolean {
  return finDeLaVidaDelPin(reserva) > ahora;
}
