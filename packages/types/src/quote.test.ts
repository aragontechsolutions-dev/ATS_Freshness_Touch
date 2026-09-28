import { describe, expect, it } from 'vitest';
import { QuoteRequestSchema } from './quote';
import { BookingRequestSchema } from './booking';
import { AvailabilityRequestSchema } from './availability';

/**
 * QUE DATOS PIDE CADA PASO
 * ------------------------
 * La cotizacion y la reserva dejaron de pedir lo mismo, y la diferencia no
 * es un detalle de formulario: es cual de los dos numeros mueve el dinero y
 * cual mueve la agenda.
 *
 *   - EL PRECIO no mira habitaciones ni banos. La estandar es plana y la
 *     profunda y la de mudanza miran los pies cuadrados.
 *   - LA DURACION si los mira, y con ella cuanto tiempo se bloquea. Una
 *     estandar de 3 hab y 2 banos ocupa tres horas; sin esos datos saldrian
 *     hora y media, y el equipo llegaria tarde al cliente siguiente.
 *
 * De ahi que el cotizador no los pida y la reserva si.
 */

const COTIZACION = {
  service: 'STANDARD' as const,
  frequency: 'ONE_TIME' as const,
  squareFeet: 900,
  addOns: [],
  destination: { postalCode: '30303' },
  locale: 'es' as const,
};

describe('la cotizacion no necesita habitaciones ni banos', () => {
  it('se acepta una peticion sin ellos', () => {
    const resultado = QuoteRequestSchema.safeParse(COTIZACION);

    expect(resultado.success).toBe(true);
  });

  it('se siguen aceptando si vienen, y no estorban', () => {
    /*
     * El esquema es estricto: sin admitirlos, una pestana abierta con el
     * paquete anterior empezaria a recibir 400 en cuanto se despliegue.
     * Se aceptan y el motor no los mira.
     */
    const resultado = QuoteRequestSchema.safeParse({
      ...COTIZACION,
      bedrooms: 3,
      bathrooms: 2,
    });

    expect(resultado.success).toBe(true);
  });

  it('un numero imposible se sigue rechazando aunque el campo sea opcional', () => {
    // Opcional no es «vale cualquier cosa»: si viene, tiene que ser creible.
    expect(QuoteRequestSchema.safeParse({ ...COTIZACION, bedrooms: 40 }).success).toBe(false);
    expect(QuoteRequestSchema.safeParse({ ...COTIZACION, bathrooms: -1 }).success).toBe(false);
  });
});

describe('la reserva y la agenda SI los exigen', () => {
  /*
   * Es la otra mitad de la regla, y la que protege la operacion: si aqui
   * tambien fueran opcionales, el sistema reservaria la mitad del tiempo
   * que necesita el trabajo y nadie se enteraria hasta el segundo retraso
   * del dia.
   */
  it('una reserva sin habitaciones ni banos se rechaza', () => {
    const reserva = {
      service: 'STANDARD' as const,
      frequency: 'ONE_TIME' as const,
      squareFeet: 900,
      addOns: [],
      startsAt: '2026-10-15T14:00:00.000Z',
      contact: {
        firstName: 'Ada',
        lastName: 'Cliente',
        email: 'ada@example.com',
        phone: '+16785550123',
        locale: 'es' as const,
      },
      address: {
        line1: '123 Peachtree St',
        city: 'Atlanta',
        state: 'GA',
        postalCode: '30303',
      },
    };

    expect(BookingRequestSchema.safeParse(reserva).success).toBe(false);
    expect(BookingRequestSchema.safeParse({ ...reserva, bedrooms: 3, bathrooms: 2 }).success).toBe(
      true,
    );
  });

  it('una consulta de agenda sin ellos se rechaza', () => {
    const consulta = {
      service: 'STANDARD',
      squareFeet: '900',
      date: '2026-10-15',
      addOns: [],
    };

    expect(AvailabilityRequestSchema.safeParse(consulta).success).toBe(false);
    expect(
      AvailabilityRequestSchema.safeParse({ ...consulta, bedrooms: '3', bathrooms: '2' }).success,
    ).toBe(true);
  });
});
