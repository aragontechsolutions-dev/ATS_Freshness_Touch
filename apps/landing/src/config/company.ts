/**
 * DATOS DE CONTACTO DE LA EMPRESA
 * -------------------------------
 * PENDIENTE: sustituir los valores marcados con "TODO" por los datos reales
 * de Freshness Touch antes de publicar el sitio. Se dejan como marcadores
 * evidentes a proposito: publicar un telefono o correo inventado seria peor
 * que no publicar ninguno.
 */
export const company = {
  name: 'Freshness Touch',

  // TODO: telefono real de la empresa
  phoneDisplay: '+1 (000) 000-0000',
  phoneHref: 'tel:+10000000000',

  // TODO: correo real de la empresa
  email: 'contact@example.com',

  // Base de operaciones. Debe coincidir con COMPANY_BASE_* de la API.
  city: 'Atlanta',
  state: 'GA',

  // TODO: enlaces reales a redes sociales y perfiles de resenas.
  social: {} as Record<string, string>,
} as const;
