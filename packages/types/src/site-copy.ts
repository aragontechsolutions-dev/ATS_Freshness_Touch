import { z } from 'zod';

/**
 * TEXTOS DEL SITIO EDITABLES
 * ==========================
 * Las promesas que la empresa hace en la web —el seguro, la verificacion de
 * antecedentes, la garantia— y las preguntas frecuentes. Hasta ahora vivian
 * en el codigo, asi que cambiar "24 horas" por "48 horas" exigia editar dos
 * archivos, compilar y desplegar.
 *
 * No son adornos: son COMPROMISOS. Una garantia mal escrita es una promesa
 * que la empresa tendra que cumplir igualmente.
 *
 * Cuatro decisiones gobiernan este contrato:
 *
 *   1. LA CLAVE ES LA MISMA QUE LA DE i18n. `whyUs.insured.title` es a la vez
 *      la clave que se guarda y la que el sitio busca en sus traducciones.
 *      Esto no es una coincidencia aprovechada: significa que el respaldo NO
 *      NECESITA TABLA DE CORRESPONDENCIAS. Sin texto configurado, se pide la
 *      misma clave al diccionario y sale lo que salia antes. Una tabla de
 *      correspondencias seria una segunda lista que mantener sincronizada, y
 *      el dia que se desincronizara el sitio ensenaria la clave en crudo.
 *
 *   2. CADA TEXTO TIENE LOS DOS IDIOMAS, Y CADA UNO PUEDE FALTAR. El sitio
 *      esta traducido entero. Si solo se pudiera editar uno, la web acabaria
 *      diciendo 24 horas en ingles y 48 en espanol, y nadie se enteraria
 *      hasta que un cliente reclamara con la version que le conviene. Que
 *      cada idioma sea anulable POR SEPARADO permite justo lo que hace falta:
 *      el idioma sin configurar sigue con el texto del codigo, y el panel
 *      puede avisar de que uno esta a medias.
 *
 *   3. VACIO NO ES UN TEXTO, ES «SIN CONFIGURAR». Se representa con `null`,
 *      nunca con la cadena vacia. Con la cadena vacia, borrar un texto
 *      dejaria un hueco en blanco en la web en vez de volver al texto de
 *      partida, y no habria forma de distinguir «lo quiero vacio» de «no lo
 *      he tocado».
 *
 *   4. ES TEXTO PLANO, Y ESO ES UNA REGLA DE SEGURIDAD, NO DE ESTILO. Lo que
 *      se guarda aqui lo escribe el panel y lo lee CUALQUIER visitante. Se
 *      pinta con las llaves de React, que escapan solo; nunca con
 *      `dangerouslySetInnerHTML`. Si algun dia alguien quiere negritas aqui,
 *      la respuesta correcta es anadir un campo con formato acotado, no
 *      abrir la puerta al HTML.
 */

// ---------------------------------------------------------------------------
// Las claves
// ---------------------------------------------------------------------------

/**
 * Los textos que se pueden cambiar desde el panel.
 *
 * QUE ESTA Y QUE NO. Estan las cuatro promesas y las seis preguntas
 * frecuentes, porque son afirmaciones sobre como opera el negocio y cambian
 * cuando cambia el negocio: la poliza, el plazo para cancelar, como se
 * explica el deposito.
 *
 * NO esta el titular de la portada ni los nombres de los servicios. El
 * titular es identidad de marca, no dato de operacion; y los servicios ya se
 * gobiernan desde el catalogo y las tarifas, que es donde deben estar.
 */
export const SITE_COPY_KEYS = [
  'whyUs.insured.title',
  'whyUs.insured.body',
  'whyUs.vetted.title',
  'whyUs.vetted.body',
  'whyUs.transparent.title',
  'whyUs.transparent.body',
  'whyUs.guarantee.title',
  'whyUs.guarantee.body',
  'faq.q1.q',
  'faq.q1.a',
  'faq.q2.q',
  'faq.q2.a',
  'faq.q3.q',
  'faq.q3.a',
  'faq.q4.q',
  'faq.q4.a',
  'faq.q5.q',
  'faq.q5.a',
  'faq.q6.q',
  'faq.q6.a',
] as const;

