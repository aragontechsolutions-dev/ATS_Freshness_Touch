import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  Req,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  BusinessSettingsSchema,
  NotificationSettingsSchema,
  PricingRatesSchema,
  ServiceAreaSettingsSchema,
  type AdminBusinessSettings,
  type AdminPricingRates,
  type AdminServiceArea,
  type AuthenticatedStaff,
  type BusinessSettings,
  type NotificationSettings,
  type PricingRates,
  type ServiceAreaSettings,
  AdminCompanyLocation,
  CompanyLocation,
  CompanyLocationSchema,
  AdminSiteCopy,
  SiteCopy,
  SiteCopySchema,
  AdminGallery,
  Gallery,
  GalleryImageKindSchema,
  GalleryPhotoUpload,
  GallerySchema,
} from '@freshness/types';
import type { Request } from 'express';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import { BusinessSettingsService } from '../settings/business-settings.service';
import { PricingRatesService } from '../settings/pricing-rates.service';
import { ServiceAreaService } from '../settings/service-area.service';
import { CompanyLocationService } from '../settings/company-location.service';
import { SiteCopyService } from '../settings/site-copy.service';
import { GalleryService } from '../settings/gallery.service';

/**
 * CONFIGURACION DEL NEGOCIO DESDE EL PANEL
 * ----------------------------------------
 * SOLO ADMINISTRACION, tambien para leer.
 *
 * Que solo administracion pueda ESCRIBIR es lo evidente: el telefono y el
 * correo que hay aqui son los que ve todo el que entra en la web. Quien
 * pudiera cambiarlos podria desviar las llamadas de todos los clientes a otro
 * numero, y el sitio lo anunciaria con total naturalidad. Es una suplantacion
 * de la empresa hecha desde dentro, y no tiene nada que ver con coordinar una
 * agenda.
 *
 * Que solo administracion pueda LEER aqui es menos evidente, porque el
 * telefono es publico. La diferencia es lo que acompana al dato: esta
 * pantalla dice ademas quien lo cambio y cuando, y eso si es informacion
 * interna. Quien solo necesita el telefono lo tiene en el endpoint publico.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/settings`)
export class SettingsAdminController {
  constructor(private readonly settings: BusinessSettingsService) {}

  @Get()
  @Roles('ADMIN')
  get(): Promise<AdminBusinessSettings> {
    return this.settings.getForAdmin();
  }

  /**
   * Guarda la configuracion entera de una vez.
   *
   * Es un PUT y no un PATCH por una razon concreta: el horario es un bloque
   * de siete dias que se edita junto. Aceptar cambios parciales obligaria a
   * fusionar lo enviado con lo guardado, y dos personas editando a la vez
   * acabarian con una semana mitad de cada una, sin que ninguna lo supiera.
   *
   * El esquema va en el parametro del cuerpo, NO en `@UsePipes()`: a nivel de
   * metodo se aplicaria tambien al resto de parametros. Ese error dejo todos
   * los endpoints de acciones devolviendo 400 en la etapa anterior.
   */
  @Put()
  @Roles('ADMIN')
  async update(
    @Body(new ZodValidationPipe<BusinessSettings>(BusinessSettingsSchema))
    settings: BusinessSettings,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminBusinessSettings> {
    await this.settings.update(settings, staff, request.ip);
    return this.settings.getForAdmin();
  }
}

