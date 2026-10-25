import { z } from 'zod';
import { GalleryPhotoPathSchema, YouTubeVideoIdSchema } from './gallery';

/**
 * EL REGISTRO DE CONSENTIMIENTOS
 * ==============================
 * El papel que firma un cliente autorizando que se publique el interior de
 * su casa, anotado aqui y ATADO A LAS PIEZAS QUE AMPARA.
 *
 * ========================================================================
 * POR QUE ESTO NO ES UNA HOJA DE CALCULO
 * ========================================================================
 * El permiso promete dos cosas que solo se pueden cumplir si el sistema sabe
 * de quien es cada pieza:
 *
 *   1. QUE SE PUEDE RETIRAR. Un cliente escribe diciendo que ya no quiere
 *      que salga su casa. Sin este registro, cumplirlo significa revisar el
 *      canal entero a ojo intentando reconocer una cocina.
 *
 *   2. QUE SE RETIRA EN UN PLAZO. Prometer «en cinco dias» obliga a poder
 *      hacerlo, y a poder demostrar cuando se hizo.
 *
 * Aqui revocar es un boton: las piezas que ampara ese permiso DEJAN DE
 * SERVIRSE al momento, sin que nadie tenga que acordarse de borrarlas. El
 * plazo prometido pasa a ser el tiempo que se tarda en pulsar.
 *
 * ========================================================================
 * ESTO NO SALE NUNCA AL SITIO PUBLICO
 * ========================================================================
 * Lleva el nombre del cliente y LA DIRECCION DE SU CASA. Es justo lo que el
 * permiso promete no mostrar, asi que vive en su propia tabla, se lee solo
 * desde administracion, y de la galeria publica solo sale el efecto: la
 * pieza esta o no esta.
 *
 * El modelo del papel, lo que nunca puede entrar en el encuadre y el
 * procedimiento de retirada estan en
 * `docs/38-fotos-y-videos-antes-y-despues.md`.
 */

// ---------------------------------------------------------------------------
// Donde se puede publicar
// ---------------------------------------------------------------------------

/**
 * Los sitios que el permiso enumera.
 *
 * SE GUARDAN AUNQUE SOLO PUBLIQUEMOS EN LA WEB, porque el papel los enumera
 * uno a uno y lo que se firmo es lo que vale. Si manana se publica en
 * Facebook y el papel no lo decia, no hay permiso para eso — y sin tenerlo
 * anotado, nadie podria saberlo.
 */
