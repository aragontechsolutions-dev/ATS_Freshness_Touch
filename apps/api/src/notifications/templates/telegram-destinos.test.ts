import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  jobAssignedTelegramMessage,
  newBookingTelegramMessage,
  teamArrivedFarTelegramMessage,
} from './booking-emails';

/**
 * LO QUE NO PUEDE LLEVAR CADA MENSAJE
 * ===================================
 * Desde la etapa 3.13 los avisos de Telegram van a tres sitios distintos, y
 * cada uno admite datos distintos. Esta prueba vigila la frontera.
 *
 * ========================================================================
 * LA REGLA QUE SOSTIENE LA ETAPA
 * ========================================================================
 * El aviso de reserva nueva lleva el importe total dentro, porque va a
 * operaciones. El del equipo de limpieza NO PUEDE LLEVARLO: quien limpia una
 * casa no necesita saber lo que paga quien vive en ella, y saberlo cambia la
 * relacion. Es la misma regla que el contrato `MyJob` ya cumple en la
 * pantalla del equipo.
 *
 * Y el riesgo es real, no teorico: las dos plantillas viven en el mismo
 * archivo, a treinta lineas una de otra, y se parecen. Copiar la linea
 * equivocada una vez basta.
 */

const FUENTE = readFileSync(join(import.meta.dirname, 'booking-emails.ts'), 'utf8');

const CUANDO = new Date('2026-10-20T14:00:00.000Z');

const ASIGNACION = {
  reference: 'FT-2026-0042',
  scheduledStart: CUANDO,
  timezone: 'America/New_York',
  addressLine: '123 Peachtree St',
  city: 'Atlanta',
  teamFirstNames: ['Ana', 'Luis'],
  serviceLabel: 'STANDARD',
};

describe('el mensaje al grupo del equipo de limpieza', () => {
  it('lleva lo que hace falta para ir a trabajar', () => {
    const texto = jobAssignedTelegramMessage(ASIGNACION);

    expect(texto).toContain('FT-2026-0042');
    expect(texto).toContain('123 Peachtree St');
    expect(texto).toContain('Atlanta');
    expect(texto).toContain('Ana');
    expect(texto).toContain('Luis');
  });

  it('NO LLEVA NI UN IMPORTE', () => {
    const texto = jobAssignedTelegramMessage(ASIGNACION);

    expect(texto).not.toMatch(/\$|USD|[Tt]otal|[Pp]recio|[Dd]eposit/);
  });

  it('y NO PUEDE llevarlo: el dato no entra en la firma', () => {
    /*
     * La guardia de verdad. Comprobar el texto solo prueba que HOY no lleva
     * importe; esto prueba que anadirlo manana exige cambiar la firma de la
     * funcion, que es un gesto visible en una revision en vez de una linea
     * mas en una plantilla.
     */
    const firma = FUENTE.slice(
      FUENTE.indexOf('export function jobAssignedTelegramMessage'),
      FUENTE.indexOf('): string {', FUENTE.indexOf('export function jobAssignedTelegramMessage')),
    );

    expect(firma).not.toMatch(/Cents|currency|total/i);
  });

  it('solo el nombre de pila, nunca el apellido', () => {
    // Un apellido completo en un chat de Telegram es un dato de empleado
    // viajando a un servicio de terceros sin ninguna necesidad.
    const texto = jobAssignedTelegramMessage(ASIGNACION);

    expect(texto).toContain('Ana, Luis');
    expect(texto).not.toContain('Garcia');
  });

  it('sin equipo asignado no se rompe', () => {
    const texto = jobAssignedTelegramMessage({ ...ASIGNACION, teamFirstNames: [] });

    expect(texto).toContain('FT-2026-0042');
  });
});

describe('el mensaje de fichaje lejano, a operaciones', () => {
  const LEJOS = {
    reference: 'FT-2026-0042',
    staffName: 'Ana Garcia',
    distanceMeters: 1240,
    addressLine: '123 Peachtree St',
    city: 'Atlanta',
  };

  it('dice quien, cuanto y donde', () => {
    const texto = teamArrivedFarTelegramMessage(LEJOS);

    expect(texto).toContain('Ana Garcia');
    expect(texto).toContain('1240 m');
    expect(texto).toContain('123 Peachtree St');
  });

  it('NO LLEVA COORDENADAS, solo metros', () => {
    /*
     * La ubicacion de un empleado no se guarda ni se transmite en ningun
     * sitio desde la etapa 3.3: lo que viaja es una distancia, que no situa a
     * nadie en un mapa. Un par de coordenadas en un chat de Telegram seria
     * exactamente lo que esa etapa decidio no construir.
     */
    const firma = FUENTE.slice(
      FUENTE.indexOf('export function teamArrivedFarTelegramMessage'),
      FUENTE.indexOf(
        '): string {',
        FUENTE.indexOf('export function teamArrivedFarTelegramMessage'),
      ),
    );

    expect(firma).not.toMatch(/latitude|longitude|\blat\b|\blon\b/i);
  });

  it('no culpa a nadie: sugiere las dos causas inocentes', () => {
    // Quien lo lee tiene que poder pensar «sera el GPS» antes que «me estan
    // mintiendo». El texto lo dice explicitamente.
    expect(teamArrivedFarTelegramMessage(LEJOS)).toMatch(/GPS|geocodificada/);
  });
});

describe('la diferencia entre los dos destinos', () => {
  it('el de operaciones SI lleva el total, y el del equipo no', () => {
    /*
     * Las dos plantillas, una al lado de la otra. Si algun dia alguien
     * unificara las dos en una sola, esta prueba se pondria roja.
     */
    const operaciones = newBookingTelegramMessage({
      reference: 'FT-2026-0042',
      customerName: 'Henry Marquez',
      scheduledStart: CUANDO,
      timezone: 'America/New_York',
      addressLine: '123 Peachtree St',
      city: 'Atlanta',
      totalCents: 18000,
      currency: 'USD',
    });

    const limpieza = jobAssignedTelegramMessage(ASIGNACION);

    expect(operaciones).toMatch(/180|Total/);
    expect(limpieza).not.toMatch(/180|Total/);
  });
});