export const SiteCopyKeySchema = z.enum(SITE_COPY_KEYS);
export type SiteCopyKey = (typeof SITE_COPY_KEYS)[number];

// ---------------------------------------------------------------------------
// Los limites de largo
// ---------------------------------------------------------------------------

/**
 * Los dos tamanos de campo, MEDIDOS sobre los textos que ya hay, no elegidos
 * a ojo. Hoy el titulo o pregunta mas largo tiene 44 caracteres y la
 * respuesta mas larga 222, en los dos idiomas.
 *
 * Los topes dejan casi el triple de holgura, que sobra para reescribir una
 * promesa con calma. Lo que impiden es lo otro: que un pegado accidental de
 * tres paginas entre en la base y reviente la maquetacion de la portada, o
 * que alguien con acceso al panel convierta la home en un muro de texto.
 */
export const SITE_COPY_SHORT_MAX = 120;
export const SITE_COPY_LONG_MAX = 600;

/**
 * Los saltos de linea y los caracteres de control se rechazan.
 *
 * No es purismo: estos textos se pintan dentro de un titulo o de un parrafo
 * de una tarjeta, donde un salto de linea no se respeta pero SI rompe el
 * calculo de altura. Y los caracteres de control invisibles son la forma
 * clasica de colar algo que se ve distinto de lo que dice.
 */
const SIN_CONTROLES = /^[^\p{Cc}\p{Cf}]*$/u;

function textoEditable(max: number) {
  return z
    .string()
    .trim()
    .min(1, 'El texto no puede quedarse vacio: para dejarlo sin configurar, usa null')
    .max(max, `El texto no puede pasar de ${max} caracteres`)
    .regex(SIN_CONTROLES, 'El texto no admite saltos de linea ni caracteres invisibles')
    .nullable();
}

/**
 * Un texto en los dos idiomas.
 *
 * Los dos son obligatorios COMO CAMPO y anulables COMO VALOR: el objeto
 * siempre trae `en` y `es`, aunque valgan `null`. Si un idioma pudiera
 * faltar del objeto, «no configurado» y «me olvide de mandarlo» serian
 * indistinguibles, y guardar solo el ingles borraria el espanol sin querer.
 */
