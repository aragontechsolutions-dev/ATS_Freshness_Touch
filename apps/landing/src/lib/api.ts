import {
  API_ERROR_CODES,
  ApiErrorSchema,
  CatalogResponseSchema,
  QuoteResponseSchema,
  type ApiError,
  type CatalogResponse,
  type QuoteRequestInput,
  type QuoteResponse,
} from '@freshness/types';

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

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
