import { describe, expect, it } from 'vitest';
import { calculateDeposit } from './deposit';
import { defaultPricingConfig } from './config';

/**
 * EL DEPOSITO
 * -----------
 * Ya no depende de la distancia: son 35 dolares siempre. Lo que se prueba
 * aqui es justo lo que la cifra fija tiene de delicado —que se descuente y
 * no se sume— y el unico caso que la mueve.
 */
describe('calculateDeposit', () => {
  it('es la cifra configurada, mire donde mire', () => {
    /*
     * Antes cambiaba con las millas y dos clientes del mismo barrio veian
     * retenciones distintas sin entender por que. Ahora se explica en una
     * frase, y esta prueba existe para que siga siendo una frase.
     */
    for (const total of [20_000, 50_000, 120_000]) {
      expect(calculateDeposit(total, defaultPricingConfig).amountCents).toBe(3500);
    }
  });

  it('nunca retiene mas de lo que cuesta el trabajo', () => {
    const deposito = calculateDeposit(2000, defaultPricingConfig);

    expect(deposito.amountCents).toBe(2000);
    expect(deposito.capped).toBe(true);
  });

  it('se acredita contra el total: NO es un cargo extra', () => {
    /*
     * Es la parte que mas se malinterpreta. Una limpieza estandar son 185
     * dolares: 35 al reservar y 150 al terminar. A la empresa le llegan
     * 185, no 220.
     */
    const total = 18_500;
    const deposito = calculateDeposit(total, defaultPricingConfig);

    expect(deposito.appliedToTotal).toBe(true);
    expect(deposito.amountCents).toBe(3500);
    expect(total - deposito.amountCents).toBe(15_000);
  });

  it('un total en cero no produce una retencion negativa', () => {
    expect(calculateDeposit(0, defaultPricingConfig).amountCents).toBe(0);
  });
});
