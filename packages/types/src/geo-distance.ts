/**
 * DISTANCIA EN LINEA RECTA ENTRE DOS COORDENADAS
 * ==============================================
 * Una sola implementacion para todo el proyecto.
 *
 * Existe porque habia DOS COPIAS IDENTICAS —una en el contorno de Georgia y
 * otra en el servicio de la ubicacion de la empresa—, y al necesitar una
 * tercera (los metros entre quien ficha y la casa) tocaba elegir: unificar o
 * tener tres. Tres copias de la misma formula es como acaban difiriendo en el
 * radio de la Tierra sin que nadie lo note, y entonces el mapa dice una cosa
 * y la auditoria otra.
 *
 * NO ES LA DISTANCIA POR CARRETERA. Eso lo resuelve el proveedor de
 * distancias de la API, que cobra por consulta y devuelve la ruta real. Esto
 * es la linea recta sobre la esfera, que es lo que sirve para:
 *
 *   - dibujar un circulo en un mapa,
 *   - decir cuanto se movio la sede,
 *   - y saber si quien ficha esta en la puerta de la casa o a dos pueblos.
 */

/**
 * Radio medio de la Tierra.
 *
 * Es una esfera aproximada, no el elipsoide real: el error es de menos del
 * 0,5% y ninguno de los usos de arriba lo nota. Para medir metros en la
 * puerta de una casa, ese error son centimetros.
 */
const RADIO_TIERRA_MILLAS = 3958.7613;

/** Metros por milla, exacto por definicion. */
const METROS_POR_MILLA = 1609.344;

/** Distancia en millas entre dos coordenadas, en linea recta. */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const aRadianes = Math.PI / 180;
  const phi1 = lat1 * aRadianes;
  const phi2 = lat2 * aRadianes;
  const deltaPhi = (lat2 - lat1) * aRadianes;
  const deltaLambda = (lon2 - lon1) * aRadianes;

  const a =
    Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  return 2 * RADIO_TIERRA_MILLAS * Math.asin(Math.sqrt(a));
}

/**
 * Lo mismo en metros.
 *
 * Existe aparte porque el fichaje razona en metros —«llego a 40 metros de la
 * puerta»— y convertir en cada sitio de llamada es como se cuela un factor
 * mal puesto. Aqui la conversion se escribe una vez.
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineMiles(lat1, lon1, lat2, lon2) * METROS_POR_MILLA;
}
