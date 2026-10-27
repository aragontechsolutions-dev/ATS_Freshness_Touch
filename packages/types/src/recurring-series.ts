import { z } from 'zod';
import { FrequencySchema, ServiceTypeSchema } from './enums';
import { QuoteAddOnInputSchema } from './quote';

/**
 * LAS CLIENTAS DE SIEMPRE
 * =======================
 * «Ana, todos los martes a las nueve.» Hasta ahora eso vivia en la cabeza de
 * la duena y en su telefono, y cada semana habia que volver a meterlo a mano.
 *
 * ========================================================================
 * UNA SERIE NO ES UNA RESERVA LARGA: ES UNA FABRICA DE RESERVAS
 * ========================================================================
 * No existe «la cita recurrente». Existe una serie que va creando citas
 * normales, cada una con su equipo, su lista de tareas, su fichaje y su
 * factura. Si una semana hay que moverla, se mueve esa y la serie sigue.
 *
 * ========================================================================
 * SE GENERAN POR ADELANTADO, PERO NO HASTA EL INFINITO
 * ========================================================================
 * Un barrido mantiene creadas las citas de las proximas semanas. Ni una sola
 * —entonces la agenda volveria a mentir y el cotizador publico venderia esos
 * martes— ni todas las del ano, porque un ano de citas generadas es un ano
 * de citas que hay que cancelar una a una el dia que la clienta se va.
 */

/** Cuantas semanas por delante se mantienen creadas las citas. */
export const SERIES_HORIZON_WEEKS = 6;

/** Las frecuencias que SI son una serie. `ONE_TIME` no lo es, por definicion. */
export const SERIES_FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
export const SeriesFrequencySchema = z.enum(SERIES_FREQUENCIES);
export type SeriesFrequency = z.infer<typeof SeriesFrequencySchema>;

/**
 * Cada cuantos dias se repite.
 *
 * MENSUAL SON CUATRO SEMANAS, no «el mismo dia del mes». Una serie se define
 * por su dia de la semana —los martes— y «el 15 de cada mes» cae en un dia
 * distinto cada vez, lo que rompe la ruta del equipo. Cuatro semanas siempre
 * cae en martes.
 *
 * Escrito como `Record<SeriesFrequency, …>` y no como `Record<string, …>`:
 * asi anadir una frecuencia al enumerado sin ponerle intervalo no compila,
 * en vez de devolver `undefined` en produccion.
 */
export const SERIES_INTERVAL_DAYS: Record<SeriesFrequency, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 28,
};

export const SERIES_STATUSES = ['ACTIVE', 'PAUSED', 'ENDED'] as const;
export const SeriesStatusSchema = z.enum(SERIES_STATUSES);
export type SeriesStatus = z.infer<typeof SeriesStatusSchema>;

/**
 * Crear una serie A PARTIR DE UNA RESERVA QUE YA EXISTE.
 *
 * ========================================================================
 * Y NO CON UN FORMULARIO PROPIO, QUE ERA LO OBVIO
 * ========================================================================
 * Un formulario de serie pediria otra vez el cliente, la direccion, el
 * servicio, el tamano y la hora: exactamente lo que acaba de escribirse al
 * meter la primera cita. Dos formularios que piden lo mismo se separan solos
 * —uno valida el codigo postal y el otro se olvida— y ademas obligan a la
 * duena a teclear dos veces lo mismo.
 *
 * Asi el camino es el natural: se mete la primera cita, y desde su ficha se
 * dice «esto se repite». El dia de la semana, la hora y la duracion salen de
 * ella.
 */
export const SeriesFromBookingSchema = z
  .strictObject({
    frequency: SeriesFrequencySchema,
    /**
     * Hasta cuando. Nulo = sin fecha de fin, que es el caso normal de una
     * clienta fija y por eso es lo que vale por defecto.
     */
    endDate: z.iso.date().nullable().default(null),
    /**
     * La tarifa pactada de esta clienta, en centavos. Nulo = manda el motor.
     *
     * Vive en la serie y no en cada cita: si se recalculara cada vez, el dia
     * que se suban las tarifas se le subirian a ella sin que nadie lo
     * decidiera.
     */
    priceOverrideCents: z.int().nonnegative().max(10_000_00).nullable().default(null),
  })
  .refine((valor) => valor.endDate === null || Date.parse(valor.endDate) > Date.now(), {
    message: 'La fecha de fin tiene que estar en el futuro',
    path: ['endDate'],
  });
