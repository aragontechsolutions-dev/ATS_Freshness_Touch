import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatCents,
  formatCentsCompact,
  formatDuration,
  formatMiles,
  formatTime,
  todayInTimezone,
} from './format';

describe('formato de moneda', () => {
  it('convierte centavos a dolares en ingles', () => {
    expect(formatCents(18500, 'en')).toBe('$185.00');
    expect(formatCents(0, 'en')).toBe('$0.00');
  });

  it('muestra los descuentos como importe negativo', () => {
    expect(formatCents(-2775, 'en')).toBe('-$27.75');
  });

  it('no pierde centavos al formatear', () => {
    expect(formatCents(3578, 'en')).toBe('$35.78');
  });

  it('la version compacta omite los decimales', () => {
    expect(formatCentsCompact(12000, 'en')).toBe('$120');
  });

  it('formatea millas sin decimales', () => {
    expect(formatMiles(23.8, 'en')).toBe('24');
  });
});

describe('formatos de fecha y hora para la reserva', () => {
  it('usa el reloj de 12 horas en los dos idiomas', () => {
    /*
     * El espanol del sitio es el de EE. UU. (es-US), no el de Espana: un
     * cliente hispanohablante en Georgia lee "2:30 p.m.", no "14:30".
     * Mostrarle 24 horas seria traducir el idioma pero no la costumbre.
     */
    expect(formatTime('14:30', 'en')).toMatch(/2:30/);
    expect(formatTime('14:30', 'en')).toMatch(/PM/i);
    expect(formatTime('14:30', 'es')).toMatch(/2:30/);
    expect(formatTime('14:30', 'es')).toMatch(/p\.?\s?m/i);
  });

  it('no desplaza la hora a la zona horaria del navegador', () => {
    // La hora ya viene resuelta en la de la empresa: volver a convertirla
    // mostraria una franja distinta de la que el cliente va a reservar.
    expect(formatTime('08:00', 'en')).toMatch(/8:00/);
    expect(formatTime('08:00', 'en')).toMatch(/AM/i);
    expect(formatTime('08:00', 'es')).toMatch(/8:00/);
  });

  it('devuelve el valor original si la hora no es valida', () => {
    expect(formatTime('sin-hora', 'en')).toBe('sin-hora');
  });

  it('formatea duraciones con horas y minutos', () => {
    expect(formatDuration(150, 'en')).toMatch(/2/);
    expect(formatDuration(150, 'en')).toMatch(/30/);
    // Menos de una hora no debe quedarse en blanco.
    expect(formatDuration(45, 'en')).toMatch(/45/);
    // Exactamente dos horas no muestra "0 min".
    expect(formatDuration(120, 'en')).not.toMatch(/0 min/);
  });

  it('suma dias sin saltar por el cambio de horario de verano', () => {
    // El 8 de marzo de 2026 hay cambio de hora en EE. UU.: sumar 24 horas a
    // un Date local daria el mismo dia o dos dias despues, segun la zona.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('la fecha de hoy se calcula en la zona de la empresa, no en la del navegador', () => {
    const enGeorgia = todayInTimezone('America/New_York');
    expect(enGeorgia).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Alguien en Tokio puede estar ya en el dia siguiente: la fecha de
    // Georgia nunca debe ser posterior a la suya.
    const enTokio = todayInTimezone('Asia/Tokyo');
    expect(enGeorgia <= enTokio).toBe(true);
  });
});
