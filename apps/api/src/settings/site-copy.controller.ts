import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { SiteCopy } from '@freshness/types';
import { SiteCopyService } from './site-copy.service';

/**
 * TEXTOS PUBLICOS DEL SITIO
 * -------------------------
 * Las promesas y las preguntas frecuentes, tal y como la empresa quiere que
 * aparezcan.
 *
 * Es publico a proposito y no filtra nada: son literalmente las frases que
 * salen impresas en la portada. Lo que NO sale por aqui es quien las escribio
 * ni cuando, que si es informacion interna.
 *
 * DEVUELVE SOLO LO CONFIGURADO, no los textos del codigo. Un texto que la
 * empresa no ha tocado simplemente no viene, y el sitio usa el suyo. La
 * alternativa —que la API devolviera los veinte textos ya resueltos— movería
 * las traducciones al servidor y obligaría a desplegar la API para corregir
 * una errata del sitio.
 */
@Controller('site-copy')
export class SiteCopyController {
  constructor(private readonly copy: SiteCopyService) {}

  /**
   * Mismo trato de cache que el resto de los datos publicos: el sitio lo pide
   * en cada visita, asi que se exime del limitador de cotizaciones y se deja
   * guardar cinco minutos.
   *
   * `stale-while-revalidate` importa aqui mas que en ningun otro sitio: si la
   * API tarda justo cuando caduca, el visitante sigue leyendo las promesas de
   * antes en vez de ver la portada cambiar de texto delante de sus ojos.
   */
  @Get()
  @SkipThrottle({ quotes: true })
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  get(): Promise<SiteCopy> {
    return this.copy.get();
  }
}
