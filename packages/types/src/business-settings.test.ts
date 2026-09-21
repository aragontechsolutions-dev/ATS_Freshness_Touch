import { describe, expect, it } from 'vitest';
import {
  BusinessSettingsSchema,
  DEFAULT_BUSINESS_SETTINGS,
  WeeklyHoursSchema,
  emailHref,
  formatLocalTime,
  formatPhone,
  groupWeeklyHours,
  normalizePhoneInput,
  phoneHref,
  type WeeklyHours,
} from './business-settings';

const horarioValido: WeeklyHours = DEFAULT_BUSINESS_SETTINGS.hours;

describe('telefono', () => {
  it('acepta un numero internacional bien formado', () => {
    const resultado = BusinessSettingsSchema.safeParse({
      phone: '+14045550123',
      email: null,
      hours: horarioValido,
    });

    expect(resultado.success).toBe(true);
  });

  /*
   * ESTA ES LA PRUEBA QUE IMPORTA. El telefono acaba dentro de un enlace
   * `tel:`; si se colara otro esquema, el boton de llamar de todo el sitio
   * pasaria a ejecutar lo que quiera quien lo guardo. Se prueba con las
   * formas que un atacante intentaria de verdad, no solo con "texto feo".
   */
  it.each([
    'javascript:alert(1)',
    'tel:+14045550123',
    '+1404555012 javascript:alert(1)',
    '"><script>alert(1)</script>',
    '+1-404-555-0123',
    '404-555-0123',
    '',
    '+0404555012',
  ])('rechaza %j como telefono', (entrada) => {
    const resultado = BusinessSettingsSchema.safeParse({
      phone: entrada,
      email: null,
      hours: horarioValido,
    });

    expect(resultado.success).toBe(false);
  });

  it('el enlace generado siempre empieza por tel: y nada mas', () => {
    expect(phoneHref('+14045550123')).toBe('tel:+14045550123');
    expect(phoneHref(null)).toBeNull();
  });

  it('presenta los numeros de Estados Unidos como los lee un cliente', () => {
    expect(formatPhone('+14045550123')).toBe('+1 (404) 555-0123');
  });

  it('deja intacto un numero de otro pais en vez de inventarle un formato', () => {
    expect(formatPhone('+34911223344')).toBe('+34911223344');
  });

  it('sin telefono no hay texto ni enlace: nada de numeros de relleno', () => {
    expect(formatPhone(null)).toBeNull();
    expect(phoneHref(null)).toBeNull();
  });
});

describe('normalizacion de lo que se teclea', () => {
  it.each([
    ['(404) 555-0123', '+14045550123'],
    ['404 555 0123', '+14045550123'],
    ['404-555-0123', '+14045550123'],
    ['+1 404 555 0123', '+14045550123'],
    ['+34 911 22 33 44', '+34911223344'],
  ])('convierte %j en %j', (entrada, esperado) => {
    expect(normalizePhoneInput(entrada)).toBe(esperado);
  });

  /*
   * Normalizar NO es validar. Lo que sale de aqui puede seguir siendo
   * invalido, y por eso pasa despues por el esquema. Si alguna vez alguien
   * confunde las dos cosas, esta prueba lo recuerda.
   */
  it('lo que normaliza mal sigue sin pasar la validacion', () => {
    const normalizado = normalizePhoneInput('javascript:alert(1)');
    expect(BusinessSettingsSchema.shape.phone.safeParse(normalizado).success).toBe(false);
  });

  it('un campo vacio se queda vacio, no se convierte en un numero', () => {
    expect(normalizePhoneInput('   ')).toBe('');
  });
});

describe('correo', () => {
  it('rechaza lo que no es un correo', () => {
    const resultado = BusinessSettingsSchema.safeParse({
      phone: null,
      email: 'javascript:alert(1)',
      hours: horarioValido,
    });

    expect(resultado.success).toBe(false);
  });

  it('normaliza a minusculas para que el enlace no dependa de como se teclee', () => {
    const resultado = BusinessSettingsSchema.parse({
      phone: null,
      email: '  Contact@FreshnessTouch.COM ',
      hours: horarioValido,
    });

    expect(resultado.email).toBe('contact@freshnesstouch.com');
    expect(emailHref(resultado.email)).toBe('mailto:contact@freshnesstouch.com');
  });

  it('sin correo no hay enlace', () => {
    expect(emailHref(null)).toBeNull();
  });
});

