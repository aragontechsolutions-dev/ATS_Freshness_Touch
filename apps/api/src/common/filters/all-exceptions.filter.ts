import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { API_ERROR_CODES, type ApiError } from '@freshness/types';
import type { Request, Response } from 'express';
import type { ErrorRecorder } from './error-recorder';

interface StructuredErrorBody {
  code?: string;
  messageKey?: string;
  fields?: { path: string; message: string }[];
}

/**
 * Error del lector del cuerpo de la peticion (cuerpo demasiado grande, JSON
 * roto). No es una HttpException de Nest, asi que sin este caso saldria como
 * un 500: el cliente veria "error del servidor" cuando el fallo es suyo y,
 * peor, un proveedor de pago reintentaria para siempre un evento que nunca
 * vamos a aceptar.
 */
interface BodyParserError {
  type: string;
  status?: number;
  statusCode?: number;
}

function asBodyParserError(exception: unknown): BodyParserError | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const candidate = exception as Partial<BodyParserError>;
  return typeof candidate.type === 'string' && candidate.type.startsWith('entity.')
    ? (candidate as BodyParserError)
    : null;
}

/**
 * El patron de la ruta que Express resolvio, si llego a resolverla.
 *
 * `request.route` no esta en los tipos de Express con una forma util —es
 * `any`— y lo que hay dentro depende de la version. Se lee a mano y con
 * cuidado: si no es una cadena, no hay patron.
 */
function patronDeRuta(request: Request): string | undefined {
  const ruta = (request as Request & { route?: { path?: unknown } }).route;
  return typeof ruta?.path === 'string' ? ruta.path : undefined;
}

/**
 * Convierte cualquier excepcion en la respuesta de error unica de la API.
 *
 * SEGURIDAD: al cliente nunca se le envian stack traces, rutas del servidor
 * ni mensajes internos. Solo un codigo estable y una clave de traduccion.
 * El detalle completo queda en el log del servidor junto al requestId.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  /**
   * SE RECIBE POR CONSTRUCTOR Y ADMITE `null` A PROPOSITO.
   *
   * Este filtro se construye a mano (`new AllExceptionsFilter(...)`) en
   * `main.ts` y en las pruebas, no por inyeccion: es la unica forma de
   * registrarlo antes de que exista el contenedor. Exigir una dependencia
   * obligatoria convertiria cada `new` de cada prueba en un montaje de
   * modulo, y la respuesta de error —que es lo que este archivo garantiza—
   * dejaria de poder probarse sola.
   *
   * Sin contador el filtro responde igual. Lo que no hay es cuenta.
   */
  constructor(private readonly contador: ErrorRecorder | null = null) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiError = {
      statusCode: status,
      code: API_ERROR_CODES.INTERNAL_ERROR,
      messageKey: 'calculator.errorGeneric',
      requestId,
    };

    const bodyError = asBodyParserError(exception);

    if (bodyError) {
      status = bodyError.status ?? bodyError.statusCode ?? HttpStatus.BAD_REQUEST;
      body = {
        statusCode: status,
        code:
          status === HttpStatus.PAYLOAD_TOO_LARGE
            ? API_ERROR_CODES.PAYLOAD_TOO_LARGE
            : API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'calculator.errorGeneric',
        requestId,
      };
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      body = {
        statusCode: status,
        code: API_ERROR_CODES.RATE_LIMITED,
        messageKey: 'calculator.errorRateLimited',
        requestId,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      const structured: StructuredErrorBody =
        typeof payload === 'object' && payload !== null ? (payload as StructuredErrorBody) : {};

      body = {
        statusCode: status,
        code: structured.code ?? defaultCodeFor(status),
        messageKey: structured.messageKey ?? 'calculator.errorGeneric',
        ...(structured.fields ? { fields: structured.fields } : {}),
        requestId,
      };
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId ?? 'sin-id'}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      /*
       * Y ADEMAS SE CUENTA, que es lo que hace que alguien se entere sin
       * entrar a leer el log. Ver `health/error-monitor.service.ts`.
       *
       * ENVUELTO, Y NO POR DESCONFIANZA: esto corre dentro del manejador de
       * errores, antes de responder. Una excepcion aqui dejaria la peticion
       * SIN RESPUESTA —el cliente esperando hasta que el proxy corte— por no
       * haber podido apuntar un numero. El contador que rompe lo que cuenta.
       */
      try {
        this.contador?.anotar({
          status,
          method: request.method,
          // El PATRON, nunca `request.url`: la URL real lleva dentro el
          // identificador de la reserva y la cadena de consulta.
          routePath: patronDeRuta(request),
          errorName: exception instanceof Error ? exception.name : undefined,
        });
      } catch {
        // Ni un log: si el contador falla, lo unico que importa es que la
        // respuesta salga.
      }
    } else {
      this.logger.warn(`[${requestId ?? 'sin-id'}] ${request.method} ${request.url} -> ${status}`);
    }

    response.status(status).json(body);
  }
}

function defaultCodeFor(status: number): string {
  if (status === HttpStatus.NOT_FOUND) return API_ERROR_CODES.NOT_FOUND;
  if (status === HttpStatus.BAD_REQUEST) return API_ERROR_CODES.VALIDATION_ERROR;
  if (status === HttpStatus.TOO_MANY_REQUESTS) return API_ERROR_CODES.RATE_LIMITED;
  return API_ERROR_CODES.INTERNAL_ERROR;
}
