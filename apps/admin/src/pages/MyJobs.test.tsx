import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChecklistItemState,
  JobChecklistEntry,
  MyJob,
  MyJobs as MyJobsRespuesta,
} from '@freshness/types';
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
 *   1. QUE EL BOTON SE PONGA ACTIVO EN EL ACTO, sin esperar al servidor. Un
 *      boton que tarda dos segundos en responder se pulsa otra vez.
 *   2. QUE UNA RESPUESTA QUE LLEGA TARDE NO DESHAGA LO YA DECIDIDO. Con dos
 *      peticiones en vuelo y la red haciendo de las suyas, la respuesta de la
 *      primera puede llegar despues de la segunda, y trae una foto del
 *      trabajo ANTERIOR a la segunda decision.
 *   3. QUE UN FALLO DEVUELVA LA TAREA A SU SITIO Y LO DIGA. Un boton que se
 *      apaga solo sin explicacion se lee como que la pantalla va mal.
 *   4. LOS TRES ESTADOS QUE PIDIO LA DUENA: que pulsar el activo deje la
 *      tarea sin decidir, que «pendiente» abra el motivo y que ese motivo no
 *      se arrastre al cambiar de estado.
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
 * DOS TAREAS DE MENTIRA, Y NO DOS DEL CATALOGO DE VERDAD.
 *
 * El catalogo real tiene cincuenta y nueve tareas con codigos largos. Usar
 * dos suyas ataria estas pruebas a que esos codigos sigan existiendo, y se
 * caerian el dia que la duena reordene su lista por un motivo que no tiene
 * nada que ver con lo que comprueban.
 *
 * Se inyecta su texto para poder buscar los botones POR EL NOMBRE DE SU
 * TAREA, que es como los busca una persona, en vez de por su posicion.
 */
i18next.addResourceBundle(
  'en',
  'translation',
  { checklist: { items: { POLVO: 'Dust all surfaces', SUELO: 'Mop the floors' } } },
  true,
  true,
);

const BOOKING = '10000000-0000-4000-8000-000000000001';

