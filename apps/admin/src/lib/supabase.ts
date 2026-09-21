/*
 * Se usa `@supabase/auth-js` y NO el cliente completo `@supabase/supabase-js`.
 *
 * El panel solo necesita iniciar sesión y mantener el token al día. El cliente
 * completo arrastra además consultas a tablas, almacenamiento de archivos,
 * funciones y tiempo real: código que aquí no se llama nunca pero que el
 * navegador descarga cada mañana en la oficina. Medido, la diferencia es de
 * cientos de kilobytes.
 */
import { AuthClient } from '@supabase/auth-js';
import type { AuthChangeEvent } from '@supabase/auth-js';

/**
 * CLIENTE DE SUPABASE AUTH
 * ------------------------
 * El panel solo usa Supabase para UNA cosa: iniciar sesión y mantener el
 * token al día. Nunca lee ni escribe datos con él; para eso está nuestra API,
 * que aplica los permisos por rol. Las tablas, además, tienen la seguridad de
 * filas cerrada, así que este cliente no podría leer nada aunque lo intentara.
 *
 * La clave "anon" es pública por diseño y viaja en el paquete del navegador.
 * No abre nada por sí sola.
 */

const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * LA SESIÓN SE GUARDA EN sessionStorage, NO EN localStorage.
 *
 * Es el valor por defecto de la librería y lo cambiamos a propósito:
 *
 *   - `localStorage` sobrevive a cerrar el navegador. En un ordenador
 *     compartido de oficina, la siguiente persona que abra el panel entra con
 *     la sesión de quien lo usó antes.
 *   - `sessionStorage` muere al cerrar la pestaña. Se paga con tener que
 *     volver a entrar tras cerrarla, que en una jornada normal ocurre una vez.
 *
 * Lo que NO arregla esto: un ataque de guion inyectado (XSS) puede leer
 * cualquiera de los dos. Contra eso protege la política de contenido estricta
 * del panel y que React escapa todo lo que pinta. Lo honesto es decir que
 * esto reduce la ventana de exposición, no que la elimine.
 */
function createSafeStorage(): Storage | undefined {
  try {
    // En una ventana privada o con el almacenamiento bloqueado, el simple
    // acceso puede lanzar. Sin esta comprobación, el panel no cargaría.
    const prueba = '__ft__';
    window.sessionStorage.setItem(prueba, '1');
    window.sessionStorage.removeItem(prueba);
    return window.sessionStorage;
  } catch {
    // Sin almacenamiento, la sesión vive solo en memoria: funciona igual
    // hasta que se recargue la página.
    return undefined;
  }
}

export const supabaseIsConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Cliente único. Es null si falta configuración, para que el panel muestre un
 * aviso claro en vez de romperse con una pantalla en blanco.
 */
export const auth: InstanceType<typeof AuthClient> | null = supabaseIsConfigured
  ? new AuthClient({
      url: `${(SUPABASE_URL as string).replace(/\/+$/, '')}/auth/v1`,
      headers: { apikey: SUPABASE_ANON_KEY as string },
      storage: createSafeStorage(),
      persistSession: true,
      // Renueva el token antes de que caduque: sin esto, una sesión larga se
      // cortaría a media tarea y se perdería lo que se estuviera haciendo.
      autoRefreshToken: true,
      // No hay inicio de sesión por enlace ni por proveedor externo, así que
      // no hay nada que leer de la dirección. Desactivarlo evita que un enlace
      // manipulado con parámetros de sesión tenga ningún efecto.
      detectSessionInUrl: false,
      flowType: 'pkce',
    })
  : null;

/** Tipo del evento que emite la libreria al cambiar la sesion. */
export type { AuthChangeEvent };
