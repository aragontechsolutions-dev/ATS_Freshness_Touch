import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, es } from '@freshness/i18n';

/**
 * LA SEDE QUE ANUNCIA LA WEB ES LA SEDE DESDE LA QUE SE COBRA
 * ==========================================================
 * La base de operaciones no es un dato de contacto: es el ORIGEN del calculo
 * de distancia, de las millas de traslado incluidas, de la zona de cada
 * reserva y del centro del mapa. Se guarda en el panel y llega a la web
 * dentro del catalogo, en `baseOfOperations`.
 *
 * ========================================================================
 * EL FALLO QUE ESTA PRUEBA IMPIDE
 * ========================================================================
 * La ciudad estuvo escrita a mano en `config/company.ts`, y la descripcion
 * del mapa decia «Atlanta» dentro de la propia traduccion. Con eso, mover la
 * sede desde el panel cambiaba los precios y NO cambiaba la web: el sitio
 * seguiria anunciando la ciudad vieja mientras el cotizador mide desde la
 * nueva. El cliente lee «con base en X» y paga el traslado desde Y.
 *
 * Es el mismo desajuste del que avisa el comentario de `baseOfOperations` en
 * el catalogo: el mapa mentiria y nadie lo notaria hasta que alguien
 * reclamara. Y no se nota al mirar la pagina, porque las dos mitades se ven
 * bien por separado.
 *
 * Asi que se ata por los dos lados: la traduccion tiene que dejar un HUECO
 * para la ciudad, y quien la pinta tiene que rellenarlo con la del catalogo.
 * El dia que alguien vuelva a escribir el nombre de una ciudad dentro del
 * texto, o vuelva a tirar de la constante del codigo, esto se pone rojo.
 *
 * OJO CON LA DIFERENCIA: «Serving Metro Atlanta» en la linea de contacto si
 * es texto fijo a proposito. No dice donde esta la sede, dice a que zona se
 * da servicio, y eso no lo decide la ubicacion de la empresa.
 */

const raiz = join(import.meta.dirname, '..');

const CONTACTO = readFileSync(join(raiz, 'sections/Contact.tsx'), 'utf8');
const ZONAS = readFileSync(join(raiz, 'sections/ServiceAreas.tsx'), 'utf8');

describe('la sede que se ensena es la que cobra', () => {
  describe('la traduccion deja hueco para la ciudad', () => {
    it('la linea de contacto interpola ciudad y estado, no los escribe', () => {
      for (const texto of [en.contact.serviceArea, es.contact.serviceArea]) {
        expect(texto).toContain('{{city}}');
        expect(texto).toContain('{{state}}');
      }
    });

    it('la descripcion del mapa interpola la ciudad y ya no nombra ninguna', () => {
      for (const texto of [en.areas.mapDescription, es.areas.mapDescription]) {
        expect(texto).toContain('{{city}}');
        /*
         * Lo que de verdad falla es que aparezca un nombre de ciudad escrito.
         * Se comprueba con «Atlanta» porque es el que estuvo ahi, y porque un
         * hueco ya relleno es indistinguible a simple vista del hueco vacio.
         */
        expect(texto).not.toMatch(/Atlanta/i);
      }
    });
  });

  describe('quien lo pinta rellena el hueco con la sede del catalogo', () => {
    it('la seccion de contacto lee la sede del catalogo', () => {
      expect(CONTACTO).toContain('baseOfOperations');
    });

    it('y no vuelve a tirar de la constante del codigo para pintarla', () => {
      // La constante sigue existiendo como respaldo mientras el catalogo
      // viaja; lo que no puede volver es pintarla directamente.
      expect(CONTACTO).not.toContain('city: company.city');
    });

    it('la descripcion del mapa recibe la ciudad de la sede', () => {
      expect(ZONAS).toContain('city: base.city');
    });
  });

  describe('el area a la que se da servicio', () => {
    it('la linea de contacto la dice en los dos idiomas', () => {
      // Se anuncia el area metropolitana, que es mas grande que la ciudad de
      // la sede: sin esta mitad, un cliente de otra ciudad del area podria
      // pensar que no se le atiende.
      expect(en.contact.serviceArea).toMatch(/Metro Atlanta/);
      expect(es.contact.serviceArea).toMatch(/área metropolitana de Atlanta/);
    });
  });
});
