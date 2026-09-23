import {
  AdminBookingDetailSchema,
  AdminBookingListSchema,
  AdminStaffListSchema,
  AdminStaffDirectorySchema,
  AdminStaffDirectoryItemSchema,
  AdminBusinessSettingsSchema,
  API_ERROR_CODES,
  NotificationSettingsSchema,
  ApiErrorSchema,
  AuthenticatedStaffSchema,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminAssignment,
  type AdminBookingQueryInput,
  type AdminCaptureDepositInput,
  type AdminReleaseDepositInput,
  type AdminBusinessSettings,
  type AdminStaffDirectory,
  type AdminStaffDirectoryItem,
  type AdminStaffList,
  type StaffCreate,
  type StaffUpdate,
  type AdminStatusChangeInput,
  type ApiError,
  type BusinessSettings,
  type NotificationSettings,
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
    /**
     * Detalle por campo que mando la API, cuando lo hay.
     *
     * Se conserva por un caso concreto: al asignar equipo, el choque de
     * horarios trae aqui el nombre de quien choca y con que reserva. Esa
     * pantalla lo pinta; el resto de errores lo ignoran, porque en ellos es
     * texto tecnico que no se le ensena a nadie.
     */
    readonly fields: ApiError['fields'] = undefined,
  ) {
    super(`${code}: ${messageKey}`);
    this.name = 'ApiClientError';
  }
}

/** true cuando la API dice que esta sesión ya no sirve para seguir aquí. */
export function isSessionError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.statusCode === 401 || error.statusCode === 403);
}

/**
 * Por qué deja de servir, que NO es lo mismo y no da igual.
 *
 *   401 — tu sesión ha caducado. Vuelve a entrar y sigues.
 *   403 — has entrado bien, pero tu cuenta no puede ver esto. Volver a entrar
 *         no arregla nada.
 *
 * Confundirlas manda a alguien a reescribir su contraseña una y otra vez ante
 * una puerta que nunca se le va a abrir. Le pasa al personal de limpieza, que
 * tiene cuenta válida y todavía no tiene pantalla propia.
 */
export function sessionLostReason(error: unknown): 'expired' | 'noAccess' {
  return error instanceof ApiClientError && error.statusCode === 403 ? 'noAccess' : 'expired';
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

    throw new ApiClientError(
      apiError.code,
      apiError.messageKey,
      apiError.statusCode,
      apiError.fields,
    );
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

/**
 * Ajustes de avisos.
 *
 * Como la configuración del negocio, la API responde 403 a todo lo que no sea
 * administración. Que el panel no ofrezca la pantalla al resto es comodidad,
 * no seguridad.
 */
export function fetchNotificationSettings(): Promise<NotificationSettings> {
  return request('/admin/notification-settings', (payload) => {
    const parsed = NotificationSettingsSchema.safeParse(payload);
    if (!parsed.success) throw contractError('/admin/notification-settings', parsed.error.issues);
    return parsed.data;
  });
}

export function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<NotificationSettings> {
  return request(
    '/admin/notification-settings',
    (payload) => {
      const parsed = NotificationSettingsSchema.safeParse(payload);
      if (!parsed.success) throw contractError('guardado de avisos', parsed.error.issues);
      return parsed.data;
    },
    { method: 'PUT', body: settings },
  );
}

/**
 * Personal al que se puede asignar un trabajo.
 *
 * La API devuelve solo nombre, apellido y puesto. NO hay correo ni telefono
 * que mostrar aqui porque el servidor no los manda: para elegir a quien va a
 * una casa basta el nombre, y una pantalla que se abre a diario no tiene por
 * que ser la agenda de contacto de la plantilla.
 */
export function fetchAssignableStaff(): Promise<AdminStaffList> {
  return request('/admin/staff', (payload) => {
    const parsed = AdminStaffListSchema.safeParse(payload);
    if (!parsed.success) throw contractError('/admin/staff', parsed.error.issues);
    return parsed.data;
  });
}

/**
 * Reemplaza el equipo entero de una reserva.
 *
 * Va el conjunto completo y no altas y bajas sueltas: "un solo responsable"
 * es una regla sobre el equipo entero, y solo se puede comprobar viendolo
 * entero. Devuelve la reserva ya actualizada, como el resto de acciones.
 */
export function saveAssignments(
  bookingId: string,
  assignments: AdminAssignment[],
): Promise<AdminBookingDetail> {
  return request(`/admin/bookings/${bookingId}/assignments`, parseDetail('asignacion de equipo'), {
    method: 'PUT',
    body: { assignments },
  });
}

/* ------------------------------------------------------------------------ */
/*  Directorio de personal. Solo administracion: la API responde 403 al       */
/*  resto, y el panel ni ofrece la pantalla. Eso es comodidad, no seguridad.  */
/* ------------------------------------------------------------------------ */

const DIRECTORIO = '/admin/staff-directory';

/** Respuesta comun de alta, edicion e invitacion: la ficha ya actualizada. */
function parseFicha(contexto: string) {
  return (payload: unknown): AdminStaffDirectoryItem => {
    const parsed = AdminStaffDirectoryItemSchema.safeParse(payload);
    if (!parsed.success) throw contractError(contexto, parsed.error.issues);
    return parsed.data;
  };
}

export function fetchStaffDirectory(): Promise<AdminStaffDirectory> {
  return request(DIRECTORIO, (payload) => {
    const parsed = AdminStaffDirectorySchema.safeParse(payload);
    if (!parsed.success) throw contractError(DIRECTORIO, parsed.error.issues);
    return parsed.data;
  });
}

/**
 * Da de alta a alguien.
 *
 * NO concede acceso al panel: la ficha nace sin cuenta vinculada. Dar acceso
 * es `inviteStaff`, una accion aparte y deliberada.
 */
export function createStaff(datos: StaffCreate): Promise<AdminStaffDirectoryItem> {
  return request(DIRECTORIO, parseFicha('alta de personal'), { method: 'POST', body: datos });
}

/** Guarda la ficha entera, el estado de alta o baja incluido. */
export function updateStaff(staffId: string, datos: StaffUpdate): Promise<AdminStaffDirectoryItem> {
  return request(`${DIRECTORIO}/${staffId}`, parseFicha('edicion de personal'), {
    method: 'PUT',
    body: datos,
  });
}

/** Manda la invitacion al panel y vincula la cuenta que se crea. */
export function inviteStaff(staffId: string): Promise<AdminStaffDirectoryItem> {
  return request(`${DIRECTORIO}/${staffId}/invite`, parseFicha('invitacion'), { method: 'POST' });
}
