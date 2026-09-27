import type { QuoteDeposit } from '@freshness/types';
import type { PricingConfig } from './config';

/**
 * EL DEPOSITO
 * -----------
 * Una cifra fija —35 dolares— que se RETIENE al reservar y se DESCUENTA del
 * total. No es un cargo extra: una limpieza estandar son 185 dolares, de los
 * que 35 se retienen al reservar y 150 se cobran al terminar. A la empresa
 * le llegan 185.
 *
 * Para que sirve: si el cliente cancela con el equipo ya en camino, o nadie
 * abre la puerta porque se olvidaron la llave, esos 35 cubren el viaje.
 *
 * ANTES DEPENDIA DE LA DISTANCIA, y eso era el problema. El deposito llevaba
 * dentro las millas y un tope, asi que dos clientes del mismo barrio veian
 * retenciones distintas sin entender por que, y parte del coste del traslado
 * se perdia al recortarlo contra el total. El traslado ahora es una linea
 * del precio (`travel.ts`) y el deposito es una frase: se retienen 35 y se
 * descuentan.
 *
 * LO UNICO QUE LO MUEVE es un trabajo que cueste menos que el propio
 * deposito: nunca se retiene mas dinero del que vale el servicio.
 */
export function calculateDeposit(totalCents: number, config: PricingConfig): QuoteDeposit {
  const amountCents = Math.min(config.deposit.amountCents, Math.max(0, totalCents));

  return {
    amountCents,
    capped: amountCents < config.deposit.amountCents,
    appliedToTotal: true,
  };
}
