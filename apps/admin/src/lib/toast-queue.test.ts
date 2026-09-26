import { describe, expect, it } from 'vitest';
import {
  TOAST_DURACION_MS,
  TOAST_MAXIMO,
  aplazar,
  barrerCaducados,
  caducidad,
  descartar,
  encolar,
  hayCaducables,
  type Toast,
} from './toast-queue';

/**
 * El reloj se pasa a mano en cada llamada. Es la razon de que esta logica no
 * viva dentro del componente: asi se puede adelantar el tiempo sin esperarlo
 * y sin montar React.
 */
const T0 = 1_700_000_000_000;

function correcto(id: string, expiraEn: number | null = T0 + TOAST_DURACION_MS): Toast {
  return { id, tone: 'success', messageKey: 'admin.settings.saved', expiraEn };
}

describe('caducidad segun el tono', () => {
  it('los correctos y los informativos se van solos', () => {
    expect(caducidad('success', T0)).toBe(T0 + TOAST_DURACION_MS);
    expect(caducidad('info', T0)).toBe(T0 + TOAST_DURACION_MS);
  });

  it('LOS ERRORES NO SE VAN SOLOS: hay algo que corregir', () => {
    expect(caducidad('error', T0)).toBeNull();
  });
});

describe('encolar', () => {
  it('anade al final, que es donde se mira lo ultimo que ha pasado', () => {
    const cola = encolar([], { tone: 'success', messageKey: 'a' }, 'id-1', T0);
    const dos = encolar(cola, { tone: 'info', messageKey: 'b' }, 'id-2', T0);

    expect(dos.map((t) => t.messageKey)).toEqual(['a', 'b']);
  });

  it('un aviso repetido NO se apila: renueva la cuenta atras del que ya estaba', () => {
    const primera = encolar([], { tone: 'success', messageKey: 'a' }, 'id-1', T0);
    const segunda = encolar(primera, { tone: 'success', messageKey: 'a' }, 'id-2', T0 + 3000);

    expect(segunda).toHaveLength(1);
    expect(segunda[0]?.id).toBe('id-1'); // conserva su sitio
    expect(segunda[0]?.expiraEn).toBe(T0 + 3000 + TOAST_DURACION_MS);
  });

  it('el mismo texto con detalles distintos SI son dos avisos', () => {
    // Dos choques de agenda con personas distintas son dos problemas.
    const uno = encolar(
      [],
      { tone: 'error', messageKey: 'admin.errorStaffDoubleBooked', detail: 'Ana · FT-1' },
      'id-1',
      T0,
    );
    const dos = encolar(
      uno,
      { tone: 'error', messageKey: 'admin.errorStaffDoubleBooked', detail: 'Luis · FT-2' },
      'id-2',
      T0,
    );

    expect(dos).toHaveLength(2);
  });

  it('el mismo texto con tonos distintos tampoco se funde', () => {
    const uno = encolar([], { tone: 'info', messageKey: 'a' }, 'id-1', T0);
    const dos = encolar(uno, { tone: 'error', messageKey: 'a' }, 'id-2', T0);

    expect(dos).toHaveLength(2);
  });

  it(`nunca hay mas de ${TOAST_MAXIMO} a la vez: entra el nuevo, se va el mas viejo`, () => {
    let cola = encolar([], { tone: 'info', messageKey: 'a' }, 'id-1', T0);
    cola = encolar(cola, { tone: 'info', messageKey: 'b' }, 'id-2', T0);
    cola = encolar(cola, { tone: 'info', messageKey: 'c' }, 'id-3', T0);
    cola = encolar(cola, { tone: 'info', messageKey: 'd' }, 'id-4', T0);

    expect(cola).toHaveLength(TOAST_MAXIMO);
    expect(cola.map((t) => t.messageKey)).toEqual(['b', 'c', 'd']);
  });

  it('devuelve una lista nueva: React compara por identidad', () => {
    const cola: Toast[] = [];
    expect(encolar(cola, { tone: 'info', messageKey: 'a' }, 'id-1', T0)).not.toBe(cola);
  });
});

describe('barrerCaducados', () => {
  it('se lleva los que ya cumplieron y deja los que no', () => {
    const cola = [correcto('viejo', T0 - 1), correcto('nuevo', T0 + 1000)];
    expect(barrerCaducados(cola, T0).map((t) => t.id)).toEqual(['nuevo']);
  });

  it('en el instante exacto de caducar ya se ha ido', () => {
    // El criterio es `expiraEn > ahora`: sobrevive mientras le quede tiempo,
    // no cuando se le acaba. Se fija aqui para que nadie lo cambie de lado
    // sin darse cuenta, no porque un milisegundo importe.
    expect(barrerCaducados([correcto('x', T0 + 1)], T0)).toHaveLength(1);
    expect(barrerCaducados([correcto('x', T0)], T0)).toHaveLength(0);
  });

  it('un error no se va por mucho que pase el tiempo', () => {
    const error: Toast = { id: 'e', tone: 'error', messageKey: 'x', expiraEn: null };
    expect(barrerCaducados([error], T0 + 10_000_000)).toHaveLength(1);
  });
});

describe('hayCaducables', () => {
  it('con la cola vacia no hace falta reloj', () => {
    expect(hayCaducables([])).toBe(false);
  });

  it('con solo errores tampoco: ninguno se va por su cuenta', () => {
    expect(hayCaducables([{ id: 'e', tone: 'error', messageKey: 'x', expiraEn: null }])).toBe(
      false,
    );
  });

  it('con uno que caduca, si', () => {
    expect(hayCaducables([correcto('a')])).toBe(true);
  });
});

describe('aplazar (lo que pasa al poner el raton encima)', () => {
  it('devuelve integro el tiempo que estuvo parado', () => {
    const cola = [correcto('a', T0 + 1000)];
    expect(aplazar(cola, 4000)[0]?.expiraEn).toBe(T0 + 5000);
  });

  it('no toca a los que no caducan', () => {
    const error: Toast = { id: 'e', tone: 'error', messageKey: 'x', expiraEn: null };
    expect(aplazar([error], 4000)[0]?.expiraEn).toBeNull();
  });

  it('una pausa de cero no cambia nada', () => {
    const cola = [correcto('a', T0 + 1000)];
    expect(aplazar(cola, 0)[0]?.expiraEn).toBe(T0 + 1000);
  });

  it('un aviso que caducaria durante la pausa sobrevive a la pausa', () => {
    /*
     * Este es el caso que importa de verdad: se pasa el raton por encima a
     * los 4 segundos y se lee durante 30. Al soltar, el aviso debe seguir
     * ahi el segundo que le quedaba, no irse de golpe.
     */
    const cola = [correcto('a', T0 + TOAST_DURACION_MS)];
    const trasLeerlo = aplazar(cola, 30_000);

    expect(barrerCaducados(trasLeerlo, T0 + 30_000 + 4000)).toHaveLength(1);
    expect(barrerCaducados(trasLeerlo, T0 + 30_000 + TOAST_DURACION_MS + 1)).toHaveLength(0);
  });
});

describe('descartar', () => {
  it('quita solo el que se cierra', () => {
    const cola = [correcto('a'), correcto('b')];
    expect(descartar(cola, 'a').map((t) => t.id)).toEqual(['b']);
  });

  it('cerrar algo que ya no esta no rompe nada', () => {
    expect(descartar([correcto('a')], 'fantasma')).toHaveLength(1);
  });
});
