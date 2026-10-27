import { describe, expect, it } from 'vitest';
import { SERIES_INTERVAL_DAYS, seriesOccurrences } from './recurring-series';

/**
 * LAS FECHAS QUE LE TOCAN A UNA SERIE
 * -----------------------------------
 * Es la cuenta de la que depende todo lo demas: si falla, o se duplican
 * citas o se pierden semanas sin que nadie lo note hasta que un equipo no
 * aparece.
 */

/* Martes. Todas las pruebas usan martes para que se vea cuando se desvia. */
const MARTES = '2026-03-03';

describe('seriesOccurrences', () => {
  it('semanal avanza de siete en siete y no se sale del martes', () => {
    const fechas = seriesOccurrences(MARTES, 'WEEKLY', MARTES, '2026-03-24');

    expect(fechas).toEqual(['2026-03-03', '2026-03-10', '2026-03-17', '2026-03-24']);
    for (const fecha of fechas) {
      expect(new Date(`${fecha}T00:00:00Z`).getUTCDay()).toBe(2);
    }
  });

  it('quincenal se salta una semana', () => {
    expect(seriesOccurrences(MARTES, 'BIWEEKLY', MARTES, '2026-04-01')).toEqual([
      '2026-03-03',
      '2026-03-17',
      '2026-03-31',
    ]);
  });

  /*
   * MENSUAL SON CUATRO SEMANAS. «El mismo dia del mes» caeria en un dia
   * distinto cada vez y rompe la ruta del equipo.
   */
  it('mensual son cuatro semanas, no el mismo dia del mes', () => {
    expect(SERIES_INTERVAL_DAYS.MONTHLY).toBe(28);
    expect(seriesOccurrences(MARTES, 'MONTHLY', MARTES, '2026-05-01')).toEqual([
      '2026-03-03',
      '2026-03-31',
      '2026-04-28',
    ]);
  });

  /*
   * LA CUENTA EMPIEZA EN `startDate`, NO EN LA VENTANA. Si empezara en la
   * ventana, cada pasada del barrido contaria desde un dia distinto y una
   * quincenal acabaria cayendo en semanas alternas distintas segun cuando se
   * ejecutara.
   */
  it('una serie vieja sigue cayendo donde le toca, no donde empieza la ventana', () => {
    const fechas = seriesOccurrences('2024-01-02', 'BIWEEKLY', '2026-03-04', '2026-03-31');

    /*
     * 2024-01-02 es martes, y del 2 de enero de 2024 al 10 de marzo de 2026
     * hay 798 dias: 57 quincenas exactas. Por eso caen el 10 y el 24, y no
     * el 17 y el 31 como caerian contando desde el principio de la ventana.
     * Esa diferencia de una semana es justo lo que esta prueba vigila.
     */
    expect(fechas).toEqual(['2026-03-10', '2026-03-24']);
    for (const fecha of fechas) {
      expect(new Date(`${fecha}T00:00:00Z`).getUTCDay()).toBe(2);
    }
  });

  it('no devuelve nada antes del comienzo', () => {
    expect(seriesOccurrences('2026-06-02', 'WEEKLY', MARTES, '2026-03-31')).toEqual([]);
  });

  it('la fecha de fin corta, y el dia del fin si entra', () => {
    expect(seriesOccurrences(MARTES, 'WEEKLY', MARTES, '2026-03-31', '2026-03-17')).toEqual([
      '2026-03-03',
      '2026-03-10',
      '2026-03-17',
    ]);
  });

  it('una ventana vacia no devuelve nada', () => {
    expect(seriesOccurrences(MARTES, 'WEEKLY', '2026-03-04', '2026-03-09')).toEqual([]);
  });

  it('una fecha ilegible no revienta: no devuelve nada', () => {
    expect(seriesOccurrences('el martes', 'WEEKLY', MARTES, '2026-03-31')).toEqual([]);
  });
});
