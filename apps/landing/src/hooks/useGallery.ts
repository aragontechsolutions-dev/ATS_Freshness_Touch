import { useEffect, useState } from 'react';
import { DEFAULT_GALLERY, type Gallery } from '@freshness/types';
import { fetchGallery } from '../lib/api';

/**
 * LA GALERIA DE ANTES Y DESPUES
 * -----------------------------
 * Se pide una sola vez al abrir la pagina y se comparte, igual que el
 * catalogo: la promesa vive a nivel de modulo.
 *
 * SI FALLA, SE DEVUELVE LA GALERIA VACIA, no un error. La seccion entonces no
 * se pinta y el visitante no ve ningun hueco ni ningun aviso roto. Es
 * decorativa: perderla es perder una seccion, y tumbar la portada por ella
 * seria perder las ventas del dia.
 *
 * NO HAY ESTADO DE «CARGANDO» A PROPOSITO. Mientras llega, la galeria esta
 * vacia y la seccion no existe; cuando llega, aparece. Un esqueleto gris que
 * a veces no se rellena nunca es peor que una seccion que aparece.
 */
let galleryPromise: Promise<Gallery> | null = null;

function loadGallery(): Promise<Gallery> {
  if (!galleryPromise) {
    galleryPromise = fetchGallery().catch(() => {
      // Se descarta la promesa para poder reintentar en otra visita.
      galleryPromise = null;
      return DEFAULT_GALLERY;
    });
  }
  return galleryPromise;
}

export function useGallery(): Gallery {
  const [gallery, setGallery] = useState<Gallery>(DEFAULT_GALLERY);

  useEffect(() => {
    let active = true;

    loadGallery().then((value) => {
      if (active) setGallery(value);
    });

    return () => {
      active = false;
    };
  }, []);

  return gallery;
}
