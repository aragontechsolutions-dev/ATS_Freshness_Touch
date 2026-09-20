import {
  API_ERROR_CODES,
  ApiErrorSchema,
  AvailabilityResponseSchema,
  BookingResponseSchema,
  CatalogResponseSchema,
  MockPaymentConfirmResponseSchema,
  QuoteResponseSchema,
  type ApiError,
  type AvailabilityResponse,
  type BookingRequestInput,
  type BookingResponse,
  type CatalogResponse,
  type MockPaymentConfirmRequestInput,
  type MockPaymentConfirmResponse,
  type QuoteAddOnInput,
  type QuoteRequestInput,
  type QuoteResponse,
  type ServiceType,
} from '@freshness/types';

/** Prefijo de version que sirve la API. */
const API_PREFIX = '/api/v1';

/**
 * Normaliza la direccion de la API.
 *
 * Tolera el error de configuracion mas comun: poner solo el dominio
 * (https://api.ejemplo.com) y olvidar el prefijo de version. Sin esto, todas
 * las peticiones responden 404 y el sitio parece roto aunque la API funcione
 * perfectamente; con esto, ambas formas valen.
 *
 * Solo se anade el prefijo cuando la direccion NO tiene ninguna ruta: si
 * alguien configura un prefijo distinto a proposito, se respeta.
 */
export function normalizeApiBaseUrl(raw: string): string {
  const sinBarraFinal = raw.trim().replace(/\/+$/, '');

  try {
    const url = new URL(sinBarraFinal);
    return url.pathname === '/' || url.pathname === ''
      ? `${url.origin}${API_PREFIX}`
      : sinBarraFinal;
  } catch {
    // No es una URL absoluta (por ejemplo una ruta relativa): se deja igual.
    return sinBarraFinal;
  }
}

const BASE_URL: string = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1',
);

/** Error normalizado de la API, con la clave i18n que debe mostrarse. */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    readonly messageKey: string,
    readonly fields: { path: string; message: string }[] = [],
    readonly statusCode?: number,
  ) {
    super(`${code}: ${messageKey}`);
    this.name = 'ApiClientError';
  }
}

const networkError = (): ApiClientError =>
  new ApiClientError('NETWORK_ERROR', 'calculator.errorNetwork');

async function request<T>(
  path: string,
  init: RequestInit,
  parse: (payload: unknown) => T,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch {
    // Incluye caida de red, CORS y peticion abortada por el usuario.
    throw networkError();
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw networkError();
  }

  if (!response.ok) {
    if (response.status === 404) {
      // Casi siempre es configuracion, no un fallo de la API: ayuda a
      // diagnosticarlo sin tener que leer el codigo.
      console.error(
        `[Freshness Touch] La API respondio 404 en ${BASE_URL}${path}. ` +
          'Revisa VITE_API_BASE_URL: debe incluir el prefijo /api/v1.',
      );
    }

    const parsed = ApiErrorSchema.safeParse(payload);
    const apiError: ApiError = parsed.success
      ? parsed.data
      : {
          statusCode: response.status,
          code: API_ERROR_CODES.INTERNAL_ERROR,
          messageKey: 'calculator.errorGeneric',
        };

    throw new ApiClientError(
      apiError.code,
      apiError.messageKey,
      apiError.fields ?? [],
      apiError.statusCode,
    );
  }

  return parse(payload);
}

/**
 * Las respuestas se validan tambien en el cliente. No es desconfianza del
 * servidor: es una red de seguridad ante cambios de contrato entre versiones
 * desplegadas (el front y la API se despliegan por separado).
 */
export function fetchCatalog(signal?: AbortSignal): Promise<CatalogResponse> {
  return request('/pricing/catalog', { method: 'GET', signal }, (payload) => {
    const parsed = CatalogResponseSchema.safeParse(payload);
    if (!parsed.success) throw new ApiClientError('BAD_CONTRACT', 'calculator.errorGeneric');
    return parsed.data;
  });
}

export function requestQuote(
  body: QuoteRequestInput,
  signal?: AbortSignal,
): Promise<QuoteResponse> {
  return request(
    '/quotes/estimate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
    (payload) => {
      const parsed = QuoteResponseSchema.safeParse(payload);
      if (!parsed.success) throw new ApiClientError('BAD_CONTRACT', 'calculator.errorGeneric');
      return parsed.data;
    },
  );
}

/** Consulta de franjas libres para un dia y un trabajo concretos. */
export interface AvailabilityQuery {
  /** AAAA-MM-DD en la zona horaria de la empresa. */
  date: string;
  service: ServiceType;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  addOns: QuoteAddOnInput[];
}

/**
 * Los extras viajan como "INSIDE_OVEN:1,LAUNDRY:2".
 *
 * La API analiza la cadena de consulta en modo simple y no entiende la
 * notacion con corchetes, asi que un array de objetos se perderia por el
 * camino y la duracion estimada saldria corta.
 */
function encodeAddOns(addOns: QuoteAddOnInput[]): string {
  return addOns.map((addOn) => `${addOn.code}:${addOn.quantity}`).join(',');
}

export function fetchAvailability(
  query: AvailabilityQuery,
  signal?: AbortSignal,
): Promise<AvailabilityResponse> {
  const params = new URLSearchParams({
    date: query.date,
    service: query.service,
    bedrooms: String(query.bedrooms),
    bathrooms: String(query.bathrooms),
    squareFeet: String(query.squareFeet),
  });

  if (query.addOns.length > 0) {
    params.set('addOns', encodeAddOns(query.addOns));
  }

  return request(`/availability?${params.toString()}`, { method: 'GET', signal }, (payload) => {
    const parsed = AvailabilityResponseSchema.safeParse(payload);
    if (!parsed.success) throw new ApiClientError('BAD_CONTRACT', 'calculator.errorGeneric');
    return parsed.data;
  });
}

/**
 * Crea la reserva.
 *
 * El cuerpo NO lleva precios: solo las caracteristicas del trabajo, la franja,
 * la direccion y el contacto. El importe y el deposito los calcula el servidor.
 */
export function createBooking(
  body: BookingRequestInput,
  signal?: AbortSignal,
): Promise<BookingResponse> {
  return request(
    '/bookings',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
    (payload) => {
      const parsed = BookingResponseSchema.safeParse(payload);
      if (!parsed.success) throw new ApiClientError('BAD_CONTRACT', 'booking.errorTitle');
      return parsed.data;
    },
  );
}

/**
 * Confirma la tarjeta cuando el proveedor activo es el simulador.
 *
 * Con Stripe este endpoint no existe (responde 404) y quien confirma la
 * tarjeta es el navegador contra los servidores de Stripe.
 */
export function confirmMockPayment(
  body: MockPaymentConfirmRequestInput,
  signal?: AbortSignal,
): Promise<MockPaymentConfirmResponse> {
  return request(
    '/payments/mock/confirm',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
    (payload) => {
      const parsed = MockPaymentConfirmResponseSchema.safeParse(payload);
      if (!parsed.success) throw new ApiClientError('BAD_CONTRACT', 'booking.errorTitle');
      return parsed.data;
    },
  );
}
