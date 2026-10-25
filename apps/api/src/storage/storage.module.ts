import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { IMAGE_STORAGE, type ImageStorage } from './storage.types';
import { DOCUMENT_STORAGE, type DocumentStorage } from './document-storage.types';
import { MemoryImageStorageProvider } from './providers/memory-image-storage.provider';
import { SupabaseImageStorageProvider } from './providers/supabase-image-storage.provider';
import { MemoryDocumentStorageProvider } from './providers/memory-document-storage.provider';
import { SupabaseDocumentStorageProvider } from './providers/supabase-document-storage.provider';

/**
 * Selecciona los almacenes segun STORAGE_PROVIDER.
 * Es el unico punto del sistema que conoce las implementaciones.
 *
 * SON DOS ALMACENES Y NO UNO, y no por tamano: el de la galeria es PUBLICO
 * de lectura —son imagenes hechas para que las vea todo internet— y el de
 * las pruebas es PRIVADO, porque lleva nombres, direcciones y firmas. Lo que
 * los separa es quien puede verlos, asi que ni comparten bucket ni comparten
 * interfaz: el puerto privado no tiene `publicUrl`, de modo que publicar por
 * error la firma de un cliente no es algo que se pueda escribir.
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
    {
      provide: DOCUMENT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): DocumentStorage => {
        if (config.get('STORAGE_PROVIDER', { infer: true }) === 'supabase') {
          return new SupabaseDocumentStorageProvider({
            url: config.get('SUPABASE_URL', { infer: true }),
            serviceRoleKey: config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
            bucket: config.get('CONSENT_EVIDENCE_BUCKET', { infer: true }),
            timeoutMs: config.get('STORAGE_TIMEOUT_MS', { infer: true }),
          });
        }

        return new MemoryDocumentStorageProvider();
      },
    },
  ],
  exports: [IMAGE_STORAGE, DOCUMENT_STORAGE],
})
export class StorageModule {}
