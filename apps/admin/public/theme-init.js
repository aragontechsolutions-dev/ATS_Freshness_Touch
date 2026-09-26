/*
 * Se ejecuta ANTES del primer pintado, y por eso esta en un archivo aparte y
 * no dentro de un componente: decide dos cosas que deben estar resueltas
 * antes de que nadie vea nada.
 *
 * 1. TEMA. Aplica el guardado para evitar el fogonazo blanco al cargar en
 *    modo oscuro. El panel se abre a las seis de la manana en una furgoneta;
 *    una pantalla en blanco a pantalla completa deslumbra de verdad.
 *
 * 2. MOVIMIENTO. Marca el documento como "animable" solo si el sistema no
 *    pide reducir el movimiento. Las animaciones del panel parten de un
 *    estado visible, asi que sin esta clase no se pierde nada: los
 *    esqueletos se quedan quietos en vez de latir, y ya esta.
 *
 * Esta en un archivo externo, y no en linea, porque la politica de seguridad
 * del panel (`vercel.json`) declara `script-src 'self'`: un script en linea
 * seria bloqueado por el navegador y el panel arrancaria siempre en claro.
 *
 * Es el mismo mecanismo que usa el sitio publico. Se copia en vez de
 * compartirse porque son dos despliegues distintos, cada uno con su carpeta
 * `public`, y no hay forma de enlazarlos sin montar un paso de compilacion
 * para veinte lineas.
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
