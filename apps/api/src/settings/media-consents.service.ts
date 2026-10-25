import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CONSENT_EVIDENCE_MAX_BYTES,
  MediaConsentSchema,
  consentEvidenceExtension,
  consentEvidenceType,
  type AuthenticatedStaff,
  type ConsentEvidenceType,
  type MediaConsent,
  type StoredMediaConsent,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { crearTestigoDeRetirada, resumenDeTestigo } from './removal-token';
import { PrismaService } from '../database/prisma.service';
import { DOCUMENT_STORAGE, type DocumentStorage } from '../storage/document-storage.types';
import { stripImageMetadata } from '../storage/strip-image-metadata';

/**
 * EL REGISTRO DE CONSENTIMIENTOS DE IMAGEN
 * ----------------------------------------
 * Los papeles firmados que amparan lo que se publica en la galeria.
 *
 * ========================================================================
 * LO QUE DE VERDAD HACE ESTO
 * ========================================================================
 * El permiso que firma un cliente promete que se puede retirar y que se
 * retira en un plazo. Sin un registro, cumplirlo significa revisar el canal
 * entero a ojo intentando reconocer una cocina.
 *
 * Aqui revocar es un boton, y `piezasPublicables()` hace que la galeria
 * publica deje de servir esas piezas AL MOMENTO. El plazo prometido pasa a
 * ser el tiempo que se tarda en pulsar.
 *
 * ========================================================================
 * NO SE BORRA NADA
 * ========================================================================
 * Un permiso retirado es exactamente lo que hay que poder demostrar: que
 * existio, que amparaba estas piezas y cuando dejo de hacerlo. Por eso
 * revocar es marcar una fecha, nunca borrar la fila.
 */
/**
 * Lo mismo que el resto de lo que sirve la portada: se consulta en CADA
 * visita y sin cache cada una dispararia una consulta.
 *
 * Medio minuto, y ademas SE INVALIDA AL REVOCAR, asi que retirar una foto se
 * ve al instante y no dentro de treinta segundos. La cache es para las
 * visitas, no para hacer esperar a quien acaba de pulsar.
 */
const CACHE_TTL_MS = 30_000;

/** Lo que el barrido de plazos necesita saber, y nada mas. */
export interface RetiradaPendiente {
  id: string;
  reference: string;
  removalDays: number;
  /** `AAAA-MM-DD`: el dia que el cliente lo pidio. */
  requestedAt: string;
  /** La ultima vez que se aviso de esta, en ISO, o `null`. */
  reminderSentAt: string | null;
}

@Injectable()
export class MediaConsentsService {
  private cached: {
    value: { videoIds: Set<string>; photoPaths: Set<string> };
    expiresAt: number;
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(DOCUMENT_STORAGE) private readonly documentos: DocumentStorage,
  ) {}

  /** Se llama al guardar, para que lo retirado deje de verse al momento. */
  invalidate(): void {
    this.cached = null;
  }

  /** Todas las fichas, la mas reciente primero. Solo administracion. */
  async list(): Promise<StoredMediaConsent[]> {
    const filas = await this.prisma.db.mediaConsent.findMany({
      orderBy: { createdAt: 'desc' },
      include: { updatedBy: { select: { firstName: true, lastName: true } } },
    });

    return filas.map((fila) => aFicha(fila));
  }

