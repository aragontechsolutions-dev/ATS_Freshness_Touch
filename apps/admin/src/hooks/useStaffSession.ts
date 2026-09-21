import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthenticatedStaff } from '@freshness/types';
import { ApiClientError, fetchSession } from '../lib/api';
import { auth, type AuthChangeEvent } from '../lib/supabase';

/** Por qué se cerró la sesión, para poder explicarlo al volver al acceso. */
export type SignOutReason = 'manual' | 'idle' | 'expired' | 'noAccess';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out'; reason: SignOutReason | null }
  | { status: 'signed-in'; staff: AuthenticatedStaff };

/**
 * SESIÓN DEL PANEL
 * ----------------
 * Hay DOS sesiones y no son la misma:
 *
 *   1. La de Supabase, que dice quién eres.
 *   2. La del servidor, que dice si eres personal activo y con qué rol.
 *
 * La segunda se consulta SIEMPRE al entrar, y no se deduce de la primera.
 * Si alguien queda dado de baja con la pestaña abierta, la API responderá 403
 * en la siguiente llamada y el panel lo devolverá al acceso: la baja no
 * espera a que caduque el token.
 */
export function useStaffSession(): {
  state: SessionState;
  signOut: (reason?: SignOutReason) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  // Evita que una comprobación lenta pise a otra más reciente, por ejemplo si
  // se cierra sesión mientras la primera consulta sigue en vuelo.
  const generacion = useRef(0);

  const signOut = useCallback(async (reason: SignOutReason = 'manual'): Promise<void> => {
    generacion.current += 1;
    await auth?.signOut().catch(() => undefined);
    setState({ status: 'signed-out', reason });
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (!auth) {
      setState({ status: 'signed-out', reason: null });
      return;
    }

    const actual = (generacion.current += 1);
    const { data } = await auth.getSession();

    if (!data.session) {
      if (generacion.current === actual) setState({ status: 'signed-out', reason: null });
      return;
    }

    try {
      const staff = await fetchSession();
      if (generacion.current === actual) setState({ status: 'signed-in', staff });
    } catch (error) {
      if (generacion.current !== actual) return;

      /*
       * Se distinguen los dos casos porque significan cosas muy distintas
       * para quien está delante:
       *   403 — has entrado bien, pero esta cuenta no es personal del panel.
       *   401 — tu sesión ya no vale; vuelve a entrar.
       */
      const sinAcceso = error instanceof ApiClientError && error.statusCode === 403;
      await auth.signOut().catch(() => undefined);
      setState({ status: 'signed-out', reason: sinAcceso ? 'noAccess' : 'expired' });
    }
  }, []);

  useEffect(() => {
    void refresh();

    // La librería avisa al renovar el token o al cerrar sesión en otra
    // pestaña. Sin esto, el panel seguiría mostrando datos con una sesión
    // que ya no existe.
    const { data } = auth?.onAuthStateChange((evento: AuthChangeEvent) => {
      if (evento === 'SIGNED_OUT') {
        setState({ status: 'signed-out', reason: null });
        return;
      }
      if (evento === 'SIGNED_IN') void refresh();
    }) ?? { subscription: null };

    return () => data?.subscription?.unsubscribe();
  }, [refresh]);

  return { state, signOut, refresh };
}
