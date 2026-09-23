import { describe, expect, it } from 'vitest';
import { AdminModule } from './admin.module';
import { THROTTLER_NAMES } from '../common/throttling';

/**
 * NINGUNA PANTALLA DEL PANEL PUEDE CAER POR EL LIMITADOR DE COTIZACIONES
 * ---------------------------------------------------------------------
 * El limitador "quotes" es de 10 peticiones por minuto porque cada cotizacion
 * gasta cuota de pago del proveedor de distancia. Pero con limitadores con
 * nombre propio NO se aplica solo a /quotes: se aplica a toda la API salvo
 * donde se desactive explicitamente.
 *
 * Eso convierte el olvido en un fallo silencioso. Un controlador nuevo del
 * panel funciona perfectamente en cualquier prueba corta y se cae con un 429
 * en la undecima peticion del minuto, que es justo lo que hace quien esta
 * trabajando: abrir la agenda, entrar en una reserva, volver, entrar en otra.
 *
 * Paso de verdad con las asignaciones. Esta prueba existe para que no vuelva
 * a pasar sin avisar, y RECORRE EL MODULO en vez de una lista escrita a mano:
 * un controlador nuevo queda cubierto el dia que se anade.
 */
describe('limitadores en los controladores del panel', () => {
  /*
   * La clave la compone @nestjs/throttler como THROTTLER_SKIP + nombre, y no
   * la exporta. Si una version futura la cambiara, esta prueba se pondria
   * roja en vez de dejar de comprobar nada en silencio, que es lo que se
   * quiere de una guardia.
   */
  const CLAVE_EXENCION = `THROTTLER:SKIP${THROTTLER_NAMES[1]}`;

  const controladores = (Reflect.getMetadata('controllers', AdminModule) ?? []) as (new (
    ...args: never[]
  ) => unknown)[];

  /**
   * Se comprueba RUTA POR RUTA y no solo a nivel de clase, igual que resuelve
   * la guarda: la exencion vale puesta en el metodo o puesta en la clase, y
   * el metodo manda. Comprobar solo la clase daria por rota una exencion que
   * funciona —le pasa a la sesion, que esta exenta de todos los limitadores
   * desde el metodo— y eso empuja a "arreglar" codigo que no esta roto.
   */
  const rutas = controladores.flatMap((controlador) =>
    Object.getOwnPropertyNames(controlador.prototype)
      .filter((nombre) => nombre !== 'constructor')
      .map((nombre) => [`${controlador.name}.${nombre}`, controlador, nombre] as const),
  );

  it('se han encontrado rutas que comprobar', () => {
    expect(rutas.length).toBeGreaterThan(0);
  });

  it.each(rutas)('%s esta exenta del limitador de cotizaciones', (_nombre, controlador, metodo) => {
    const manejador = (controlador.prototype as Record<string, unknown>)[metodo];
    const exenta =
      Reflect.getMetadata(CLAVE_EXENCION, manejador as object) ??
      Reflect.getMetadata(CLAVE_EXENCION, controlador);

    expect(exenta).toBe(true);
  });
});