  /**
   * Las piezas que SI se pueden publicar.
   *
   * ========================================================================
   * MODO ESTRICTO: SIN PAPEL NO SE PUBLICA
   * ========================================================================
   * No es una lista negra de lo retirado, es una lista blanca de lo
   * amparado. La diferencia importa: con una lista negra, una foto que nadie
   * anoto se publica — y publicar la casa de alguien sin su permiso firmado
   * es el escenario que todo este modulo existe para evitar.
   *
   * Olvidar anotar un papel ahora tiene una consecuencia VISIBLE —la foto no
   * sale— en vez de una invisible —la foto sale sin permiso—. De las dos,
   * esta es la que se arregla, porque se nota.
   *
   * UNA PIEZA CON UN PERMISO REVOCADO NO SE PUBLICA AUNQUE OTRO LA AMPARE.
   * No deberia pasar —una pieza es de una casa— pero si pasara, lo que manda
   * es la voluntad de quien dijo que no.
   *
   * ESTO LO LLAMA LA GALERIA PUBLICA EN CADA VISITA. Salen de la base solo
   * las dos listas: ni un nombre ni una direccion.
   */
  async piezasPublicables(
    now: number = Date.now(),
  ): Promise<{ videoIds: Set<string>; photoPaths: Set<string> }> {
    if (this.cached && this.cached.expiresAt > now) return this.cached.value;

    const filas = await this.prisma.db.mediaConsent.findMany({
      select: { revokedAt: true, videoIds: true, photoPaths: true },
    });

    const amparados = { videoIds: new Set<string>(), photoPaths: new Set<string>() };
    const retirados = { videoIds: new Set<string>(), photoPaths: new Set<string>() };

    for (const fila of filas) {
      const destino = fila.revokedAt === null ? amparados : retirados;
      for (const id of fila.videoIds) destino.videoIds.add(id);
      for (const path of fila.photoPaths) destino.photoPaths.add(path);
    }

    const value = {
      videoIds: new Set([...amparados.videoIds].filter((id) => !retirados.videoIds.has(id))),
      photoPaths: new Set(
        [...amparados.photoPaths].filter((path) => !retirados.photoPaths.has(path)),
      ),
    };

    this.cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  /**
   * Anota una ficha nueva.
   *
   * DEVUELVE EL TESTIGO, Y ES LA UNICA VEZ QUE EXISTE. Si la ficha lleva
   * correo, se le fabrica un enlace de retirada; de el solo queda el resumen
   * en la base, asi que este valor no se puede recuperar despues. Quien
   * llama lo manda en el correo de constancia y lo olvida.
   *
   * Se devuelve en vez de mandarse desde aqui porque mandar correos exige
   * los canales, que viven en el modulo de avisos — y ese modulo ya importa
   * este. Pedirle la vuelta seria un ciclo entre los dos.
   */
  async create(
    consent: MediaConsent,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<{ ficha: StoredMediaConsent; removalToken: string | null }> {
    const testigo = consent.customerEmail === null ? null : crearTestigoDeRetirada();

    const fila = await this.prisma.db.$transaction(async (tx) => {
      const creada = await tx.mediaConsent.create({
        data: {
          ...aFila(consent),
          removalTokenHash: testigo?.hash ?? null,
          updatedByStaffId: staff.staffId,
        },
        include: { updatedBy: { select: { firstName: true, lastName: true } } },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'media_consent.created',
          entityType: 'media_consent',
          entityId: creada.id,
          metadata: resumen(consent),
          ipAddress,
        },
        tx,
      );

      return creada;
    });

    this.invalidate();
    return { ficha: aFicha(fila), removalToken: testigo?.token ?? null };
  }

  /* ---------------------------------------------------------------------- */
  /*  La retirada que hace el propio cliente                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * RETIRA LAS FOTOS DE UNA FICHA CON SU TESTIGO, SIN SESION DE NADIE.
   *
   * Es la unica puerta publica de todo este modulo, y hace una sola cosa:
   * despublicar. No lee la ficha, no devuelve el nombre ni la direccion, no
   * dice de que casa era y no toca ninguna otra.
   *
   * ========================================================================
   * EL TESTIGO SE GASTA
   * ========================================================================
   * Al usarse se borra el resumen, asi que un segundo intento con el mismo
   * enlace ya no encuentra nada. No es por ahorro: un enlace que sigue
   * sirviendo despues de usarse es una credencial viva en un buzon para
   * siempre.
   *
   * ========================================================================
   * UN TESTIGO QUE NO EXISTE Y UNO YA GASTADO RESPONDEN IGUAL
   * ========================================================================
   * Devuelven lo mismo —`desconocido`— y quien llama ensena el mismo texto.
   * Distinguirlos convertiria esta ruta en una forma de averiguar que
   * enlaces existieron alguna vez.
   */
  async retirarConTestigo(
    token: string,
    ipAddress: string | null,
  ): Promise<{ retirada: string | null }> {
    const fila = await this.prisma.db.mediaConsent.findUnique({
      where: { removalTokenHash: resumenDeTestigo(token) },
      select: { id: true, reference: true, revokedAt: true },
    });

    if (!fila) return { retirada: null };

    await this.prisma.db.$transaction(async (tx) => {
      await tx.mediaConsent.update({
        where: { id: fila.id },
        data: {
          // Si ya estaba retirada no se mueve la fecha: la que vale es la
          // primera, que es la que dice cuando dejo de publicarse.
          revokedAt: fila.revokedAt ?? new Date(),
          removalTokenHash: null,
          /*
           * `updatedByStaffId` se queda como estaba: aqui no hay personal
           * que anotar, y poner el de quien creo la ficha seria atribuirle
           * una accion que no hizo.
           */
        },
      });

      await this.audit.record(
        {
          staff: null,
          actorType: 'CUSTOMER',
          surface: 'SITE',
          action: 'media_consent.revoked',
          entityType: 'media_consent',
          entityId: fila.id,
          /*
           * La referencia y nada mas. Ni el testigo —es una credencial y no
           * se escribe en ningun registro— ni el nombre ni la direccion.
           */
          metadata: { reference: fila.reference, bySelfService: true },
          ipAddress,
        },
        tx,
      );
    });

    this.invalidate();

    /*
     * Devuelve la REFERENCIA, no un booleano: quien llama tiene que poder
     * avisar a la empresa de cual se retiro, y volver a preguntarselo a la
     * base seria pedir dos veces lo que ya se sabe.
     */
    return { retirada: fila.reference };
  }

  async update(
    id: string,
    consent: MediaConsent,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<StoredMediaConsent> {
    await this.exigirQueExista(id);

    const fila = await this.prisma.db.$transaction(async (tx) => {
      const guardada = await tx.mediaConsent.update({
        where: { id },
        data: { ...aFila(consent), updatedByStaffId: staff.staffId },
        include: { updatedBy: { select: { firstName: true, lastName: true } } },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'media_consent.updated',
          entityType: 'media_consent',
          entityId: id,
          metadata: resumen(consent),
          ipAddress,
        },
        tx,
      );

      return guardada;
    });

    this.invalidate();
    return aFicha(fila);
  }

  /**
   * Retira o restituye un permiso.
   *
   * RETIRAR NO BORRA: marca la fecha. Y a partir de ese instante la galeria
   * publica deja de servir las piezas que amparaba, sin que nadie tenga que
   * acordarse de quitarlas una a una.
   *
   * Restituir existe porque revocar por error tiene que poder deshacerse, y
   * las dos cosas quedan registradas con su propia accion: la pregunta que
   * llega tarde es CUANDO se retiro, y se responde con el registro.
   */
  async setRevoked(
    id: string,
    revocado: boolean,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<StoredMediaConsent> {
    const anterior = await this.exigirQueExista(id);

    const fila = await this.prisma.db.$transaction(async (tx) => {
      const guardada = await tx.mediaConsent.update({
        where: { id },
        data: {
          revokedAt: revocado ? new Date() : null,
          updatedByStaffId: staff.staffId,
        },
        include: { updatedBy: { select: { firstName: true, lastName: true } } },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: revocado ? 'media_consent.revoked' : 'media_consent.restored',
          entityType: 'media_consent',
          entityId: id,
          metadata: {
            reference: anterior.reference,
            videos: anterior.videoIds.length,
            photos: anterior.photoPaths.length,
          },
          ipAddress,
        },
        tx,
      );

      return guardada;
    });

    this.invalidate();
    return aFicha(fila);
  }

  /* ---------------------------------------------------------------------- */
  /*  La prueba del permiso                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Guarda el escaneo del papel, o el PDF del correo, junto a la ficha.
   *
   * ========================================================================
   * POR QUE ESTO NO VA AL ALMACEN DE LA GALERIA
   * ========================================================================
   * Porque aquel es PUBLICO de lectura y esto lleva el nombre del cliente, la
   * direccion de su casa y su firma —justo lo que el permiso promete no
   * mostrar—. Va a un bucket privado y se sirve por `leerPrueba()`, detras de
   * la sesion del panel. No existe ninguna direccion que lo abra sin ella.
   *
   * SE COMPRUEBAN LOS BYTES, no lo que diga la cabecera: un archivo que dice
   * ser un PDF y no lo es no se guarda. Y a las imagenes se les quitan los
   * metadatos, por el mismo motivo que a las de la galeria —una foto de movil
   * lleva coordenadas dentro— aunque aqui el archivo no se publique: el
   * habito tiene que ser el mismo o un dia se olvida donde importa.
   *
   * SUSTITUIR BORRA LA ANTERIOR. Dos pruebas para un mismo permiso no es un
   * respaldo, es no saber cual vale.
   */
  async attachEvidence(
    id: string,
    bytes: Uint8Array,
    declarado: ConsentEvidenceType,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<
    | { ok: true; ficha: StoredMediaConsent }
    | { ok: false; reason: 'tooBig' | 'notADocument' | 'storage' }
  > {
    const anterior = await this.exigirQueExista(id);

    if (bytes.length === 0 || bytes.length > CONSENT_EVIDENCE_MAX_BYTES) {
      return { ok: false, reason: 'tooBig' };
    }
    if (!this.documentos.configured) return { ok: false, reason: 'storage' };

    const comprobados = revisarBytes(bytes, declarado);
    if (comprobados === null) return { ok: false, reason: 'notADocument' };

    // Treinta y dos hexadecimales: nada del nombre original sobrevive.
    const path = `evidence/${randomUUID().replace(/-/g, '')}.${consentEvidenceExtension(
      comprobados.tipo,
    )}`;

    const subida = await this.documentos.upload({
      path,
      bytes: comprobados.bytes,
      contentType: comprobados.tipo,
    });
    if (!subida.ok) return { ok: false, reason: 'storage' };

    const fila = await this.prisma.db.$transaction(async (tx) => {
      const guardada = await tx.mediaConsent.update({
        where: { id },
        data: { evidencePath: path, updatedByStaffId: staff.staffId },
        include: { updatedBy: { select: { firstName: true, lastName: true } } },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'media_consent.evidence_attached',
          entityType: 'media_consent',
          entityId: id,
          /*
           * NI LA RUTA. Es el unico dato que, sumado a la clave de servicio,
           * abre el documento; y el registro de auditoria se consulta, se
           * exporta y se ensena. El tipo y el tamano responden a lo que se
           * pregunta de verdad: que se guardo algo y de que clase era.
           */
          metadata: {
            reference: anterior.reference,
            evidenceType: comprobados.tipo,
            bytes: comprobados.bytes.length,
            replaced: anterior.evidencePath !== null,
          },
          ipAddress,
        },
        tx,
      );

      return guardada;
    });

    /*
     * La anterior se borra DESPUES de que la nueva este guardada y escrita.
     * Al reves, un fallo a mitad dejaria la ficha sin ninguna prueba.
     */
    if (anterior.evidencePath !== null) {
      await this.documentos.remove([anterior.evidencePath]);
    }

    return { ok: true, ficha: aFicha(fila) };
  }

  /**
   * Los bytes de la prueba, para que la API los sirva.
   *
   * NO SE AUDITA LEERLA. Se mira al abrir la ficha y se volveria a mirar en
   * cada vistazo: un registro que crece con cada ojeada es un registro que
   * nadie lee, y enterraria las lineas que si importan —quien la guardo y
   * quien la borro—.
   */
  async readEvidence(
    id: string,
  ): Promise<{ bytes: Uint8Array; contentType: ConsentEvidenceType } | null> {
    const fila = await this.exigirQueExista(id);
    if (fila.evidencePath === null) return null;

    const contentType = consentEvidenceType(fila.evidencePath);
    if (contentType === null) return null;

    const bytes = await this.documentos.download(fila.evidencePath);
    return bytes === null ? null : { bytes, contentType };
  }

  /**
   * Borra la prueba, dejando la ficha.
   *
   * La ficha NO se borra nunca: un permiso anotado sin su archivo sigue
   * amparando lo que ampara, y que le falte la prueba es algo que se ve en la
   * pantalla y se arregla volviendo a subirla.
   */
  async removeEvidence(
    id: string,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<StoredMediaConsent> {
    const anterior = await this.exigirQueExista(id);

    const fila = await this.prisma.db.$transaction(async (tx) => {
      const guardada = await tx.mediaConsent.update({
        where: { id },
        data: { evidencePath: null, updatedByStaffId: staff.staffId },
        include: { updatedBy: { select: { firstName: true, lastName: true } } },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'media_consent.evidence_removed',
          entityType: 'media_consent',
          entityId: id,
          metadata: { reference: anterior.reference },
          ipAddress,
        },
        tx,
      );

      return guardada;
    });

    if (anterior.evidencePath !== null) {
      await this.documentos.remove([anterior.evidencePath]);
    }

    return aFicha(fila);
  }

  /* ---------------------------------------------------------------------- */
  /*  El plazo de retirada                                                   */
  /* ---------------------------------------------------------------------- */

  /**
   * Anota el dia en que el cliente pidio la retirada, o lo borra.
   *
   * ========================================================================
   * LA FECHA LA ELIGE QUIEN ANOTA, Y NO ES EL RELOJ DEL SERVIDOR
   * ========================================================================
   * Porque el correo del cliente puede llevar dos dias en el buzon. Poner
   * «hoy» automaticamente regalaria esos dos dias y haria que el plazo se
   * midiera desde que nos enteramos, no desde que lo pidio — que es
   * exactamente la promesa que se firmo.
   *
   * ANOTARLO NO RETIRA NADA. Son dos acciones distintas a proposito: esta
   * arranca el reloj y pone la ficha en la lista de avisos; retirar es el
   * boton de siempre, y es el que despublica. Juntarlas parece comodo hasta
   * el dia que alguien anota una peticion de hace tres dias para dejar
   * constancia y despublica sin querer.
   *
   * SE BORRA EL ULTIMO AVISO al cambiar la fecha, para que el barrido vuelva
   * a contar desde cero: si no, mover la peticion a otro dia dejaria la
   * primera notificacion sin repetir.
   */
  async setRemovalRequest(
    id: string,
    requestedAt: string | null,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<StoredMediaConsent> {
    const anterior = await this.exigirQueExista(id);

    const fila = await this.prisma.db.$transaction(async (tx) => {
      const guardada = await tx.mediaConsent.update({
        where: { id },
        data: {
          removalRequestedAt: requestedAt === null ? null : new Date(`${requestedAt}T00:00:00Z`),
          removalReminderSentAt: null,
          updatedByStaffId: staff.staffId,
        },
        include: { updatedBy: { select: { firstName: true, lastName: true } } },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action:
            requestedAt === null
              ? 'media_consent.removal_request_cancelled'
              : 'media_consent.removal_requested',
          entityType: 'media_consent',
          entityId: id,
          /*
           * La fecha SI entra: es la que decide si la promesa se cumplio, y
           * es el dato que hara falta el dia que alguien pregunte. El nombre
           * y la direccion siguen fuera, como en todo este registro.
           */
          metadata: {
            reference: anterior.reference,
            requestedAt,
            removalDays: anterior.removalDays,
          },
          ipAddress,
        },
        tx,
      );

      return guardada;
    });

    return aFicha(fila);
  }

  /**
   * Las peticiones de retirada que siguen abiertas.
   *
   * ========================================================================
   * DEVUELVE CUATRO COLUMNAS Y NO LA FICHA
   * ========================================================================
   * Quien llama a esto es el barrido que avisa, y lo que manda por correo y
   * por Telegram es la referencia y el plazo. Cargar la ficha entera traeria
   * el nombre del cliente y la direccion de su casa a un proceso que no los
   * necesita — y lo que no se carga no se puede filtrar por error a un canal
   * que no deberia verlo.
   *
   * Se pregunta a la base y no se filtra en memoria sobre `list()` porque el
   * barrido corre cada hora para encontrar, casi siempre, nada: ese es el
   * caso que conviene que sea barato. Hay un indice parcial con exactamente
   * esta condicion.
   */
  async retiradasPendientes(): Promise<RetiradaPendiente[]> {
    const filas = await this.prisma.db.mediaConsent.findMany({
      where: { removalRequestedAt: { not: null }, revokedAt: null },
      orderBy: { removalRequestedAt: 'asc' },
      select: {
        id: true,
        reference: true,
        removalDays: true,
        removalRequestedAt: true,
        removalReminderSentAt: true,
      },
    });

    return filas.flatMap((fila) =>
      fila.removalRequestedAt === null
        ? []
        : [
            {
              id: fila.id,
              reference: fila.reference,
              removalDays: fila.removalDays,
              requestedAt: soloFecha(fila.removalRequestedAt),
              reminderSentAt: fila.removalReminderSentAt?.toISOString() ?? null,
            },
          ],
    );
  }

  /** Deja constancia de que ya se aviso de estas, para no repetirlo hoy. */
  async marcarAvisadas(ids: readonly string[], cuando: Date): Promise<void> {
    if (ids.length === 0) return;

    await this.prisma.db.mediaConsent.updateMany({
      where: { id: { in: [...ids] } },
      data: { removalReminderSentAt: cuando },
    });
  }

  private async exigirQueExista(id: string) {
    const fila = await this.prisma.db.mediaConsent.findUnique({ where: { id } });
    if (!fila) throw new NotFoundException('Ese permiso no existe');
    return fila;
  }
}

/* ------------------------------------------------------------------------ */

/** Lo que el contrato dice, listo para la base. */
function aFila(consent: MediaConsent) {
  return {
    reference: consent.reference,
    evidenceKind: consent.evidenceKind,
    customerName: consent.customerName,
    customerEmail: consent.customerEmail,
    customerLocale: consent.customerLocale,
    propertyAddress: consent.propertyAddress,
    occupiedByOthers: consent.occupiedByOthers,
    occupantConsent: consent.occupantConsent,
    // Las fechas van sin hora: es lo que hay escrito en un papel.
    serviceDate: new Date(`${consent.serviceDate}T00:00:00Z`),
    signedAt: new Date(`${consent.signedAt}T00:00:00Z`),
    coversInterior: consent.coversInterior,
    coversExterior: consent.coversExterior,
    allowsBefore: consent.allowsBefore,
    channels: consent.channels,
    removalDays: consent.removalDays,
    videoIds: consent.videoIds,
    photoPaths: consent.photoPaths,
    notes: consent.notes,
  };
}

interface FilaConAutor {
  id: string;
  reference: string;
  evidenceKind: string;
  customerName: string;
  customerEmail: string | null;
  customerLocale: string;
  propertyAddress: string;
  occupiedByOthers: boolean;
  occupantConsent: boolean;
  serviceDate: Date;
  signedAt: Date;
  coversInterior: boolean;
  coversExterior: boolean;
  allowsBefore: boolean;
  channels: string[];
  removalDays: number;
  videoIds: string[];
  photoPaths: string[];
  notes: string | null;
  evidencePath: string | null;
  removalTokenHash: string | null;
  removalRequestedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: { firstName: string; lastName: string } | null;
}

/** De la base a la ficha que lee el panel. */
function aFicha(fila: FilaConAutor): StoredMediaConsent {
  /*
   * Se valida LO QUE SALE, no solo lo que entra. Una fila escrita a mano
   * desde una consola no paso por el contrato, y aqui se nota antes de que
   * el panel intente pintarla.
   */
  const consent = MediaConsentSchema.parse({
    reference: fila.reference,
    evidenceKind: fila.evidenceKind,
    customerName: fila.customerName,
    customerEmail: fila.customerEmail,
    customerLocale: fila.customerLocale,
    propertyAddress: fila.propertyAddress,
    occupiedByOthers: fila.occupiedByOthers,
    occupantConsent: fila.occupantConsent,
    serviceDate: soloFecha(fila.serviceDate),
    signedAt: soloFecha(fila.signedAt),
    coversInterior: fila.coversInterior,
    coversExterior: fila.coversExterior,
    allowsBefore: fila.allowsBefore,
    channels: fila.channels,
    removalDays: fila.removalDays,
    videoIds: fila.videoIds,
    photoPaths: fila.photoPaths,
    notes: fila.notes,
  });

  return {
    id: fila.id,
    consent,
    evidencePath: fila.evidencePath,
    /*
     * SE DICE QUE HAY ENLACE, NUNCA CUAL. El panel necesita saber si este
     * cliente tiene salida automatica —para no prometersela si no la
     * tiene—, pero el resumen del testigo no sale de esta funcion: una
     * pantalla que lo recibiera lo dejaria en la memoria de un navegador.
     */
    hasRemovalLink: fila.removalTokenHash !== null,
    removalRequestedAt:
      fila.removalRequestedAt === null ? null : soloFecha(fila.removalRequestedAt),
    revokedAt: fila.revokedAt?.toISOString() ?? null,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
    updatedBy: fila.updatedBy
      ? `${fila.updatedBy.firstName} ${fila.updatedBy.lastName}`.trim()
      : null,
  };
}

/**
 * Comprueba que los bytes son de verdad lo que dicen ser.
 *
 * LO QUE MANDA SON LOS BYTES, NO LA CABECERA. Quien sube elige lo que pone
 * en `Content-Type`, asi que confiar en ella es no comprobar nada: llamar
 * `application/pdf` a un SVG colaria un documento con JavaScript dentro.
 *
 * A las imagenes se les quitan ademas los metadatos. Aqui el archivo no se
 * publica, asi que las coordenadas de dentro no se ensenarian a nadie; se
 * quitan igual porque el habito tiene que ser el mismo en los dos almacenes
 * o un dia se olvida en el que si publica.
 *
 * El PDF se guarda tal cual: no hay forma honesta de limpiarlo sin una
 * libreria que lo entienda entero, y meter una para esto seria cambiar un
 * riesgo pequeno por una dependencia grande. Lo que se comprueba es que
 * EMPIEZA como un PDF, que es lo que impide colar otra cosa con ese nombre.
 */
function revisarBytes(
  bytes: Uint8Array,
  declarado: ConsentEvidenceType,
): { tipo: ConsentEvidenceType; bytes: Uint8Array } | null {
  if (declarado === 'application/pdf') {
    return esPdf(bytes) ? { tipo: 'application/pdf', bytes } : null;
  }

  const limpia = stripImageMetadata(bytes);
  if (!limpia.ok) return null;

  return { tipo: `image/${limpia.format}`, bytes: limpia.bytes };
}

/** `%PDF-`, los cinco bytes con los que empieza todo PDF. */
function esPdf(bytes: Uint8Array): boolean {
  const firma = [0x25, 0x50, 0x44, 0x46, 0x2d];
  if (bytes.length < firma.length) return false;
  return firma.every((byte, i) => bytes[i] === byte);
}

/** `AAAA-MM-DD` en UTC, que es como se guardo. */
function soloFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Lo que va al registro de auditoria.
 *
 * NI EL NOMBRE NI LA DIRECCION. El registro se consulta, se exporta y se
 * ensena; de ahi vendria el problema. La referencia del papel y cuantas
 * piezas ampara bastan para responder a lo que se pregunta.
 */
function resumen(consent: MediaConsent) {
  return {
    reference: consent.reference,
    evidenceKind: consent.evidenceKind,
    videos: consent.videoIds.length,
    photos: consent.photoPaths.length,
    allowsBefore: consent.allowsBefore,
  };
}
