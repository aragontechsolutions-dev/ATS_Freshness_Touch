import { Body, Controller, Get, Put, Req } from '@nestjs/common';
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