export const LocalizedTextSchema = z.strictObject({
  en: textoEditable(SITE_COPY_LONG_MAX),
  es: textoEditable(SITE_COPY_LONG_MAX),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/** El texto sin configurar en ningun idioma. */
export const TEXTO_SIN_CONFIGURAR: LocalizedText = { en: null, es: null };

// ---------------------------------------------------------------------------
// El conjunto
// ---------------------------------------------------------------------------

/** De que tamano es cada clave, para validar y para maquetar el panel. */
export const SITE_COPY_SHORT_KEYS: readonly SiteCopyKey[] = SITE_COPY_KEYS.filter(
  (key) => key.endsWith('.title') || key.endsWith('.q'),
);

/** A que bloque de la web pertenece cada clave. */
export type SiteCopyGroup = 'whyUs' | 'faq';

export function siteCopyGroup(key: SiteCopyKey): SiteCopyGroup {
  return key.startsWith('faq.') ? 'faq' : 'whyUs';
}

/**
 * Los textos configurados.
 *
 * ES UN REGISTRO PARCIAL A PROPOSITO: una clave que no esta significa «sin
 * configurar», exactamente igual que una con los dos idiomas en `null`. Si
 * exigiera las veinte claves, anadir un texto editable en el futuro
 * invalidaria de golpe todo lo que la empresa hubiera escrito, porque a la
 * fila guardada le faltaria la clave nueva.
 *
 * Las claves desconocidas SI se rechazan, para que una clave mal escrita no
 * se quede guardada en silencio sin salir nunca en la web. El servicio las
 * limpia antes de validar, que es como se retira una clave sin romper lo
 * guardado.
 */
export const SiteCopySchema = z
  .partialRecord(SiteCopyKeySchema, LocalizedTextSchema)
  .superRefine((copy, ctx) => {
    /*
     * El tope corto se comprueba aqui y no en el esquema del texto porque
     * depende de la clave, y el valor no sabe bajo que clave vive. Hacerlo
     * asi mantiene UN solo tipo de texto en vez de dos casi iguales.
     */
    for (const key of SITE_COPY_SHORT_KEYS) {
      const valor = copy[key];
      if (valor === undefined) continue;

      for (const idioma of ['en', 'es'] as const) {
        const texto = valor[idioma];
        if (texto !== null && texto.length > SITE_COPY_SHORT_MAX) {
          ctx.addIssue({
            code: 'custom',
            message: `Este texto es un titulo: no puede pasar de ${SITE_COPY_SHORT_MAX} caracteres`,
            path: [key, idioma],
          });
        }
      }
    }
  });
export type SiteCopy = z.infer<typeof SiteCopySchema>;

/**
 * Nada configurado: el sitio ensena exactamente lo que ensenaba antes de que
 * esto existiera. Es tambien lo que se sirve si la fila no se puede leer.
 */
export const DEFAULT_SITE_COPY: SiteCopy = {};

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/** Los dos idiomas del sitio. */
export const SITE_COPY_LOCALES = ['en', 'es'] as const;
export type SiteCopyLocale = (typeof SITE_COPY_LOCALES)[number];

/**
 * Recorta un codigo de idioma cualquiera a uno de los dos que se guardan.
 *
 * NO ES COSMETICA. El sitio resuelve el idioma con i18next, que segun el
 * navegador devuelve `en-US`, `es-419` o `es-MX`. Comparando la cadena
 * entera, la busqueda del texto configurado fallaria SIEMPRE y el panel
 * pareceria no servir para nada, aunque los textos estuvieran bien
 * guardados: el sitio seguiria ensenando los del codigo y nadie sabria por
 * que.
 *
 * Lo desconocido cae en ingles, que es el idioma de partida del sitio.
 */
export function toSiteCopyLocale(language: string | undefined | null): SiteCopyLocale {
  const corto = (language ?? '').slice(0, 2).toLowerCase();
  return (SITE_COPY_LOCALES as readonly string[]).includes(corto)
    ? (corto as SiteCopyLocale)
    : 'en';
}

/**
 * El texto configurado para una clave en un idioma, o `null` si no lo hay.
 *
 * Devolver `null` y no una cadena vacia es lo que permite a quien llama
 * escribir `configurado ?? t(clave)`: el respaldo al texto del codigo queda
 * en una linea y no hay forma de olvidarlo.
 */
export function siteCopyText(
  copy: SiteCopy,
  key: SiteCopyKey,
  locale: SiteCopyLocale,
): string | null {
  return copy[key]?.[locale] ?? null;
}

/**
 * Las claves que tienen un idioma escrito y el otro no.
 *
 * Es el aviso que de verdad importa. Nadie deja un texto a medias a
 * proposito: se escribe la promesa nueva en ingles, se deja el espanol para
 * luego y se olvida. A partir de ese momento la web promete dos cosas
 * distintas segun el idioma, y eso con una garantia es un problema de verdad.
 */
export function incompleteSiteCopyKeys(copy: SiteCopy): SiteCopyKey[] {
  return SITE_COPY_KEYS.filter((key) => {
    const valor = copy[key];
    if (valor === undefined) return false;
    return (valor.en === null) !== (valor.es === null);
  });
}

// ---------------------------------------------------------------------------
// Vista del panel
// ---------------------------------------------------------------------------

/**
 * Los textos mas quien los cambio por ultima vez.
 *
 * Igual que con el resto de la configuracion, esto NO sale por el endpoint
 * publico: al visitante le interesa la garantia, no quien la redacto.
 */
export const AdminSiteCopySchema = z.strictObject({
  copy: SiteCopySchema,
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type AdminSiteCopy = z.infer<typeof AdminSiteCopySchema>;
