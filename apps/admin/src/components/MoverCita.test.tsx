import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminBookingDetail, AuthenticatedStaff, BookingStatus } from '@freshness/types';
import '../i18n';

/**
 * MOVER LA CITA, LA PANTALLA
 * --------------------------
 * Lo que se comprueba es lo que no se puede dejar al servidor:
 *
 *   1. QUE EL AVISO DE LAS 24 HORAS SE VEA ANTES DE MOVER. El servidor sabe
 *      si el movimiento llego tarde y lo anota, pero para entonces ya esta
 *      hecho. Quien esta al telefono lo necesita MIENTRAS decide, porque
 *      cambia lo que le dice al cliente.
 *   2. QUE NO SE OFREZCA UN FORMULARIO QUE VA A FALLAR: una cita que ya
 *      empezo o ya termino no se mueve.
 *   3. QUE EL BOTON GRIS EXPLIQUE POR QUE LO ESTA. Un boton deshabilitado y
 *      mudo deja a quien lo mira convencido de que el sistema no deja mover
 *      la cita. Ya paso con cancelar.
 */

const rescheduleBooking = vi.fn();

vi.mock('../lib/api', () => ({
  rescheduleBooking: (...args: unknown[]) => rescheduleBooking(...args),
  isSessionError: () => false,
  ApiClientError: class extends Error {},
}));

const { MoverCita } = await import('./MoverCita');

let contenedor: HTMLDivElement;
let root: Root;

const COORDINA: AuthenticatedStaff = {
  staffId: '33333333-3333-4333-8333-333333333333',
  firstName: 'Diego',
  lastName: 'Coordina',
  email: 'diego@example.com',
  role: 'DISPATCHER',
  sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

/**
 * Una ficha con lo justo que mira el componente.
 *
 * Se recorta a proposito: construir las cuarenta y tantas claves del contrato
 * para comprobar un aviso de texto haria una prueba que falla cada vez que se
 * anade un campo a la ficha, sin que nada de lo que mira haya cambiado.
 */
function fichaCon(status: BookingStatus, scheduledStart: Date): AdminBookingDetail {
  return {
    bookingId: '8f2c1a94-1d3e-4f55-9b77-2c0a5e6d7f88',
    status,
    scheduledStart: scheduledStart.toISOString(),
  } as AdminBookingDetail;
}

const enHoras = (horas: number): Date => new Date(Date.now() + horas * 3_600_000);

async function montar(booking: AdminBookingDetail): Promise<void> {
  await act(async () => {
    root.render(
      <MoverCita booking={booking} staff={COORDINA} onMovida={vi.fn()} onSessionLost={vi.fn()} />,
    );
  });
}

beforeEach(() => {
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
  rescheduleBooking.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

/* -------------------------------------------------------------------------- */

describe('el formulario de mover una cita', () => {
  it('se ofrece para una cita confirmada', async () => {
    await montar(fichaCon('CONFIRMED', enHoras(72)));

    expect(contenedor.textContent).toContain('Move this appointment');
  });

  it('NO SE OFRECE para una que ya esta pasando o ya termino', async () => {
    for (const status of ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as BookingStatus[]) {
      await montar(fichaCon(status, enHoras(-2)));

      expect(contenedor.textContent, status).toBe('');
    }
  });
});

describe('el aviso de las 24 horas', () => {
  it('SALE cuando quedan menos, con lo que hay que decir por telefono', async () => {
    await montar(fichaCon('CONFIRMED', enHoras(10)));

    expect(contenedor.textContent).toContain('less than 24 hours');
    expect(contenedor.textContent).toContain('$35 deposit');
  });

  it('no sale cuando queda tiempo de sobra', async () => {
    await montar(fichaCon('CONFIRMED', enHoras(72)));

    expect(contenedor.textContent).not.toContain('less than 24 hours');
  });

  it('a quien no es administracion se le dice a quien avisar', async () => {
    /*
     * Coordinacion puede mover pero no cobrar, asi que el boton de cobrar el
     * deposito no esta en su pantalla. Si nadie le dice que ese movimiento
     * daba derecho a cobrar, nadie lo cobra.
     */
    await montar(fichaCon('CONFIRMED', enHoras(10)));

    expect(contenedor.textContent).toContain('done by administration');
  });
});

describe('el boton gris explica por que lo esta', () => {
  it('sin fecha no se puede enviar', async () => {
    await montar(fichaCon('CONFIRMED', enHoras(72)));

    const boton = contenedor.querySelector('button[type="submit"]');
    expect(boton?.hasAttribute('disabled')).toBe(true);
  });

  it('tarde y sin motivo, el boton lo dice en texto', async () => {
    await montar(fichaCon('CONFIRMED', enHoras(10)));

    expect(contenedor.textContent).toContain('Write why, above.');
    expect(contenedor.textContent).toContain('(required)');
  });

  it('con tiempo de sobra el motivo es opcional', async () => {
    await montar(fichaCon('CONFIRMED', enHoras(72)));

    expect(contenedor.textContent).toContain('(optional)');
    expect(contenedor.textContent).not.toContain('Write why, above.');
  });
});

describe('avisar al cliente', () => {
  it('viene marcado, y al desmarcarlo avisa de lo que eso significa', async () => {
    await montar(fichaCon('CONFIRMED', enHoras(72)));

    const casillas = [...contenedor.querySelectorAll('input[type="checkbox"]')];
    const avisar = casillas.at(-1) as HTMLInputElement;

    expect(avisar.checked).toBe(true);
    expect(contenedor.textContent).not.toContain('tell them yourself');

    await act(async () => {
      avisar.click();
    });

    expect(contenedor.textContent).toContain('tell them yourself');
  });
});
