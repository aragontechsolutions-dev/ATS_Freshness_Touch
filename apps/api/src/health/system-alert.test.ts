import { beforeEach, describe, expect, it } from 'vitest';
import type { SystemCheck, SystemCheckId, SystemHealth } from '@freshness/types';
import { peorEstado } from '@freshness/types';
import { SystemAlertService } from './system-alert.service';

/**
 * EL ANTIRREBOTE
 * ==============
 * Lo que de verdad decide si esta etapa sirve de algo.
 *
 * ========================================================================
 * LA CUENTA QUE JUSTIFICA ESTE ARCHIVO
 * ========================================================================
 * El fallo del pin de la puerta duro unas 48 horas y el barrido lo detectaba
 * cada 30 minutos. Con la alarma mirando cada 5 minutos y sin antirrebote,
 * eso son casi 600 mensajes al telefono del titular.
 *
 * Nadie lee el mensaje 600. Nadie lee el cuarto. A partir de ahi la alarma
 * no solo deja de servir: ensena activamente a ignorar los avisos, y el dia
 * que suene por algo distinto tampoco lo leera nadie.
 *
 * Por eso las reglas se prueban con el reloj en la mano, una a una.
 *
 * SIN NEST Y SIN BASE DE DATOS, a proposito: lo que se comprueba es una
 * decision pura —que avisar y cuando— y montar una aplicacion entera para
 * probarla esconderia la regla detras del andamio.
 */

const SILENCIO_HORAS = 6;
const HORA_MS = 3_600_000;

/** Un informe con las comprobaciones que se digan, las demas en verde. */
function informe(malas: Partial<Record<SystemCheckId, SystemCheck>>): SystemHealth {
  const todas: SystemCheckId[] = [
    'database',
    'migrations',
    'pricingRates',
    'paymentProvider',
    'sweeps',
  ];

  const checks = todas.map(
    (id): SystemCheck => malas[id] ?? { id, state: 'ok', detailKey: null, count: null },
  );

  return { state: peorEstado(checks), checks, checkedAt: new Date().toISOString() };
}

const MIGRACIONES_PENDIENTES: SystemCheck = {
  id: 'migrations',
  state: 'down',
  detailKey: 'migrations.pending',
  count: 1,
};

const TARIFAS_ROTAS: SystemCheck = {
  id: 'pricingRates',
  state: 'degraded',
  detailKey: 'pricingRates.fallback',
  count: null,
};

/* -------------------------------------------------------------------------- */
/*  Dobles                                                                     */
/* -------------------------------------------------------------------------- */

let actual: SystemHealth;
let enviados: { chatId: string; text: string }[];
let chatId: string | null;
let chatTecnico: string | null;
let servicio: SystemAlertService;

function construir(): SystemAlertService {
  const checks = { run: () => Promise.resolve(actual) };

  const ajustes = {
    get: () => Promise.resolve({ telegramChatId: chatId, telegramTechChatId: chatTecnico }),
  };

  const telegram = {
    name: 'telegram' as const,
    send: (destino: string, texto: string) => {
      enviados.push({ chatId: destino, text: texto });
      return Promise.resolve({ ok: true, providerMessageId: '1', failureReason: null });
    },
  };

  const config = {
    get: (clave: string): unknown => (clave === 'SYSTEM_ALERT_SILENCE_HOURS' ? SILENCIO_HORAS : 0),
  };

  return new SystemAlertService(
    checks as never,
    ajustes as never,
    telegram as never,
    config as never,
  );
}

beforeEach(() => {
  enviados = [];
  chatId = '-100123';
  chatTecnico = '-100999';
  actual = informe({});
  servicio = construir();
});

/* -------------------------------------------------------------------------- */

