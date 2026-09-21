import {
  AdminBookingDetailSchema,
  AdminBookingListSchema,
  AdminBusinessSettingsSchema,
  API_ERROR_CODES,
  ApiErrorSchema,
  AuthenticatedStaffSchema,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingQueryInput,
  type AdminCaptureDepositInput,
  type AdminReleaseDepositInput,
  type AdminBusinessSettings,
  type AdminStatusChangeInput,
  type ApiError,
  type BusinessSettings,
  type AuthenticatedStaff,
} from '@freshness/types';
import { auth } from './supabase';

const API_PREFIX = '/api/v1';

/** Misma tolerancia que el sitio público: si falta el prefijo, se añade. */
function normalizeApiBaseUrl(raw: string): string {
  const sinBarra = raw.trim().replace(/\/+$/, '');
  try {
    const url = new URL(sinBarra);
    return url.pathname === '/' || url.pathname === '' ? `${url.origin}${API_PREFIX}` : sinBarra;
  } catch {
    return sinBarra;
  }
}

const BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1',
);

/**
 * Las respuestas se validan tambien aqui, como red de seguridad ante cambios
 * de contrato entre versiones desplegadas por separado.
 *
 * Cuando falla, el mensaje en pantalla es generico a proposito, pero el
 * detalle va a la consola: sin el, un desajuste de contrato solo se ve como
 * "algo salio mal" y cuesta una tarde averiguar que campo sobra o falta.
 */
function contractError(contexto: string, issues: unknown): ApiClientError {
  console.error(`[Freshness Touch] Respuesta inesperada en ${contexto}:`, issues);
  return new ApiClientError('BAD_CONTRACT', 'admin.errorGeneric', 500);
}

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    readonly messageKey: string,
    readonly statusCode: number,
  ) {
    super(`${code}: ${messageKey}`);
    this.name = 'ApiClientError';
  }
}

/** true cuando la API dice que la sesión ya no vale. */
export function isSessionError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.statusCode === 401 || error.statusCode === 403);
}

/**
 * Petición autenticada a la API.
 *
 * El token se pide a la librería EN CADA LLAMADA, no se guarda en una
 * variable: así se usa siempre el vigente. Si se cacheara, tras una
 * renovación se seguiría enviando el viejo y la API respondería 401 con una
 * sesión que en realidad sigue siendo buena.
 */
async function request<T>(
  path: string,
  parse: (payload: unknown) => T,
  init: { method: 'GET' | 'PATCH' | 'POST' | 'PUT'; body?: unknown } = { method: 'GET' },
): Promise<T> {
  if (!auth) {
    throw new ApiClientError(API_ERROR_CODES.UNAUTHORIZED, 'admin.errorNotConfigured', 401);
  }

  const { data } = await auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new ApiClientError(API_ERROR_CODES.UNAUTHORIZED, 'admin.errorSessionExpired', 401);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      // La API no usa cookies de sesión: el token va en la cabecera. Enviar
      // credenciales de origen cruzado sin necesitarlas abriría la puerta a
      // ataques de petición forzada.
      credentials: 'omit',
      // El panel no debe filtrar a la API desde qué página se llamó.
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new ApiClientError('NETWORK_ERROR', 'admin.errorNetwork', 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError('NETWORK_ERROR', 'admin.errorNetwork', response.status);
  }

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(payload);
    const apiError: ApiError = parsed.success
      ? parsed.data
      : {
          statusCode: response.status,
          code: API_ERROR_CODES.INTERNAL_ERROR,
          messageKey: 'admin.errorGeneric',
        };

    throw new ApiClientError(apiError.code, apiError.messageKey, apiError.statusCode);
  }

  return parse(payload);
}

