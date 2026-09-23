import { describe, expect, it } from 'vitest';
import {
  AdminAssignmentsUpdateSchema,
  AdminStaffOptionSchema,
  staffFullName,
} from './assignments';

const ANA = 'a5a5a5a5-1111-4111-8111-111111111111';
const BETO = 'b5b5b5b5-2222-4222-8222-222222222222';

describe('equipo de una reserva', () => {
  it('acepta un equipo con un responsable', () => {
    const resultado = AdminAssignmentsUpdateSchema.safeParse({
      assignments: [
        { staffId: ANA, isLead: true },
        { staffId: BETO, isLead: false },
      ],
    });

    expect(resultado.success).toBe(true);
  });

  /*
   * Vaciar el equipo es una operacion legitima, no un error: cuando alguien
   * causa baja o se reorganiza el dia hay que poder dejar la reserva sin
   * nadie mientras se decide quien va.
   */
  it('acepta dejar la reserva sin nadie', () => {
    expect(AdminAssignmentsUpdateSchema.safeParse({ assignments: [] }).success).toBe(true);
  });

  it('acepta un equipo sin responsable: es un descuido, no un imposible', () => {
    const resultado = AdminAssignmentsUpdateSchema.safeParse({
      assignments: [
        { staffId: ANA, isLead: false },
        { staffId: BETO, isLead: false },
      ],
    });

    expect(resultado.success).toBe(true);
  });

  /*
   * DOS RESPONSABLES ES EL ESTADO QUE HAY QUE IMPEDIR. Con dos, ante un
   * imprevisto en la casa cada uno supone que decide el otro, que es
   * exactamente lo mismo que no tener ninguno pero sin que se note al mirar
   * la agenda.
   */
  it('rechaza dos responsables', () => {
    const resultado = AdminAssignmentsUpdateSchema.safeParse({
      assignments: [
        { staffId: ANA, isLead: true },
        { staffId: BETO, isLead: true },
      ],
    });

    expect(resultado.success).toBe(false);
  });

  /*
   * La misma persona dos veces no es solo redundante: al guardarse, esa
   * reserva ocuparia dos veces a la misma persona y la guardia de
   * solapamiento empezaria a ver choques consigo misma.
   */
  it('rechaza a la misma persona dos veces', () => {
    const resultado = AdminAssignmentsUpdateSchema.safeParse({
      assignments: [
        { staffId: ANA, isLead: true },
        { staffId: ANA, isLead: false },
      ],
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza un identificador que no es un UUID', () => {
    const resultado = AdminAssignmentsUpdateSchema.safeParse({
      assignments: [{ staffId: 'ana', isLead: true }],
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza mas de diez personas', () => {
    const muchas = Array.from({ length: 11 }, (_, i) => ({
      staffId: `a5a5a5a5-1111-4111-8111-${String(i).padStart(12, '0')}`,
      isLead: false,
    }));

    expect(AdminAssignmentsUpdateSchema.safeParse({ assignments: muchas }).success).toBe(false);
  });

  /*
   * El contrato es estricto a proposito. Sin esto, un campo de mas en el
   * cuerpo —por ejemplo uno que intentara fijar el sueldo de ese trabajo—
   * pasaria la validacion en vez de rechazarse.
   */
  it('rechaza campos que no existen', () => {
    const resultado = AdminAssignmentsUpdateSchema.safeParse({
      assignments: [{ staffId: ANA, isLead: true, payCents: 5000 }],
    });

    expect(resultado.success).toBe(false);
  });
});

describe('personal que se ofrece en el selector', () => {
  /*
   * LA PRUEBA QUE IMPORTA AQUI ES DE PRIVACIDAD. Esta pantalla se abre a
   * diario y la ve cualquiera que coordine. Si el contrato admitiera correo o
   * telefono, el dia que alguien los anadiera "porque son utiles" la lista de
   * asignar se convertiria en la agenda de contacto de toda la plantilla, sin
   * que nadie lo revisara.
   */
  it.each(['email', 'phone'])('rechaza que se cuele el campo %s', (campo) => {
    const resultado = AdminStaffOptionSchema.safeParse({
      staffId: ANA,
      firstName: 'Ana',
      lastName: 'Garcia',
      role: 'CLEANER',
      [campo]: 'algo',
    });

    expect(resultado.success).toBe(false);
  });

  it('acepta lo minimo para elegir a quien va', () => {
    const resultado = AdminStaffOptionSchema.safeParse({
      staffId: ANA,
      firstName: 'Ana',
      lastName: 'Garcia',
      role: 'CLEANER',
    });

    expect(resultado.success).toBe(true);
  });

  it('rechaza un puesto que no existe', () => {
    const resultado = AdminStaffOptionSchema.safeParse({
      staffId: ANA,
      firstName: 'Ana',
      lastName: 'Garcia',
      role: 'DUENO',
    });

    expect(resultado.success).toBe(false);
  });
});

describe('nombre completo', () => {
  it('une nombre y apellido', () => {
    expect(staffFullName({ firstName: 'Ana', lastName: 'Garcia' })).toBe('Ana Garcia');
  });

  it('sin apellido no deja un espacio suelto al final', () => {
    expect(staffFullName({ firstName: 'Ana', lastName: '' })).toBe('Ana');
  });
});