/**
 * AJUSTES DE AVISOS
 * -----------------
 * Mismo criterio que la configuracion del negocio: SOLO ADMINISTRACION, y
 * tambien para leer.
 *
 * Aqui se decide a que telefono llega el aviso de cada reserva nueva y a que
 * buzon la copia de los correos. Quien controla eso puede enterarse de todo
 * lo que entra, o dejar a la empresa sin enterarse de nada apagandolo.
 * Coordinacion mueve la agenda; no decide quien recibe los avisos.
 *
 * NO SE GUARDA NINGUNA CREDENCIAL. Ni la clave del proveedor de correo ni el
 * token del bot: esos viven en el entorno del servidor. El esquema es estricto
 * y rechaza cualquier campo que no conozca, asi que un token no puede colarse
 * en la base de datos ni por descuido.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/notification-settings`)
export class NotificationSettingsController {
  constructor(private readonly notifications: NotificationSettingsService) {}

  @Get()
  @Roles('ADMIN')
  get(): Promise<NotificationSettings> {
    return this.notifications.get();
  }

  @Put()
  @Roles('ADMIN')
  update(
    @Body(new ZodValidationPipe<NotificationSettings>(NotificationSettingsSchema))
    settings: NotificationSettings,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<NotificationSettings> {
    return this.notifications.update(settings, staff, request.ip);
  }
}

/**
 * AREA DE SERVICIO
 * ----------------
 * Hasta donde va la empresa y donde el precio sale solo.
 *
 * SOLO ADMINISTRACION, y aqui el motivo es el mas directo de los tres
 * bloques de esta pantalla: CADA RESERVA QUE ENTRE DESPUES SE COBRA CON
 * ESTO. Mover un limite unas millas cambia el recargo de todas las casas de
 * esa franja, y ampliar el precio automatico a trescientas millas haria que
 * el cotizador prometiera cifras para traslados de ocho horas.
 *
 * Coordinacion mueve la agenda; no decide el area de cobertura ni los
 * recargos. Eso es una decision comercial.
 *
 * QUE NO SE PUEDE HACER DESDE AQUI: inventarse zonas. El conjunto de codigos
 * es fijo porque se guarda en cada reserva. Lo que se edita son los limites,
 * los recargos y si cada zona da precio automatico; el contrato ademas
 * rechaza combinaciones que no significan nada —anillos desordenados, o
 * precio automatico mas lejos que donde ya se dijo que no hay—.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/service-area`)
export class ServiceAreaAdminController {
  constructor(private readonly serviceArea: ServiceAreaService) {}

  @Get()
  @Roles('ADMIN')
  get(): Promise<AdminServiceArea> {
    return this.serviceArea.getForAdmin();
  }

  /**
   * Guarda el area entera.
   *
   * PUT y no PATCH por lo mismo que el horario: las zonas son un bloque que
   * solo tiene sentido completo. Sus reglas —que cada anillo llegue mas
   * lejos que el anterior, que el precio automatico no vuelva— son sobre el
   * CONJUNTO, y no se pueden comprobar sobre un cambio suelto.
   */
  @Put()
  @Roles('ADMIN')
  update(
    @Body(new ZodValidationPipe<ServiceAreaSettings>(ServiceAreaSettingsSchema))
    settings: ServiceAreaSettings,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminServiceArea> {
    return this.serviceArea.save(settings, staff, request.ip ?? null);
  }
}

/**
 * LAS TARIFAS
 * -----------
 * SOLO ADMINISTRACION, y aqui el motivo es el mas directo de todo el panel:
 * quien pueda tocar esta pantalla decide cuanto factura la empresa. Un cero
 * de mas en un precio, o un descuento del cincuenta por ciento, no rompen
 * nada: el sistema cotiza, cobra y factura con la cifra equivocada, sin un
 * solo error por ningun sitio. Coordinacion organiza la agenda; no fija
 * precios.
 *
 * QUE NO SE PUEDE HACER DESDE AQUI:
 *
 *   - Poner precio al servicio comercial. No da precio automatico, asi que
 *     cualquier cifra seria decorativa.
 *   - Cambiar si un extra es plano o por unidad, las duraciones, los limites
 *     de validacion o el impuesto. Ver `packages/types/src/pricing-rates.ts`.
 *   - Reescribir una tabla anterior. Cada guardado crea una VERSION NUEVA y
 *     ninguna se borra: es lo que permite reproducir un presupuesto antiguo.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/pricing-rates`)
export class PricingRatesAdminController {
  constructor(private readonly rates: PricingRatesService) {}

  @Get()
  @Roles('ADMIN')
  get(): Promise<AdminPricingRates> {
    return this.rates.getForAdmin();
  }

  /**
   * Guarda una tabla nueva.
   *
   * PUT y no PATCH, y con mas razon que en el resto: las invariantes son
   * sobre el CONJUNTO —que el descuento no baje al subir la frecuencia, que
   * el minimo del deposito no supere al maximo— y no se pueden comprobar
   * sobre un campo suelto.
   *
   * LA VERSION NO VIAJA EN LA PETICION: la pone el servidor. Si la mandara
   * quien llama, dos pestanas abiertas podrian enviar la misma y la segunda
   * machacaria a la primera, que es justo lo que una tabla de solo anadir
   * existe para impedir.
   */
  @Put()
  @Roles('ADMIN')
  update(
    @Body(new ZodValidationPipe<PricingRates>(PricingRatesSchema)) rates: PricingRates,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminPricingRates> {
    return this.rates.save(rates, staff, request.ip ?? null);
  }
}

