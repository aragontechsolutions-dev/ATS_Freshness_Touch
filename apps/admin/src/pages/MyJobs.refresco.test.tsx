import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyJob, MyJobAdjustment, MyJobs as MyJobsRespuesta } from '@freshness/types';
import '../i18n';

/**
 * LA PWA SE ENTERA SOLA (ETAPA 3.8)
 * =================================
 * Lo que se comprueba aqui no se ve leyendo el componente, y mucho menos
 * abriendo el navegador en un portatil con fibra:
 *
 *   1. QUE EL SONDEO NO PISE UNA ACCION EN CURSO. Es la prueba que mas
 *      importa del archivo. Un reloj que dispara SOLO mientras hay un toque
 *      en vuelo puede desmarcar en pantalla algo que ya esta guardado, y eso
 *      en una casa se lee como que la aplicacion pierde el trabajo hecho.
 *   2. QUE CON LA PANTALLA OCULTA NO SE PIDA NADA. Son la bateria y los datos
 *      del movil de quien trabaja, durante toda la jornada.
 *   3. QUE AL VOLVER A LA APLICACION NO HAYA QUE ESPERAR AL RELOJ. El caso
 *      real es sacar el movil del bolsillo, no tenerlo abierto media hora.
 *   4. QUE SE AVISE DE LO QUE CAMBIA Y SOLO DE ESO. Un aviso por cada
 *      correccion vieja al abrir la aplicacion es ruido; un rechazo que pasa
 *      en silencio enseña al equipo a no volver a reportar nada.
 */

const fetchMyJobs = vi.fn<() => Promise<MyJobsRespuesta>>();
const markChecklistItem = vi.fn<(id: string, body: unknown) => Promise<MyJob>>();
const exito = vi.fn();
const aviso = vi.fn();
const fallo = vi.fn();

/** Si el fallo que toca ahora es de sesion caducada. */
let laSesionCaduco = false;

vi.mock('../lib/api', () => ({
  fetchMyJobs: () => fetchMyJobs(),
  markChecklistItem: (id: string, body: unknown) => markChecklistItem(id, body),
  markMyJobProgress: vi.fn(),
  proposeFieldAdjustment: vi.fn(),
  isSessionError: () => laSesionCaduco,
  sessionLostReason: () => 'expired',
  ApiClientError: class ApiClientError extends Error {
    messageKey = 'admin.errorGeneric';
  },
}));

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ success: exito, error: fallo, info: aviso }),
}));

const BOOKING = '10000000-0000-4000-8000-000000000001';
const AJUSTE = '20000000-0000-4000-8000-000000000001';

function ajuste(cambios: Partial<MyJobAdjustment> = {}): MyJobAdjustment {
  return {
    id: AJUSTE,
    state: 'PROPOSED',
    booked: { squareFeet: 900, bedrooms: 3, bathrooms: 2, addOns: [] },
    found: { squareFeet: 1300, bedrooms: 3, bathrooms: 2, addOns: [] },
    note: 'La casa es mucho mas grande',
    proposedByFirstName: 'Cleo',
    proposedAt: '2026-10-05T10:00:00.000Z',
    resolvedAt: null,
    resolutionNote: null,
    ...cambios,
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
    squareFeet: 900,
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
    checklist: [],
    ...cambios,
  };
}

let contenedor: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  laSesionCaduco = false;
  vi.useFakeTimers();
  mirando('visible');
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
  vi.useRealTimers();
});

/** Pone la pestaña a la vista o escondida, como hace el movil al bloquearse. */
function mirando(estado: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true });
}

