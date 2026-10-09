import { type DoorPin, pinSigueVigente } from '@freshness/types';

/**
 * LEER UN PIN, CON SU CADUCIDAD APLICADA
 * ======================================
 * El unico sitio del que sale un pin para enseñarselo a alguien. Que sea uno
 * solo es la mitad de la promesa que se le hace al cliente.
 *
 * ========================================================================
 * POR QUE CADUCA AL LEERSE Y NO SOLO AL BORRARSE
 * ========================================================================
 * Hay un barrido que borra las filas vencidas, y podria parecer suficiente.
 * No lo es: un barrido puede fallar en silencio —la API caida un fin de
 * semana, una excepcion que nadie mira, el proceso reiniciandose antes de
 * completar la pasada— y entonces el dato seguiria ahi DESPUES de haberle
 * dicho al cliente que no.
 *
 * Con la caducidad en la lectura, aunque el barrido no haya pasado nunca, un
 * pin vencido NO LO PUEDE DEVOLVER NADIE: ni el panel, ni la PWA, ni un
 * endpoint futuro que alguien escriba sin acordarse de esto. La fila puede
 * sobrevivir un rato de mas; el dato, no.
 *
 * Cinturon y tirantes, y a proposito: lo que esta en juego no es una
 * pantalla fea, es una promesa escrita a un cliente.
 */

/** Lo minimo que hace falta de una reserva para decidir sobre su pin. */
export interface ReservaConPin {
  doorPinLatitude: number | null;
  doorPinLongitude: number | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  scheduledEnd: Date;
}

/**
 * El pin de esa reserva, o `null` si no hay o si ya vencio.
 *
 * Las dos mitades se comprueban juntas aunque la base ya lo garantice con un
 * `CHECK`: media coordenada no es un punto, y este codigo tambien corre
 * contra filas que pudo escribir otra version.
 */
export function pinVisible(reserva: ReservaConPin, ahora: Date = new Date()): DoorPin | null {
  if (reserva.doorPinLatitude === null || reserva.doorPinLongitude === null) return null;
  if (!pinSigueVigente(reserva, ahora)) return null;

  return { latitude: reserva.doorPinLatitude, longitude: reserva.doorPinLongitude };
}

/** Los campos que hay que pedirle a Prisma para poder llamar a `pinVisible`. */
export const PIN_SELECT = {
  doorPinLatitude: true,
  doorPinLongitude: true,
  completedAt: true,
  cancelledAt: true,
  scheduledEnd: true,
} as const;
