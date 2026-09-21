import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettingsSchema,
  TelegramChatIdSchema,
  maskChatId,
  maskEmail,
} from './notifications';

describe('identificador de chat de Telegram', () => {
  it('acepta un chat personal y un grupo', () => {
    expect(TelegramChatIdSchema.safeParse('123456789').success).toBe(true);
    // Los grupos llevan identificador negativo.
    expect(TelegramChatIdSchema.safeParse('-1001234567890').success).toBe(true);
  });

  /*
   * ESTA ES LA PRUEBA QUE IMPORTA. El identificador acaba dentro de la
   * direccion a la que se hace la peticion al proveedor. Si admitiera texto
   * libre, se podria apuntar el aviso a otra ruta de su API, o colar
   * parametros de consulta que cambien lo que se envia.
   */
  it.each([
    '123/sendDocument',
    '123?chat_id=otro',
    '../getUpdates',
    '123 456',
    'abc',
    '',
    '12345678901234567890123',
  ])('rechaza %j', (entrada) => {
    expect(TelegramChatIdSchema.safeParse(entrada).success).toBe(false);
  });
});

describe('ajustes de avisos', () => {
  it('los valores de partida cumplen el contrato', () => {
    expect(NotificationSettingsSchema.safeParse(DEFAULT_NOTIFICATION_SETTINGS).success).toBe(true);
  });

  /*
   * El criterio: lo que el cliente espera recibir funciona desde el primer
   * dia; lo que interrumpe a una persona concreta no se enciende sin que esa
   * persona lo pida.
   */
  it('los correos al cliente nacen encendidos y los avisos internos sin destino', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.emailBookingConfirmed).toBe(true);
    expect(DEFAULT_NOTIFICATION_SETTINGS.emailBookingCancelled).toBe(true);
    expect(DEFAULT_NOTIFICATION_SETTINGS.telegramChatId).toBeNull();
    expect(DEFAULT_NOTIFICATION_SETTINGS.internalEmail).toBeNull();
  });

  it('rechaza un correo interno que no lo es', () => {
    const resultado = NotificationSettingsSchema.safeParse({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      internalEmail: 'no-es-un-correo',
    });

    expect(resultado.success).toBe(false);
  });

  it('normaliza el correo interno a minusculas', () => {
    const resultado = NotificationSettingsSchema.parse({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      internalEmail: '  Avisos@FreshnessTouch.COM ',
    });

    expect(resultado.internalEmail).toBe('avisos@freshnesstouch.com');
  });

  /*
   * El contrato es estricto a proposito: aqui NO deben poder guardarse
   * credenciales. Si alguien anade un campo "token" al formulario, esto lo
   * rechaza en vez de escribirlo en la base de datos.
   */
  it('rechaza campos que no existen, credenciales incluidas', () => {
    const resultado = NotificationSettingsSchema.safeParse({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      telegramBotToken: '123:ABC',
    });

    expect(resultado.success).toBe(false);
  });

  it('apagar todo es una opcion valida', () => {
    const resultado = NotificationSettingsSchema.safeParse({
      internalEmail: null,
      telegramChatId: null,
      telegramOnNewBooking: false,
      emailBookingConfirmed: false,
      emailBookingCancelled: false,
    });

    expect(resultado.success).toBe(true);
  });
});

describe('enmascarado para el panel', () => {
  it('deja ver el dominio pero no el buzon completo', () => {
    expect(maskEmail('ana.garcia@example.com')).toBe('an…@example.com');
  });

  it('con un usuario muy corto ensena aun menos', () => {
    expect(maskEmail('a@example.com')).toBe('a…@example.com');
  });

  it('nunca devuelve el correo entero', () => {
    for (const correo of ['ana.garcia@example.com', 'a@b.co', 'x@example.org']) {
      expect(maskEmail(correo)).not.toBe(correo);
    }
  });

  it('una cadena sin arroba no se filtra por el camino', () => {
    expect(maskEmail('esto-no-es-un-correo')).toBe('…');
  });

  it('del chat solo se ven los ultimos digitos', () => {
    expect(maskChatId('123456789')).toBe('…6789');
    expect(maskChatId('-1001234567890')).toBe('…7890');
  });

  it('un chat demasiado corto se oculta entero', () => {
    expect(maskChatId('123')).toBe('…');
  });
});