describe('horario', () => {
  it('exige los siete dias: falta de dato y dia cerrado no son lo mismo', () => {
    const { 7: _domingo, ...seisDias } = horarioValido;
    expect(WeeklyHoursSchema.safeParse(seisDias).success).toBe(false);
  });

  it('rechaza un cierre anterior a la apertura', () => {
    const resultado = WeeklyHoursSchema.safeParse({
      ...horarioValido,
      1: { open: '18:00', close: '08:00' },
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza abrir y cerrar a la misma hora: seria un dia de cero minutos', () => {
    const resultado = WeeklyHoursSchema.safeParse({
      ...horarioValido,
      1: { open: '09:00', close: '09:00' },
    });

    expect(resultado.success).toBe(false);
  });

  /*
   * Una expresion como `\d{2}:\d{2}` daria estas por buenas y la agenda
   * intentaria generar franjas a las 25:70.
   */
  it.each(['25:00', '08:70', '8:00', '0800', '08:00:00'])('rechaza %j como hora', (hora) => {
    const resultado = WeeklyHoursSchema.safeParse({
      ...horarioValido,
      1: { open: hora, close: '18:00' },
    });

    expect(resultado.success).toBe(false);
  });

  it('permite cerrar todos los dias sin romperse', () => {
    const cerrado = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null };
    expect(WeeklyHoursSchema.safeParse(cerrado).success).toBe(true);
  });
});

describe('agrupacion para mostrar', () => {
  it('junta los dias seguidos que comparten horario', () => {
    const tramos = groupWeeklyHours(horarioValido);

    expect(tramos).toEqual([
      { from: 1, to: 5, hours: { open: '08:00', close: '18:00' } },
      { from: 6, to: 6, hours: { open: '09:00', close: '16:00' } },
      { from: 7, to: 7, hours: null },
    ]);
  });

  it('no junta dias con el mismo horario si no son seguidos', () => {
    const tramos = groupWeeklyHours({
      ...horarioValido,
      3: null,
    });

    expect(tramos.map((tramo) => [tramo.from, tramo.to])).toEqual([
      [1, 2],
      [3, 3],
      [4, 5],
      [6, 6],
      [7, 7],
    ]);
  });

  it('una semana entera igual se resume en un solo tramo', () => {
    const iguales = Object.fromEntries(
      [1, 2, 3, 4, 5, 6, 7].map((dia) => [dia, { open: '09:00', close: '17:00' }]),
    ) as WeeklyHours;

    expect(groupWeeklyHours(iguales)).toHaveLength(1);
  });
});

describe('horas en pantalla', () => {
  it('en ingles lleva AM/PM', () => {
    expect(formatLocalTime('08:00', 'en-US')).toMatch(/8:00\s?AM/i);
    expect(formatLocalTime('18:00', 'en-US')).toMatch(/6:00\s?PM/i);
  });

  /*
   * Se prueba con `es-US`, que es el que usan las dos aplicaciones, NO con
   * `es-ES`. La diferencia importa: en Espana se dice "18:00" y en Estados
   * Unidos "6:00 p.m.", y los clientes de esta empresa estan en Georgia. Una
   * prueba contra `es-ES` pasaria igual y estaria comprobando un formato que
   * nadie llega a ver.
   */
  it('en espanol de Estados Unidos usa el reloj de 12 horas, como su publico', () => {
    expect(formatLocalTime('18:00', 'es-US')).toMatch(/6:00\s?p\.?\s?m/i);
  });

  it('el mismo dato se lee distinto segun el idioma, y esa es la idea', () => {
    expect(formatLocalTime('18:00', 'en-US')).not.toBe(formatLocalTime('18:00', 'es-US'));
  });
});

describe('valores de partida', () => {
  it('son validos contra el propio contrato', () => {
    expect(BusinessSettingsSchema.safeParse(DEFAULT_BUSINESS_SETTINGS).success).toBe(true);
  });

  it('no traen telefono ni correo inventados', () => {
    expect(DEFAULT_BUSINESS_SETTINGS.phone).toBeNull();
    expect(DEFAULT_BUSINESS_SETTINGS.email).toBeNull();
  });
});