/** Quién soy y hasta cuándo dura mi sesión, según el servidor. */
export function fetchSession(): Promise<AuthenticatedStaff> {
  return request('/admin/session', (payload) => {
    const parsed = AuthenticatedStaffSchema.safeParse(payload);
    if (!parsed.success) throw contractError('/admin/session', parsed.error.issues);
    return parsed.data;
  });
}

export function fetchBookings(query: AdminBookingQueryInput = {}): Promise<AdminBookingList> {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query)) {
    if (valor !== undefined && valor !== '') params.set(clave, String(valor));
  }
  const sufijo = params.toString();

  return request(`/admin/bookings${sufijo ? `?${sufijo}` : ''}`, (payload) => {
    const parsed = AdminBookingListSchema.safeParse(payload);
    if (!parsed.success) throw contractError('/admin/bookings', parsed.error.issues);
    return parsed.data;
  });
}

export function fetchBookingDetail(bookingId: string): Promise<AdminBookingDetail> {
  return request(`/admin/bookings/${bookingId}`, (payload) => {
    const parsed = AdminBookingDetailSchema.safeParse(payload);
    if (!parsed.success) throw contractError('/admin/bookings/:id', parsed.error.issues);
    return parsed.data;
  });
}

/** Respuesta comun de las acciones: la reserva ya actualizada. */
function parseDetail(contexto: string) {
  return (payload: unknown): AdminBookingDetail => {
    const parsed = AdminBookingDetailSchema.safeParse(payload);
    if (!parsed.success) throw contractError(contexto, parsed.error.issues);
    return parsed.data;
  };
}

/**
 * Cambia el estado de una reserva.
 *
 * Devuelve la reserva ya actualizada, no un "vale": asi el panel pinta el
 * estado real que decidio el servidor en vez de suponer que hizo lo pedido.
 */
export function changeBookingStatus(
  bookingId: string,
  change: AdminStatusChangeInput,
): Promise<AdminBookingDetail> {
  return request(`/admin/bookings/${bookingId}/status`, parseDetail('cambio de estado'), {
    method: 'PATCH',
    body: change,
  });
}

/** Cobra el deposito retenido. Solo administracion. */
export function captureDeposit(
  bookingId: string,
  body: AdminCaptureDepositInput,
): Promise<AdminBookingDetail> {
  return request(
    `/admin/bookings/${bookingId}/payment/capture`,
    parseDetail('cobro del deposito'),
    { method: 'POST', body },
  );
}

/** Libera la retencion sin cobrar. Solo administracion. */
export function releaseDeposit(
  bookingId: string,
  body: AdminReleaseDepositInput,
): Promise<AdminBookingDetail> {
  return request(
    `/admin/bookings/${bookingId}/payment/release`,
    parseDetail('liberacion del deposito'),
    { method: 'POST', body },
  );
}

/**
 * Configuracion del negocio, con quien la cambio por ultima vez.
 *
 * La API responde 403 a todo lo que no sea administracion, asi que el panel
 * ni siquiera ofrece la pantalla al resto. Eso es comodidad, no seguridad: la
 * puerta la cierra el servidor.
 */
export function fetchSettings(): Promise<AdminBusinessSettings> {
  return request('/admin/settings', (payload) => {
    const parsed = AdminBusinessSettingsSchema.safeParse(payload);
    if (!parsed.success) throw contractError('/admin/settings', parsed.error.issues);
    return parsed.data;
  });
}

/**
 * Guarda la configuracion completa.
 *
 * Va entera y no por campos: el horario es un bloque de siete dias que se
 * edita junto, y los cambios parciales acabarian fusionando por detras la
 * semana de dos personas distintas.
 */
export function saveSettings(settings: BusinessSettings): Promise<AdminBusinessSettings> {
  return request(
    '/admin/settings',
    (payload) => {
      const parsed = AdminBusinessSettingsSchema.safeParse(payload);
      if (!parsed.success) throw contractError('guardado de configuracion', parsed.error.issues);
      return parsed.data;
    },
    { method: 'PUT', body: settings },
  );
}
