import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobChecklistEntry, MyJob, MyJobs as MyJobsRespuesta } from '@freshness/types';
import i18next from '../i18n';
import '../i18n';

/**
 * LA LISTA DE VERIFICACION EN LA PANTALLA DE LIMPIEZA
 * ==================================================
 * Esta pantalla se usa de pie, en la puerta de una casa, con una mano y con
 * la cobertura que haya. Lo que se comprueba aqui es justo lo que no se ve
 * leyendo el componente y lo que NO aparece abriendo el navegador en un
 * portatil con fibra:
 *
 *   1. QUE LA CASILLA SE MUEVA EN EL ACTO, sin esperar al servidor. Una
 *      casilla que tarda dos segundos en moverse se pulsa otra vez.
 *   2. QUE UNA RESPUESTA QUE LLEGA TARDE NO DESMARQUE LO YA MARCADO. Con dos
 *      peticiones en vuelo y la red haciendo de las suyas, la respuesta de la
 *      primera puede llegar despues de la segunda, y trae una foto del
 *      trabajo ANTERIOR a la segunda marca.
 *   3. QUE UN FALLO DEVUELVA LA CASILLA A SU SITIO Y LO DIGA. Una casilla que
 *      vuelve sola sin explicacion se lee como que la pantalla va mal.
 */

const fetchMyJobs = vi.fn<() => Promise<MyJobsRespuesta>>();
const markChecklistItem = vi.fn<(id: string, body: unknown) => Promise<MyJob>>();
const errorToast = vi.fn();

vi.mock('../lib/api', () => ({
  fetchMyJobs: () => fetchMyJobs(),
  markChecklistItem: (id: string, body: unknown) => markChecklistItem(id, body),
  markMyJobProgress: vi.fn(),
  isSessionError: () => false,
  sessionLostReason: () => undefined,
  ApiClientError: class ApiClientError extends Error {
    messageKey = 'admin.errorGeneric';
  },
}));

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: errorToast }),
}));

/*
 * Los textos de las tareas estan pendientes de las plantillas del cliente, asi
 * que el paquete de idioma no los tiene. Se inyectan tres aqui para poder
 * buscar las casillas POR SU ETIQUETA, que es como las busca una persona, en
 * vez de por su posicion en el DOM.
 */
i18next.addResourceBundle(
  'en',
  'translation',
  { checklist: { items: { POLVO: 'Dust all surfaces', SUELO: 'Mop the floors' } } },
  true,
  true,
);

const BOOKING = '10000000-0000-4000-8000-000000000001';

function tarea(code: string, done: boolean): JobChecklistEntry {
  return {
    code,
    room: 'COMMON_AREAS',
    done,
    doneAt: done ? '2026-10-04T10:00:00.000Z' : null,
    doneByFirstName: done ? 'Cleo' : null,
    retired: false,
  };
}

