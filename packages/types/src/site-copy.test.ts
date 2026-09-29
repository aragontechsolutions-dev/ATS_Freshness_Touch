import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SITE_COPY,
  SITE_COPY_KEYS,
  SITE_COPY_LONG_MAX,
  SITE_COPY_SHORT_KEYS,
  SITE_COPY_SHORT_MAX,
  SiteCopySchema,
  incompleteSiteCopyKeys,
  siteCopyGroup,
  siteCopyText,
  toSiteCopyLocale,
  type SiteCopy,
} from './site-copy';

describe('textos del sitio', () => {
  describe('las claves', () => {
    it('son las veinte previstas, sin repetidas', () => {
      expect(SITE_COPY_KEYS).toHaveLength(20);
      expect(new Set(SITE_COPY_KEYS).size).toBe(20);
    });

    it('cada clave cae en su bloque', () => {
      expect(siteCopyGroup('whyUs.insured.title')).toBe('whyUs');
      expect(siteCopyGroup('faq.q1.a')).toBe('faq');
    });

    it('los titulos y las preguntas son los campos cortos', () => {
      expect(SITE_COPY_SHORT_KEYS).toHaveLength(10);
      for (const key of SITE_COPY_SHORT_KEYS) {
        expect(key.endsWith('.title') || key.endsWith('.q'), key).toBe(true);
      }
    });
  });

  describe('lo que se acepta', () => {
    it('sin nada configurado es valido: es el estado de partida', () => {
      expect(SiteCopySchema.safeParse(DEFAULT_SITE_COPY).success).toBe(true);
      expect(SiteCopySchema.safeParse({}).success).toBe(true);
    });

    it('acepta unas pocas claves, no hacen falta las veinte', () => {
      /*
       * Es lo que permite anadir un texto editable manana sin invalidar lo
       * que la empresa ya escribio.
       */
      const parsed = SiteCopySchema.safeParse({
        'whyUs.guarantee.body': { en: 'Tell us within 48 hours.', es: 'Avisanos en 48 horas.' },
      });
      expect(parsed.success).toBe(true);
    });

    it('un idioma puede quedarse sin configurar', () => {
      const parsed = SiteCopySchema.safeParse({
        'whyUs.insured.title': { en: 'Insured and bonded', es: null },
      });
      expect(parsed.success).toBe(true);
    });

    it('recorta los espacios de alrededor', () => {
      const parsed = SiteCopySchema.parse({
        'faq.q1.q': { en: '  Do I pay tax?  ', es: null },
      });
      expect(parsed['faq.q1.q']?.en).toBe('Do I pay tax?');
    });
  });

  describe('lo que se rechaza', () => {
    it('una clave desconocida', () => {
      // Una clave mal escrita se quedaria guardada sin salir nunca en la web.
      const parsed = SiteCopySchema.safeParse({
        'whyUs.insured.titel': { en: 'Typo', es: null },
      });
      expect(parsed.success).toBe(false);
    });

    it('la cadena vacia: para no configurar algo esta null', () => {
      /*
       * Si se aceptara, borrar un texto dejaria un hueco en blanco en la web
       * en vez de volver al texto de partida.
       */
      const parsed = SiteCopySchema.safeParse({
        'whyUs.insured.title': { en: '', es: null },
      });
      expect(parsed.success).toBe(false);
    });

    it('un texto de solo espacios, que es la cadena vacia disfrazada', () => {
      const parsed = SiteCopySchema.safeParse({
        'whyUs.insured.title': { en: '     ', es: null },
      });
      expect(parsed.success).toBe(false);
    });

    it('un idioma que falta del objeto', () => {
      /*
       * Mandar solo el ingles no puede significar «borra el espanol». Los dos
       * campos van siempre, aunque valgan null.
       */
      const parsed = SiteCopySchema.safeParse({
        'whyUs.insured.title': { en: 'Insured' },
      });
      expect(parsed.success).toBe(false);
    });

    it('un idioma que no es ni en ni es', () => {
      const parsed = SiteCopySchema.safeParse({
        'whyUs.insured.title': { en: 'Insured', es: 'Asegurados', fr: 'Assures' },
      });
      expect(parsed.success).toBe(false);
    });

    it('un titulo mas largo que el tope corto', () => {
      const parsed = SiteCopySchema.safeParse({
        'whyUs.insured.title': { en: 'a'.repeat(SITE_COPY_SHORT_MAX + 1), es: null },
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.path).toEqual(['whyUs.insured.title', 'en']);
      }
    });

    it('un cuerpo mas largo que el tope largo', () => {
      const parsed = SiteCopySchema.safeParse({
        'whyUs.insured.body': { en: 'a'.repeat(SITE_COPY_LONG_MAX + 1), es: null },
      });
      expect(parsed.success).toBe(false);
    });

    it('un cuerpo de tamano intermedio SI cabe, aunque no cabria en un titulo', () => {
      // Comprueba que el tope corto no se esta aplicando a todo por error.
      const intermedio = 'a'.repeat(SITE_COPY_SHORT_MAX + 50);
      expect(
        SiteCopySchema.safeParse({ 'whyUs.insured.body': { en: intermedio, es: null } }).success,
      ).toBe(true);
    });

    it('saltos de linea y caracteres invisibles', () => {
      /*
       * El salto de linea no se respeta dentro de la tarjeta pero si descuadra
       * la altura; los invisibles son la forma clasica de que un texto diga
       * una cosa y se lea otra.
       */
      for (const veneno of ['Dos\nlineas', 'Con\ttabulador', 'Invisible​']) {
        expect(
          SiteCopySchema.safeParse({ 'faq.q1.a': { en: veneno, es: null } }).success,
          veneno,
        ).toBe(false);
      }
    });

    it('el HTML se guarda como texto, no se rechaza: se escapa al pintar', () => {
      /*
       * A PROPOSITO. Rechazar el simbolo menor que impediria escribir
       * «limpiezas de menos de <2 horas». La defensa de verdad esta en el
       * pintado: React escapa el texto, y no se usa dangerouslySetInnerHTML
       * en ninguna parte del camino. Hay una prueba de eso en el sitio.
       */
      const parsed = SiteCopySchema.safeParse({
        'faq.q1.a': { en: '<script>alert(1)</script>', es: null },
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe('leer un texto', () => {
    const copy: SiteCopy = {
      'whyUs.guarantee.body': { en: 'Within 48 hours.', es: null },
    };

    it('devuelve el texto configurado del idioma pedido', () => {
      expect(siteCopyText(copy, 'whyUs.guarantee.body', 'en')).toBe('Within 48 hours.');
    });

    it('devuelve null en el idioma sin configurar, para que se use el del codigo', () => {
      expect(siteCopyText(copy, 'whyUs.guarantee.body', 'es')).toBeNull();
    });

    it('devuelve null en una clave que nadie ha tocado', () => {
      expect(siteCopyText(copy, 'faq.q3.q', 'en')).toBeNull();
    });
  });

  describe('el idioma que llega del navegador', () => {
    /*
     * ESTA ES LA QUE EVITA EL FALLO SILENCIOSO. i18next devuelve lo que el
     * navegador pida: `en-US`, `es-419`, `es-MX`. Si no se recortara, la
     * busqueda fallaria SIEMPRE, el sitio seguiria con los textos del codigo
     * y el panel pareceria no servir para nada.
     */
    it('recorta las variantes regionales', () => {
      expect(toSiteCopyLocale('en-US')).toBe('en');
      expect(toSiteCopyLocale('es-419')).toBe('es');
      expect(toSiteCopyLocale('es-MX')).toBe('es');
    });

    it('acepta los codigos ya cortos, en cualquier caja', () => {
      expect(toSiteCopyLocale('es')).toBe('es');
      expect(toSiteCopyLocale('ES')).toBe('es');
    });

    it('lo desconocido, lo vacio y lo ausente caen en ingles', () => {
      expect(toSiteCopyLocale('fr')).toBe('en');
      expect(toSiteCopyLocale('')).toBe('en');
      expect(toSiteCopyLocale(undefined)).toBe('en');
      expect(toSiteCopyLocale(null)).toBe('en');
    });
  });

  describe('el aviso de idioma a medias', () => {
    it('senala la clave con un idioma escrito y el otro no', () => {
      const copy: SiteCopy = {
        'whyUs.guarantee.body': { en: 'Within 48 hours.', es: null },
      };
      expect(incompleteSiteCopyKeys(copy)).toEqual(['whyUs.guarantee.body']);
    });

    it('no senala la que tiene los dos idiomas', () => {
      const copy: SiteCopy = {
        'whyUs.guarantee.body': { en: 'Within 48 hours.', es: 'En 48 horas.' },
      };
      expect(incompleteSiteCopyKeys(copy)).toEqual([]);
    });

    it('no senala la que no tiene ninguno: eso es no haberla tocado', () => {
      const copy: SiteCopy = {
        'whyUs.guarantee.body': { en: null, es: null },
      };
      expect(incompleteSiteCopyKeys(copy)).toEqual([]);
    });

    it('las devuelve en el orden del contrato, no en el de escritura', () => {
      // Para que el aviso del panel salga siempre igual y se pueda comparar.
      const copy: SiteCopy = {
        'faq.q2.a': { en: 'Later', es: null },
        'whyUs.insured.title': { en: 'First', es: null },
      };
      expect(incompleteSiteCopyKeys(copy)).toEqual(['whyUs.insured.title', 'faq.q2.a']);
    });
  });
});
