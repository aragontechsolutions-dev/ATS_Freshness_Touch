import { describe, expect, it } from 'vitest';
import {
  BOOKING_CONSENT_NONE,
  BookingMediaConsentSchema,
  BookingRequestSchema,
  MediaConsentSchema,
  consentFromBooking,
} from './index';

/**
 * EL PERMISO QUE SE DA AL RESERVAR
 * --------------------------------
 * Lo que se marca en el formulario se convierte en una ficha del registro sin
 * que nadie teclee nada. Estas pruebas fijan QUE dice esa ficha, porque es lo
 * unico que quedara escrito el dia que haya que demostrar el permiso.
 */

const BASE = {
  reference: 'FT-2026-0007',
  customerName: 'Ana Perez',
  propertyAddress: '123 Peachtree St NE, Atlanta, GA 30303',
  serviceDate: '2026-11-02',
  signedAt: '2026-10-25',
};

describe('lo que se marca en el formulario', () => {
  it('todo en falso por defecto: una casilla premarcada no es un permiso', () => {
    expect(BookingMediaConsentSchema.parse({})).toEqual(BOOKING_CONSENT_NONE);
  });

  /*
   * EL SITIO Y LA API SE DESPLIEGAN POR SEPARADO. Una reserva enviada por una
   * version anterior del formulario no trae el campo, y lo que tiene que
   * pasar entonces es que NO haya permiso, nunca que se suponga uno.
   */
  it('una reserva sin el campo se acepta y no concede nada', () => {
    const reserva = BookingRequestSchema.parse({
      service: 'STANDARD',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      startsAt: '2026-11-02T14:00:00.000Z',
      contact: {
        firstName: 'Ana',
        lastName: 'Perez',
        email: 'ana@example.com',
        phone: '+1 404 555 0101',
      },
      address: { line1: '123 Peachtree St NE', city: 'Atlanta', postalCode: '30303' },
    });

    expect(reserva.mediaConsent).toEqual(BOOKING_CONSENT_NONE);
  });
});

describe('la ficha que queda anotada', () => {
  const marcado = { granted: true, allowsBefore: true, occupiedByOthers: false };

  it('es una ficha valida del registro, sin pasar por ninguna excepcion', () => {
    expect(MediaConsentSchema.safeParse(consentFromBooking({ marcado, ...BASE })).success).toBe(
      true,
    );
  });

  it('dice que llego por el formulario, que es donde esta la prueba', () => {
    expect(consentFromBooking({ marcado, ...BASE }).evidenceKind).toBe('WEB_FORM');
  });

  /*
   * SOLO LA WEB. El texto del formulario autoriza la pagina, no las redes
   * sociales: publicar en Facebook con un permiso que no las nombra es
   * publicar sin permiso.
   */
  it('autoriza la web y nada mas', () => {
    expect(consentFromBooking({ marcado, ...BASE }).channels).toEqual(['WEBSITE']);
  });

  it('promete los cinco dias de retirada que decidio la duena', () => {
    expect(consentFromBooking({ marcado, ...BASE }).removalDays).toBe(5);
  });

  /*
   * NACE SIN PIEZAS: el video todavia no existe cuando se reserva. El
   * contrato lo admite porque la regla que exige autorizar la web solo se
   * aplica a las fichas que amparan algo.
   */
  it('nace sin piezas atadas, y aun asi es valida', () => {
    const ficha = consentFromBooking({ marcado, ...BASE });
    expect(ficha.videoIds).toEqual([]);
    expect(ficha.photoPaths).toEqual([]);
  });

  /*
   * EL «ANTES» ES LA PARTE SENSIBLE —su casa sucia— y tiene su propia
   * casilla. Que el permiso general este marcado no lo arrastra.
   */
  it('sin marcar el «antes», no lo cubre', () => {
    const ficha = consentFromBooking({
      marcado: { ...marcado, allowsBefore: false },
      ...BASE,
    });
    expect(ficha.allowsBefore).toBe(false);
  });

  /*
   * QUIEN RESERVA NO PUEDE DAR EL PERMISO DE QUIEN VIVE ALLI. El dueno que
   * alquila autoriza su propiedad, pero los muebles y la ropa del plano son
   * del inquilino.
   */
  it('si alli vive otra persona, el permiso del inquilino sigue faltando', () => {
    const ficha = consentFromBooking({
      marcado: { ...marcado, occupiedByOthers: true },
      ...BASE,
    });

    expect(ficha.occupiedByOthers).toBe(true);
    expect(ficha.occupantConsent).toBe(false);
  });

  /*
   * Y ESO TIENE CONSECUENCIAS, no es solo una anotacion: una ficha asi no
   * puede llevar piezas atadas, asi que el modo estricto no publicara
   * ninguna.
   */
  it('y entonces esa ficha no puede amparar ninguna pieza', () => {
    const ficha = consentFromBooking({
      marcado: { ...marcado, occupiedByOthers: true },
      ...BASE,
    });

    const conFoto = MediaConsentSchema.safeParse({
      ...ficha,
      photoPaths: ['photos/0123456789abcdef0123456789abcdef.jpg'],
    });
    expect(conFoto.success).toBe(false);
  });

  /*
   * LA VERSION DEL TEXTO QUEDA ESCRITA. Un permiso vale por lo que decia el
   * texto que la persona leyo, no por lo que diga hoy la pagina.
   */
  it('deja escrito que texto se acepto', () => {
    expect(consentFromBooking({ marcado, ...BASE }).notes).toBe('Formulario de reserva, texto v1');
  });
});
