/*
 * Se ejecuta ANTES del primer pintado, y por eso esta en un archivo aparte y
 * no dentro de un componente: decide dos cosas que deben estar resueltas
 * antes de que el usuario vea nada.
 *
 * 1. TEMA. Aplica el guardado para evitar el parpadeo blanco al cargar en
 *    modo oscuro.
 *
 * 2. MOVIMIENTO. Marca el documento como "animable" solo si el sistema no
 *    pide reducir el movimiento. Las animaciones de entrada parten de
 *    opacidad cero, asi que ese estado inicial SOLO puede aplicarse cuando
 *    hay movimiento permitido: si no, el contenido se quedaria invisible
 *    para quien pidio reducirlo o para quien tenga JavaScript desactivado.
 *
 * Esta en un archivo externo, y no en linea, para que la politica de
 * seguridad pueda prohibir por completo los scripts en linea.
 */
(function () {
  var raiz = document.documentElement;

  try {
    var guardado = localStorage.getItem('ft-theme');
    var prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (guardado === 'dark' || (guardado !== 'light' && prefiereOscuro)) {
      raiz.classList.add('dark');
    }
  } catch (error) {
    /* localStorage puede estar bloqueado: se ignora y queda el tema claro */
  }

  try {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      raiz.classList.add('ft-motion');
    }
  } catch (error) {
    /* Sin matchMedia no se anima: es la opcion segura */
  }
})();
