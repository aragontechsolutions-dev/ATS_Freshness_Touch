import { describe, expect, it } from 'vitest';
import { bookingConfirmedEmail } from './booking-emails';
import { emailHtml } from './layout';
import { staffInviteEmail, staffRecoveryEmail } from './staff-emails';

/**
 * EL DISENO DE LOS CORREOS
 * ------------------------
 * Un correo no se puede mirar en el navegador antes de mandarlo, y una vez
 * mandado ya no se corrige. Lo que se comprueba aqui es justo lo que no se
 * ve leyendo el codigo y lo que mas caro sale equivocarse:
 *
 *   1. Que el correo se entienda CON LAS IMAGENES BLOQUEADAS, que es como lo
 *      recibe buena parte de la gente —Outlook por defecto, y Gmail con
 *      quien no este en su libreta—.
 *   2. Que nada de lo que escribio un desconocido pueda romper la maqueta.
 *   3. Que el enlace este siempre tambien en texto.
 */

const BASE = {
  locale: 'es' as const,
  titulo: 'Un titulo',
  parrafos: ['Un parrafo.'],
  contacto: ['Teléfono: +1 (404) 555-0123'],
  branding: { logoUrl: 'https://ejemplo.test/logo.jpg' },
};

describe('la cabecera con y sin logotipo', () => {
  it('sin logotipo, el nombre de la empresa va en texto', () => {
    const html = emailHtml({ ...BASE, branding: { logoUrl: null } });

    expect(html).not.toContain('<img');
    expect(html).toContain('Freshness Touch');
  });

  it('con logotipo, lleva texto alternativo', () => {
    const html = emailHtml(BASE);

    expect(html).toContain('src="https://ejemplo.test/logo.jpg"');
    expect(html).toContain('alt="Freshness Touch"');
  });

  it('NO fija el alto de la imagen', () => {
    /*
     * ESTA PRUEBA VIENE DE UN FALLO QUE SOLO SE VIO MIRANDOLO. Con
     * height="160", ese hueco se reserva igual cuando las imagenes estan
     * bloqueadas y el correo se abre con un agujero blanco enorme antes del
     * titulo. Sin el alto, el hueco se encoge hasta la linea de texto.
     */
    expect(emailHtml(BASE)).not.toContain('height="160"');
  });

  it('la banda de color va siempre: un fondo no se puede bloquear', () => {
    const conLogo = emailHtml(BASE);
    const sinLogo = emailHtml({ ...BASE, branding: { logoUrl: null } });

    // El azul oficial de marca.
    expect(conLogo).toContain('#145788');
    expect(sinLogo).toContain('#145788');
  });
});

describe('lo que escribe un desconocido no rompe nada', () => {
  it('escapa el texto del cuerpo', () => {
    const html = emailHtml({
      ...BASE,
      parrafos: ['<script>alert(1)</script> & "comillas"'],
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('escapa tambien el enlace, que va dentro de un atributo', () => {
    /*
     * No es lo mismo escapar texto que escapar un atributo: unas comillas
     * sin escapar dentro de href="..." permiten cerrar el atributo y anadir
     * otros. El enlace lo construye el proveedor, pero escapar solo donde
     * uno cree que hace falta es como se cuelan estas cosas.
     */
    const html = emailHtml({
      ...BASE,
      boton: { texto: 'Entrar', enlace: 'https://x.test/?a=1" onclick="robar()' },
    });

    expect(html).not.toContain('onclick="robar()"');
    expect(html).toContain('&quot;');
  });

  it('el idioma del documento sigue al de la persona', () => {
    expect(emailHtml({ ...BASE, locale: 'en' })).toContain('<html lang="en">');
    expect(emailHtml({ ...BASE, locale: 'es' })).toContain('<html lang="es">');
  });
});

describe('el enlace va siempre tambien en texto', () => {
  const ENLACE = 'https://panel.test/#access_token=abc&type=invite';

  it('en el HTML, debajo del boton', () => {
    const html = emailHtml({ ...BASE, boton: { texto: 'Entrar', enlace: ENLACE } });

    /*
     * Dos veces: una en el href del boton y otra como texto copiable. Hay
     * clientes de correo que no pintan botones, y quien lea esto en uno de
     * ellos tiene que poder copiarlo a mano. Es la diferencia entre que
     * alguien entre o que llame por telefono.
     */
    const escapado = ENLACE.replace(/&/g, '&amp;');
    expect(html.split(escapado)).toHaveLength(3);
  });
});

describe('los cinco correos pasan por el mismo diseno', () => {
  const contacto = { companyPhone: '+14045550123', companyEmail: 'hola@ejemplo.test' };
  const logoUrl = 'https://ejemplo.test/logo.jpg';

  const reserva = {
    locale: 'es' as const,
    customerFirstName: 'Ada',
    reference: 'FT-1',
    scheduledStart: new Date('2026-10-14T14:00:00Z'),
    timezone: 'America/New_York',
    addressLine: '1 Calle',
    city: 'Atlanta',
    state: 'GA',
    depositCents: 5000,
    balanceDueCents: 18500,
    currency: 'USD',
    ...contacto,
    logoUrl,
  };

  const personal = {
    locale: 'es' as const,
    firstName: 'Ada',
    role: 'CLEANER' as const,
    actionLink: 'https://panel.test/#access_token=abc',
    ...contacto,
    logoUrl,
  };

  it.each([
    ['reserva confirmada', bookingConfirmedEmail('a@b.test', reserva)],
    ['invitacion', staffInviteEmail('a@b.test', personal)],
    ['recuperacion', staffRecoveryEmail('a@b.test', personal)],
  ])('%s lleva la banda, el logotipo y el pie', (_nombre, mensaje) => {
    expect(mensaje.html).toContain('#145788');
    expect(mensaje.html).toContain('alt="Freshness Touch"');
    expect(mensaje.html).toContain('hola@ejemplo.test');
  });

  it('la version en texto plano nunca va vacia', () => {
    /*
     * Algunos clientes solo pintan el texto plano, y los filtros de correo
     * basura penalizan un mensaje que solo trae HTML.
     */
    for (const mensaje of [
      bookingConfirmedEmail('a@b.test', reserva),
      staffInviteEmail('a@b.test', personal),
      staffRecoveryEmail('a@b.test', personal),
    ]) {
      expect(mensaje.text.length).toBeGreaterThan(80);
      expect(mensaje.text).not.toContain('<');
    }
  });
});
