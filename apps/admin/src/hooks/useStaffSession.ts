import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthenticatedStaff } from '@freshness/types';
import { fetchSession } from '../lib/api';
import { sessionOutcome } from '../lib/session-outcome';
import { auth, type AuthChangeEvent } from '../lib/supabase';

/** Por qué se cerró la sesión, para poder explicarlo al volver al acceso. */
export type SignOutReason = 'manual' | 'idle' | 'expired' | 'noAccess';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out'; reason: SignOutReason | null }
  | { status: 'signed-in'; staff: AuthenticatedStaff }
  /**
   * Hay sesión, pero no se ha podido comprobar contra el servidor.
   *
   * NO es lo mismo que estar fuera, y por eso es un estado propio: la sesión
   * sigue viva y lo único que falta es poder preguntar. Se ofrece reintentar
   * en vez de mandar a nadie a teclear su contraseña otra vez.
   */
  | { status: 'unreachable' };

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
 *
 * DOS COSAS QUE ESTE ENGANCHE APRENDIÓ A LA MALA
 * ----------------------------------------------
 * Al entrar con credenciales correctas, el panel se quedaba en la pantalla de
 * acceso —sin ningún mensaje— y había que recargar con F5 para pasar. La
 * causa eran dos fallos que solo juntos producían ese síntoma:
 *
 *   1. UN ACCESO DISPARABA DOS COMPROBACIONES. El evento `SIGNED_IN` lanzaba
 *      una y el formulario otra al resolverse. Corrían a la vez, y la más
 *      reciente descartaba el resultado de la anterior.
 *
 *   2. NADA RECOGÍA UN FALLO DE `getSession()`. Si la más reciente moría ahí
 *      —el bloqueo que usa la librería, o el almacenamiento del navegador—
 *      la buena ya se había descartado, la promesa se perdía en silencio y
 *      no se ponía ningún estado. Pantalla muda.
 *
 * De ahí las dos reglas de abajo: las comprobaciones SE SERIALIZAN, y NINGÚN
 * camino puede terminar sin dejar un estado.
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

  /*
   * Las comprobaciones se serializan en vez de correr a la vez.
   *
   * Si llega una petición mientras hay otra en curso, no se lanza una
   * segunda: se anota que hay que repetir al terminar. Así un acceso produce
   * UNA llamada a la API en vez de dos compitiendo, y ninguna puede descartar
   * el resultado bueno de la otra.
   */
  const enCurso = useRef(false);
  const pendiente = useRef(false);

  const signOut = useCallback(async (reason: SignOutReason = 'manual'): Promise<void> => {
    generacion.current += 1;
    await auth?.signOut().catch(() => undefined);
    setState({ status: 'signed-out', reason });
  }, []);

  /**
   * Una comprobación completa. NUNCA termina sin dejar un estado.
   *
   * Devuelve si quedó RESUELTA, es decir, si el servidor llegó a contestar
   * —entrando o echando fuera—. Un "no se pudo preguntar" no lo está, y eso
   * es lo que decide si merece la pena repetir.
   */
  const unaPasada = useCallback(async (): Promise<boolean> => {
    if (!auth) {
      setState({ status: 'signed-out', reason: null });
      return true;
    }

    const actual = (generacion.current += 1);
    const vigente = (): boolean => generacion.current === actual;

    try {
      /*
       * `getSession()` va DENTRO del try. Antes estaba fuera, y ese detalle
       * es lo que dejaba la pantalla muda: si lanzaba, la promesa moría sin
       * que nadie pusiera un estado.
       */
      const { data } = await auth.getSession();
      if (!vigente()) return true;

      if (!data.session) {
        setState({ status: 'signed-out', reason: null });
        return true;
      }

      const staff = await fetchSession();
      if (!vigente()) return true;

      setState({ status: 'signed-in', staff });
      return true;
    } catch (error) {
      if (!vigente()) return true;

      const salida = sessionOutcome(error);

      /*
       * SOLO SE CIERRA LA SESIÓN CUANDO EL SERVIDOR DICE QUE NO VALE.
       *
       * Un corte de red o una API todavía arrancando dejaban antes a la
       * persona fuera, con un mensaje que además mentía ("tu sesión ha
       * terminado"). Ahora se queda dentro y se le ofrece reintentar.
       */
      if (salida === 'unreachable') {
        setState({ status: 'unreachable' });
        return false;
      }

      await auth.signOut().catch(() => undefined);
      /*
       * El estado se pone DESPUÉS de cerrar sesión, porque cerrar emite un
       * evento que también escribe estado. Si se pusiera antes, ese evento lo
       * pisaría y se perdería el motivo.
       */
      setState({ status: 'signed-out', reason: salida });
      return true;
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    if (enCurso.current) {
      pendiente.current = true;
      return;
    }

    enCurso.current = true;
    try {
      /*
       * Se repite SOLO si la pasada no llegó a resolverse.
       *
       * Un acceso dispara dos veces —el evento del proveedor y el propio
       * formulario—, y sin esta condición serían dos llamadas a la API para
       * una sola entrada. Con ella, la segunda petición se descarta cuando la
       * primera ya contestó, y se convierte en un REINTENTO justo cuando hace
       * falta: cuando la primera murió sin respuesta.
       */
      let resuelta = false;
      do {
        pendiente.current = false;
        resuelta = await unaPasada();
      } while (pendiente.current && !resuelta);
    } finally {
      enCurso.current = false;
    }
  }, [unaPasada]);

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
