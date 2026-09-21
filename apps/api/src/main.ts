import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { applyBodyParsers } from './common/body-parsers';
import type { Env } from './common/config/env';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    // Conserva los bytes originales de cada peticion. El webhook de pagos los
    // necesita: su firma se calcula sobre ellos y cualquier reserializacion la
    // invalidaria.
    rawBody: true,
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
    // PATCH lo necesita el panel para cambiar el estado de una reserva.
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    /*
     * "Authorization" es imprescindible para el panel: sin declararla aqui el
     * navegador rechaza la peticion despues del preflight, aunque el servidor
     * responda 204. Es un fallo que solo se ve en un navegador de verdad, no
     * con curl ni en los tests de la API.
     */
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 86400,
  });

  // --- Limite de tamano del cuerpo ------------------------------------------
  applyBodyParsers(app, config.get('API_PREFIX', { infer: true }));

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
  logger.log(`Proveedor de pago: ${config.get('PAYMENT_PROVIDER', { infer: true })}`);
  logger.log(`Origenes CORS permitidos: ${corsOrigins.join(', ')}`);
}

void bootstrap();