describe('la alarma de estado', () => {
  describe('cuando algo se rompe', () => {
    it('avisa la primera vez', async () => {
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });

      const mensajes = await servicio.pasada(0);

      expect(mensajes).toHaveLength(1);
      expect(mensajes[0]).toContain('migrations.pending');
      expect(enviados).toHaveLength(1);
    });

    it('NO REPITE en la pasada siguiente', async () => {
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });

      await servicio.pasada(0);
      const segunda = await servicio.pasada(5 * 60_000);

      expect(segunda).toEqual([]);
    });

    it('LA CUENTA DEL DESASTRE: 48 h de fallo son 9 mensajes, no 600', async () => {
      /*
       * La prueba que resume el archivo. Se simulan dos dias enteros de
       * fallo continuo con la alarma mirando cada cinco minutos, que es
       * exactamente lo que paso con el pin de la puerta.
       *
       * Sin antirrebote: 576 mensajes.
       * Con silencio de 6 horas: uno al principio y uno cada seis horas.
       */
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });

      let total = 0;
      for (let minuto = 0; minuto <= 48 * 60; minuto += 5) {
        total += (await servicio.pasada(minuto * 60_000)).length;
      }

      // 1 inicial + 8 recordatorios (una cada 6 h durante 48 h).
      expect(total).toBe(9);
      expect(total).toBeLessThan(576);
    });

    it('el recordatorio se nota que es recordatorio', async () => {
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });

      const primero = await servicio.pasada(0);
      const recordatorio = await servicio.pasada(SILENCIO_HORAS * HORA_MS);

      expect(primero[0]).toContain('FALLO');
      expect(recordatorio[0]).toContain('SIGUE MAL');
    });

    it('el silencio se cuenta desde el ultimo AVISO, no desde la ultima mirada', async () => {
      /*
       * Un fallo clasico de implementacion: guardar la marca de tiempo en
       * cada pasada en vez de solo al avisar. Con el reloj reiniciandose
       * cada cinco minutos, el silencio no se cumpliria JAMAS y no volveria
       * a sonar nunca, por mucho que el fallo siguiera ahi.
       */
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });

      await servicio.pasada(0);
      // Muchas pasadas dentro de la ventana de silencio.
      for (let m = 5; m < SILENCIO_HORAS * 60; m += 5) {
        await servicio.pasada(m * 60_000);
      }

      const alCumplirse = await servicio.pasada(SILENCIO_HORAS * HORA_MS);

      expect(alCumplirse).toHaveLength(1);
    });
  });

  describe('cuando se arregla', () => {
    it('avisa de que se resolvio', async () => {
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });
      await servicio.pasada(0);

      actual = informe({});
      const mensajes = await servicio.pasada(60_000);

      expect(mensajes).toHaveLength(1);
      expect(mensajes[0]).toContain('[OK]');
      expect(mensajes[0]).toContain('migrations');
    });

    it('pero no dice «resuelto» de algo que nunca estuvo mal', async () => {
      // Sin esto, cada arranque mandaria cinco mensajes de «todo bien» de
      // cosas que nadie sabia que estuvieran mal.
      expect(await servicio.pasada(0)).toEqual([]);
    });

    it('y si vuelve a romperse, vuelve a avisar enseguida', async () => {
      /*
       * Tras recuperarse se olvida el historial, asi que una reaparicion es
       * un fallo nuevo y suena ya, sin esperar las seis horas. Un fallo
       * intermitente es MAS grave que uno continuo, no menos.
       */
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });
      await servicio.pasada(0);
      actual = informe({});
      await servicio.pasada(60_000);

      actual = informe({ migrations: MIGRACIONES_PENDIENTES });
      const otraVez = await servicio.pasada(120_000);

      expect(otraVez).toHaveLength(1);
      expect(otraVez[0]).toContain('FALLO');
    });
  });

  describe('varios problemas a la vez', () => {
    it('se cuentan por separado, cada uno con su silencio', async () => {
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });
      await servicio.pasada(0);

      // Aparece un segundo problema media hora despues.
      actual = informe({ migrations: MIGRACIONES_PENDIENTES, pricingRates: TARIFAS_ROTAS });
      const mensajes = await servicio.pasada(30 * 60_000);

      // Solo el nuevo: el primero sigue dentro de su silencio.
      expect(mensajes).toHaveLength(1);
      expect(mensajes[0]).toContain('pricingRates');
    });
  });

  describe('lo que NO puede salir en un mensaje', () => {
    it('solo la clave del contrato y una cifra', async () => {
      actual = informe({ migrations: MIGRACIONES_PENDIENTES, pricingRates: TARIFAS_ROTAS });

      const mensajes = await servicio.pasada(0);

      /*
       * Telegram es un servicio de terceros y el historial de ese chat vive
       * en sus servidores para siempre. Lo que se manda ahi, se publica ahi.
       * El mensaje solo puede llevar lo que el contrato ya deja salir por la
       * API: la clave y un numero.
       */
      for (const mensaje of mensajes) {
        expect(mensaje).not.toMatch(/postgres|supabase|sk_|whsec_|@/i);
        expect(mensaje.length).toBeLessThan(120);
      }
    });
  });

  describe('cuando no hay a donde mandarlo', () => {
    it('no se cae, y lo deja escrito igualmente', async () => {
      /*
       * Sin chat configurado el aviso sigue existiendo en el log. Si el
       * unico rastro fuera el mensaje de Telegram, un chat mal puesto
       * dejaria el fallo sin registrar justo cuando mas falta hace.
       */
      chatId = null;
      chatTecnico = null;
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });

      const mensajes = await servicio.pasada(0);

      expect(mensajes).toHaveLength(1);
      expect(enviados).toEqual([]);
    });
  });

  describe('a que chat va el aviso (etapa 3.13)', () => {
    it('al TECNICO, no al de operaciones', async () => {
      /*
       * Quien lleva el negocio no puede hacer nada con «faltan migraciones».
       * Mezclar esos mensajes con los de reservas nuevas ensena a no leer
       * ninguno de los dos.
       */
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });

      await servicio.pasada(0);

      expect(enviados).toHaveLength(1);
      expect(enviados[0]?.chatId).toBe('-100999');
    });

    it('y si no hay tecnico, al de operaciones antes que a ninguno', async () => {
      /*
       * Esta caida SI es deliberada: molestar a quien no puede arreglarlo es
       * mucho menos grave que un sistema roto del que no se entera nadie.
       */
      chatTecnico = null;
      actual = informe({ migrations: MIGRACIONES_PENDIENTES });

      await servicio.pasada(0);

      expect(enviados[0]?.chatId).toBe('-100123');
    });
  });

  describe('la alarma no puede tumbar la API', () => {
    it('si el diagnostico revienta, se traga el error', async () => {
      /*
       * Corre en un temporizador, sin nadie esperando: una excepcion aqui
       * acabaria con el proceso entero por no haber podido mandar un aviso.
       * El vigilante que mata a lo que vigila.
       */
      const roto = new SystemAlertService(
        { run: () => Promise.reject(new Error('la base no responde')) } as never,
        { get: () => Promise.resolve({ telegramChatId: '-1' }) } as never,
        { send: () => Promise.resolve({ ok: true }) } as never,
        { get: () => SILENCIO_HORAS } as never,
      );

      await expect(roto.pasada(0)).resolves.toEqual([]);
    });

    it('si Telegram falla, la pasada termina igual', async () => {
      const conTelegramRoto = new SystemAlertService(
        { run: () => Promise.resolve(informe({ migrations: MIGRACIONES_PENDIENTES })) } as never,
        { get: () => Promise.resolve({ telegramChatId: '-1' }) } as never,
        {
          send: () =>
            Promise.resolve({
              ok: false,
              providerMessageId: null,
              failureReason: 'chat not found',
            }),
        } as never,
        { get: () => SILENCIO_HORAS } as never,
      );

      await expect(conTelegramRoto.pasada(0)).resolves.toHaveLength(1);
    });
  });
});
