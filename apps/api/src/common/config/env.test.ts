import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

/**
 * LAS GUARDAS DEL ENTORNO
 * -----------------------
 * Aqui no se prueba que Zod sepa convertir cadenas a numeros. Se prueba que
 * la aplicacion SE NIEGUE A ARRANCAR con una configuracion que en produccion
 * causaria un dano que no se puede deshacer.
 */

/** Lo minimo para que el esquema valide. El resto tiene valor por defecto. */
const BASE = { NODE_ENV: 'test' };

describe('retencion del registro de auditoria', () => {
  it('por defecto guarda un ano', () => {
    expect(validateEnv(BASE).AUDIT_RETENTION_DAYS).toBe(365);
  });

  /*
   * UN CERO APAGA LA PURGA; UN UNO BORRARIA CASI TODO EL REGISTRO.
   *
   * Los dos son un digito y estan pegados en el teclado, pero solo uno es
   * irreversible. Por eso cualquier retencion distinta de cero tiene suelo:
   * el error tipografico que se paga caro no debe llegar a arrancar.
   */
  it('cero esta permitido y significa "no purgar"', () => {
    expect(validateEnv({ ...BASE, AUDIT_RETENTION_DAYS: '0' }).AUDIT_RETENTION_DAYS).toBe(0);
  });

  it('una retencion ridicula no arranca', () => {
    for (const dias of ['1', '7', '29']) {
      expect(() => validateEnv({ ...BASE, AUDIT_RETENTION_DAYS: dias })).toThrow(
        /AUDIT_RETENTION_DAYS/,
      );
    }
  });

  it('treinta dias es el minimo que si arranca', () => {
    expect(validateEnv({ ...BASE, AUDIT_RETENTION_DAYS: '30' }).AUDIT_RETENTION_DAYS).toBe(30);
  });

  it('un valor negativo tampoco arranca', () => {
    expect(() => validateEnv({ ...BASE, AUDIT_RETENTION_DAYS: '-1' })).toThrow();
  });
});

describe('el proveedor local de identidad no vale para produccion', () => {
  /*
   * Emite tokens con un secreto compartido: quien lo conozca puede
   * fabricarse uno de administrador. Se niega a arrancar en vez de avisar en
   * el log, porque un aviso se pasa por alto y un arranque fallido no.
   */
  it('produccion con AUTH_PROVIDER=local no arranca', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', AUTH_PROVIDER: 'local', DATABASE_URL: undefined }),
    ).toThrow(/AUTH_PROVIDER/);
  });
});
