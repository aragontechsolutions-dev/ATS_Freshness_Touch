import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { IMAGE_STORAGE, type ImageStorage } from './storage.types';
import { MemoryImageStorageProvider } from './providers/memory-image-storage.provider';
import { SupabaseImageStorageProvider } from './providers/supabase-image-storage.provider';

/**
 * Selecciona el almacen de imagenes segun STORAGE_PROVIDER.
 * Es el unico punto del sistema que conoce ambas implementaciones.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: IMAGE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): ImageStorage => {
        if (config.get('STORAGE_PROVIDER', { infer: true }) === 'supabase') {
          return new SupabaseImageStorageProvider({
            // La validacion de entorno garantiza que ambas existen en este caso.
            url: config.get('SUPABASE_URL', { infer: true }),
            serviceRoleKey: config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
            bucket: config.get('GALLERY_BUCKET', { infer: true }),
            timeoutMs: config.get('STORAGE_TIMEOUT_MS', { infer: true }),
          });
        }

        if (config.get('NODE_ENV', { infer: true }) === 'production') {
          /*
           * Un aviso imposible de pasar por alto, igual que con el simulador
           * de pagos: con el almacen en memoria las fotos se pierden en cada
           * despliegue y sus direcciones no cargan nada.
           */
          new Logger('StorageModule').error(
            'STORAGE_PROVIDER=memory en produccion: las fotos de la galeria se guardan en ' +
              'memoria y se pierden al reiniciar. Configura STORAGE_PROVIDER=supabase.',
          );
        }

        return new MemoryImageStorageProvider();
      },
    },
  ],
  exports: [IMAGE_STORAGE],
})
export class StorageModule {}
