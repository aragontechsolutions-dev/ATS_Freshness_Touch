import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChecklistItemState,
  JobChecklistEntry,
  MyJob,
  MyJobs as MyJobsRespuesta,
} from '@freshness/types';
import '../i18n';

/**
 * «HE TERMINADO» PREGUNTA ANTES, Y EL AVISO DE LA CAMPANA LLEGA A ALGUN SITIO
 * ==========================================================================
 * Dos huecos del PWA del equipo de limpieza, probados aqui porque ninguno de
 * los dos se ve leyendo el componente:
 *
 *   H4. `COMPLETED` es un estado FINAL —no hay transicion de salida ni para
 *       el equipo ni para coordinacion— y el boton lo ponia con UN TOQUE sin
 *       preguntar. Lo que se comprueba es que el toque ya NO llama a la API,
 *       que la pregunta dice las tareas que quedan, y que decir «todavia no»
 *       deja el trabajo exactamente como estaba.
 *
 *   H5. La campana se pinta para este puesto y recibe sus avisos, pero sus
 *       dos botones cambiaban una vista que para limpieza no se miraba
 *       nunca: no pasaba nada al pulsar. Ahora el aviso trae un trabajo
 *       destacado, y lo que se comprueba es el caso incomodo —que el trabajo
 *       YA NO ESTE en la lista, porque la lista empieza hoy— que es el que
 *       volveria a parecer un boton muerto.
 */

const fetchMyJobs = vi.fn<() => Promise<MyJobsRespuesta>>();
const markMyJobProgress = vi.fn<(id: string, body: unknown) => Promise<MyJob>>();

vi.mock('../lib/api', () => ({
  fetchMyJobs: () => fetchMyJobs(),
  markChecklistItem: vi.fn(),
  markMyJobProgress: (id: string, body: unknown) => markMyJobProgress(id, body),
  proposeFieldAdjustment: vi.fn(),
  isSessionError: () => false,
  sessionLostReason: () => undefined,
  ApiClientError: class ApiClientError extends Error {
    messageKey = 'admin.errorGeneric';
  },
}));

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

/*
 * La ubicacion se simula: en jsdom no hay `navigator.geolocation`, y aunque
 * la version real devuelve «no se pudo» sin lanzar, dejarla suelta ataria
 * estas pruebas a un detalle del entorno que no tiene nada que ver con lo
 * que se esta comprobando.
 */
vi.mock('../lib/geolocalizacion', () => ({
  ubicacionParaFichar: () => Promise.resolve({ locationState: 'UNAVAILABLE' as const }),
}));

const BOOKING = '10000000-0000-4000-8000-000000000001';
const OTRO = '10000000-0000-4000-8000-000000000002';

function tarea(code: string, state: ChecklistItemState | null = null): JobChecklistEntry {
  return {
    code,
    room: 'COMMON_AREAS',
    state,
    note: null,
    markedAt: state === null ? null : '2026-10-04T10:00:00.000Z',
    markedByFirstName: state === null ? null : 'Cleo',
    retired: false,
  };
}

function trabajo(cambios: Partial<MyJob> = {}): MyJob {
  const dentroDeUnRato = new Date(Date.now() + 3 * 3_600_000);

  return {
    bookingId: BOOKING,
    reference: 'FT-2026-0001',
    status: 'IN_PROGRESS',
    service: 'STANDARD',
    scheduledStart: dentroDeUnRato.toISOString(),
    scheduledEnd: new Date(dentroDeUnRato.getTime() + 7_200_000).toISOString(),
    timezone: 'America/New_York',
    durationMinutes: 120,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    addOns: [],
    customerFirstName: 'Luis',
    customerPhone: '+14045550199',
    addressLine1: '100 Peachtree St',
    addressLine2: null,
    city: 'Atlanta',
    state: 'GA',
    postalCode: '30303',
    accessNotes: null,
    customerNotes: null,
    teammates: [],
    iAmLead: true,
    // Ha fichado la llegada y no la salida: es el unico estado en el que la
    // pantalla ofrece «He terminado».
    iHaveArrived: true,
    iHaveLeft: false,
    clockIns: [],
    adjustments: [],
    doorPin: null,
    checklist: [],
    ...cambios,
  };
}

let contenedor: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

