import { useEffect, useState } from 'react';
import type { CatalogResponse } from '@freshness/types';
import { fetchCatalog } from '../lib/api';

/**
 * Catalogo de precios del servidor, compartido por toda la pagina.
 *
 * Se guarda la promesa a nivel de modulo para que varias secciones
 * (servicios, zonas, cotizador) lo usen con una sola peticion.
 */
let catalogPromise: Promise<CatalogResponse> | null = null;

function loadCatalog(): Promise<CatalogResponse> {
  if (!catalogPromise) {
    catalogPromise = fetchCatalog().catch((error: unknown) => {
      // Si falla, se descarta la promesa para poder reintentar mas tarde.
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

export interface CatalogState {
  catalog: CatalogResponse | null;
  loading: boolean;
  failed: boolean;
}

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({
    catalog: null,
    loading: true,
    failed: false,
  });

  useEffect(() => {
    let active = true;

    loadCatalog()
      .then((catalog) => {
        if (active) setState({ catalog, loading: false, failed: false });
      })
      .catch(() => {
        if (active) setState({ catalog: null, loading: false, failed: true });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
