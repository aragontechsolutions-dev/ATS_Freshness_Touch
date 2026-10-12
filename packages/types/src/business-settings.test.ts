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
  whatsappHref,
  whatsappNumber,
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
   * ESTA ES LA PRUEBA QUE IMPORTA. El telefono acaba dentro del enlace de
   * WhatsApp de todo el sitio; si se colara otro esquema, ese boton pasaria
   * a ejecutar lo que quiera quien lo guardo. Se prueba con las formas que
   * un atacante intentaria de verdad, no solo con "texto feo".
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

  it('el enlace generado siempre es un wa.me de solo digitos', () => {
    expect(whatsappHref({ whatsapp: null, phone: '+14045550123' })).toBe(
      'https://wa.me/14045550123',
    );
  });

  it('presenta los numeros de Estados Unidos como los lee un cliente', () => {
    expect(formatPhone('+14045550123')).toBe('+1 (404) 555-0123');
  });

  it('deja intacto un numero de otro pais en vez de inventarle un formato', () => {
    expect(formatPhone('+34911223344')).toBe('+34911223344');
  });

  it('sin numero no hay texto ni enlace: nada de numeros de relleno', () => {
    expect(formatPhone(null)).toBeNull();
    expect(whatsappHref({ whatsapp: null, phone: null })).toBeNull();
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

/* -------------------------------------------------------------------------- */

describe('WhatsApp (etapa 3.16)', () => {
  /*
   * TODOS LOS BOTONES DE CONTACTO DEL SITIO PASAN POR AQUI. Un enlace mal
   * construido no da un error: da un boton que no escribe a nadie, o peor,
   * que escribe a otro numero.
   */

  it('vacio significa «el mismo telefono»', () => {
    // La regla 1 de este archivo: el numero se guarda UNA vez, para que el
    // sitio no pueda ensenar uno y escribir a otro.
    expect(whatsappNumber({ whatsapp: null, phone: '+14045550123' })).toBe('+14045550123');
  });

  it('y si hay una linea propia de WhatsApp, manda esa', () => {
    expect(whatsappNumber({ whatsapp: '+16785551234', phone: '+14045550123' })).toBe(
      '+16785551234',
    );
  });

  it('sin ningun numero no hay enlace, en vez de uno roto', () => {
    expect(whatsappNumber({ whatsapp: null, phone: null })).toBeNull();
    expect(whatsappHref({ whatsapp: null, phone: null }, 'hola')).toBeNull();
  });

  it('EL NUMERO VIAJA SIN SIGNOS, que es lo que exige wa.me', () => {
    // Con el «+» delante, wa.me devuelve un error en vez de abrir el chat.
    expect(whatsappHref({ whatsapp: '+16785551234', phone: null })).toBe(
      'https://wa.me/16785551234',
    );
  });

  it('el mensaje va codificado, no pegado en crudo', () => {
    /*
     * Sin codificar, un «&» o un «#» en el texto cortarian la URL y el
     * cliente llegaria al chat con media frase.
     */
    const enlace = whatsappHref({ whatsapp: null, phone: '+14045550123' }, 'Hola 30655 & 1800 ft²');

    expect(enlace).toContain('?text=');
    expect(enlace).not.toContain(' ');
    expect(enlace).not.toContain('&text');
    expect(decodeURIComponent(enlace?.split('?text=')[1] ?? '')).toBe('Hola 30655 & 1800 ft²');
  });

  it('un mensaje vacio no deja un ?text= colgando', () => {
    expect(whatsappHref({ whatsapp: null, phone: '+14045550123' }, '   ')).toBe(
      'https://wa.me/14045550123',
    );
  });

  it('NO SE PIERDE EL TELEFONO con una fila de antes de la etapa', () => {
    /*
     * LA PRUEBA QUE JUSTIFICA EL `.default(null)`.
     *
     * Esto es un `strictObject`. Sin el valor por defecto, la fila guardada
     * —que no tiene `whatsapp`— dejaria de cumplir el contrato, el servicio
     * caeria a DEFAULT_BUSINESS_SETTINGS y el telefono desapareceria de toda
     * la web sin un solo error. Es la caida muda que costo diez dias con los
     * precios.
     */
    const filaDeAntes = {
      phone: '+14045550123',
      email: 'hola@ejemplo.com',
      hours: horarioValido,
    };

    const resultado = BusinessSettingsSchema.safeParse(filaDeAntes);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.phone).toBe('+14045550123');
    expect(resultado.data?.whatsapp).toBeNull();
  });

  it('y el numero de WhatsApp se valida igual de duro que el telefono', () => {
    const resultado = BusinessSettingsSchema.safeParse({
      phone: '+14045550123',
      whatsapp: 'javascript:alert(1)',
      email: null,
      hours: horarioValido,
    });

    expect(resultado.success).toBe(false);
  });
});
