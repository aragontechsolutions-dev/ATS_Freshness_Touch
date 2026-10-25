import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_GALLERY,
  DEFAULT_PUBLIC_GALLERY,
  GALLERY_PHOTO_MAX_BYTES,
  GallerySchema,
  galleryImageFolder,
  type AdminGallery,
  type AuthenticatedStaff,
  type Gallery,
  type GalleryImageKind,
  type PublicGallery,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { stripImageMetadata } from '../storage/strip-image-metadata';
import { IMAGE_STORAGE, type ImageStorage } from '../storage/storage.types';

/**
 * LA GALERIA DE ANTES Y DESPUES
 * -----------------------------
 * Los videos que la empresa publica en la portada. Vive en una sola fila de
 * la tabla de clave y valor, como el resto de la configuracion.
 *
 * UNA FILA Y NO UNA POR VIDEO, por el mismo motivo que los textos del sitio:
 * la galeria se reordena en tandas, y un fallo a mitad dejaria la portada con
 * dos videos repetidos y uno perdido.
 *
 * NUNCA FALLA AL LEER. Si la fila no existe, tiene basura de una version
 * anterior o la base no responde, devuelve la galeria vacia y lo deja en el
 * log. La seccion no se pinta y la portada sale entera: esta es la pagina que
 * genera los ingresos, y tumbarla por no poder leer una lista de videos seria
 * un intercambio pesimo.
 */
const SETTINGS_KEY = 'gallery';

/**
 * Lo pide el sitio publico en cada visita, asi que se cachea como el resto.
 * Medio minuto: retirar un video a peticion de un cliente llega a la web en
 * lo que se tarda en recargar dos veces, y eso importa — el consentimiento se
 * puede revocar.
 */
