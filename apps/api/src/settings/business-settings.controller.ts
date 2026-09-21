import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { BusinessSettings } from '@freshness/types';
import { BusinessSettingsService } from './business-settings.service';

/**
 * DATOS PUBLICOS DE LA EMPRESA
 * ----------------------------
 * Telefono, correo y horario, tal y como aparecen en el sitio web.
 *
 * Es publico a proposito y no filtra nada: son exactamente los datos que la
 * empresa quiere que cualquiera conozca. Lo que NO sale por aqui es quien los
 * cambio ni cuando, que si es informacion interna.
 *
 * Existe para que el sitio los lea en vivo. La alternativa —incrustarlos al
 * compilar— obligaria a desplegar de nuevo para corregir un telefono, que es
 * justo la dependencia del equipo tecnico que este trabajo viene a eliminar.
 */
@Controller('business-settings')
export class BusinessSettingsController {
  constructor(private readonly settings: BusinessSettingsService) {}

  /**
   * El sitio publico consulta esto en cada visita, asi que se exime del
   * limitador estricto de cotizaciones (que existe por el coste del proveedor
   * de distancia) y se deja que navegadores e intermediarios lo guarden cinco
   * minutos. El limitador general sigue aplicando.
   *
   * `stale-while-revalidate` hace que, si la API tarda o falla justo cuando
   * caduca, el visitante siga viendo el telefono de antes en vez de una
   * seccion de contacto vacia.
   */
  @Get()
  @SkipThrottle({ quotes: true })
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  get(): Promise<BusinessSettings> {
    return this.settings.get();
  }
}