/**
 * LA UBICACION DE LA EMPRESA
 * --------------------------
 * SOLO ADMINISTRACION, y el motivo es el mismo que el de las tarifas dicho
 * de otra forma: este punto es el ORIGEN DESDE EL QUE SE MIDE TODO. La
 * distancia de cada presupuesto, las millas de traslado que se cobran, la
 * zona que se guarda en cada reserva y el centro del mapa salen de aqui.
 *
 * Moverlo unas millas cambia el recargo de todas las casas de la frontera;
 * moverlo de ciudad cambia el precio de todas. Y no falla por ningun sitio:
 * el sistema sigue cotizando, cobrando y facturando, desde el sitio
 * equivocado. Coordinacion mueve la agenda, no la sede.
 *
 * QUE NO SE PUEDE HACER DESDE AQUI: poner la base fuera de Georgia. El
 * contrato lo rechaza, y esa guardia existe para el dedazo —un signo
 * cambiado deja la empresa en el Tibet y a todos los clientes fuera de
 * area— mas que para el capricho.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/company-location`)
export class CompanyLocationAdminController {
  constructor(private readonly ubicacion: CompanyLocationService) {}

  @Get()
  @Roles('ADMIN')
  get(): Promise<AdminCompanyLocation> {
    return this.ubicacion.getForAdmin();
  }

  /**
   * PUT y no PATCH: las coordenadas, la ciudad y el codigo postal describen
   * UN punto. Dejar cambiar la latitud sin la ciudad permitiria guardar una
   * ficha que se contradice a si misma.
   */
  @Put()
  @Roles('ADMIN')
  update(
    @Body(new ZodValidationPipe<CompanyLocation>(CompanyLocationSchema))
    settings: CompanyLocation,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminCompanyLocation> {
    return this.ubicacion.save(settings, staff, request.ip ?? null);
  }
}

/**
 * LOS TEXTOS DE LA WEB DESDE EL PANEL
 * -----------------------------------
 * SOLO ADMINISTRACION, tambien para leer, y aqui el motivo es mas fuerte que
 * en ninguna otra pantalla de configuracion.
 *
 * Lo que se edita aqui no son ajustes: son COMPROMISOS. "Estamos asegurados",
 * "todo el equipo pasa verificacion de antecedentes", "si no quedas conforme
 * volvemos en 24 horas". Quien pueda cambiarlos puede hacer que la empresa
 * prometa por escrito, a todo el que entre en la web, algo que no piensa
 * cumplir —o borrar una promesa que si cumple y perder ventas—. Eso no tiene
 * nada que ver con coordinar una agenda, que es lo que hace coordinacion.
 *
 * Leer tambien queda restringido por lo de siempre: el texto es publico, pero
 * esta pantalla dice ademas quien lo escribio y cuando. Quien solo necesita
 * el texto lo tiene en el endpoint publico, sin sesion.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/site-copy`)
export class SiteCopyAdminController {
  constructor(private readonly copy: SiteCopyService) {}

  @Get()
  @Roles('ADMIN')
  get(): Promise<AdminSiteCopy> {
    return this.copy.getForAdmin();
  }

  /**
   * PUT y no PATCH: se manda el conjunto entero.
   *
   * Las promesas se reescriben en tandas, porque se contradicen entre si. Si
   * se cambia la garantia a 48 horas hay que tocar tambien la pregunta
   * frecuente que la menciona, y mandarlo todo junto es lo que garantiza que
   * las dos entren o no entre ninguna. Con parches independientes, la web
   * podria quedarse prometiendo 48 horas en la tarjeta y 24 en el FAQ.
   */
  @Put()
  @Roles('ADMIN')
  update(
    @Body(new ZodValidationPipe<SiteCopy>(SiteCopySchema)) copy: SiteCopy,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminSiteCopy> {
    return this.copy.save(copy, staff, request.ip ?? null);
  }
}