function trabajo(checklist: JobChecklistEntry[], cambios: Partial<MyJob> = {}): MyJob {
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
    iHaveArrived: true,
    iHaveLeft: false,
    clockIns: [],
    adjustments: [],
    checklist,
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

/** Monta la pantalla con la lista indicada y espera a la carga. */
async function montar(checklist: JobChecklistEntry[], cambios: Partial<MyJob> = {}): Promise<void> {
  fetchMyJobs.mockResolvedValue({ jobs: [trabajo(checklist, cambios)] });

  const { MyJobs } = await import('./MyJobs');
  await act(async () => {
    root.render(<MyJobs locale="en" staffFirstName="Cleo" onSessionLost={vi.fn()} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

/** La casilla cuya etiqueta contiene ese texto. */
function casilla(texto: string): HTMLInputElement {
  const etiquetas = [...contenedor.querySelectorAll('label')];
  const encontrada = etiquetas.find((l) => l.textContent?.includes(texto));
  const entrada = encontrada?.querySelector('input[type=checkbox]');

  if (!(entrada instanceof HTMLInputElement)) {
    throw new Error(`no hay casilla para "${texto}"`);
  }
  return entrada;
}

/**
 * Pulsa una casilla COMO LO HARIA UN DEDO.
 *
 * `entrada.click()` y no asignar `entrada.checked` a mano: React lleva su
 * propio rastreador del valor de cada campo y SUPRIME el evento de cambio
 * cuando el valor que encuentra ya coincide con el que esperaba. Asignando a
 * mano, el manejador del componente no llega a ejecutarse NUNCA y la prueba
 * pasa sin haber probado nada —que es justo lo que le paso a la primera
 * version de este archivo—.
 */
function pulsar(entrada: HTMLInputElement): void {
  act(() => {
    entrada.click();
  });
}

describe('marcar una tarea', () => {
  it('LA CASILLA SE MUEVE EN EL ACTO, sin esperar al servidor', async () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Con la casilla esperando a la
     * respuesta, en una casa con mala cobertura pasan dos segundos entre el
     * toque y el movimiento. Esa espera no se interpreta como «esta
     * guardando»: se interpreta como «no me ha cogido el toque», y se vuelve
     * a pulsar.
     */
    await montar([tarea('POLVO', false), tarea('SUELO', false)]);

    // La promesa NO se resuelve: el servidor no ha contestado todavia.
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    pulsar(casilla('Dust all surfaces'));

    expect(casilla('Dust all surfaces').checked).toBe(true);
  });

  it('y el contador baja en el acto tambien', async () => {
    await montar([tarea('POLVO', false), tarea('SUELO', false)]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    expect(contenedor.textContent).toContain('2 tasks left');
    pulsar(casilla('Dust all surfaces'));
    expect(contenedor.textContent).toContain('1 task left');
  });

  it('UNA RESPUESTA QUE LLEGA TARDE NO DESMARCA LO YA MARCADO', async () => {
    /*
     * LA PRUEBA QUE MAS IMPORTA DE ESTE ARCHIVO, y el fallo que tenia la
     * primera version.
     *
     * Se marcan dos tareas seguidas, que es como se usa esto. Cada respuesta
     * trae el trabajo ENTERO tal como estaba el servidor al atenderla. Si la
     * respuesta de la primera llega la ultima —cosa que la red hace—, trae
     * una foto SIN la segunda marca, y repintar con ella desmarca en pantalla
     * algo que en la base de datos esta marcado.
     *
     * Nadie lo ve probando: hace falta que dos respuestas se crucen.
     */
    await montar([tarea('POLVO', false), tarea('SUELO', false)]);

    let resolverPrimera: ((j: MyJob) => void) | undefined;
    markChecklistItem
      // La primera se queda colgada a proposito.
      .mockImplementationOnce(
        () =>
          new Promise<MyJob>((resolve) => {
            resolverPrimera = resolve;
          }),
      )
      // La segunda contesta enseguida, con las dos marcadas.
      .mockResolvedValueOnce(trabajo([tarea('POLVO', true), tarea('SUELO', true)]));

    pulsar(casilla('Dust all surfaces'));
    pulsar(casilla('Mop the floors'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(casilla('Mop the floors').checked).toBe(true);

    // Y AHORA llega, tarde, la respuesta de la primera: una foto del trabajo
    // en la que la segunda tarea todavia no estaba marcada.
    await act(async () => {
      resolverPrimera?.(trabajo([tarea('POLVO', true), tarea('SUELO', false)]));
      await Promise.resolve();
    });

    expect(casilla('Dust all surfaces').checked).toBe(true);
    expect(casilla('Mop the floors').checked, 'la respuesta tardia la desmarco').toBe(true);
  });
});

describe('cuando la API falla', () => {
  it('la casilla vuelve a su sitio', async () => {
    await montar([tarea('POLVO', false), tarea('SUELO', false)]);
    markChecklistItem.mockRejectedValue(new Error('sin red'));

    pulsar(casilla('Dust all surfaces'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(casilla('Dust all surfaces').checked).toBe(false);
  });

  it('y lo dice, porque una casilla que vuelve sola parece una pantalla rota', async () => {
    await montar([tarea('POLVO', false)]);
    markChecklistItem.mockRejectedValue(new Error('sin red'));

    pulsar(casilla('Dust all surfaces'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(errorToast).toHaveBeenCalled();
  });

  it('desmarcar tambien se deshace: la tarea vuelve a quedar marcada', async () => {
    await montar([tarea('POLVO', true)]);
    markChecklistItem.mockRejectedValue(new Error('sin red'));

    pulsar(casilla('Dust all surfaces'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(casilla('Dust all surfaces').checked).toBe(true);
  });
});

/**
 * EL BOTON SE DECIDE POR PERSONA, NO POR EL ESTADO DEL TRABAJO
 * ===========================================================
 * ESTE BLOQUE EXISTE POR UN FALLO QUE LLEGO A PRODUCCION, y que se vio en una
 * captura de pantalla: el aviso decia «Marca primero He llegado» justo debajo
 * de un boton que ponia «He terminado».
 *
 * La causa: `Acciones` miraba solo `job.status`. Un trabajo pasa a EN CURSO
 * cuando ficha LA PRIMERA persona del equipo —o cuando coordinacion mueve el
 * estado desde el panel—, asi que a la siguiente se le ofrecia terminar un
 * trabajo al que no habia podido fichar que llegaba. Y sin fichaje de llegada
 * propio tampoco podia avisar de que la casa no era la contratada.
 */

/** El texto del boton principal de la tarjeta, si hay alguno. */
function botonPrincipal(): string | null {
  const botones = [...contenedor.querySelectorAll('button')];
  const principal = botones.find((b) => b.className.includes('ft-btn-primary'));
  return principal?.textContent?.trim() ?? null;
}

describe('que boton se ofrece', () => {
  it('EL CASO DE LA CAPTURA: trabajo EN CURSO y yo sin fichar → «He llegado»', async () => {
    /*
     * Antes salia «He terminado» y no habia forma de fichar la llegada: un
     * callejon sin salida en la puerta de una casa.
     */
    await montar([], { status: 'IN_PROGRESS', iHaveArrived: false, iHaveLeft: false });

    expect(botonPrincipal()).toContain('I have arrived');
  });

  it('trabajo CONFIRMADO y yo sin fichar → «He llegado»', async () => {
    await montar([], { status: 'CONFIRMED', iHaveArrived: false, iHaveLeft: false });

    expect(botonPrincipal()).toContain('I have arrived');
  });

  it('ya fiche mi llegada → «He terminado»', async () => {
    await montar([], { status: 'IN_PROGRESS', iHaveArrived: true, iHaveLeft: false });

    expect(botonPrincipal()).toContain('I have finished');
  });

  it('el trabajo lo cerro otra pero yo no me he ido → «He terminado»', async () => {
    // Su salida tambien cuenta: las horas son de cada cual.
    await montar([], { status: 'COMPLETED', iHaveArrived: true, iHaveLeft: false });

    expect(botonPrincipal()).toContain('I have finished');
  });

  it('ya fiche mi salida → ningun boton, solo «Terminado»', async () => {
    await montar([], { status: 'COMPLETED', iHaveArrived: true, iHaveLeft: true });

    expect(botonPrincipal()).toBeNull();
    expect(contenedor.textContent).toContain('Finished');
  });

  it('en una CANCELADA no se ficha nada', async () => {
    // A esa casa no va nadie.
    await montar([], { status: 'CANCELLED', iHaveArrived: false, iHaveLeft: false });

    expect(botonPrincipal()).toBeNull();
  });
});

describe('el aviso de corregir y el boton no se contradicen', () => {
  it('SI DICE «marca primero He llegado», EL BOTON DICE «He llegado»', async () => {
    /*
     * LA PRUEBA QUE HABRIA CAZADO EL FALLO. No comprueba un boton ni un texto
     * por separado: comprueba que los dos CUENTAN LA MISMA HISTORIA, que es
     * lo que estaba roto.
     */
    await montar([], {
      status: 'IN_PROGRESS',
      iAmLead: true,
      iHaveArrived: false,
      iHaveLeft: false,
    });

    const texto = contenedor.textContent ?? '';
    if (texto.includes('Tap "I have arrived" first')) {
      expect(botonPrincipal(), 'el aviso manda a un boton que no esta').toContain('I have arrived');
    }
  });
});
