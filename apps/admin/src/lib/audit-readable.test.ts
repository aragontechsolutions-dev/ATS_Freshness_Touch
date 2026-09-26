import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, type AuditLogItem } from '@freshness/types';
import { en } from '@freshness/i18n';
import { GRUPOS, describir, grupoDe, porDias, type Contexto } from './audit-readable';

/**
 * EL TRADUCTOR DE METADATA
 * ------------------------
 * Cada caso de aqui usa LA METADATA QUE ESCRIBE DE VERDAD algun servicio de
 * la API, copiada de su `audit.record(...)`. No hay formas inventadas: si un
 * servicio cambia lo que guarda, lo suyo es que esta prueba falle.
 *
 * La regla que mas importa comprobar es la que sostiene el modulo entero:
 * NO SE PIERDE NADA. Una clave sin traduccion tiene que seguir apareciendo,
 * fea pero visible, porque un registro de auditoria que esconde lo que no
 * entiende deja de ser una prueba de nada.
 */

const CLEO = '0826c725-0414-4abb-ae61-a5e14a4178ae';
const DARIO = '11111111-1111-4111-8111-111111111111';
const ADA = '22222222-2222-4222-8222-222222222222';

/**
 * Resuelve la clave contra los textos REALES en ingles.
 *
 * Con un doble que devolviera la clave, una etiqueta que faltara pasaria
 * desapercibida; asi, si no existe, se ve en la asercion.
 */
const ctx: Contexto = {
  locale: 'en',
  nombres: new Map([
    [CLEO, 'Cleo Limpia'],
    [DARIO, 'Dario Brilla'],
    [ADA, 'Ada Jefa'],
  ]),
  t: (clave, opciones) => {
    const valor = clave
      .split('.')
      .reduce<unknown>(
        (acc, parte) =>
          acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[parte] : undefined,
        en,
      );

    if (typeof valor !== 'string') {
      return typeof opciones?.defaultValue === 'string' ? opciones.defaultValue : clave;
    }

    return valor.replace(/\{\{(\w+)\}\}/g, (_, nombre: string) => String(opciones?.[nombre] ?? ''));
  },
};

/** Una entrada con lo minimo, para no repetir ocho campos en cada caso. */
function entrada(parcial: Partial<AuditLogItem>): AuditLogItem {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    occurredAt: '2026-09-23T20:17:00.000Z',
    surface: 'PANEL',
    actorType: 'STAFF',
    actorId: ADA,
    actorName: 'Ada Jefa',
    action: 'booking.viewed',
    entityType: 'booking',
    entityId: '33333333-3333-4333-8333-333333333333',
    metadata: null,
    ipAddress: '10.26.125.146',
    ...parcial,
  };
}

/** Las filas como pares, que es lo que se compara casi siempre. */
function filas(item: AuditLogItem): [string, string][] {
  return describir(item, ctx).datos.map((dato) => [dato.etiqueta, dato.valor]);
}

/* ======================================================================== */

describe('sobre que fue', () => {
  it('una reserva se identifica por su referencia, no por su UUID', () => {
    const { objetivo } = describir(
      entrada({ entityType: 'booking', metadata: { reference: 'FT-2026-0002' } }),
      ctx,
    );

    expect(objetivo).toBe('Booking FT-2026-0002');
  });

  /*
   * El nombre se resuelve con el directorio y no se guarda en la fila: si
   * alguien se cambia el apellido, el historial entero pasa a mostrarlo bien.
   */
  it('una ficha de personal se identifica por el nombre de la persona', () => {
    const { objetivo } = describir(
      entrada({ entityType: 'staff', entityId: CLEO, metadata: { email: 'cleo@example.com' } }),
      ctx,
    );

    expect(objetivo).toBe('Staff record: Cleo Limpia');
  });

  /*
   * Si la ficha ya no existe queda el correo, que es lo unico que identifica
   * a esa persona meses despues. Un UUID no le dice nada a nadie.
   */
  it('si la ficha ya no existe, queda el correo y nunca el identificador', () => {
    const { objetivo } = describir(
      entrada({
        entityType: 'staff',
        entityId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        metadata: { email: 'quien@example.com' },
      }),
      ctx,
    );

    expect(objetivo).toBe('Staff record: quien@example.com');
    expect(objetivo).not.toContain('ffffffff');
  });

  it('la configuracion y el propio registro no tienen "sobre que"', () => {
    expect(describir(entrada({ entityType: 'business_settings' }), ctx).objetivo).toBeNull();
    expect(describir(entrada({ entityType: 'audit', entityId: null }), ctx).objetivo).toBeNull();
  });
});

