import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedStaff } from '@freshness/types';

/**
 * EL TOKEN SE RENUEVA SOLO, Y EL PANEL TIENE QUE ENTERARSE
 * =======================================================
 * El cliente de Supabase va con `autoRefreshToken: true` y renueva el token
 * por su cuenta cada ~55 min. Este enganche NO ATENDIA ese evento, y era un
 * fallo latente de los peores: no se notaba mientras nadie mirase
 * `sessionExpiresAt`, porque todo lo demas seguia funcionando.
 *
 * En el momento en que esa fecha se usa para avisar «tu sesion se acaba en N
 * minutos», el fallo sale a la superficie al reves de como se espera: el
 * aviso aparece a la hora de haber entrado —con el token ya renovado y una
 * hora entera por delante— y no hay forma de quitarlo. Un aviso que miente
 * es peor que no tener aviso.
 *
 * Aqui se comprueba lo unico que arregla eso: que `TOKEN_REFRESHED` vuelva a
 * preguntar a la API, y que la fecha nueva llegue al estado.
 */

const fetchSession = vi.fn<() => Promise<AuthenticatedStaff>>();
const refreshSession = vi.fn<() => Promise<unknown>>();
const getSession = vi.fn<() => Promise<{ data: { session: unknown } }>>();

/** El escuchador que registra el enganche, para poder dispararlo a mano. */
let escuchador: ((evento: string) => void) | null = null;

vi.mock('../lib/api', () => ({
  fetchSession: () => fetchSession(),
}));

vi.mock('../lib/supabase', () => ({
  auth: {
    getSession: () => getSession(),
    signOut: () => Promise.resolve(),
    refreshSession: () => refreshSession(),
    onAuthStateChange: (cb: (evento: string) => void) => {
      escuchador = cb;
      return { data: { subscription: { unsubscribe: () => undefined } } };
    },
  },
}));

function personal(expiresAt: string): AuthenticatedStaff {
  return {
    staffId: '20000000-0000-4000-8000-000000000001',
    firstName: 'Cleo',
    lastName: 'Diaz',
    email: 'cleo@example.com',
    role: 'CLEANER',
    sessionExpiresAt: expiresAt,
  };
}

const PRIMERA = '2026-10-31T13:00:00.000Z';
const RENOVADA = '2026-10-31T14:00:00.000Z';

let contenedor: HTMLDivElement;
let root: Root;
/** Lo ultimo que devolvio el enganche, para poder leerlo desde la prueba. */
let visto: { expiresAt: string | null; renovar: (() => Promise<void>) | null };

beforeEach(() => {
  vi.clearAllMocks();
  escuchador = null;
  visto = { expiresAt: null, renovar: null };
  getSession.mockResolvedValue({ data: { session: { access_token: 'x' } } });
  refreshSession.mockResolvedValue({});
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

async function montar(): Promise<void> {
  const { useStaffSession } = await import('./useStaffSession');

  function Sonda() {
    const { state, renovar } = useStaffSession();
    visto.expiresAt = state.status === 'signed-in' ? state.staff.sessionExpiresAt : null;
    visto.renovar = renovar;
    return null;
  }

  await act(async () => {
    root.render(<Sonda />);
  });
  // Dos vueltas: `getSession()` y `fetchSession()` son dos promesas en cadena.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useStaffSession', () => {
  it('entra y guarda la fecha de caducidad que dio el servidor', async () => {
    fetchSession.mockResolvedValue(personal(PRIMERA));
    await montar();

    expect(visto.expiresAt).toBe(PRIMERA);
  });

  it('AL RENOVARSE EL TOKEN VUELVE A PREGUNTAR, y la fecha nueva llega al estado', async () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Sin atender el evento, esta fecha se
     * quedaba congelada en la de la primera comprobacion durante toda la
     * jornada, y cualquier cosa construida sobre ella —el aviso de sesion—
     * diria algo falso a partir de la primera hora.
     */
    fetchSession.mockResolvedValue(personal(PRIMERA));
    await montar();
    expect(fetchSession).toHaveBeenCalledTimes(1);

    fetchSession.mockResolvedValue(personal(RENOVADA));
    await act(async () => {
      escuchador?.('TOKEN_REFRESHED');
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchSession).toHaveBeenCalledTimes(2);
    expect(visto.expiresAt).toBe(RENOVADA);
  });

  it('«seguir conectada» PIDE UN TOKEN NUEVO, no solo relee el que hay', async () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Con solo `refresh()`, el boton
     * llamaria a `getSession()` —que devuelve el token que ya hay— y volveria
     * a preguntar a la API con la misma caducidad: el aviso seguiria en
     * pantalla contando hacia atras. Un boton que no hace lo que dice.
     */
    fetchSession.mockResolvedValue(personal(PRIMERA));
    await montar();

    fetchSession.mockResolvedValue(personal(RENOVADA));
    await act(async () => {
      await visto.renovar?.();
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(visto.expiresAt).toBe(RENOVADA);
  });

  it('SI LA RENOVACION FALLA NO SE CIERRA LA SESION', async () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Lo normal es que falle por no haber
     * cobertura, y echar fuera a quien esta en una casa por no haber podido
     * renovar seria hacer exactamente el dano que el aviso venia a evitar.
     */
    fetchSession.mockResolvedValue(personal(PRIMERA));
    await montar();

    refreshSession.mockRejectedValue(new Error('sin red'));
    await act(async () => {
      await visto.renovar?.();
    });

    expect(visto.expiresAt).toBe(PRIMERA);
  });
});
