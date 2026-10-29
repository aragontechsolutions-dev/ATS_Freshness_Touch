import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiErrorReport } from '@freshness/types';
import '../i18n';

/**
 * LA TARJETA DE «QUE HA FALLADO»
 * ------------------------------
 * Tiene el mismo modo de fallo malo que la pantalla de estado, en espejo:
 * DECIR QUE NO HAY ERRORES CUANDO LO QUE PASA ES QUE NO SE PUDO PREGUNTAR.
 * Una lista vacia tranquiliza; una lista vacia porque la peticion fallo es
 * una mentira tranquilizadora.
 *
 * Y tiene una segunda obligacion que no tiene ninguna otra pantalla: NO
 * ENSENAR DATOS DE NADIE. Lo que llega del servidor viene saneado, pero el
 * aviso de que esto no es el log se pinta siempre, porque quien lo lee tiene
 * que saber que aqui no va a encontrar el mensaje del error.
 */

const fetchApiErrors = vi.fn<() => Promise<ApiErrorReport>>();

vi.mock('../lib/api', () => ({
  fetchApiErrors: () => fetchApiErrors(),
  isSessionError: () => false,
  sessionLostReason: () => 'expired' as const,
}));

const { ErroresRecientes } = await import('./ErroresRecientes');

let contenedor: HTMLDivElement;
let root: Root;

const VACIO: ApiErrorReport = {
  windowMinutes: 60,
  inWindow: 0,
  historyMinutes: 1440,
  samples: [],
  checkedAt: '2026-10-29T15:30:00.000Z',
};

const CON_FALLOS: ApiErrorReport = {
  ...VACIO,
  inWindow: 3,
  samples: [
    {
      fingerprint: 'POST /api/v1/bookings PrismaClientKnownRequestError',
      status: 500,
      count: 3,
      lastAt: '2026-10-29T15:28:00.000Z',
    },
  ],
};

async function montar(): Promise<void> {
  await act(async () => {
    root.render(<ErroresRecientes onSessionLost={vi.fn()} />);
  });
}

beforeEach(() => {
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  fetchApiErrors.mockReset();
  fetchApiErrors.mockResolvedValue(VACIO);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

/* -------------------------------------------------------------------------- */

describe('la tarjeta de errores recientes', () => {
  it('sin errores lo dice, con el plazo que ha mirado', async () => {
    await montar();

    expect(contenedor.textContent).toContain('No server errors in the last 24 hours');
  });

  it('ensena la huella entera, que es lo que se busca despues en el codigo', async () => {
    fetchApiErrors.mockResolvedValue(CON_FALLOS);

    await montar();

    expect(contenedor.textContent).toContain('POST /api/v1/bookings PrismaClientKnownRequestError');
    expect(contenedor.textContent).toContain('3 times');
    expect(contenedor.textContent).toContain('500');
  });

  it('y cuantos hubo en la ventana de la alarma', async () => {
    fetchApiErrors.mockResolvedValue(CON_FALLOS);

    await montar();

    expect(contenedor.textContent).toContain('3 in the last 60 minutes');
  });

  it('el aviso de que esto no es el log se pinta siempre', async () => {
    /*
     * Tambien cuando no hay nada que ensenar. Quien abre esta pantalla
     * buscando «que le paso al cliente que llamo» tiene que leer aqui que
     * eso no esta —ni va a estar— en esta lista.
     */
    await montar();

    expect(contenedor.textContent).toContain('stay in the server log');
  });

  it('UN FALLO AL PREGUNTAR NO SE VE COMO «NO HAY ERRORES»', async () => {
    fetchApiErrors.mockRejectedValue(new Error('la red'));

    await montar();

    expect(contenedor.textContent).toContain('Could not read the recent errors');
    expect(contenedor.textContent).not.toContain('No server errors');
  });
});