/* ======================================================================== */

describe('el equipo de una reserva', () => {
  /*
   * Es el caso que motivo todo esto. Antes se veia el JSON crudo con un
   * `staffId` dentro; ahora se lee quien entro y quien salio.
   */
  it('traduce identificadores a nombres y marca al responsable', () => {
    expect(
      filas(
        entrada({
          action: 'booking.team_changed',
          metadata: {
            reference: 'FT-2026-0002',
            before: [],
            after: [
              { staffId: CLEO, isLead: true },
              { staffId: DARIO, isLead: false },
            ],
          },
        }),
      ),
    ).toEqual([
      ['Team before', 'Nobody'],
      ['Team after', 'Cleo Limpia (lead), Dario Brilla'],
    ]);
  });

  it('un equipo vacio se dice con palabras, no con una lista en blanco', () => {
    const resultado = filas(
      entrada({
        action: 'booking.team_changed',
        metadata: {
          reference: 'FT-2026-0002',
          before: [{ staffId: CLEO, isLead: true }],
          after: [],
        },
      }),
    );

    expect(resultado).toContainEqual(['Team after', 'Nobody']);
  });

  it('alguien que ya no esta en la plantilla se dice, no se deja el UUID', () => {
    const resultado = filas(
      entrada({
        action: 'booking.team_changed',
        metadata: { before: [], after: [{ staffId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }] },
      }),
    );

    expect(resultado).toContainEqual(['Team after', 'Someone no longer on the staff list']);
  });
});

/* ======================================================================== */

describe('ficha de personal', () => {
  /*
   * Solo lo que CAMBIO. Volcar los tres campos siempre obligaria a comparar
   * a ojo cual es el que se toco, que es el trabajo que hay que ahorrar.
   */
  it('solo enseña los campos que cambiaron, con flecha', () => {
    expect(
      filas(
        entrada({
          action: 'staff.updated',
          entityType: 'staff',
          entityId: CLEO,
          metadata: {
            before: { role: 'CLEANER', isActive: true, email: 'cleo@example.com' },
            after: { role: 'DISPATCHER', isActive: true, email: 'cleo@example.com' },
          },
        }),
      ),
    ).toEqual([['Role', 'Cleaner → Dispatcher']]);
  });

  it('dar de baja se lee como tal', () => {
    const resultado = filas(
      entrada({
        action: 'staff.updated',
        metadata: {
          before: { role: 'CLEANER', isActive: true, email: 'c@e.com' },
          after: { role: 'CLEANER', isActive: false, email: 'c@e.com' },
        },
      }),
    );

    expect(resultado).toEqual([['Active', 'Yes → No']]);
  });

  it('el alta enseña puesto y correo', () => {
    expect(
      filas(
        entrada({ action: 'staff.created', metadata: { email: 'ana@example.com', role: 'ADMIN' } }),
      ),
    ).toEqual([
      ['Email', 'ana@example.com'],
      ['Role', 'Administrator'],
    ]);
  });
});

/* ======================================================================== */

