import { describe, expect, it } from 'vitest';
import { CAJA_DE_GEORGIA, DoorPinSchema, finDeLaVidaDelPin, pinSigueVigente } from './door-pin';

/** Una reserva con las tres fechas que deciden la vida del pin. */
function reserva(cambios: Partial<Parameters<typeof pinSigueVigente>[0]> = {}) {
  return {
    completedAt: null,
    cancelledAt: null,
    scheduledEnd: new Date('2026-10-10T18:00:00.000Z'),
    ...cambios,
  };
}

describe('el pin que manda el navegador', () => {
  it('acepta un punto dentro de Georgia', () => {
    const pin = DoorPinSchema.parse({ latitude: 34.2979, longitude: -83.8241 });
    expect(pin).toEqual({ latitude: 34.2979, longitude: -83.8241 });
  });

  it('REDONDEA A SEIS DECIMALES, que son unos 11 cm', () => {
    /*
     * El navegador escupe quince decimales. Guardarlos no añade precision
     * —la puerta no mide una millonesima de grado— sino un dato mas exacto
     * de lo necesario sobre la casa de una persona.
     */
    const pin = DoorPinSchema.parse({
      latitude: 34.2979123456,
      longitude: -83.8241987654,
    });

    expect(pin.latitude).toBe(34.297912);
    expect(pin.longitude).toBe(-83.824199);
  });

  it('RECHAZA LATITUD Y LONGITUD INTERCAMBIADAS', () => {
    /*
     * El fallo clasico al pasar de GeoJSON a Leaflet, y el que deja Georgia
     * en medio del oceano Indico. Sin esta guardia entra sin protestar.
     */
    const alReves = DoorPinSchema.safeParse({ latitude: -83.8241, longitude: 34.2979 });
    expect(alReves.success).toBe(false);
  });

  it('rechaza un punto fuera del estado', () => {
    // Miami: latitud valida para el planeta, no para Georgia.
    expect(DoorPinSchema.safeParse({ latitude: 25.76, longitude: -80.19 }).success).toBe(false);
  });

  it('rechaza lo que no es un numero', () => {
    expect(DoorPinSchema.safeParse({ latitude: '34.29', longitude: -83.82 }).success).toBe(false);
  });

  it('rechaza campos de mas', () => {
    const conPaja = DoorPinSchema.safeParse({
      latitude: 34.2979,
      longitude: -83.8241,
      accuracy: 5,
    });
    expect(conPaja.success).toBe(false);
  });

  it('la caja cubre Georgia entera, de Rabun Gap a St. Marys', () => {
    // Las dos esquinas reales del estado, para que nadie estreche la caja
    // sin darse cuenta de a quien deja fuera.
    expect(CAJA_DE_GEORGIA.latMin).toBeLessThan(30.7); // St. Marys, al sur
    expect(CAJA_DE_GEORGIA.latMax).toBeGreaterThan(34.99); // Rabun Gap, al norte
    expect(CAJA_DE_GEORGIA.lonMin).toBeLessThan(-85.6); // el borde con Alabama
    expect(CAJA_DE_GEORGIA.lonMax).toBeGreaterThan(-80.85); // el borde atlantico
  });
});

describe('cuando deja de valer', () => {
  it('vive 24 h despues del final previsto', () => {
    const vence = finDeLaVidaDelPin(reserva());
    expect(vence.toISOString()).toBe('2026-10-11T18:00:00.000Z');
  });

  it('y si el trabajo se completo, desde que se completo', () => {
    const vence = finDeLaVidaDelPin(reserva({ completedAt: new Date('2026-10-10T15:30:00.000Z') }));
    expect(vence.toISOString()).toBe('2026-10-11T15:30:00.000Z');
  });

  it('una cancelacion lo mata antes', () => {
    const vence = finDeLaVidaDelPin(reserva({ cancelledAt: new Date('2026-10-08T09:00:00.000Z') }));
    expect(vence.toISOString()).toBe('2026-10-09T09:00:00.000Z');
  });

  it('SIGUE VIVO MIENTRAS EL EQUIPO LO NECESITA', () => {
    /*
     * La prueba de que la caducidad no se come su propia utilidad: el dia
     * del trabajo, horas antes de ir, el pin tiene que estar.
     */
    const horasAntes = new Date('2026-10-10T08:00:00.000Z');
    expect(pinSigueVigente(reserva(), horasAntes)).toBe(true);
  });

  it('y muere al dia siguiente', () => {
    const pasadoManana = new Date('2026-10-12T00:00:00.000Z');
    expect(pinSigueVigente(reserva(), pasadoManana)).toBe(false);
  });

  it('AUNQUE NADIE MARQUE QUE TERMINO', () => {
    /*
     * El caso que sostiene la promesa. Si el equipo se olvida de pulsar «he
     * terminado», `completedAt` se queda nulo para siempre; medido desde el
     * final PREVISTO, el pin muere igual.
     */
    const tresDiasDespues = new Date('2026-10-13T18:00:00.000Z');
    const sinCerrar = reserva({ completedAt: null, cancelledAt: null });

    expect(pinSigueVigente(sinCerrar, tresDiasDespues)).toBe(false);
  });
});