/**
 * LA GALERIA DE ANTES Y DESPUES DESDE EL PANEL
 * --------------------------------------------
 * SOLO ADMINISTRACION, tambien para leer.
 *
 * Para escribir, por lo que se publica: el interior de la casa de un cliente.
 * Publicar un video sin el permiso firmado de su propietario es el escenario
 * de demanda mas probable de todo el sistema, y no tiene nada que ver con
 * coordinar una agenda. Coordinacion coordina.
 *
 * Para leer, por lo que acompana al dato: los identificadores son publicos
 * —estan en YouTube—, pero esta pantalla dice ademas quien los puso y cuando.
 * Quien solo necesita la lista la tiene en el endpoint publico, sin sesion.
 *
 * El modelo del consentimiento y lo que nunca puede entrar en el encuadre
 * estan en `docs/38-fotos-y-videos-antes-y-despues.md`.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/gallery`)
export class GalleryAdminController {
  constructor(private readonly gallery: GalleryService) {}

  @Get()
  @Roles('ADMIN')
  get(): Promise<AdminGallery> {
    return this.gallery.getForAdmin();
  }

  /**
   * PUT y no PATCH: se manda la galeria entera.
   *
   * No es por simetria con el resto. Lo que mas va a pasar aqui es RETIRAR un
   * video porque un cliente revoco su permiso, y retirar es una ausencia. Con
   * parches independientes habria que inventar una operacion de borrado, y
   * una peticion de retirada perdida por el camino deja publicada la casa de
   * alguien que pidio que la quitaran. Mandando el conjunto, lo que no viene
   * es que ya no esta.
   */
  @Put()
  @Roles('ADMIN')
  update(
    @Body(new ZodValidationPipe<Gallery>(GallerySchema)) gallery: Gallery,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminGallery> {
    return this.gallery.save(gallery, staff, request.ip ?? null);
  }

  /**
   * SUBIR UNA IMAGEN: una foto de la galeria o la miniatura de un video.
   *
   * Recibe los bytes de la imagen tal cual, sin envoltorio de formulario: el
   * panel manda el archivo como cuerpo y el tipo en la cabecera. Asi no hace
   * falta ninguna libreria de multipart, que para subir un archivo de uno en
   * uno es puro envoltorio.
   *
   * UN SOLO ENDPOINT CON LA CARPETA COMO PARAMETRO, y no dos rutas: lo que
   * cambia entre una foto y una miniatura es UNA carpeta. Con dos rutas
   * habria dos sitios donde comprobar los bytes y quitar los metadatos, y
   * tarde o temprano un arreglo se aplicaria a una y no a la otra.
   *
   * SUBIR NO PUBLICA. Devuelve la ruta y ahi se queda: la imagen no se ve en
   * ningun sitio hasta que esa ruta entra en la galeria con un `PUT`. Es
   * deliberado — deja elegir el titulo y el orden antes de que la casa de
   * nadie aparezca en la portada.
   *
   * 201 y no 200: se ha creado algo.
   */
  @Post('images')
  @Roles('ADMIN')
  @HttpCode(201)
  async uploadImage(
    @Query('kind') kind: unknown,
    @Req() request: Request,
  ): Promise<GalleryPhotoUpload> {
    const carpeta = GalleryImageKindSchema.safeParse(kind);
    if (!carpeta.success) {
      throw new UnsupportedMediaTypeException('Indica si la imagen es una foto o una miniatura');
    }

    /*
     * El lector de cuerpos solo acepta los tres tipos de imagen en esta ruta,
     * asi que cualquier otra cosa llega aqui sin cuerpo. Se distingue de una
     * imagen vacia a proposito: el mensaje tiene que decir que el tipo no
     * vale, no que el archivo este roto.
     */
    const cuerpo: unknown = request.body;
    if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0) {
      throw new UnsupportedMediaTypeException('Manda una imagen JPEG, PNG o WebP');
    }

    const resultado = await this.gallery.uploadImage(cuerpo, carpeta.data);

    if (!resultado.ok) {
      if (resultado.reason === 'storage') {
        throw new ServiceUnavailableException('El almacen de imagenes no esta disponible');
      }
      // Tamano y «no es una imagen» son los dos un problema del archivo que
      // se manda, asi que los dos son un 415 con su propio mensaje.
      throw new UnsupportedMediaTypeException(
        resultado.reason === 'tooBig'
          ? 'La imagen pesa demasiado'
          : 'Eso no es una imagen JPEG, PNG o WebP',
      );
    }

    return { path: resultado.path, url: resultado.url };
  }
}
