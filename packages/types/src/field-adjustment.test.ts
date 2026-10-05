import { describe, expect, it } from 'vitest';
import {
  FieldAdjustmentDecisionSchema,
  FieldAdjustmentInputSchema,
  differsFromBooked,
  isOpenAdjustment,
  type FieldAdjustment,
  type FieldAdjustmentValues,
} from './field-adjustment';

const CONTRATADO: FieldAdjustmentValues = {
  squareFeet: 900,
  bedrooms: 3,
  bathrooms: 2,
  addOns: [{ code: 'INSIDE_FRIDGE', quantity: 1 }],
};

function propuesta(cambios: Partial<FieldAdjustment> = {}): FieldAdjustment {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    state: 'PROPOSED',
    booked: CONTRATADO,
    found: { ...CONTRATADO, squareFeet: 1300 },
    note: 'La casa es bastante mas grande de lo que decia la reserva.',
    proposedByFirstName: 'Cleo',
    proposedAt: '2026-10-04T14:00:00.000Z',
    differenceCents: 4000,
    newTotalCents: 20000,
    resolvedByFirstName: null,
    resolvedAt: null,
    noPriceReason: null,
    manualPrice: false,
    resolutionNote: null,
    ...cambios,
  };
}

describe('lo que el lider puede corregir', () => {
  it('acepta corregir solo los pies cuadrados', () => {
    // El caso mas comun: nadie sabe cuantos pies cuadrados tiene su casa.
    expect(
      FieldAdjustmentInputSchema.safeParse({ squareFeet: 1300, note: 'Es mas grande' }).success,
    ).toBe(true);
  });

  it('acepta corregir solo los extras, con su cantidad', () => {
    // «Marca inside the fridge y tiene tres neveras».
    expect(
      FieldAdjustmentInputSchema.safeParse({
        addOns: [{ code: 'INSIDE_FRIDGE', quantity: 3 }],
        note: 'Hay tres neveras, no una',
      }).success,
    ).toBe(true);
  });

  it('EXIGE UN MOTIVO, siempre', () => {
    /*
     * Lo lee una persona que no estuvo alli y que va a tener que llamar al
     * cliente. Sin esto, un «1.300» a secas no se puede defender por
     * telefono.
     */
    expect(FieldAdjustmentInputSchema.safeParse({ squareFeet: 1300 }).success).toBe(false);
    expect(FieldAdjustmentInputSchema.safeParse({ squareFeet: 1300, note: '   ' }).success).toBe(
      false,
    );
  });

  it('RECHAZA una propuesta que no corrige nada', () => {
    // Eso es una nota, y para una nota no hace falta mover un precio.
    expect(FieldAdjustmentInputSchema.safeParse({ note: 'Todo correcto' }).success).toBe(false);
  });

  it('NO DEJA CAMBIAR EL TIPO DE SERVICIO', () => {
    /*
     * Es el cambio mas caro del catalogo y ademas cambiaria la lista de
     * tareas bajo los pies del equipo a media limpieza. Esa conversacion la
     * tiene coordinacion con el cliente, no se decide en una puerta.
     */
    expect(
      FieldAdjustmentInputSchema.safeParse({ service: 'DEEP', note: 'Hace falta profunda' })
        .success,
    ).toBe(false);
  });

  it('ni la fecha, ni la direccion, ni el precio', () => {
    for (const campo of ['startsAt', 'address', 'totalCents', 'frequency']) {
      expect(
        FieldAdjustmentInputSchema.safeParse({ [campo]: 'x', note: 'nota' }).success,
        campo,
      ).toBe(false);
    }
  });

  it('respeta los mismos topes que al reservar', () => {
    // El tope de 20.000 pies es el mismo del contrato de reserva: sin el, un
    // cero de mas multiplicaria el precio sin que nada lo parara.
    expect(FieldAdjustmentInputSchema.safeParse({ squareFeet: 25000, note: 'n' }).success).toBe(
      false,
    );
    expect(FieldAdjustmentInputSchema.safeParse({ squareFeet: 100, note: 'n' }).success).toBe(
      false,
    );
  });

  it('rechaza el mismo extra dos veces', () => {
    expect(
      FieldAdjustmentInputSchema.safeParse({
        addOns: [
          { code: 'INSIDE_FRIDGE', quantity: 1 },
          { code: 'INSIDE_FRIDGE', quantity: 2 },
        ],
        note: 'n',
      }).success,
    ).toBe(false);
  });
});