describe('formato por tipo de dato', () => {
  it('el dinero sale como dinero, no como un numero de centavos', () => {
    expect(
      filas(
        entrada({
          action: 'payment.captured',
          metadata: { amountCents: 5000, reason: 'Trabajo hecho' },
        }),
      ),
    ).toEqual([
      ['Amount', '$50.00'],
      ['Reason', 'Trabajo hecho'],
    ]);
  });

  it('un cambio de estado se lee con los nombres de los estados', () => {
    expect(
      filas(
        entrada({
          action: 'booking.status.completed',
          metadata: { from: 'IN_PROGRESS', to: 'COMPLETED', reason: null },
        }),
      ),
    ).toEqual([
      ['Before', 'In progress'],
      ['After', 'Completed'],
    ]);
  });

  /*
   * `from` y `to` significan DOS cosas: los estados de una reserva, o el
   * rango de fechas de una consulta. Se distinguen por la forma del valor,
   * no por la accion, para que no haya que acordarse de nada al anadir una.
   */
  it('las mismas claves "from" y "to" valen para un rango de fechas', () => {
    const resultado = filas(
      entrada({
        action: 'audit.queried',
        entityType: 'audit',
        metadata: { from: '2026-09-01T00:00:00.000Z', to: null, actorId: CLEO },
      }),
    );

    expect(resultado).toContainEqual(['Person', 'Cleo Limpia']);
    /*
     * Y la etiqueta cambia con el valor: llamar «Antes» al principio de un
     * rango de fechas dice justo lo contrario de lo que paso.
     */
    expect(resultado.find(([etiqueta]) => etiqueta === 'From')?.[1]).toContain('2026');
    expect(resultado.map(([etiqueta]) => etiqueta)).not.toContain('Before');
  });

  /*
   * UNA CITA VA EN HORA DE GEORGIA. Es la hora a la que un equipo se
   * presenta en una casa y la misma que ve el cliente en su correo; en la
   * zona del navegador, el panel y el cliente hablarian de horas distintas.
   */
  it('la hora de la cita va en la zona de la empresa, no en la del navegador', () => {
    const resultado = filas(
      entrada({
        action: 'booking.created',
        // Mediodia en horario universal: las 8 de la manana en Georgia.
        metadata: { reference: 'FT-1', scheduledStart: '2026-10-01T12:00:00.000Z' },
      }),
    );

    expect(resultado.find(([e]) => e === 'Scheduled for')?.[1]).toContain('8:00');
  });

  it('marcar desde "Mis trabajos" se dice con el nombre de la pantalla', () => {
    const resultado = filas(
      entrada({
        action: 'booking.status.in_progress',
        metadata: { reference: 'FT-1', from: 'CONFIRMED', to: 'IN_PROGRESS', source: 'my-jobs' },
      }),
    );

    expect(resultado).toContainEqual(['Marked from', 'The "My jobs" screen']);
  });

  it('la reserva del sitio enseña servicio, zona e importe legibles', () => {
    const resultado = filas(
      entrada({
        action: 'booking.created',
        actorType: 'CUSTOMER',
        actorId: null,
        actorName: null,
        surface: 'SITE',
        metadata: {
          reference: 'FT-2026-0003',
          service: 'STANDARD',
          zone: 'A',
          totalCents: 19440,
          scheduledStart: '2026-10-01T14:00:00.000Z',
        },
      }),
    );

    expect(resultado).toContainEqual(['Zone', 'Zone A']);
    expect(resultado).toContainEqual(['Booking total', '$194.40']);
    expect(resultado.find(([e]) => e === 'Service')?.[1]).not.toBe('STANDARD');
  });
});

/* ======================================================================== */

describe('configuracion', () => {
  /*
   * `value` trae la configuracion ENTERA. Volcarla seria peor que el JSON
   * crudo, asi que se usa `changed` como indice y solo se enseña lo tocado.
   */
  it('solo enseña los campos tocados, con su valor nuevo', () => {
    expect(
      filas(
        entrada({
          action: 'settings.updated',
          entityType: 'business_settings',
          metadata: {
            changed: ['phone'],
            value: { phone: '+14045550123', email: 'hola@example.com', hours: {} },
          },
        }),
      ),
    ).toEqual([['Phone', '+14045550123']]);
  });

  it('un horario semanal no se vuelca: se dice que se actualizo', () => {
    expect(
      filas(
        entrada({
          action: 'settings.updated',
          metadata: {
            changed: ['hours'],
            value: { hours: { 1: { open: '08:00', close: '18:00' } } },
          },
        }),
      ),
    ).toEqual([['Opening hours', 'Updated']]);
  });
});