const CACHE_TTL_MS = 30_000;

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  private cached: { value: Gallery; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(IMAGE_STORAGE) private readonly storage: ImageStorage,
  ) {}

  /** La galeria vigente. */
  async get(now: number = Date.now()): Promise<Gallery> {
    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.value;
    }

    const value = await this.load();
    this.cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  /** Se llama al guardar, para que el cambio se vea sin esperar a la cache. */
  invalidate(): void {
    this.cached = null;
  }

  private async load(): Promise<Gallery> {
    let stored: unknown;

    try {
      const row = await this.prisma.db.businessSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      });

      if (!row) return DEFAULT_GALLERY;
      stored = row.value;
    } catch (error) {
      this.logger.error(
        'No se pudo leer la galeria; la seccion no se pinta: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return DEFAULT_GALLERY;
    }

    const parsed = GallerySchema.safeParse(stored);

    if (!parsed.success) {
      this.logger.error(
        `La fila "${SETTINGS_KEY}" no cumple el contrato y se ignora. ` +
          'Guardala de nuevo desde el panel para corregirla.',
      );
      return DEFAULT_GALLERY;
    }

    return parsed.data;
  }

  /**
   * La galeria mas quien la cambio, para la pantalla de administracion.
   *
   * Sin cache, y ademas la invalida: quien va a editar tiene que ver el
   * estado real, no el de hace medio minuto. Servir datos viejos en la
   * pantalla desde la que se edita es como dos personas se pisan los
   * cambios — y aqui pisarse significa volver a publicar un video que la
   * otra acababa de retirar porque un cliente lo pidio.
   */
  async getForAdmin(): Promise<AdminGallery> {
    this.invalidate();

    const row = await this.prisma.db.businessSetting.findUnique({
      where: { key: SETTINGS_KEY },
      select: { updatedAt: true, updatedBy: true },
    });

    const gallery = await this.get();

    const rutas = [
      ...gallery.photos.map((photo) => photo.path),
      ...gallery.videos.flatMap((video) => (video.poster === null ? [] : [video.poster])),
    ];

    return {
      gallery,
      imageUrls: Object.fromEntries(
        rutas.flatMap((ruta) => {
          const url = this.storage.publicUrl(ruta);
          return url === null ? [] : [[ruta, url] as const];
        }),
      ),
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: await this.staffName(row?.updatedBy ?? null),
    };
  }

  /** Nombre de quien guardo. `null` si esa persona ya no esta en la tabla. */
  private async staffName(staffId: string | null): Promise<string | null> {
    if (staffId === null) return null;

    const persona = await this.prisma.db.staff.findUnique({
      where: { id: staffId },
      select: { firstName: true, lastName: true },
    });

    return persona ? `${persona.firstName} ${persona.lastName}`.trim() : null;
  }

  /**
   * Guarda la galeria entera y deja rastro de quien la cambio.
   *
   * EL CAMBIO Y SU AUDITORIA VAN EN LA MISMA TRANSACCION, y aqui eso no es
   * ceremonia: lo que se publica es el interior de la casa de un cliente con
   * su permiso firmado. Si el cliente revoca ese permiso o reclama, la
   * pregunta es «quien lo publico, cuando, y cuando se retiro». Un cambio
   * guardado sin su registro deja esa pregunta sin respuesta.
   */
  async save(
    gallery: Gallery,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<AdminGallery> {
    const anterior = await this.get();

    const antes = anterior.videos.map((v) => v.videoId);
    const despues = gallery.videos.map((v) => v.videoId);

    const fotosAntes = anterior.photos.map((p) => p.path);
    const fotosDespues = gallery.photos.map((p) => p.path);

    /*
     * LAS MINIATURAS RETIRADAS TAMBIEN SE BORRAN DEL ALMACEN.
     *
     * Y no solo al quitar un video: tambien al SUSTITUIR su miniatura por
     * otra, que es lo que mas va a pasar. Sin esto, cada cambio de portada
     * dejaria la anterior en el almacen para siempre, accesible con su
     * direccion para quien la tuviera.
     */
    const minisAntes = anterior.videos.flatMap((v) => (v.poster === null ? [] : [v.poster]));
    const minisDespues = gallery.videos.flatMap((v) => (v.poster === null ? [] : [v.poster]));

    const retiradas = [
      ...fotosAntes.filter((path) => !fotosDespues.includes(path)),
      ...minisAntes.filter((path) => !minisDespues.includes(path)),
    ];

    await this.prisma.db.$transaction(async (tx) => {
      await tx.businessSetting.upsert({
        where: { key: SETTINGS_KEY },
        create: { key: SETTINGS_KEY, value: gallery, updatedBy: staff.staffId },
        update: { value: gallery, updatedBy: staff.staffId },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'gallery.updated',
          /*
           * `business_settings` como el resto de la configuracion, no una
           * entidad propia: lo que distingue este cambio de un cambio de
           * telefono es la ACCION. El catalogo de entidades existe para que
           * nadie invente una grafia nueva.
           */
          entityType: 'business_settings',
          entityId: SETTINGS_KEY,
          /*
           * QUE ENTRO Y QUE SALIO, no la lista entera. La lista entera no
           * responde a «cuando se retiro el video de esta casa», que es la
           * unica pregunta que llega tarde; la diferencia si.
           *
           * Son identificadores de videos ya publicos en YouTube: no hay
           * nada secreto. Lo que NO entra aqui es ninguna direccion ni
           * ningun dato del cliente, que es de donde vendria el problema.
           */
          metadata: {
            added: despues.filter((id) => !antes.includes(id)),
            removed: antes.filter((id) => !despues.includes(id)),
            /*
             * Las rutas de las fotos son nombres que puso el servidor:
             * treinta y dos hexadecimales. No dicen nada de nadie, y son lo
             * unico con lo que se puede responder a «cuando se retiro la foto
             * de esta casa».
             */
            photosAdded: fotosDespues.filter((path) => !fotosAntes.includes(path)),
            photosRemoved: fotosAntes.filter((path) => !fotosDespues.includes(path)),
            postersAdded: minisDespues.filter((path) => !minisAntes.includes(path)),
            postersRemoved: minisAntes.filter((path) => !minisDespues.includes(path)),
          },
          ipAddress,
        },
        tx,
      );
    });

    this.invalidate();

    /*
     * EL BORRADO VA DESPUES DE LA TRANSACCION, NO DENTRO.
     *
     * Dentro, un fallo posterior haria retroceder la fila y dejaria las fotos
     * ya borradas del almacen: la galeria apuntaria a archivos que no
     * existen. Fuera, el peor caso es un archivo huerfano, que no se ve en
     * ninguna parte.
     *
     * Y no se espera a que termine bien: `remove` no falla nunca a proposito.
     * Lo que importa de retirar una foto es que DEJE DE VERSE —el cliente
     * revoco su permiso—, y eso ya pasó al guardar la fila. Un huerfano es
     * un problema de limpieza; una foto que sigue publicada despues de pedir
     * que la quiten es un problema legal.
     */
    await this.storage.remove(retiradas);

    return this.getForAdmin();
  }

  /* ---------------------------------------------------------------------- */
  /*  Lo que ve el sitio publico                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * La galeria con DIRECCIONES en vez de rutas.
   *
   * La direccion la compone el servidor, que es el unico que sabe donde esta
   * el almacen. La web no construye ninguna: usa la que recibe. Mandar la
   * ruta y que la web le pegue delante un dominio suyo pondria ese dominio en
   * dos sitios que tendrian que coincidir para siempre, y es exactamente el
   * fallo de la sede, donde la web anunciaba una ciudad y el cotizador medía
   * desde otra.
   *
   * UNA FOTO CUYA DIRECCION NO SE PUEDE COMPONER NO SALE. Pasa si no hay
   * almacen configurado, y entonces es mejor una seccion sin esa foto que una
   * portada con un icono de imagen rota.
   */
  async getPublic(): Promise<PublicGallery> {
    const gallery = await this.get();

    const photos = gallery.photos.flatMap((photo) => {
      const url = this.storage.publicUrl(photo.path);
      return url === null ? [] : [{ url, title: photo.title }];
    });

    /*
     * UN VIDEO SIN MINIATURA SIGUE SALIENDO. No es como una foto, que sin
     * direccion no es nada: el video se ve igual, solo que la tarjeta se
     * pinta con los colores de la marca.
     */
    const videos = gallery.videos.map((video) => ({
      videoId: video.videoId,
      title: video.title,
      posterUrl: video.poster === null ? null : this.storage.publicUrl(video.poster),
    }));

    if (videos.length === 0 && photos.length === 0) return DEFAULT_PUBLIC_GALLERY;

    return { videos, photos };
  }

  /* ---------------------------------------------------------------------- */
  /*  Subir una foto                                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Guarda una imagen en el almacen y devuelve su ruta.
   *
   * ========================================================================
   * TRES COSAS PASAN AQUI, Y LAS TRES SON EL MOTIVO DE QUE LA SUBIDA NO VAYA
   * DIRECTA DEL NAVEGADOR AL ALMACEN
   * ========================================================================
   *
   *   1. SE COMPRUEBA QUE LOS BYTES SON UNA IMAGEN, por los bytes y no por lo
   *      que diga el cliente. Sin esto, llamar `.jpg` a un SVG colaria un
   *      documento con JavaScript dentro en un bucket publico.
   *
   *   2. SE QUITAN LOS METADATOS. Una foto de movil lleva dentro las
   *      COORDENADAS GPS de la casa. El permiso que firma el cliente dice que
   *      no se mostrara su calle; publicar su direccion exacta escrita dentro
   *      del archivo deja ese cuidado en nada.
   *
   *   3. EL NOMBRE LO PONE EL SERVIDOR. Si lo pusiera quien sube, se
   *      acabarian subiendo archivos llamados «casa-de-los-martinez.jpg», que
   *      es publicar el apellido del cliente en una direccion que cualquiera
   *      puede leer.
   *
   * NO SE AUDITA LA SUBIDA, y es deliberado: subir no publica nada. Una foto
   * en el almacen que no esta en la fila no se ve en ninguna parte. Lo que se
   * audita es PUBLICARLA, al guardar la galeria, que es cuando pasa a verse.
   */
  async uploadImage(
    bytes: Uint8Array,
    kind: GalleryImageKind,
  ): Promise<
    | { ok: true; path: string; url: string }
    | { ok: false; reason: 'tooBig' | 'notAnImage' | 'storage' }
  > {
    if (bytes.length === 0 || bytes.length > GALLERY_PHOTO_MAX_BYTES) {
      return { ok: false, reason: 'tooBig' };
    }

    if (!this.storage.configured) return { ok: false, reason: 'storage' };

    const limpia = stripImageMetadata(bytes);
    if (!limpia.ok) return { ok: false, reason: 'notAnImage' };

    const extension = limpia.format === 'jpeg' ? 'jpg' : limpia.format;
    const contentType = `image/${limpia.format}` as const;

    // Treinta y dos hexadecimales: nada del nombre original sobrevive.
    const path = `${galleryImageFolder(kind)}/${randomUUID().replace(/-/g, '')}.${extension}`;

    const subida = await this.storage.upload({ path, bytes: limpia.bytes, contentType });
    if (!subida.ok) return { ok: false, reason: 'storage' };

    /*
     * Se devuelve tambien la direccion para que el panel pueda ensenar la
     * vista previa al momento. Sin ella habria que recargar la pantalla
     * entera para ver la foto que acabas de subir, y el orden y los titulos
     * se eligen MIRANDO las fotos.
     */
    const url = this.storage.publicUrl(path);
    if (url === null) return { ok: false, reason: 'storage' };

    return { ok: true, path, url };
  }
}
