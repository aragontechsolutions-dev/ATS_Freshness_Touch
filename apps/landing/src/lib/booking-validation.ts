/**
 * VALIDACION DEL FORMULARIO DE RESERVA
 * ------------------------------------
 * Esta validacion es para el usuario, no para la seguridad: sirve para avisar
 * de un error antes de enviar, no para proteger nada. La comprobacion que de
 * verdad cuenta es la del servidor, que vuelve a validar todo con el mismo
 * esquema estricto aunque aqui se salte.
 *
 * Cada campo devuelve una CLAVE de traduccion, no un texto: el mensaje se
 * elige en el idioma activo en el momento de mostrarlo.
 */

export interface BookingDetailsForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  accessNotes: string;
  customerNotes: string;
  marketingOptIn: boolean;
}

export type DetailsErrors = Partial<Record<keyof BookingDetailsForm, string>>;

export const EMPTY_DETAILS: BookingDetailsForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: 'GA',
  postalCode: '',
  accessNotes: '',
  customerNotes: '',
  marketingOptIn: false,
};

/**
 * Correo electronico.
 *
 * Deliberadamente permisivo: las direcciones reales admiten mucho mas de lo
 * que suele aceptar una expresion regular estricta, y rechazar un correo
 * valido pierde un cliente. Solo se descarta lo que seguro que es un error.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Caracteres que puede llevar un telefono escrito por una persona. */
const PHONE_CHARS = /^[+()\d\s.-]+$/;

export function validateDetails(form: BookingDetailsForm): DetailsErrors {
  const errors: DetailsErrors = {};

  if (form.firstName.trim().length === 0) errors.firstName = 'booking.errorRequired';
  if (form.lastName.trim().length === 0) errors.lastName = 'booking.errorRequired';

  const email = form.email.trim();
  if (email.length === 0) errors.email = 'booking.errorRequired';
  else if (!EMAIL.test(email) || email.length > 160) errors.email = 'booking.errorEmail';

  const phone = form.phone.trim();
  if (phone.length === 0) errors.phone = 'booking.errorRequired';
  else if (!PHONE_CHARS.test(phone) || !hasUsPhoneDigits(phone))
    errors.phone = 'booking.errorPhone';

  if (form.line1.trim().length < 3) errors.line1 = 'booking.errorRequired';
  if (form.city.trim().length < 2) errors.city = 'booking.errorRequired';
  if (!/^\d{5}$/.test(form.postalCode.trim())) errors.postalCode = 'booking.errorPostalCode';
  if (!/^[A-Za-z]{2}$/.test(form.state.trim())) errors.state = 'booking.errorRequired';

  return errors;
}

/**
 * Un telefono de EE. UU. tiene 10 digitos, u 11 si se escribe con el prefijo
 * de pais. Comprobarlo evita el error mas comun (dejarse un digito), que
 * dejaria a la empresa sin forma de avisar de un retraso.
 */
function hasUsPhoneDigits(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return true;
  return digits.length === 11 && digits.startsWith('1');
}

/** Formatea mientras se escribe: (404) 555-0123. */
export function formatUsPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  const sinPrefijo = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (sinPrefijo.length <= 3) return sinPrefijo;
  if (sinPrefijo.length <= 6) return `(${sinPrefijo.slice(0, 3)}) ${sinPrefijo.slice(3)}`;
  return `(${sinPrefijo.slice(0, 3)}) ${sinPrefijo.slice(3, 6)}-${sinPrefijo.slice(6, 10)}`;
}

/** true si no hay ningun error. */
export function isValid(errors: DetailsErrors): boolean {
  return Object.keys(errors).length === 0;
}
