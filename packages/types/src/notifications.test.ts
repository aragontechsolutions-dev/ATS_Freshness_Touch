import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettingsSchema,
  TelegramChatIdSchema,
  maskChatId,
  maskEmail,
  telegramChatForAudience,
  telegramChatForSystemAlerts,
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
      emailBookingReminder: false,
      // Las horas siguen siendo obligatorias aunque el recordatorio este
      // apagado: asi no se pierde el valor configurado al volver a encenderlo.
      reminderHoursBefore: 24,
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

describe('antelacion del recordatorio', () => {
  /*
   * El minimo de 2 horas no es arbitrario. Reservar exige 24 horas de
   * antelacion, asi que alguien puede reservar para manana mismo; con un valor
   * muy bajo el recordatorio le llegaria pegado a la confirmacion, y dos
   * correos casi identicos en cinco minutos se leen como un fallo.
   */
  it.each([0, 1, -5])('rechaza %d horas: quedaria pegado a la confirmacion', (horas) => {
    const resultado = NotificationSettingsSchema.safeParse({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      reminderHoursBefore: horas,
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza mas de 72 horas: con cuatro dias ya no es un recordatorio', () => {
    const resultado = NotificationSettingsSchema.safeParse({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      reminderHoursBefore: 96,
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza medias horas: la ventana se cuenta en horas enteras', () => {
    const resultado = NotificationSettingsSchema.safeParse({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      reminderHoursBefore: 24.5,
    });

    expect(resultado.success).toBe(false);
  });

  it.each([2, 24, 48, 72])('acepta %d horas', (horas) => {
    const resultado = NotificationSettingsSchema.safeParse({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      reminderHoursBefore: horas,
    });

    expect(resultado.success).toBe(true);
  });

  it('el valor de partida es la vispera', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS.reminderHoursBefore).toBe(24);
    expect(DEFAULT_NOTIFICATION_SETTINGS.emailBookingReminder).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Los tres destinos de Telegram (etapa 3.13)                                 */
/* -------------------------------------------------------------------------- */

describe('a que chat va cada aviso', () => {
  const chats = {
    telegramChatId: '-100111',
    telegramCleaningChatId: '-100222',
    telegramTechChatId: '-100333',
  };

  it('operaciones y limpieza van a chats DISTINTOS', () => {
    /*
     * La prueba mas importante del bloque. Si estos dos coincidieran, el
     * mensaje de reserva nueva —que lleva el importe dentro— acabaria en el
     * grupo de quien limpia la casa.
     */
    const operaciones = telegramChatForAudience('INTERNAL', chats);
    const limpieza = telegramChatForAudience('CLEANING', chats);

    expect(operaciones).toBe('-100111');
    expect(limpieza).toBe('-100222');
    expect(operaciones).not.toBe(limpieza);
  });

  it('el cliente NUNCA tiene chat, pase lo que pase', () => {
    /*
     * Devolver aqui cualquiera de los otros mandaria al equipo un texto
     * redactado para el cliente, con su nombre y su precio.
     */
    expect(telegramChatForAudience('CUSTOMER', chats)).toBeNull();
  });

  it('sin grupo de limpieza configurado no se inventa otro', () => {
    const sinGrupo = { ...chats, telegramCleaningChatId: null };

    // Caer al de operaciones aqui seria exactamente el fallo que se evita.
    expect(telegramChatForAudience('CLEANING', sinGrupo)).toBeNull();
  });

  it('los fallos del sistema van al chat tecnico', () => {
    expect(telegramChatForSystemAlerts(chats)).toBe('-100333');
  });

  it('y sin chat tecnico caen al de operaciones, que es mejor que a ninguno', () => {
    /*
     * Esta caida SI es deliberada, al reves que la de limpieza. Molestar a
     * quien no puede arreglarlo es menos grave que un sistema roto del que
     * no se entera nadie.
     */
    expect(telegramChatForSystemAlerts({ ...chats, telegramTechChatId: null })).toBe('-100111');
  });

  it('sin ningun chat, no se manda nada en vez de fallar', () => {
    const vacio = { telegramChatId: null, telegramCleaningChatId: null, telegramTechChatId: null };

    expect(telegramChatForAudience('INTERNAL', vacio)).toBeNull();
    expect(telegramChatForSystemAlerts(vacio)).toBeNull();
  });
});

describe('la fila ya guardada sigue siendo valida', () => {
  it('UNA FILA SIN LOS CAMPOS NUEVOS SE LEE IGUAL', () => {
    /*
     * ESTA PRUEBA EVITA REPETIR UNA CAIDA QUE YA PASO.
     *
     * Estos ajustes se guardan como un JSON validado con `strictObject`. Al
     * cambiar el contrato de las tarifas sin pensar en esto, la fila guardada
     * dejo de validar y el sistema volvio a los valores de partida. Tardo
     * diez dias en descubrirse.
     *
     * Aqui el efecto habria sido peor y mas rapido: los valores de partida
     * tienen `telegramChatId: null`, asi que el chat que la empresa ya tenia
     * configurado se habria APAGADO SOLO, sin un error en ningun sitio.
     *
     * Por eso los campos nuevos llevan `.default(null)`: lo que hay guardado
     * hoy sigue entrando.
     */
    const filaDeAntesDeLaEtapa = {
      internalEmail: null,
      telegramChatId: '-100111',
      telegramOnNewBooking: true,
      emailBookingConfirmed: true,
      emailBookingCancelled: true,
      emailBookingReminder: true,
      reminderHoursBefore: 24,
    };

    const parsed = NotificationSettingsSchema.safeParse(filaDeAntesDeLaEtapa);

    expect(parsed.success).toBe(true);
    // Y lo que importa: el chat que ya estaba puesto NO se pierde.
    expect(parsed.success && parsed.data.telegramChatId).toBe('-100111');
    expect(parsed.success && parsed.data.telegramCleaningChatId).toBeNull();
    expect(parsed.success && parsed.data.telegramTechChatId).toBeNull();
  });
});