/* ======================================================================== */

describe('consultar el registro', () => {
  it('sin filtros lo dice con palabras, no con siete guiones', () => {
    expect(
      filas(
        entrada({
          action: 'audit.queried',
          entityType: 'audit',
          entityId: null,
          metadata: {
            actorId: null,
            action: null,
            surface: null,
            entityType: null,
            entityId: null,
            from: null,
            to: null,
          },
        }),
      ),
    ).toEqual([['Filters', 'No filters: the whole log was requested']]);
  });
});

/* ======================================================================== */

describe('no se pierde nada', () => {
  /*
   * LA REGLA QUE SOSTIENE EL MODULO. Si un servicio empieza a guardar una
   * clave nueva, tiene que salir en pantalla aunque nadie le haya puesto
   * etiqueta todavia. Una linea fea informa; una linea que desaparece es un
   * agujero en el registro.
   */
  it('una clave sin traduccion se pinta igual, con su nombre crudo', () => {
    expect(filas(entrada({ metadata: { algoNuevoQueNadieTradujo: 'valor' } }))).toEqual([
      ['algoNuevoQueNadieTradujo', 'valor'],
    ]);
  });

  it('los nulos no ocupan una linea: no dicen nada', () => {
    expect(filas(entrada({ metadata: { reason: null, role: 'ADMIN' } }))).toEqual([
      ['Role', 'Administrator'],
    ]);
  });

  it('sin metadata no hay lineas, y no se rompe', () => {
    expect(filas(entrada({ metadata: null }))).toEqual([]);
    expect(filas(entrada({ metadata: 'esto no deberia pasar' }))).toEqual([]);
  });
});

/* ======================================================================== */

describe('las categorias del filtro', () => {
  /*
   * El grupo se decide por prefijo justamente para que una accion nueva del
   * catalogo caiga sola en su cajon. Esta prueba comprueba que ninguna se
   * queda fuera del desplegable.
   */
  it('todas las acciones del catalogo caen en un grupo conocido', () => {
    for (const accion of AUDIT_ACTIONS) {
      expect(GRUPOS, accion).toContain(grupoDe(accion));
    }
  });

  /*
   * Mirar la ficha de un cliente NO es un movimiento de la reserva: es
   * alguien viendo sus datos, que es justo lo que interesa poder filtrar por
   * separado.
   */
  it('las lecturas van a "datos de clientes", no a "reservas"', () => {
    expect(grupoDe('booking.viewed')).toBe('sensitive');
    expect(grupoDe('access_notes.viewed')).toBe('sensitive');
    expect(grupoDe('booking.status.cancelled')).toBe('bookings');
  });
});

/* ======================================================================== */

describe('agrupar por dia', () => {
  const ahora = new Date('2026-09-26T18:00:00.000Z');

  it('separa hoy, ayer y el resto por su fecha', () => {
    const jornadas = porDias(
      [
        entrada({ id: '1', occurredAt: '2026-09-26T17:30:00.000Z' }),
        entrada({ id: '2', occurredAt: '2026-09-26T09:00:00.000Z' }),
        entrada({ id: '3', occurredAt: '2026-09-25T09:00:00.000Z' }),
        entrada({ id: '4', occurredAt: '2026-09-20T09:00:00.000Z' }),
      ],
      ctx,
      ahora,
    );

    expect(jornadas).toHaveLength(3);
    expect(jornadas[0]?.titulo).toBe('Today');
    expect(jornadas[0]?.entradas).toHaveLength(2);
    expect(jornadas[1]?.titulo).toBe('Yesterday');
    expect(jornadas[2]?.titulo).toContain('September');
  });

  it('una lista vacia no produce ningun grupo', () => {
    expect(porDias([], ctx, ahora)).toEqual([]);
  });
});
