import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Env } from './common/config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });

  const config = app.get(ConfigService<Env, true>);
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  const port = config.get('PORT', { infer: true });
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });

  // --- Cabeceras de seguridad -----------------------------------------------
  // La API solo devuelve JSON, asi que se puede aplicar una CSP muy restrictiva.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // --- CORS: lista blanca explicita, nunca "*" -------------------------------
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 86400,
  });

  // --- Limite de tamano del cuerpo ------------------------------------------
  // Una cotizacion valida ocupa menos de 1 KB; 16 KB es margen de sobra y
  // evita que alguien intente saturar el servidor con cuerpos enormes.
  app.useBodyParser('json', { limit: '16kb' });

  // Render (y cualquier proxy) reenvia la IP real en X-Forwarded-For.
  // Sin esto el limitador de peticiones veria una sola IP para todo el mundo.
  app.set('trust proxy', 1);

  // Se excluyen ambas rutas: `exclude` compara la ruta exacta, asi que
  // indicar solo "health" dejaria /health/ready colgando del prefijo.
  app.setGlobalPrefix(config.get('API_PREFIX', { infer: true }), {
    exclude: ['health', 'health/ready'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  logger.log(`Freshness Touch API escuchando en el puerto ${port} (entorno: ${nodeEnv})`);
  logger.log(`Proveedor de distancia: ${config.get('DISTANCE_PROVIDER', { infer: true })}`);
  logger.log(`Origenes CORS permitidos: ${corsOrigins.join(', ')}`);
}

void bootstrap();
