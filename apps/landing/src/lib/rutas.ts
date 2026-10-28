import { LEGAL_PATHS, REMOVAL_LINK_PATH } from '@freshness/types';

/**
 * QUE PANTALLA LE TOCA A CADA DIRECCION
 * =====================================
 * Una funcion pura y no un `if` dentro del componente, por un motivo que
 * costo una tarde: **las rutas nuevas no funcionaban en produccion**.
 *
 * `/terms` y `/privacy` existian en el codigo y respondian 404 en el sitio
 * real, porque `vercel.json` solo reescribia `/retirar-fotos` hacia
 * `index.html`. Vercel busca un archivo llamado `terms`, no lo encuentra y
 * contesta su propio 404: el JavaScript no llega a ejecutarse nunca.
 *
 * En local no se ve, porque el servidor de Vite sirve `index.html` para todo.
 * Esa es exactamente la clase de fallo que una prueba de interfaz tampoco
 * habria pillado: no estaba en la aplicacion, estaba delante de ella.
 *
 * Ahora `vercel.json` reescribe TODO hacia `index.html` y es esta funcion la
 * que decide, incluido el 404. Una lista, un sitio, y una prueba que la
 * recorre.
 */
export type Pantalla = 'sitio' | 'retirarFotos' | 'terms' | 'privacy' | 'noEncontrada';

/** Las direcciones que no son la portada. El resto es 404. */
const PANTALLAS: Record<string, Pantalla> = {
  [REMOVAL_LINK_PATH]: 'retirarFotos',
  [LEGAL_PATHS.terms]: 'terms',
  [LEGAL_PATHS.privacy]: 'privacy',
};

export function pantallaPara(pathname: string): Pantalla {
  /*
   * LA BARRA DEL FINAL NO CUENTA: `/terms` y `/terms/` son la misma pagina, y
   * un enlace pegado en un correo lleva la barra la mitad de las veces.
   */
  const ruta = pathname.replace(/\/+$/, '');

  if (ruta === '') return 'sitio';

  return PANTALLAS[ruta] ?? 'noEncontrada';
}