describe('si de verdad cambia algo', () => {
  it('el mismo contenido no es un ajuste', () => {
    // El lider abre la pantalla, mira, ve que esta todo bien y la cierra.
    expect(differsFromBooked(CONTRATADO, { ...CONTRATADO })).toBe(false);
  });

  it('un tamano distinto si', () => {
    expect(differsFromBooked(CONTRATADO, { ...CONTRATADO, squareFeet: 1300 })).toBe(true);
  });

  it('la misma nevera con otra cantidad tambien', () => {
    expect(
      differsFromBooked(CONTRATADO, {
        ...CONTRATADO,
        addOns: [{ code: 'INSIDE_FRIDGE', quantity: 3 }],
      }),
    ).toBe(true);
  });

  it('un extra de mas o de menos tambien', () => {
    expect(differsFromBooked(CONTRATADO, { ...CONTRATADO, addOns: [] })).toBe(true);
    expect(
      differsFromBooked(CONTRATADO, {
        ...CONTRATADO,
        addOns: [
          { code: 'INSIDE_FRIDGE', quantity: 1 },
          { code: 'INSIDE_OVEN', quantity: 1 },
        ],
      }),
    ).toBe(true);
  });

  it('EL ORDEN DE LOS EXTRAS NO CUENTA COMO CAMBIO', () => {
    /*
     * Es un fallo facil de cometer comparando listas: el movil puede mandar
     * los mismos extras en otro orden, y entonces cada vez que el lider
     * abriera la pantalla se crearia una propuesta identica a la anterior.
     */
    const dos: FieldAdjustmentValues = {
      ...CONTRATADO,
      addOns: [
        { code: 'INSIDE_FRIDGE', quantity: 1 },
        { code: 'INSIDE_OVEN', quantity: 2 },
      ],
    };
    const alReves: FieldAdjustmentValues = {
      ...CONTRATADO,
      addOns: [
        { code: 'INSIDE_OVEN', quantity: 2 },
        { code: 'INSIDE_FRIDGE', quantity: 1 },
      ],
    };

    expect(differsFromBooked(dos, alReves)).toBe(false);
  });
});

describe('la decision de coordinacion', () => {
  it('aprobar no necesita motivo', () => {
    expect(FieldAdjustmentDecisionSchema.safeParse({ approve: true }).success).toBe(true);
  });

  it('rechazar lo admite', () => {
    expect(
      FieldAdjustmentDecisionSchema.safeParse({ approve: false, note: 'Lo asumimos nosotros' })
        .success,
    ).toBe(true);
  });

  it('ADMITE un importe tecleado, porque hay trabajos sin precio automatico', () => {
    /*
     * ESTA PRUEBA DECIA LO CONTRARIO HASTA LA ETAPA 3.7, y su premisa era
     * incompleta: daba por hecho que el motor SIEMPRE puede dar precio. No
     * puede. Todo lo que esta fuera de las 35 millas del area metropolitana
     * —o sea, casi toda Georgia— se atiende sin cotizacion automatica por
     * diseno, y alli un ajuste se quedaba sin poder resolverse nunca.
     *
     * QUIEN LO RECHAZA ES EL SERVIDOR, no el contrato: solo administracion
     * puede teclearlo, y solo cuando el motor no ha podido calcularlo. Las
     * dos reglas estan probadas de punta a punta en
     * `field-adjustments.e2e.test.ts`, porque dependen del rol y del
     * resultado del motor, que el contrato no conoce.
     */
    expect(
      FieldAdjustmentDecisionSchema.safeParse({ approve: true, newTotalCents: 42000 }).success,
    ).toBe(true);
  });

  it('pero con un tope: un cero de mas al teclear no es la factura', () => {
    expect(
      FieldAdjustmentDecisionSchema.safeParse({ approve: true, newTotalCents: 99_000_000 }).success,
    ).toBe(false);
    expect(
      FieldAdjustmentDecisionSchema.safeParse({ approve: true, newTotalCents: -1 }).success,
    ).toBe(false);
  });

  it('y sigue sin dejar colar cualquier otro campo', () => {
    for (const extra of ['state', 'manualPrice', 'differenceCents']) {
      expect(
        FieldAdjustmentDecisionSchema.safeParse({ approve: true, [extra]: 1 }).success,
        extra,
      ).toBe(false);
    }
  });
});

describe('una propuesta abierta', () => {
  it('solo `PROPOSED` espera decision', () => {
    expect(isOpenAdjustment(propuesta())).toBe(true);

    for (const estado of ['APPLIED', 'REJECTED', 'SUPERSEDED'] as const) {
      expect(isOpenAdjustment(propuesta({ state: estado })), estado).toBe(false);
    }
  });

  it('sin precio automatico la diferencia es null, NO cero', () => {
    /*
     * Una casa por encima del ultimo tramo de la tabla no tiene precio
     * automatico. Un cero diria «no cambia nada», que es lo contrario de lo
     * que pasa: cambia, y hay que calcularlo a mano.
     */
    const sinPrecio = propuesta({ differenceCents: null, newTotalCents: null });
    expect(sinPrecio.differenceCents).toBeNull();
    expect(sinPrecio.differenceCents).not.toBe(0);
  });
});
