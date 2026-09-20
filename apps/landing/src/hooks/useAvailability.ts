import { useEffect, useRef, useState } from 'react';
import type { AvailabilityResponse } from '@freshness/types';
import { ApiClientError, fetchAvailability, type AvailabilityQuery } from '../lib/api';

export interface AvailabilityState {
  data: AvailabilityResponse | null;
  loading: boolean;
  /** Clave i18n del error, o null. */
  errorKey: string | null;
}

/**
 * Consulta las franjas libres de un dia.
 *
 * Cancela la peticion anterior al cambiar de fecha: alguien que pulse varias
 * veces la flecha del calendario genera varias consultas, y sin cancelarlas
 * la respuesta de un dia antiguo podria llegar la ultima y pintar las franjas
 * equivocadas.
 */
export function useAvailability(query: AvailabilityQuery | null): AvailabilityState {
  const [state, setState] = useState<AvailabilityState>({
    data: null,
    loading: false,
    errorKey: null,
  });

  const controllerRef = useRef<AbortController | null>(null);

  /*
   * La consulta es un objeto nuevo en cada render, asi que no sirve como
   * dependencia: provocaria una peticion por render. Lo que decide si hay que
   * volver a preguntar es su CONTENIDO, y el objeto en si se lee de una
   * referencia, que es estable.
   */
  const queryRef = useRef(query);
  queryRef.current = query;
  const key = query ? JSON.stringify(query) : null;

  useEffect(() => {
    const current = queryRef.current;
    if (!key || !current) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((current) => ({ ...current, loading: true, errorKey: null }));

    fetchAvailability(current, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ data, loading: false, errorKey: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          loading: false,
          errorKey: error instanceof ApiClientError ? error.messageKey : 'booking.errorTitle',
        });
      });

    return () => controller.abort();
  }, [key]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return state;
}
