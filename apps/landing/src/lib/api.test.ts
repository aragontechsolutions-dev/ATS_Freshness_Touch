import { describe, expect, it } from 'vitest';
import { normalizeApiBaseUrl } from './api';

describe('direccion de la API', () => {
  it('anade el prefijo de version cuando solo se configura el dominio', () => {
    // Es el error de configuracion mas comun: sin esto, todas las peticiones
    // responden 404 y el sitio parece roto aunque la API funcione.
    expect(normalizeApiBaseUrl('https://api.ejemplo.com')).toBe('https://api.ejemplo.com/api/v1');
  });

  it('tolera la barra final', () => {
    expect(normalizeApiBaseUrl('https://api.ejemplo.com/')).toBe('https://api.ejemplo.com/api/v1');
    expect(normalizeApiBaseUrl('https://api.ejemplo.com/api/v1/')).toBe(
      'https://api.ejemplo.com/api/v1',
    );
  });

  it('respeta una direccion que ya trae su ruta', () => {
    expect(normalizeApiBaseUrl('https://api.ejemplo.com/api/v1')).toBe(
      'https://api.ejemplo.com/api/v1',
    );
  });

  it('no pisa un prefijo distinto configurado a proposito', () => {
    expect(normalizeApiBaseUrl('https://api.ejemplo.com/v2')).toBe('https://api.ejemplo.com/v2');
  });

  it('deja pasar una ruta relativa', () => {
    expect(normalizeApiBaseUrl('/api/v1')).toBe('/api/v1');
  });
});
