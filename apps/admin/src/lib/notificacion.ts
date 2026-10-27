import type { Locale, StaffNotification } from '@freshness/types';
import { formatCents, formatTimestamp } from './format';

/**
 * EL TEXTO DE UNA NOTIFICACION
 * ----------------------------
 * En la base van `kind` y `params`; la frase se compone aqui, en el idioma
 * de quien mira. Guardar el texto ya escrito dejaria las de ayer en el
 * idioma de quien las provoco, y corregir una errata no arreglaria las que
 * ya estan.
 *
 * ========================================================================
 * LOS PARAMETROS SE PRESENTAN, NO SE PEGAN
 * ========================================================================
 * Lo que viaja en la fila son datos crudos —centavos enteros, fechas en
 * ISO— porque es lo unico que se puede guardar sin saber quien lo va a
 * leer. Pegarlos tal cual en la frase daria «quedan 3500 retenidos» y «el
 * 2026-10-27T14:00:00.000Z»: correcto y, para quien lo lee, inutil.
 */

/** Las claves de i18n de una clase. Anidadas igual que el `kind`. */
export function clavesDeNotificacion(kind: string): { titulo: string; cuerpo: string } {
  return {
    titulo: `admin.inbox.kind.${kind}.title`,
    cuerpo: `admin.inbox.kind.${kind}.body`,
  };
}

/**
 * Los parametros listos para la frase.
 *
 * Convierte lo que hay que convertir y deja lo demas como esta. Lo que no
 * reconoce pasa tal cual: una clase nueva anadida en la API, cuyo panel
 * todavia no se ha desplegado, ensena su texto con los datos en crudo en vez
 * de no ensenar nada.
 */
export function parametrosDeNotificacion(
  notificacion: Pick<StaffNotification, 'params'>,
  locale: Locale,
): Record<string, string | number | boolean> {
  const salida: Record<string, string | number | boolean> = { ...notificacion.params };

  /* El dinero, en centavos enteros en la fila y en moneda en la frase. */
  const centavos = notificacion.params.amountCents;
  if (typeof centavos === 'number') salida.amount = formatCents(centavos, locale);

  /* Las fechas, en ISO en la fila y legibles en la frase. */
  for (const clave of ['scheduledStart', 'expiresAt'] as const) {
    const valor = notificacion.params[clave];
    if (typeof valor === 'string' && !Number.isNaN(Date.parse(valor))) {
      salida[clave === 'scheduledStart' ? 'when' : clave] = formatTimestamp(valor, locale);
    }
  }

  return salida;
}