export const CONSENT_CHANNELS = ['WEBSITE', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'] as const;
export const ConsentChannelSchema = z.enum(CONSENT_CHANNELS);
export type ConsentChannel = z.infer<typeof ConsentChannelSchema>;

// ---------------------------------------------------------------------------
// El papel
// ---------------------------------------------------------------------------

/** Ni saltos de linea ni caracteres invisibles, igual que el resto de textos. */
const SIN_CONTROLES = /^[^\p{Cc}\p{Cf}]*$/u;

function texto(max: number) {
  return z.string().trim().min(1).max(max).regex(SIN_CONTROLES);
}

/** Una fecha sin hora, tal y como se escribe en un papel. */
const FechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como AAAA-MM-DD');

export const CONSENT_REFERENCE_MAX = 40;
export const CONSENT_NAME_MAX = 120;
export const CONSENT_ADDRESS_MAX = 200;
export const CONSENT_NOTES_MAX = 500;

/**
 * El plazo de retirada que promete el papel, en dias.
 *
 * Con tope porque prometer mas de un mes no es una promesa. El documento
 * recomienda cinco dias laborables; «inmediatamente» no se puede cumplir un
 * domingo y por eso el minimo no es cero.
 */
export const CONSENT_REMOVAL_DAYS_MIN = 1;
export const CONSENT_REMOVAL_DAYS_MAX = 30;

export const MediaConsentSchema = z
  .strictObject({
    /**
     * Lo que va escrito en el papel, para poder emparejar el escaneo.
     *
     * Lo teclea quien archiva, no lo inventa el sistema: el numero util es
     * el que de verdad esta impreso en la hoja que hay en el cajon.
     */
    reference: texto(CONSENT_REFERENCE_MAX),
    customerName: texto(CONSENT_NAME_MAX),
    /** La casa. NUNCA sale al sitio publico. */
    propertyAddress: texto(CONSENT_ADDRESS_MAX),
    serviceDate: FechaSchema,
    signedAt: FechaSchema,

    /** Que se autorizo grabar. Al menos una de las dos. */
    coversInterior: z.boolean(),
    coversExterior: z.boolean(),

    /**
     * Si se autorizan las imagenes del «antes».
     *
     * Su propia casilla porque es la parte sensible: el «antes» es, por
     * definicion, la casa sucia de una persona concreta.
     */
    allowsBefore: z.boolean(),

    channels: z.array(ConsentChannelSchema).min(1, 'El permiso tiene que decir donde'),
    removalDays: z.int().min(CONSENT_REMOVAL_DAYS_MIN).max(CONSENT_REMOVAL_DAYS_MAX),

    /** Las piezas que ampara. Es lo que convierte esto en algo util. */
    videoIds: z.array(YouTubeVideoIdSchema).default([]),
    photoPaths: z.array(GalleryPhotoPathSchema).default([]),

    notes: z.string().trim().max(CONSENT_NOTES_MAX).regex(SIN_CONTROLES).nullable().default(null),
  })
  .refine((c) => c.coversInterior || c.coversExterior, {
    message: 'El permiso tiene que cubrir el interior, el exterior o los dos',
    path: ['coversInterior'],
  })
  /*
   * SI AMPARA ALGUNA PIEZA, EL PAPEL TIENE QUE PERMITIR LA WEB.
   *
   * Es donde se publica. Un permiso que solo autoriza Instagram no autoriza
   * la portada, y sin esta comprobacion se podria atar una foto a un papel
   * que no la cubre — que es peor que no tener papel, porque parece que si.
   */
  .refine(
    (c) => (c.videoIds.length === 0 && c.photoPaths.length === 0) || c.channels.includes('WEBSITE'),
    {
      message: 'Para publicar en la web, el permiso tiene que autorizar la web',
      path: ['channels'],
    },
  );

export type MediaConsent = z.infer<typeof MediaConsentSchema>;

// ---------------------------------------------------------------------------
// Lo que devuelve el panel
// ---------------------------------------------------------------------------

/**
 * Una ficha completa tal y como la lee el panel.
 *
 * ES TOLERANTE CON CAMPOS NUEVOS, como todo lo que lee un navegador: el
 * panel y la API se despliegan por separado, y un contrato estricto aqui
 * vaciaria la pantalla entera el dia que la API devuelva un campo de mas.
 * Ver `lo-que-lee-la-web-tolera-campos-nuevos.test.ts`.
 */
export const StoredMediaConsentSchema = z.object({
  id: z.uuid(),
  consent: MediaConsentSchema,
  /** Cuando se retiro el permiso, o `null` si sigue en pie. */
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Quien lo anoto por ultima vez. `null` si esa persona ya no esta. */
  updatedBy: z.string().nullable(),
});
export type StoredMediaConsent = z.infer<typeof StoredMediaConsentSchema>;

export const MediaConsentListSchema = z.object({
  consents: z.array(StoredMediaConsentSchema).default([]),
});
export type MediaConsentList = z.infer<typeof MediaConsentListSchema>;

/** Si una ficha sigue amparando lo que publica. */
export function consentIsActive(ficha: Pick<StoredMediaConsent, 'revokedAt'>): boolean {
  return ficha.revokedAt === null;
}

/**
 * Las piezas que NO se pueden seguir publicando.
 *
 * Es lo que convierte el registro en algo que cumple solo: revocar deja de
 * ser un recordatorio para quien archiva y pasa a ser un filtro que corre en
 * cada visita.
 */
export function revokedPieces(fichas: readonly StoredMediaConsent[]): {
  videoIds: Set<string>;
  photoPaths: Set<string>;
} {
  const videoIds = new Set<string>();
  const photoPaths = new Set<string>();

  for (const ficha of fichas) {
    if (consentIsActive(ficha)) continue;
    for (const id of ficha.consent.videoIds) videoIds.add(id);
    for (const path of ficha.consent.photoPaths) photoPaths.add(path);
  }

  return { videoIds, photoPaths };
}

/**
 * Las piezas publicadas que no tienen ningun permiso anotado.
 *
 * NO SE DEJA DE PUBLICARLAS, se avisa. Bloquearlas haria desaparecer de la
 * portada lo que ya estaba publicado el dia que esto se despliegue, y una
 * seccion que se vacia sola en un despliegue es exactamente el fallo que
 * este proyecto ya se comio una vez.
 *
 * Pero una pieza sin papel es una pieza publicando sin permiso, asi que el
 * panel la marca y quien mire la pantalla lo ve.
 */
export function piecesWithoutConsent(
  fichas: readonly StoredMediaConsent[],
  publicadas: { videoIds: readonly string[]; photoPaths: readonly string[] },
): { videoIds: string[]; photoPaths: string[] } {
  const conPapel = { videoIds: new Set<string>(), photoPaths: new Set<string>() };

  for (const ficha of fichas) {
    if (!consentIsActive(ficha)) continue;
    for (const id of ficha.consent.videoIds) conPapel.videoIds.add(id);
    for (const path of ficha.consent.photoPaths) conPapel.photoPaths.add(path);
  }

  return {
    videoIds: publicadas.videoIds.filter((id) => !conPapel.videoIds.has(id)),
    photoPaths: publicadas.photoPaths.filter((path) => !conPapel.photoPaths.has(path)),
  };
}