async function montar(jobs: MyJob[], destacado: string | null = null): Promise<void> {
  fetchMyJobs.mockResolvedValue({ jobs });

  const { MyJobs } = await import('./MyJobs');
  await act(async () => {
    root.render(
      <MyJobs
        locale="en"
        staffFirstName="Cleo"
        destacado={destacado}
        onDestacadoVisto={vi.fn()}
        onSessionLost={vi.fn()}
      />,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
}

/** El boton cuyo texto contiene ese trozo. Falla si no hay exactamente uno. */
function boton(texto: string): HTMLButtonElement {
  const encontrados = [...contenedor.querySelectorAll('button')].filter((b) =>
    b.textContent?.includes(texto),
  );

  if (encontrados.length !== 1) {
    throw new Error(`se esperaba un solo boton con "${texto}", hay ${encontrados.length}`);
  }
  return encontrados[0] as HTMLButtonElement;
}

function hayTexto(trozo: string): boolean {
  return (contenedor.textContent ?? '').includes(trozo);
}

describe('H4: «he terminado» pregunta antes de cerrar el trabajo', () => {
  it('UN TOQUE NO FICHA LA SALIDA: abre la pregunta', async () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. El movil en el bolsillo, las manos
     * mojadas, el dedo que resbala: un toque cerraba el trabajo a mitad y
     * `COMPLETED` no se puede deshacer desde ningun sitio del producto.
     */
    await montar([trabajo()]);

    await act(async () => {
      boton('I have finished').click();
    });

    expect(markMyJobProgress).not.toHaveBeenCalled();
    expect(hayTexto('Finish this job?')).toBe(true);
  });

  it('LA PREGUNTA DICE LAS TAREAS QUE QUEDAN, que es lo que hace que alguien se pare', async () => {
    /*
     * «¿Seguro?» a secas se contesta «si» sin leerlo. El dato inesperado
     * —«te quedan 2»— es lo unico que distingue el toque bueno del
     * accidental.
     */
    await montar([trabajo({ checklist: [tarea('POLVO'), tarea('SUELO')] })]);

    await act(async () => {
      boton('I have finished').click();
    });

    expect(hayTexto('have not looked at 2 tasks')).toBe(true);
  });

  it('sin tareas por mirar NO dice «te quedan 0»', async () => {
    await montar([trabajo({ checklist: [tarea('POLVO', 'DONE')] })]);

    await act(async () => {
      boton('I have finished').click();
    });

    expect(hayTexto('Finish this job?')).toBe(true);
    expect(hayTexto('have not looked at')).toBe(false);
  });

  it('UNA PENDIENTE DECLARADA NO CUENTA: ya se decidio, con su motivo', async () => {
    /*
     * ES LA DISTINCION QUE PIDIO LA DUENA, puesta donde mas se nota. Quien
     * marco una tarea «pendiente» ya la miro, decidio que no se podia hacer y
     * lo explico. Nombrarsela al terminar seria pedirle que haga algo que ya
     * ha dicho que no puede hacer.
     *
     * Y «no aplica» tampoco cuenta: era justo el problema que habia que
     * arreglar. Una casa vacia de mudanza salia con veinte tareas «sin hacer»
     * cuando en veinte de ellas no habia nada que hacer.
     */
    await montar([
      trabajo({
        checklist: [tarea('POLVO', 'PENDING'), tarea('SUELO', 'NOT_APPLICABLE')],
      }),
    ]);

    await act(async () => {
      boton('I have finished').click();
    });

    expect(hayTexto('Finish this job?')).toBe(true);
    expect(hayTexto('have not looked at')).toBe(false);
  });

  it('confirmar SI ficha la salida', async () => {
    await montar([trabajo()]);
    markMyJobProgress.mockResolvedValue(trabajo({ status: 'COMPLETED', iHaveLeft: true }));

    await act(async () => {
      boton('I have finished').click();
    });
    await act(async () => {
      boton('Yes, I have finished').click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(markMyJobProgress).toHaveBeenCalledTimes(1);
    expect(markMyJobProgress.mock.calls[0]?.[0]).toBe(BOOKING);
    expect(markMyJobProgress.mock.calls[0]?.[1]).toMatchObject({ status: 'COMPLETED' });
  });

  it('decir «todavia no» cierra la pregunta y NO ficha nada', async () => {
    await montar([trabajo()]);

    await act(async () => {
      boton('I have finished').click();
    });
    await act(async () => {
      boton('Not yet').click();
    });

    expect(markMyJobProgress).not.toHaveBeenCalled();
    expect(hayTexto('Finish this job?')).toBe(false);
    // Y el boton sigue ahi: no se ha perdido la forma de terminar.
    expect(() => boton('I have finished')).not.toThrow();
  });
});

describe('H5: el aviso de la campana llega a un trabajo de verdad', () => {
  it('el trabajo senalado queda destacado, y no se avisa de nada', async () => {
    await montar([trabajo()], BOOKING);

    const tarjeta = contenedor.querySelector('section.ring-2');
    expect(tarjeta).not.toBeNull();
    expect(hayTexto('no longer on your list')).toBe(false);
  });

  it('SI EL TRABAJO YA NO ESTA EN LA LISTA SE DICE, en vez de no hacer nada', async () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. La lista empieza hoy, asi que un
     * aviso sin leer de la semana pasada senala un trabajo que ya no se
     * sirve. Sin esta linea, pulsarlo dejaba la pantalla igual que antes
     * —el mismo sintoma exacto que el boton muerto que esto arreglaba— y no
     * habia forma de saber si el fallo era de la aplicacion o del aviso.
     */
    await montar([trabajo()], OTRO);

    expect(hayTexto('no longer on your list')).toBe(true);
    expect(contenedor.querySelector('section.ring-2')).toBeNull();
  });

  it('sin aviso detras no se destaca ninguna tarjeta', async () => {
    await montar([trabajo()]);

    expect(contenedor.querySelector('section.ring-2')).toBeNull();
    expect(hayTexto('no longer on your list')).toBe(false);
  });
});
