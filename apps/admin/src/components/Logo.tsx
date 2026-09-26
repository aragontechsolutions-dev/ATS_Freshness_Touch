import logoMark from '../assets/logo-mark.webp';

/**
 * ISOTIPO DE FRESHNESS TOUCH
 * --------------------------
 * El girasol, el hogar y la onda sobre el circulo azul. Antes aqui habia un
 * cuadrado amarillo con las letras «FT»: un marcador de posicion que se puso
 * cuando el panel no tenia marca, y que ya no hacia falta.
 *
 * ES EL MISMO ARCHIVO QUE USA EL SITIO PUBLICO, copiado, no enlazado. Son dos
 * despliegues independientes con su propia compilacion, asi que no hay forma
 * de compartir un binario sin montar un paquete aparte para un archivo. Si
 * algun dia la marca crece (variantes, lockups, versiones para correo), ese
 * paquete compartido si merecera la pena; con una imagen, no.
 *
 * SE SIRVE DESDE EL PROPIO DOMINIO. La politica de seguridad del panel
 * declara `img-src 'self' data:`, asi que una imagen de un tercero ni
 * siquiera cargaria; ademas, una peticion a un dominio ajeno desde la
 * pantalla de acceso delataria quien esta entrando y cuando.
 *
 * SOBRE EL TAMANO: se usa la version de 256x256 (20 kB), no el original de
 * 1254x1254 (155 kB). Son el mismo dibujo —comprobado pixel a pixel: la
 * diferencia media es 2,84 sobre 255, el ruido normal de reescalar— y en el
 * panel se pinta a 36 y a 64 pixeles. Incluso en una pantalla de triple
 * densidad eso son 192 pixeles: el original pesaria ocho veces mas para que
 * no se notara nada. El panel se abre con datos moviles en la calle.
 */

interface LogoMarkProps {
  className?: string;
  /**
   * Texto alternativo.
   *
   * Vacio por defecto —decorativo— porque en la mayoria de los sitios el
   * nombre de la empresa ya esta escrito al lado. Donde el isotipo es lo
   * UNICO que identifica a la empresa, como la cabecera del panel o la
   * pantalla de acceso, hay que pasarle el nombre: si no, quien usa lector
   * de pantalla no tiene forma de saber en que aplicacion esta.
   */
  alt?: string;
}

export function LogoMark({ className = 'h-9 w-9', alt = '' }: LogoMarkProps) {
  return (
    <img
      src={logoMark}
      alt={alt}
      className={className}
      /*
       * `width` y `height` reales, aunque las clases manden el tamano final:
       * es lo que permite al navegador reservar el hueco antes de descargar
       * la imagen. Sin ellos, la cabecera da un salto al cargar.
       */
      width={256}
      height={256}
      // Esta en la primera pantalla y siempre visible: no se carga en diferido.
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}
