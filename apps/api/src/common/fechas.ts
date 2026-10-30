/**
 * De «AAAA-MM-DD» a lo que admite una columna `date`.
 *
 * Prisma exige un ISO-8601 completo aunque la columna solo guarde el dia, y
 * con la cadena corta responde «premature end of input». Se fija a mediodia
 * UTC y no a medianoche para que ningun desfase horario de una hora mueva la
 * fecha al dia anterior.
 *
 * ========================================================================
 * VIVE AQUI Y NO EN EL SERVICIO DE SERIES, QUE ES DONDE NACIO
 * ========================================================================
 * Al poder mover una cita, las reservas tambien guardan una fecha sin hora
 * —`seriesOccurrenceDate`, el dia que le tocaba en el calendario de la
 * serie— y la necesitan. Dejarla en `series.service.ts` obligaria a
 * `bookings.service.ts` a importar del modulo de series, que es el que esta
 * construido ENCIMA de las reservas: una importacion hacia arriba que el dia
 * que crezca se convierte en un ciclo.
 *
 * La trampa que evita ya costo dos diagnosticos, y las dos veces el error
 * fue el mismo: pasar «2026-03-03» tal cual.
 */
export function comoFecha(dia: string): Date {
  return new Date(`${dia}T12:00:00.000Z`);
}
