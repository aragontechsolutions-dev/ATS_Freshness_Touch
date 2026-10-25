import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MediaConsentSchema,
  type AuthenticatedStaff,
  type MediaConsent,
  type StoredMediaConsent,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

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

@Injectable()
export class MediaConsentsService {
  private cached: {
    value: { videoIds: Set<string>; photoPaths: Set<string> };
    expiresAt: number;
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  async create(
    consent: MediaConsent,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<StoredMediaConsent> {
    const fila = await this.prisma.db.$transaction(async (tx) => {
      const creada = await tx.mediaConsent.create({
        data: { ...aFila(consent), updatedByStaffId: staff.staffId },
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
    return aFicha(fila);
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
    customerName: consent.customerName,
    propertyAddress: consent.propertyAddress,
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
  customerName: string;
  propertyAddress: string;
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
    customerName: fila.customerName,
    propertyAddress: fila.propertyAddress,
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
    revokedAt: fila.revokedAt?.toISOString() ?? null,
    createdAt: fila.createdAt.toISOString(),
    updatedAt: fila.updatedAt.toISOString(),
    updatedBy: fila.updatedBy
      ? `${fila.updatedBy.firstName} ${fila.updatedBy.lastName}`.trim()
      : null,
  };
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
    videos: consent.videoIds.length,
    photos: consent.photoPaths.length,
    allowsBefore: consent.allowsBefore,
  };
}
