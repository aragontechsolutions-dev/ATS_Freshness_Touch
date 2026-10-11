import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_CHECK_IDS, type SystemCheck, type SystemHealth } from '@freshness/types';
import '../i18n';

/**
 * LA PANTALLA DE ESTADO DEL SISTEMA
 * ---------------------------------
 * Un panel de estado tiene un modo de fallo propio y muy malo: DAR VERDE
 * CUANDO NO SABE. Si eso pasa, el panel deja de ser informacion y pasa a ser
 * una mentira tranquilizadora, que es peor que no tener panel.
 *
 * Lo que se comprueba, por orden de importancia:
 *
 *   1. QUE NO INVENTE VERDES. Si el servidor no manda una comprobacion, la
 *      fila aparece y dice «no se sabe». No desaparece ni se pinta bien.
 *   2. QUE EL ESTADO SE LEA SIN DEPENDER DEL COLOR. Un punto rojo no le dice
 *      nada a quien no distingue el rojo del verde, y eso es alrededor de
 *      uno de cada doce hombres.
 *   3. QUE EL DETALLE ESTE EN CASTELLANO LLANO, no en la clave del contrato.
 *      Quien lo lee es el titular del negocio en su telefono.
 *   4. QUE UN FALLO DE RED NO SE VEA IGUAL QUE UN SISTEMA SANO.
 */

const fetchSystemHealth = vi.fn<() => Promise<SystemHealth>>();

vi.mock('../lib/api', () => ({
  fetchSystemHealth: () => fetchSystemHealth(),
  isSessionError: () => false,
  sessionLostReason: () => 'expired' as const,
}));

const { SystemHealthPanel } = await import('./SystemHealthPanel');

let contenedor: HTMLDivElement;
let root: Root;

function informe(parciales: SystemCheck[], state: SystemHealth['state'] = 'ok'): SystemHealth {
  return { state, checks: parciales, checkedAt: '2026-10-11T15:30:00.000Z' };
}

const TODAS_BIEN: SystemCheck[] = SYSTEM_CHECK_IDS.map((id) => ({
  id,
  state: 'ok',
  detailKey: null,
  count: null,
}));

async function montar(): Promise<void> {
  await act(async () => {
    root.render(<SystemHealthPanel onSessionLost={vi.fn()} />);
  });
}

beforeEach(() => {
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  fetchSystemHealth.mockReset();
  fetchSystemHealth.mockResolvedValue(informe(TODAS_BIEN));
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

/* -------------------------------------------------------------------------- */

describe('la pantalla de estado del sistema', () => {
  it('ensena una fila por comprobacion', async () => {
    await montar();

    expect(contenedor.textContent).toContain('Database');
    expect(contenedor.textContent).toContain('Database schema');
    expect(contenedor.textContent).toContain('Pricing table');
    expect(contenedor.textContent).toContain('Card payments');
    expect(contenedor.textContent).toContain('Scheduled jobs');
  });

  it('NO INVENTA VERDES: lo que el servidor no manda sale como «no se sabe»', async () => {
    /*
     * El caso real que esto evita: el servidor anade una comprobacion nueva
     * y el panel todavia no se ha desplegado, o al reves. Si la pantalla
     * recorriera la lista de la RESPUESTA en vez de la del CONTRATO, la fila
     * que falta desapareceria sin mas y el panel diria que todo esta bien
     * sin haber mirado.
     */
    fetchSystemHealth.mockResolvedValue(informe(TODAS_BIEN.filter((c) => c.id !== 'migrations')));

    await montar();

    expect(contenedor.textContent).toContain('Database schema');
    expect(contenedor.textContent).toContain('Unknown');
  });

  it('traduce el detalle a algo que se entienda, no a la clave', async () => {
    fetchSystemHealth.mockResolvedValue(
      informe(
        TODAS_BIEN.map((c) =>
          c.id === 'migrations'
            ? { ...c, state: 'down', detailKey: 'migrations.pending', count: 2 }
            : c,
        ),
        'down',
      ),
    );

    await montar();

    // Lo que ve el titular del negocio.
    expect(contenedor.textContent).toContain('Bookings may fail');
    expect(contenedor.textContent).toContain('(2)');
    // Lo que NO debe ver.
    expect(contenedor.textContent).not.toContain('migrations.pending');
  });

  it('el estado se puede LEER, no solo ver por el color', async () => {
    /*
     * En torno a uno de cada doce hombres no distingue bien el rojo del
     * verde. Un panel que dice «esto va mal» solo con un punto de color no
     * se lo esta diciendo a esa persona.
     */
    fetchSystemHealth.mockResolvedValue(
      informe(
        TODAS_BIEN.map((c) =>
          c.id === 'paymentProvider'
            ? { ...c, state: 'degraded', detailKey: 'paymentProvider.simulated', count: null }
            : c,
        ),
        'degraded',
      ),
    );

    await montar();

    expect(contenedor.textContent).toContain('Partly working');
    expect(contenedor.textContent).toContain('NO deposit is held');
  });

  it('dice CUANDO se comprobo', async () => {
    /*
     * Sin la hora, una pantalla congelada por un fallo de red se ve
     * exactamente igual que un sistema sano. Es la confusion mas peligrosa
     * que puede tener un panel de estado.
     */
    await montar();

    expect(contenedor.textContent).toMatch(/Checked at/);
  });

  it('si no se puede leer el estado, lo dice en vez de callarse', async () => {
    fetchSystemHealth.mockRejectedValue(new Error('la red no va'));

    await montar();

    expect(contenedor.textContent).toContain('Could not read the system status');
  });

  it('y un fallo pasajero no borra lo que ya se sabia', async () => {
    // Primera carga buena, segunda rota: la pantalla conserva lo ultimo
    // conocido en vez de quedarse en blanco.
    await montar();
    expect(contenedor.textContent).toContain('Database');

    fetchSystemHealth.mockRejectedValue(new Error('la red se cayo'));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(contenedor.textContent).toContain('Database');
  });
});
