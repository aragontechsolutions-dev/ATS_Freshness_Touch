/*
 * Aplica el tema guardado ANTES del primer pintado para evitar el parpadeo
 * blanco al cargar en modo oscuro.
 *
 * Esta en un archivo aparte, y no en linea dentro de index.html, para que la
 * politica de seguridad de contenido (CSP) pueda prohibir por completo los
 * scripts en linea: "script-src 'self'" sin excepciones.
 */
(function () {
  try {
    var stored = localStorage.getItem('ft-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (stored !== 'light' && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (error) {
    /* localStorage puede estar bloqueado: se ignora y queda el tema claro */
  }
})();
