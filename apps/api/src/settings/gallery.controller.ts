import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Gallery } from '@freshness/types';
import { GalleryService } from './gallery.service';

/**
 * LA GALERIA PUBLICA
 * ------------------
 * Los videos de antes y despues, tal y como salen en la portada.
 *
 * Es publico a proposito y no filtra nada: son identificadores de videos que
 * ya estan publicados en YouTube y titulos escritos para leerse. Lo que NO
 * sale por aqui es quien los puso ni cuando, que si es informacion interna.
 */
@Controller('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  /**
   * Mismo trato de cache que el resto de los datos publicos, con una
   * diferencia que importa: la ventana es corta a proposito.
   *
   * Un cliente puede revocar su consentimiento, y la empresa promete retirar
   * el material en unos dias. Una cache larga en el navegador alargaria esa
   * promesa sin que nadie lo notara.
   */
  @Get()
  @SkipThrottle({ quotes: true })
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  get(): Promise<Gallery> {
    return this.gallery.get();
  }
}
