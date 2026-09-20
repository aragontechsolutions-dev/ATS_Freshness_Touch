import { describe, expect, it } from 'vitest';
import {
  EMPTY_DETAILS,
  formatUsPhone,
  isValid,
  validateDetails,
  type BookingDetailsForm,
} from './booking-validation';

const COMPLETO: BookingDetailsForm = {
  ...EMPTY_DETAILS,
  firstName: 'Ana',
  lastName: 'Perez',
  email: 'ana@example.com',
  phone: '(404) 555-0123',
  line1: '123 Peachtree St NE',
  city: 'Atlanta',
  postalCode: '30303',
};

describe('validacion del formulario de reserva', () => {
  it('acepta un formulario completo', () => {
    expect(validateDetails(COMPLETO)).toEqual({});
    expect(isValid(validateDetails(COMPLETO))).toBe(true);
  });

  it('senala todos los campos obligatorios a la vez', () => {
    // Avisar de uno en uno obliga a enviar el formulario cinco veces.
    const errores = validateDetails(EMPTY_DETAILS);
    expect(Object.keys(errores).sort()).toEqual([
      'city',
      'email',
      'firstName',
      'lastName',
      'line1',
      'phone',
      'postalCode',
    ]);
  });

  it('no acepta un espacio en blanco como nombre', () => {
    expect(validateDetails({ ...COMPLETO, firstName: '   ' }).firstName).toBe(
      'booking.errorRequired',
    );
  });

  describe('correo electronico', () => {
    it('rechaza direcciones claramente mal escritas', () => {
      for (const email of ['ana', 'ana@', '@example.com', 'ana@example', 'a b@example.com']) {
        expect(validateDetails({ ...COMPLETO, email }).email, email).toBe('booking.errorEmail');
      }
    });

    it('acepta direcciones reales poco habituales', () => {
      // Rechazar un correo valido pierde un cliente; es peor que aceptar uno
      // dudoso, que como mucho rebota.
      for (const email of [
        'ana+limpieza@example.com',
        "o'brien@example.co.uk",
        'ana.maria_perez@sub.example.com',
      ]) {
        expect(validateDetails({ ...COMPLETO, email }).email, email).toBeUndefined();
      }
    });
  });

  describe('telefono', () => {
    it('acepta los formatos que la gente escribe de verdad', () => {
      for (const phone of [
        '(404) 555-0123',
        '404-555-0123',
        '404.555.0123',
        '4045550123',
        '+1 404 555 0123',
        '1 (404) 555-0123',
      ]) {
        expect(validateDetails({ ...COMPLETO, phone }).phone, phone).toBeUndefined();
      }
    });

    it('rechaza un numero al que faltan digitos', () => {
      // El error mas comun. Sin telefono correcto la empresa no puede avisar
      // de un retraso ni de que el equipo esta en la puerta.
      expect(validateDetails({ ...COMPLETO, phone: '404 555 012' }).phone).toBe(
        'booking.errorPhone',
      );
    });

    it('rechaza letras', () => {
      expect(validateDetails({ ...COMPLETO, phone: '404-CLEAN-01' }).phone).toBe(
        'booking.errorPhone',
      );
    });
  });

  describe('codigo postal', () => {
    it('exige exactamente cinco digitos', () => {
      for (const postalCode of ['3030', '303035', 'ABCDE', '']) {
        expect(validateDetails({ ...COMPLETO, postalCode }).postalCode, postalCode).toBe(
          'booking.errorPostalCode',
        );
      }
    });
  });
});

describe('formato del telefono mientras se escribe', () => {
  it('va construyendo el formato habitual', () => {
    expect(formatUsPhone('404')).toBe('404');
    expect(formatUsPhone('404555')).toBe('(404) 555');
    expect(formatUsPhone('4045550123')).toBe('(404) 555-0123');
  });

  it('quita el prefijo de pais para no duplicarlo', () => {
    expect(formatUsPhone('+1 404 555 0123')).toBe('(404) 555-0123');
  });

  it('descarta lo que sobra en vez de deformar el numero', () => {
    expect(formatUsPhone('404555012399999')).toBe('(404) 555-0123');
  });

  it('no se rompe con una entrada vacia', () => {
    expect(formatUsPhone('')).toBe('');
  });
});
