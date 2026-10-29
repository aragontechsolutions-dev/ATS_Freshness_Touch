import { Controller, Get, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import type { ErrorRecorder } from '../common/filters/error-recorder';
import { ErrorMonitorService } from './error-monitor.service';

/**
 * LA CADENA ENTERA, CON PETICIONES DE VERDAD
 * ==========================================
 * Las pruebas de `error-monitor.test.ts` llaman a `anotar` a mano, asi que
 * demuestran la regla pero no el CABLE. Y el cable es la mitad que puede
 * romperse sin que nada se queje: si el filtro dejara de llamar al contador,
 * o si Express dejara de poner el patron de la ruta donde se lee, la alarma
 * se quedaria muda para siempre y el panel diria «ningun error» con toda la
 * tranquilidad del mundo. Una alarma que no suena se ve igual que un sistema
 * sano.
 *
 * Por eso aqui hay una aplicacion de verdad, con una ruta que revienta a
 * proposito, y se mira lo que quedo anotado.
 *
 * NO HACE FALTA BASE DE DATOS: el contador vive en memoria. Es, de paso, la
 * demostracion de por que vive en memoria —el dia que la base no responda,
 * esto seguira contando.
 */

@Controller('revienta')
class ControladorQueRevienta {
  @Get()
  ahora(): string {
    throw new Error('revienta a proposito');
  }

  @Get(':bookingId')
  conId(): string {
    /*
     * El identificador de la peticion NO se usa para nada: esta ruta existe
     * para comprobar que lo que se anota es el patron `:bookingId` y no el
     * valor que llego.
     */
    throw new TypeError('revienta a proposito, con identificador');
  }
}

@Module({ controllers: [ControladorQueRevienta] })
class ModuloQueRevienta {}

/** Una reserva de verdad, con la forma que tienen las de este sistema. */
const RESERVA = '8f2c1a94-1d3e-4f55-9b77-2c0a5e6d7f88';

async function montar(contador: ErrorRecorder | null): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [ModuloQueRevienta] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter(contador));
  await app.init();
  return app;
}

describe('un error de verdad llega al contador', () => {
  let app: INestApplication;
  const monitor = new ErrorMonitorService();

  beforeAll(async () => {
    app = await montar(monitor);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    monitor.reset();
  });

  it('una excepcion no controlada se responde con 500 y se cuenta', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/revienta');

    expect(respuesta.status).toBe(500);
    expect(monitor.comprobacion().count).toBe(1);
    expect(monitor.informe().samples[0]?.fingerprint).toBe('GET /api/v1/revienta Error');
  });

  it('EL IDENTIFICADOR DE LA RESERVA NO ENTRA: se anota el patron', async () => {
    /*
     * ESTA ES LA PRUEBA DE SEGURIDAD DE LA ETAPA, y la razon de que exista
     * este archivo. Lo que se lee del lado de Express es
     * `request.route.path`, que es el patron escrito en el codigo; lo facil
     * —y lo que pasaria si alguien lo cambiara por comodidad— es leer
     * `request.url`, que trae el identificador dentro. Esa huella acabaria
     * en una pantalla de navegador.
     */
    const respuesta = await request(app.getHttpServer()).get(`/api/v1/revienta/${RESERVA}`);

    expect(respuesta.status).toBe(500);

    const huella = monitor.informe().samples[0]?.fingerprint;

    expect(huella).toBe('GET /api/v1/revienta/:bookingId TypeError');
    expect(huella).not.toContain(RESERVA);
  });

  it('y el mensaje del error tampoco sale en la respuesta', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/revienta');
    const cuerpo = JSON.stringify(respuesta.body);

    expect(cuerpo).not.toContain('a proposito');
    expect(cuerpo).not.toContain('revienta');
  });

  it('una ruta que no existe es un 404 y NO se cuenta', async () => {
    /*
     * Un robot buscando agujeros genera cientos de estos al dia. Si contaran,
     * la alarma sonaria cada manana y en dos semanas nadie la leeria.
     */
    const respuesta = await request(app.getHttpServer()).get('/api/v1/no-existe-esta-ruta');

    expect(respuesta.status).toBe(404);
    expect(monitor.comprobacion().state).toBe('ok');
    expect(monitor.informe().samples).toHaveLength(0);
  });

  it('dos peticiones distintas a la misma ruta son un solo problema', async () => {
    await request(app.getHttpServer()).get(`/api/v1/revienta/${RESERVA}`);
    await request(app.getHttpServer()).get('/api/v1/revienta/0000ffff-0000-4000-8000-00000000abcd');

    const informe = monitor.informe();

    expect(informe.samples).toHaveLength(1);
    expect(informe.samples[0]?.count).toBe(2);
  });
});

describe('si el contador revienta, la peticion se responde igual', () => {
  /*
   * EL VIGILANTE NO PUEDE MATAR A LO QUE VIGILA.
   *
   * Esto corre DENTRO del manejador de errores, antes de escribir la
   * respuesta. Una excepcion aqui dejaria la peticion sin contestar: el
   * cliente esperando hasta que el proxy corte, y una pantalla en blanco,
   * por no haber podido apuntar un numero.
   *
   * Es el mismo razonamiento que ya esta escrito en la alarma de estado y en
   * los barridos, y la razon de que `anotar` prometa no lanzar y de que
   * quien la llama la envuelva de todas formas.
   */
  let app: INestApplication;

  beforeAll(async () => {
    app = await montar({
      anotar: () => {
        throw new Error('el contador esta roto');
      },
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('la respuesta de error sale completa', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/revienta');

    expect(respuesta.status).toBe(500);
    expect(respuesta.body).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });
});

describe('sin contador tambien funciona', () => {
  /*
   * El filtro se construye a mano en las pruebas que solo miran la forma de
   * la respuesta (`body-parsers.e2e.test.ts`). Si el contador fuera
   * obligatorio, cada una de esas pruebas tendria que montar medio modulo
   * para comprobar un codigo HTTP.
   */
  let app: INestApplication;

  beforeAll(async () => {
    app = await montar(null);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('responde 500 sin contar nada', async () => {
    expect((await request(app.getHttpServer()).get('/api/v1/revienta')).status).toBe(500);
  });
});
