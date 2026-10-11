import { describe, expect, it } from 'vitest';
import {
  SYSTEM_CHECK_IDS,
  SystemCheckSchema,
  SystemHealthSchema,
  peorEstado,
  requiereAtencion,
  type SystemCheck,
  type SystemCheckState,
} from './system-health';

const sana = (id: SystemCheck['id']): SystemCheck => ({
  id,
  state: 'ok',
  detailKey: null,
  count: null,
});

describe('el contrato del estado del sistema', () => {
  describe('el detalle no puede ser un mensaje', () => {
    /*
     * ESTO ES LA GUARDIA DE SEGURIDAD DEL ARCHIVO, no una comprobacion de
     * formato. Un mensaje de error de Postgres trae el nombre del servidor y
     * el de la tabla; uno de Stripe puede traer datos de la cuenta. El dia
     * que alguien, por comodidad, meta `error.message` en este campo, lo
     * estara publicando en una respuesta HTTP.
     */
    it('acepta una clave', () => {
      const parsed = SystemCheckSchema.safeParse({
        ...sana('migrations'),
        state: 'down',
        detailKey: 'migrations.pending',
        count: 1,
      });
      expect(parsed.success).toBe(true);
    });

    it('RECHAZA un mensaje de error de verdad', () => {
      const mensajesReales = [
        'Raw query failed. Code: `42703`. Message: `column "doorPinLatitude" does not exist`',
        "Can't reach database server at db.abcdefgh.supabase.co:5432",
        'No such payment_intent: pi_3ABC',
        'ECONNREFUSED 10.0.0.4:6543',
      ];

      for (const mensaje of mensajesReales) {
        const parsed = SystemCheckSchema.safeParse({
          ...sana('database'),
          state: 'down',
          detailKey: mensaje,
        });
        expect(parsed.success, `deberia rechazar: ${mensaje}`).toBe(false);
      }
    });

    it('rechaza tambien lo que SOLO PARECE una clave', () => {
      /*
       * ESTA PRUEBA CAMBIO EL DISENO DEL CONTRATO.
       *
       * La primera version validaba el FORMATO `palabra.palabra`, y
       * `db.abcdefgh` —medio nombre de servidor de Supabase— lo cumplia tan
       * bien como `migrations.pending`. Ninguna regla de forma distingue las
       * dos cosas, porque los identificadores de servidor, de proyecto y de
       * cuenta tienen exactamente esa forma.
       *
       * Por eso el campo pasó a ser una LISTA CERRADA. Lo que no esta escrito
       * en el contrato no sale de la API.
       */
      const conFormaDeClave = [
        'db.abcdefgh',
        'host.supabase.co',
        'pi.3ABCdef',
        'migrations.pendiente',
        'Migrations.Pending',
      ];

      for (const casi of conFormaDeClave) {
        expect(
          SystemCheckSchema.safeParse({ ...sana('database'), detailKey: casi }).success,
          `deberia rechazar: ${casi}`,
        ).toBe(false);
      }
    });
  });

  describe('la cifra que acompana', () => {
    it('es un numero y nada mas', () => {
      expect(SystemCheckSchema.safeParse({ ...sana('sweeps'), count: 3 }).success).toBe(true);
      expect(SystemCheckSchema.safeParse({ ...sana('sweeps'), count: null }).success).toBe(true);
    });

    it('no admite texto, que es por donde se colaria un dato', () => {
      expect(SystemCheckSchema.safeParse({ ...sana('sweeps'), count: 'tres' }).success).toBe(false);
      expect(SystemCheckSchema.safeParse({ ...sana('sweeps'), count: -1 }).success).toBe(false);
    });
  });

  describe('el estado del conjunto es el PEOR, no el promedio', () => {
    it('una sola rota deja el conjunto roto aunque las demas esten bien', () => {
      const checks: SystemCheck[] = [
        sana('database'),
        sana('pricingRates'),
        sana('paymentProvider'),
        { ...sana('migrations'), state: 'down', detailKey: 'migrations.pending', count: 1 },
      ];

      expect(peorEstado(checks)).toBe('down');
    });

    it('«no se sabe» pesa mas que «va a medias» y menos que «no va»', () => {
      /*
       * El orden importa y es contraintuitivo a primera vista. No saber si
       * algo funciona es PEOR que saber que funciona a medias: lo segundo se
       * puede decidir, lo primero no. Y es mejor que saber que esta caido,
       * porque todavia puede estar bien.
       */
      const con = (state: SystemCheckState): SystemCheck => ({ ...sana('database'), state });

      expect(peorEstado([con('degraded'), con('unknown')])).toBe('unknown');
      expect(peorEstado([con('unknown'), con('down')])).toBe('down');
      expect(peorEstado([con('ok'), con('degraded')])).toBe('degraded');
    });

    it('sin comprobaciones dice ok', () => {
      expect(peorEstado([])).toBe('ok');
    });
  });

  describe('que merece una alarma', () => {
    it('todo lo que no sea ok, «no se sabe» incluido', () => {
      expect(requiereAtencion('ok')).toBe(false);
      expect(requiereAtencion('degraded')).toBe(true);
      expect(requiereAtencion('down')).toBe(true);
      expect(requiereAtencion('unknown')).toBe(true);
    });
  });

  describe('el informe entero', () => {
    it('se valida con las comprobaciones dentro', () => {
      const parsed = SystemHealthSchema.safeParse({
        state: 'ok',
        checks: SYSTEM_CHECK_IDS.map((id) => sana(id)),
        checkedAt: new Date().toISOString(),
      });

      expect(parsed.success).toBe(true);
    });

    it('no admite campos de sobra', () => {
      // `strictObject`: si alguien anade un campo nuevo tiene que pasar por
      // el contrato, no colarlo en la respuesta.
      const parsed = SystemHealthSchema.safeParse({
        state: 'ok',
        checks: [],
        checkedAt: new Date().toISOString(),
        stackTrace: 'at PrismaService.ping (/srv/app/dist/...)',
      });

      expect(parsed.success).toBe(false);
    });
  });

  it('la lista de comprobaciones es corta a proposito', () => {
    /*
     * Esta prueba parece tonta y no lo es. Una lista de estado larga se
     * convierte en una lista con algo siempre en ambar, y una lista con algo
     * siempre en ambar se deja de mirar: el mismo final que tuvo el log.
     *
     * Si hay que pasar de aqui, que sea una decision y no una deriva.
     */
    expect(SYSTEM_CHECK_IDS.length).toBeLessThanOrEqual(8);
  });
});