/** Monta la pantalla y espera a la carga inicial. */
async function montar(primero: MyJob, onSessionLost = vi.fn()): Promise<() => void> {
  fetchMyJobs.mockResolvedValue({ jobs: [primero] });

  const { MyJobs } = await import('./MyJobs');
  await act(async () => {
    root.render(<MyJobs locale="en" staffFirstName="Cleo" onSessionLost={onSessionLost} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return onSessionLost;
}

/** Monta la pantalla con la carga inicial rota, como en un sotano. */
async function montarSinCobertura(): Promise<void> {
  fetchMyJobs.mockRejectedValue(new Error('sin red'));

  const { MyJobs } = await import('./MyJobs');
  await act(async () => {
    root.render(<MyJobs locale="en" staffFirstName="Cleo" onSessionLost={vi.fn()} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

/** Deja pasar los segundos que diga el reloj, y las promesas que eso lance. */
async function pasan(segundos: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(segundos * 1000);
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Vuelve a la aplicacion, como al desbloquear el movil. */
async function volverALaApp(): Promise<void> {
  mirando('visible');
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** El boton cuyo texto contiene eso. */
function boton(texto: string): HTMLButtonElement {
  const encontrado = [...contenedor.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(texto),
  );
  if (!encontrado) throw new Error(`no hay boton con "${texto}"`);
  return encontrado;
}

describe('el refresco automatico', () => {
  it('EL SONDEO NO PISA UNA ACCION EN CURSO', async () => {
    /*
     * ====================================================================
     * LA PRUEBA QUE MAS IMPORTA DE ESTE ARCHIVO
     * ====================================================================
     * Es la version de fondo del fallo que ya costo un arreglo en la Etapa
     * 3.5.h, y es peor que aquel: alli hacian falta dos toques seguidos,
     * aqui basta UNO, porque el reloj dispara solo.
     *
     * Se marca una tarea, el servidor todavia no ha contestado, y el reloj
     * salta. Si el sondeo se llevara a cabo, traeria una foto SIN la marca
     * —el servidor aun no la tiene— y la casilla se volveria atras sin que
     * nadie hubiera tocado nada.
     */
    await montar(
      trabajo({
        checklist: [
          {
            code: 'POLVO',
            room: 'COMMON_AREAS',
            done: false,
            doneAt: null,
            doneByFirstName: null,
            retired: false,
          },
        ],
      }),
    );
    expect(fetchMyJobs).toHaveBeenCalledTimes(1);

    // El servidor no contesta: la peticion se queda en vuelo.
    markChecklistItem.mockReturnValue(new Promise(() => {}));

    const casilla = contenedor.querySelector('input[type=checkbox]');
    if (!(casilla instanceof HTMLInputElement)) throw new Error('no hay casilla');
    act(() => casilla.click());

    await pasan(60);

    // Ni una peticion mas: con algo en vuelo, el sondeo se calla.
    expect(fetchMyJobs).toHaveBeenCalledTimes(1);
  });

  it('con la pantalla oculta no se pide nada', async () => {
    await montar(trabajo());
    expect(fetchMyJobs).toHaveBeenCalledTimes(1);

    mirando('hidden');
    await pasan(120);

    expect(fetchMyJobs).toHaveBeenCalledTimes(1);
  });

  it('con la pantalla delante se pide cada 30 segundos', async () => {
    await montar(trabajo());

    await pasan(30);
    expect(fetchMyJobs).toHaveBeenCalledTimes(2);

    await pasan(30);
    expect(fetchMyJobs).toHaveBeenCalledTimes(3);
  });

  it('AL VOLVER A LA APLICACION no hay que esperar al reloj', async () => {
    /*
     * El caso real no es tener la aplicacion abierta media hora: es sacar el
     * movil del bolsillo. Sin esto se verian hasta treinta segundos de datos
     * viejos justo cuando se mira para decidir algo.
     */
    await montar(trabajo());
    expect(fetchMyJobs).toHaveBeenCalledTimes(1);

    await volverALaApp();

    expect(fetchMyJobs).toHaveBeenCalledTimes(2);
  });

  it('trae lo que coordinacion decidio mientras tanto', async () => {
    await montar(trabajo({ adjustments: [ajuste()] }));
    expect(contenedor.textContent).toContain('Sent to dispatch');

    fetchMyJobs.mockResolvedValue({
      jobs: [
        trabajo({
          squareFeet: 1300,
          adjustments: [ajuste({ state: 'APPLIED', resolvedAt: '2026-10-05T11:00:00.000Z' })],
        }),
      ],
    });

    await pasan(30);

    expect(contenedor.textContent).not.toContain('Sent to dispatch');
  });
});

describe('el aviso de que coordinacion decidio', () => {
  it('avisa cuando se aprueba', async () => {
    await montar(trabajo({ adjustments: [ajuste()] }));
    expect(exito).not.toHaveBeenCalled();

    fetchMyJobs.mockResolvedValue({
      jobs: [trabajo({ adjustments: [ajuste({ state: 'APPLIED' })] })],
    });
    await pasan(30);

    expect(exito).toHaveBeenCalledWith('admin.toast.adjustmentApproved');
  });

  it('EL RECHAZO LLEGA CON SU MOTIVO', async () => {
    /*
     * Es lo mas importante de este aviso. Que se apruebe se nota solo —el
     * trabajo pasa a decir otra cosa—; que se rechace no se nota en nada, y
     * un rechazo mudo enseña al equipo a no volver a reportar.
     */
    await montar(trabajo({ adjustments: [ajuste()] }));

    fetchMyJobs.mockResolvedValue({
      jobs: [
        trabajo({
          adjustments: [
            ajuste({ state: 'REJECTED', resolutionNote: 'Ya lo habiamos hablado con el cliente' }),
          ],
        }),
      ],
    });
    await pasan(30);

    expect(aviso).toHaveBeenCalledWith('admin.toast.adjustmentRejectedToTeam', {
      detail: 'Ya lo habiamos hablado con el cliente',
    });
  });

  it('LA PRIMERA CARGA NO AVISA de lo que se resolvio hace semanas', async () => {
    await montar(trabajo({ adjustments: [ajuste({ state: 'APPLIED' })] }));

    expect(exito).not.toHaveBeenCalled();
    expect(aviso).not.toHaveBeenCalled();
  });

  it('y no avisa dos veces de lo mismo', async () => {
    await montar(trabajo({ adjustments: [ajuste()] }));

    fetchMyJobs.mockResolvedValue({
      jobs: [trabajo({ adjustments: [ajuste({ state: 'APPLIED' })] })],
    });
    await pasan(30);
    await pasan(30);
    await pasan(30);

    expect(exito).toHaveBeenCalledTimes(1);
  });

  it('una propuesta SUSTITUIDA no avisa: la sustituyo quien la escribio', async () => {
    await montar(trabajo({ adjustments: [ajuste()] }));

    fetchMyJobs.mockResolvedValue({
      jobs: [trabajo({ adjustments: [ajuste({ state: 'SUPERSEDED' })] })],
    });
    await pasan(30);

    expect(exito).not.toHaveBeenCalled();
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe('cuando el precio ya se resolvio', () => {
  it('EL BOTON GRANDE DESAPARECE', async () => {
    /*
     * Dejarlo a tamaño completo despues de que administracion haya puesto el
     * precio hace parecer que el asunto sigue sin resolver, y no lo esta.
     */
    await montar(trabajo({ squareFeet: 1300, adjustments: [ajuste({ state: 'APPLIED' })] }));

    expect(contenedor.textContent).not.toContain('This is not what was booked');
    expect(contenedor.textContent).toContain('Found something else? Report it');
  });

  it('pero queda una salida: el equipo puede reportar otra cosa', async () => {
    /*
     * Medir los pies cuadrados y descubrir DESPUES que hay tres neveras es
     * un caso normal. Sin salida, al equipo solo le quedaria el telefono.
     */
    await montar(trabajo({ squareFeet: 1300, adjustments: [ajuste({ state: 'APPLIED' })] }));

    act(() => boton('Found something else? Report it').click());

    expect(contenedor.textContent).toContain('What did you find?');
  });

  it('con una propuesta SIN resolver sigue el boton grande', async () => {
    await montar(trabajo({ adjustments: [ajuste()] }));

    expect(contenedor.textContent).toContain('Sent to dispatch');
    expect(contenedor.textContent).not.toContain('Found something else? Report it');
  });

  it('EL FORMULARIO ARRANCA CON LO QUE AHORA DICE LA RESERVA', async () => {
    /*
     * ====================================================================
     * EL FALLO QUE CREO EL PROPIO REFRESCO AUTOMATICO
     * ====================================================================
     * Los campos guardan lo contratado en estado local al montarse. Hasta la
     * Etapa 3.8 eso no se movia; ahora si: al aprobarse la correccion la
     * reserva pasa a decir 1.300 pies donde decia 900, y el sondeo lo trae.
     *
     * Sin volver a sincronizar, el formulario se quedaria con el 900 de
     * cuando se monto, y abrirlo propondria «de 1.300 a 900» —deshacer la
     * correccion que se acaba de aprobar— sin que nadie lo pidiera.
     */
    await montar(trabajo({ squareFeet: 900, adjustments: [ajuste()] }));

    fetchMyJobs.mockResolvedValue({
      jobs: [trabajo({ squareFeet: 1300, adjustments: [ajuste({ state: 'APPLIED' })] })],
    });
    await pasan(30);

    act(() => boton('Found something else? Report it').click());

    const campo = contenedor.querySelector('input[inputmode=numeric]');
    if (!(campo instanceof HTMLInputElement)) throw new Error('no hay campo de pies cuadrados');
    expect(campo.value).toBe('1300');
  });
});

describe('lo que el sondeo no puede hacer', () => {
  it('UN FALLO DE RED NO VACIA LA PANTALLA NI SACA UN AVISO', async () => {
    /*
     * Esto ocurre SOLO, sin que nadie lo pida. Un rojo cada treinta segundos
     * en una zona con mala cobertura tapa la pantalla justo mientras se
     * trabaja, y perder la lista de trabajos por un sondeo de fondo que no
     * entro en un sotano seria absurdo: lo pintado sigue siendo valido.
     */
    await montar(trabajo());
    expect(contenedor.textContent).toContain('100 Peachtree St');

    fetchMyJobs.mockRejectedValue(new Error('sin red'));
    await pasan(30);

    expect(contenedor.textContent).toContain('100 Peachtree St');
    expect(fallo).not.toHaveBeenCalled();
  });

  it('y LA PANTALLA SE CURA SOLA cuando vuelve la cobertura', async () => {
    /*
     * Si la carga inicial fallo, hasta ahora habia que cerrar y abrir la
     * aplicacion. Ahora el propio sondeo la recupera.
     */
    await montarSinCobertura();
    expect(contenedor.textContent).not.toContain('100 Peachtree St');

    fetchMyJobs.mockResolvedValue({ jobs: [trabajo()] });
    await pasan(30);

    expect(contenedor.textContent).toContain('100 Peachtree St');
  });

  it('CON LA SESION CADUCADA EL RELOJ SE CALLA PARA SIEMPRE', async () => {
    /*
     * Sin esto, un token muerto se seguiria mandando cada treinta segundos:
     * ruido en los registros, cuota del limitador gastada, y un aviso de
     * sesion perdida por cada vuelta del reloj.
     */
    const onSessionLost = await montar(trabajo());

    laSesionCaduco = true;
    fetchMyJobs.mockRejectedValue(new Error('401'));
    await pasan(30);

    expect(onSessionLost).toHaveBeenCalledTimes(1);
    const peticiones = fetchMyJobs.mock.calls.length;

    await pasan(120);

    expect(fetchMyJobs).toHaveBeenCalledTimes(peticiones);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });
});
