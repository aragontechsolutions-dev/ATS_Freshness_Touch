import { describe, expect, it } from 'vitest';
import { formatDistanciaDeFichaje } from './format';

/**
 * LA DISTANCIA DE UN FICHAJE, TAL Y COMO SE LEE
 * ---------------------------------------------
 * La API guarda metros, que es lo correcto para un dato. Esto comprueba la
 * traduccion a las unidades del pais, que es lo unico que ve una persona.
 */

describe('pies cerca de la casa', () => {
  it('en la puerta', () => {
    // 20 metros son unos 66 pies, redondeados a 70.
    expect(formatDistanciaDeFichaje(20)).toEqual({ value: '70', unit: 'feet' });
  });

  it('en la acera de enfrente', () => {
    expect(formatDistanciaDeFichaje(60)).toEqual({ value: '200', unit: 'feet' });
  });

  it('redondea a diez pies, sin fingir exactitud', () => {
    /*
     * Un fichaje viene de un GPS de movil contra un punto interpolado sobre
     * una calle. Decir «187 pies» afirma una precision que no existe por
     * ninguno de los dos lados.
     */
    for (const metros of [57, 58, 59]) {
      expect(Number(formatDistanciaDeFichaje(metros).value) % 10).toBe(0);
    }
  });

  it('cero metros no es un caso raro: se lee igual', () => {
    expect(formatDistanciaDeFichaje(0)).toEqual({ value: '0', unit: 'feet' });
  });
});

describe('millas lejos de la casa', () => {
  it('a dos manzanas largas ya son millas', () => {
    // 1000 pies es el corte: 305 metros.
    const justoPorEncima = formatDistanciaDeFichaje(310);
    expect(justoPorEncima.unit).toBe('miles');
    expect(justoPorEncima.value).toBe('0.2');
  });

  it('el «fiche desde mi casa» se lee de un golpe', () => {
    // Marietta, a unos 25 km del centro de Atlanta.
    expect(formatDistanciaDeFichaje(25_000)).toEqual({ value: '15.5', unit: 'miles' });
  });

  it('con un solo decimal', () => {
    expect(formatDistanciaDeFichaje(4_000).value).toMatch(/^\d+\.\d$/);
  });
});

describe('el corte entre las dos escalas', () => {
  it('por debajo de 1000 pies son pies, y a partir de ahi millas', () => {
    /*
     * 1000 pies son 304,8 metros. Se comprueba a los dos lados porque el
     * corte es lo unico que puede quedar mal: una milla a secas dejaria «0.04
     * millas» en la puerta de la casa, y pies a secas dejaria «82.000 pies»
     * para quien fichara desde su casa.
     */
    expect(formatDistanciaDeFichaje(304).unit).toBe('feet');
    expect(formatDistanciaDeFichaje(305).unit).toBe('miles');
  });
});

describe('los numeros, en las dos lenguas', () => {
  it('EN ESPANOL SE LEEN A LA AMERICANA, y es lo correcto', () => {
    /*
     * ESTA PRUEBA SE ESCRIBIO ESPERANDO LO CONTRARIO, y fallo.
     *
     * La suposicion era que el espanol pondria coma decimal —«15,5
     * millas»—, como en Espana. Pero el proyecto usa `es-US`, no `es-ES`, y
     * `es-US` separa los numeros igual que el ingles.
     *
     * Y ASI DEBE SER. Quien habla espanol en Georgia lee los precios del
     * supermercado, las facturas y los limites de velocidad con punto
     * decimal. Poner coma aqui seria una traduccion hecha desde Espana para
     * gente que vive en Estados Unidos, y se leeria como un error.
     *
     * Queda como prueba para que nadie lo «arregle» mas adelante.
     */
    expect(formatDistanciaDeFichaje(25_000, 'en').value).toBe('15.5');
    expect(formatDistanciaDeFichaje(25_000, 'es').value).toBe('15.5');
  });
});