function tarea(
  code: string,
  state: ChecklistItemState | null = null,
  note: string | null = null,
): JobChecklistEntry {
  return {
    code,
    room: 'COMMON_AREAS',
    state,
    note,
    markedAt: state === null ? null : '2026-10-04T10:00:00.000Z',
    markedByFirstName: state === null ? null : 'Cleo',
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
    doorPin: null,
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

/**
 * El boton de un estado, dentro del grupo de SU tarea.
 *
 * Se busca por el nombre de la tarea —que es el `aria-label` del grupo— y
 * despues por el texto del boton. Buscar solo por el texto cogeria el «Done»
 * de la primera tarea de la lista estando en la segunda, y la prueba pasaria
 * comprobando otra cosa.
 */
function boton(tarea: string, estado: 'Done' | 'Pending' | 'N/A'): HTMLButtonElement {
  const grupo = [...contenedor.querySelectorAll('[role=group]')].find(
    (g) => g.getAttribute('aria-label') === tarea,
  );
  const encontrado = [...(grupo?.querySelectorAll('button') ?? [])].find(
    (b) => b.textContent?.trim() === estado,
  );

  if (!(encontrado instanceof HTMLButtonElement)) {
    throw new Error(`no hay boton "${estado}" en "${tarea}"`);
  }
  return encontrado;
}

/** Si ese estado es el que esta puesto ahora mismo. */
function activo(tarea: string, estado: 'Done' | 'Pending' | 'N/A'): boolean {
  return boton(tarea, estado).getAttribute('aria-pressed') === 'true';
}

/**
 * Pulsa COMO LO HARIA UN DEDO, con `click()`.
 *
 * No se llama al manejador a mano ni se tocan propiedades del DOM: React
 * lleva su propio rastreador del valor de los campos y SUPRIME eventos
 * cuando el valor que encuentra ya coincide con el que esperaba. Es lo que
 * hizo que la primera version de este archivo pasara sin probar nada.
 */
function pulsar(elemento: HTMLElement): void {
  act(() => {
    elemento.click();
  });
}

describe('decir en que queda una tarea', () => {
  it('EL BOTON SE PONE ACTIVO EN EL ACTO, sin esperar al servidor', async () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Con el boton esperando a la respuesta,
     * en una casa con mala cobertura pasan dos segundos entre el toque y el
     * movimiento. Esa espera no se interpreta como «esta guardando»: se
     * interpreta como «no me ha cogido el toque», y se vuelve a pulsar.
     */
    await montar([tarea('POLVO'), tarea('SUELO')]);

    // La promesa NO se resuelve: el servidor no ha contestado todavia.
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    pulsar(boton('Dust all surfaces', 'Done'));

    expect(activo('Dust all surfaces', 'Done')).toBe(true);
  });

  it('y el contador baja en el acto tambien', async () => {
    await montar([tarea('POLVO'), tarea('SUELO')]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    expect(contenedor.textContent).toContain('2 to decide');
    pulsar(boton('Dust all surfaces', 'Done'));
    expect(contenedor.textContent).toContain('1 to decide');
  });

  it('manda al servidor el estado, no un booleano', async () => {
    await montar([tarea('POLVO')]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    pulsar(boton('Dust all surfaces', 'N/A'));

    expect(markChecklistItem).toHaveBeenCalledWith(BOOKING, {
      itemCode: 'POLVO',
      state: 'NOT_APPLICABLE',
      note: null,
    });
  });

  it('PULSAR EL ESTADO QUE YA ESTA PUESTO LA DEJA SIN DECIDIR', async () => {
    /*
     * Es la unica forma de deshacer un toque equivocado, y hace falta: la
     * primera vez que alguien marque sin querer «horno limpiado» y no pueda
     * corregirlo, aprendera que la lista miente y dejara de usarla.
     */
    await montar([tarea('POLVO', 'DONE')]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    pulsar(boton('Dust all surfaces', 'Done'));

    expect(activo('Dust all surfaces', 'Done')).toBe(false);
    expect(markChecklistItem).toHaveBeenCalledWith(BOOKING, {
      itemCode: 'POLVO',
      state: null,
      note: null,
    });
  });

  it('cambiar de estado no deja los dos activos', async () => {
    // Un fallo de este tipo no da error: deja la pantalla afirmando dos cosas
    // contradictorias sobre la misma tarea.
    await montar([tarea('POLVO', 'DONE')]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    pulsar(boton('Dust all surfaces', 'N/A'));

    expect(activo('Dust all surfaces', 'N/A')).toBe(true);
    expect(activo('Dust all surfaces', 'Done')).toBe(false);
  });

  it('UNA RESPUESTA QUE LLEGA TARDE NO DESHACE LO YA DECIDIDO', async () => {
    /*
     * LA PRUEBA QUE MAS IMPORTA DE ESTE ARCHIVO, y el fallo que tenia la
     * primera version.
     *
     * Se deciden dos tareas seguidas, que es como se usa esto. Cada respuesta
     * trae el trabajo ENTERO tal como estaba el servidor al atenderla. Si la
     * respuesta de la primera llega la ultima —cosa que la red hace—, trae
     * una foto SIN la segunda, y repintar con ella deshace en pantalla algo
     * que en la base de datos esta guardado.
     *
     * Nadie lo ve probando: hace falta que dos respuestas se crucen.
     */
    await montar([tarea('POLVO'), tarea('SUELO')]);

    let resolverPrimera: ((j: MyJob) => void) | undefined;
    markChecklistItem
      // La primera se queda colgada a proposito.
      .mockImplementationOnce(
        () =>
          new Promise<MyJob>((resolve) => {
            resolverPrimera = resolve;
          }),
      )
      // La segunda contesta enseguida, con las dos hechas.
      .mockResolvedValueOnce(trabajo([tarea('POLVO', 'DONE'), tarea('SUELO', 'DONE')]));

    pulsar(boton('Dust all surfaces', 'Done'));
    pulsar(boton('Mop the floors', 'Done'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(activo('Mop the floors', 'Done')).toBe(true);

    // Y AHORA llega, tarde, la respuesta de la primera: una foto del trabajo
    // en la que la segunda tarea todavia estaba sin decidir.
    await act(async () => {
      resolverPrimera?.(trabajo([tarea('POLVO', 'DONE'), tarea('SUELO')]));
      await Promise.resolve();
    });

    expect(activo('Dust all surfaces', 'Done')).toBe(true);
    expect(activo('Mop the floors', 'Done'), 'la respuesta tardia la deshizo').toBe(true);
  });
});

describe('el motivo de una tarea pendiente', () => {
  /** El campo de motivo que haya en pantalla, o `null`. */
  function campo(): HTMLTextAreaElement | null {
    return contenedor.querySelector('textarea');
  }

  /**
   * ESCRIBE EN EL CAMPO COMO LO HARIA UN TECLADO.
   *
   * Es la misma trampa que `pulsar` documenta arriba, y aqui muerde de verdad:
   * `area.value = 'x'` NO llega al componente. React guarda su propio
   * rastreador del valor de cada campo y suprime el evento de cambio cuando el
   * valor que encuentra ya coincide con el que esperaba — y asignando a mano
   * siempre coincide. La prueba pasaria sin que el manejador se ejecutara
   * nunca, que es exactamente lo que le paso a la primera version de este
   * archivo con las casillas.
   *
   * La salida es llamar al asignador NATIVO del prototipo, que es el que el
   * rastreador de React no ha interceptado.
   */
  function escribir(area: HTMLTextAreaElement, texto: string): void {
    const nativo = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativo === undefined) throw new Error('sin asignador nativo de textarea');

    act(() => {
      nativo.call(area, texto);
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  /** El boton de guardar el motivo, o `null` si no se ofrece. */
  function guardar(): HTMLButtonElement | null {
    const botones = [...contenedor.querySelectorAll('button')];
    return (
      botones.find(
        (b) =>
          b.textContent?.includes('Save reason') === true ||
          b.textContent?.includes('Remove the reason') === true,
      ) ?? null
    );
  }

  it('SOLO SE PIDE EN UNA PENDIENTE', async () => {
    /*
     * El contrato y la base de datos rechazan un motivo en cualquier otro
     * estado, asi que ofrecer el campo seria ofrecer algo que acaba en un
     * error que nadie sabria explicar.
     */
    await montar([tarea('POLVO', 'DONE')]);
    expect(campo()).toBeNull();

    await montar([tarea('POLVO', 'NOT_APPLICABLE')]);
    expect(campo()).toBeNull();

    await montar([tarea('POLVO', 'PENDING')]);
    expect(campo()).not.toBeNull();
  });

  it('EL ESTADO SE GUARDA AL TOCAR EL BOTON, ANTES DE ESCRIBIR NADA', async () => {
    /*
     * Es lo que impide que un movil sin bateria a mitad de la frase se lleve
     * por delante tambien el estado. Y es por lo que una pendiente SIN motivo
     * —que es un caso normal y legitimo— queda guardada igual.
     */
    await montar([tarea('POLVO')]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    pulsar(boton('Dust all surfaces', 'Pending'));

    expect(markChecklistItem).toHaveBeenCalledWith(BOOKING, {
      itemCode: 'POLVO',
      state: 'PENDING',
      note: null,
    });
  });

  it('no se ofrece guardar mientras no haya nada que guardar', async () => {
    // Un boton que no hace nada al pulsarlo se pulsa dos veces y se
    // desconfia de la pantalla.
    await montar([tarea('POLVO', 'PENDING', 'No habia productos')]);

    expect(guardar()).toBeNull();
  });

  it('guarda el motivo escrito, con el estado pendiente', async () => {
    await montar([tarea('POLVO', 'PENDING')]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    const area = campo();
    if (area === null) throw new Error('no hay campo de motivo');
    escribir(area, 'La habitacion estaba cerrada');

    const botonGuardar = guardar();
    if (botonGuardar === null) throw new Error('no se ofrece guardar');
    pulsar(botonGuardar);

    expect(markChecklistItem).toHaveBeenCalledWith(BOOKING, {
      itemCode: 'POLVO',
      state: 'PENDING',
      note: 'La habitacion estaba cerrada',
    });
  });

  it('EL CAMPO VACIO QUITA EL MOTIVO, y manda null y no cadena vacia', async () => {
    /*
     * El contrato rechaza una cadena vacia a proposito: una fila que dice
     * «hay un motivo» sin motivo es peor que no tener fila.
     */
    await montar([tarea('POLVO', 'PENDING', 'No habia productos')]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    const area = campo();
    if (area === null) throw new Error('no hay campo de motivo');
    escribir(area, '   ');

    const botonQuitar = guardar();
    if (botonQuitar === null) throw new Error('no se ofrece quitar');
    pulsar(botonQuitar);

    expect(markChecklistItem).toHaveBeenCalledWith(BOOKING, {
      itemCode: 'POLVO',
      state: 'PENDING',
      note: null,
    });
  });

  it('EL MOTIVO NO SE ARRASTRA AL PASAR A «HECHA»', async () => {
    /*
     * Un motivo de «no se pudo» colgado de una tarea hecha seria una
     * contradiccion guardada, y el contrato y la base de datos lo rechazan:
     * sin esto, cambiar de pendiente a hecha devolveria un 400 y el boton
     * volveria solo a su sitio sin que nadie entendiera por que.
     */
    await montar([tarea('POLVO', 'PENDING', 'No habia productos')]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    pulsar(boton('Dust all surfaces', 'Done'));

    expect(markChecklistItem).toHaveBeenCalledWith(BOOKING, {
      itemCode: 'POLVO',
      state: 'DONE',
      note: null,
    });
  });

  it('pero SI se conserva al volver a pendiente desde sin decidir', async () => {
    // Quien se equivoca de boton y vuelve no tiene que escribirlo otra vez.
    await montar([tarea('POLVO', null, 'No habia productos')]);
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    pulsar(boton('Dust all surfaces', 'Pending'));

    expect(markChecklistItem).toHaveBeenCalledWith(BOOKING, {
      itemCode: 'POLVO',
      state: 'PENDING',
      note: 'No habia productos',
    });
  });
});

describe('cuando la API falla', () => {
  it('la tarea vuelve a su sitio', async () => {
    await montar([tarea('POLVO'), tarea('SUELO')]);
    markChecklistItem.mockRejectedValue(new Error('sin red'));

    pulsar(boton('Dust all surfaces', 'Done'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(activo('Dust all surfaces', 'Done')).toBe(false);
  });

  it('y lo dice, porque un boton que se apaga solo parece una pantalla rota', async () => {
    await montar([tarea('POLVO')]);
    markChecklistItem.mockRejectedValue(new Error('sin red'));

    pulsar(boton('Dust all surfaces', 'Done'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(errorToast).toHaveBeenCalled();
  });

  it('dejar sin decidir tambien se deshace: la tarea vuelve a quedar hecha', async () => {
    await montar([tarea('POLVO', 'DONE')]);
    markChecklistItem.mockRejectedValue(new Error('sin red'));

    pulsar(boton('Dust all surfaces', 'Done'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(activo('Dust all surfaces', 'Done')).toBe(true);
  });

  it('y EL MOTIVO vuelve tambien: no se queda guardado lo que no se guardo', async () => {
    await montar([tarea('POLVO', 'PENDING', 'No habia productos')]);
    markChecklistItem.mockRejectedValue(new Error('sin red'));

    pulsar(boton('Dust all surfaces', 'Done'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(activo('Dust all surfaces', 'Pending')).toBe(true);
    expect(contenedor.textContent).toContain('No habia productos');
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