export type SeriesFromBooking = z.infer<typeof SeriesFromBookingSchema>;
export type SeriesFromBookingInput = z.input<typeof SeriesFromBookingSchema>;

/** Pausar, reanudar o terminar. Lo unico que se puede cambiar de una serie. */
export const SeriesUpdateSchema = z.strictObject({
  status: SeriesStatusSchema,
});
export type SeriesUpdate = z.infer<typeof SeriesUpdateSchema>;

/**
 * Una serie tal y como la ve el panel.
 *
 * TOLERANTE, como todo lo que lee un navegador: panel y API se despliegan por
 * separado y un contrato estricto aqui vaciaria la lista entera el dia que la
 * API devuelva un campo de mas.
 */
export const SeriesItemSchema = z.object({
  id: z.uuid(),
  status: SeriesStatusSchema,
  frequency: FrequencySchema,
  service: ServiceTypeSchema,
  /** 0 = domingo ... 6 = sabado, en la zona horaria de la empresa. */
  dayOfWeek: z.int().min(0).max(6),
  /** Hora local de inicio, HH:MM. */
  startTime: z.string(),
  durationMinutes: z.int().positive(),
  startDate: z.string(),
  endDate: z.string().nullable().default(null),
  priceOverrideCents: z.int().nullable().default(null),
  addOns: z.array(QuoteAddOnInputSchema).default([]),
  /** Para hablar con ella por telefono. NO es dato de pantalla compartida. */
  customerName: z.string(),
  /** Cuantas citas futuras tiene creadas ahora mismo. */
  upcomingCount: z.int().nonnegative().default(0),
  /** La siguiente, si la hay. */
  nextAt: z.string().nullable().default(null),
});
export type SeriesItem = z.infer<typeof SeriesItemSchema>;

export const SeriesListSchema = z.object({
  series: z.array(SeriesItemSchema).default([]),
});
export type SeriesList = z.infer<typeof SeriesListSchema>;

/**
 * Las fechas que le tocan a una serie dentro de una ventana.
 *
 * ========================================================================
 * SE CUENTA DESDE `startDate`, NO DESDE HOY
 * ========================================================================
 * Si se contara desde hoy, cada pasada del barrido empezaria la cuenta en un
 * dia distinto y una serie quincenal acabaria cayendo en semanas alternas
 * distintas segun cuando se ejecutara. Contando siempre desde el principio,
 * el martes que toca es el mismo lo mire quien lo mire.
 *
 * Devuelve fechas AAAA-MM-DD en la zona de la empresa; la hora la pone quien
 * llama, que es quien sabe el `startTime`.
 */
export function seriesOccurrences(
  startDate: string,
  frequency: SeriesFrequency,
  desde: string,
  hasta: string,
  endDate: string | null = null,
): string[] {
  const paso = SERIES_INTERVAL_DAYS[frequency];

  const inicio = Date.parse(`${startDate}T00:00:00Z`);
  const limiteBajo = Date.parse(`${desde}T00:00:00Z`);
  const limiteAlto = Date.parse(`${hasta}T00:00:00Z`);
  const fin = endDate === null ? null : Date.parse(`${endDate}T00:00:00Z`);

  if (Number.isNaN(inicio) || Number.isNaN(limiteBajo) || Number.isNaN(limiteAlto)) return [];

  const DIA = 86_400_000;
  const fechas: string[] = [];

  /*
   * SE SALTA DE GOLPE hasta la ventana en vez de avanzar dia a dia: una serie
   * semanal que empezo hace tres anos son ciento cincuenta vueltas de bucle
   * cada hora, por cada clienta, para no encontrar nada.
   */
  const saltos = inicio >= limiteBajo ? 0 : Math.ceil((limiteBajo - inicio) / (paso * DIA));

  for (let momento = inicio + saltos * paso * DIA; momento <= limiteAlto; momento += paso * DIA) {
    if (fin !== null && momento > fin) break;
    const fecha = new Date(momento).toISOString().slice(0, 10);
    fechas.push(fecha);
  }

  return fechas;
}
