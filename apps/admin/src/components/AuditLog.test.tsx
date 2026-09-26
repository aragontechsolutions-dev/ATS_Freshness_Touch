import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditPage } from '@freshness/types';
import '../i18n';

/**
 * LA PANTALLA DEL REGISTRO DE ACTIVIDAD
 * -------------------------------------
 * Tres cosas que no se pueden comprobar mirando el codigo, y una de ellas es
 * de seguridad:
 *
 *   1. QUE NO CONSULTE AL TECLEAR. Cada consulta escribe una fila en el
 *      propio registro. Si la pantalla recargara en cada pulsacion, como hace
 *      la agenda, llenaria la auditoria de consultas sobre si misma y
 *      enterraria lo que importa. Aqui se escribe en los filtros y se
 *      comprueba que NO se ha llamado a la API.
 *
 *   2. QUE LA METADATA SE PINTE COMO TEXTO. Parte de su contenido llega de
 *      fuera —el motivo que alguien escribe al cancelar— y acaba en pantalla.
 *      Se mete una etiqueta `<img onerror>` en el motivo y se comprueba que
 *      sale como texto y no como elemento.
 *
 *   3. QUE UNA ACCION DESCONOCIDA NO DEJE LA FILA EN BLANCO. El dia que el
 *      servidor vaya por delante del panel, es mejor ver el codigo crudo que
 *      un hueco justo cuando alguien esta investigando algo.
 */

const fetchAuditLog = vi.fn<(...args: unknown[]) => Promise<AuditPage>>();
const fetchStaffDirectory = vi.fn();

vi.mock('../lib/api', () => ({
  fetchAuditLog: (...args: unknown[]) => fetchAuditLog(...args),
  fetchStaffDirectory: () => fetchStaffDirectory(),
  isSessionError: () => false,
  sessionLostReason: () => 'expired',
  ApiClientError: class ApiClientError extends Error {},
}));

const { AuditLog } = await import('./AuditLog');

const MOTIVO_CON_TRAMPA = '<img src=x onerror="alert(1)">';
const CLEO = '0826c725-0414-4abb-ae61-a5e14a4178ae';

const PAGINA: AuditPage = {
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      occurredAt: '2026-09-20T15:04:00.000Z',
      surface: 'PANEL',
      actorType: 'STAFF',
      actorId: '22222222-2222-4222-8222-222222222222',
      actorName: 'Ada Jefa',
      action: 'booking.status.cancelled',
      entityType: 'booking',
      entityId: '33333333-3333-4333-8333-333333333333',
      metadata: { reason: MOTIVO_CON_TRAMPA },
      ipAddress: '203.0.113.7',
    },
  ],
  nextBefore: null,
};

let contenedor: HTMLDivElement;
let raiz: Root;

async function montar(): Promise<void> {
  await act(async () => {
    raiz.render(<AuditLog locale="en" onSessionLost={() => undefined} />);
  });
}

beforeEach(() => {
  fetchAuditLog.mockReset().mockResolvedValue(PAGINA);
  fetchStaffDirectory.mockReset().mockResolvedValue({
    staff: [
      { staffId: CLEO, firstName: 'Cleo', lastName: 'Limpia' },
      { staffId: '22222222-2222-4222-8222-222222222222', firstName: 'Ada', lastName: 'Jefa' },
    ],
    canInvite: false,
  });

  contenedor = document.createElement('div');
  document.body.append(contenedor);
  raiz = createRoot(contenedor);
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
});

describe('la pantalla del registro', () => {
  it('pide la primera pagina una sola vez al abrirse', async () => {
    await montar();

    expect(fetchAuditLog).toHaveBeenCalledTimes(1);
    expect(fetchAuditLog).toHaveBeenCalledWith({});
  });

  /*
   * LA DECISION QUE PROTEGE AL PROPIO REGISTRO. Cambiar un filtro no consulta:
   * hay que pulsar el boton. Ver la cabecera del archivo.
   */
  it('cambiar un filtro NO dispara una consulta', async () => {
    await montar();
    fetchAuditLog.mockClear();

    const desde = contenedor.querySelector<HTMLInputElement>('#auditoria-desde');
    expect(desde).not.toBeNull();

    await act(async () => {
      cambiarValor(desde as HTMLInputElement, '2026-09-01');
    });

    expect(fetchAuditLog).not.toHaveBeenCalled();
  });

  it('al pulsar "aplicar" consulta una vez, con el filtro puesto', async () => {
    await montar();
    fetchAuditLog.mockClear();

    await act(async () => {
      cambiarValor(
        contenedor.querySelector<HTMLInputElement>('#auditoria-origen') as HTMLInputElement,
        'SITE',
      );
    });

    await act(async () => {
      contenedor
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(fetchAuditLog).toHaveBeenCalledTimes(1);
    expect(fetchAuditLog).toHaveBeenCalledWith({ surface: 'SITE' });
  });

  it('traduce la accion en vez de enseñar su codigo', async () => {
    await montar();

    expect(contenedor.textContent).toContain('Ada Jefa');
    expect(contenedor.textContent).toContain('Cancelled');
    expect(contenedor.textContent).not.toContain('booking.status.cancelled');
  });

  /*
   * Si el servidor va por delante del panel, se ensena el codigo tal cual.
   * Es feo y es correcto: mejor "booking.refunded" que una fila en blanco.
   */
  it('una accion que no conoce se ensena cruda, no en blanco', async () => {
    fetchAuditLog.mockResolvedValue({
      items: [{ ...PAGINA.items[0]!, action: 'booking.refunded', metadata: null }],
      nextBefore: null,
    });

    await montar();
    expect(contenedor.textContent).toContain('booking.refunded');
  });

  /*
   * LA COMPROBACION DE SEGURIDAD. El motivo lo escribe una persona y llega
   * hasta aqui: tiene que salir como texto, nunca interpretado.
   */
  it('la metadata se pinta como texto y no como marcado', async () => {
    await montar();

    const detalle = contenedor.querySelector('pre');
    // Serializado, las comillas interiores van escapadas; lo que importa es
    // que la etiqueta aparece COMO TEXTO dentro del bloque.
    expect(detalle?.textContent).toContain('<img src=x onerror=');
    // Si se hubiera interpretado, existiria el elemento.
    expect(contenedor.querySelector('img')).toBeNull();
  });

  it('sin metadata no hay volcado, pero la IP sigue disponible', async () => {
    fetchAuditLog.mockResolvedValue({
      items: [{ ...PAGINA.items[0]!, metadata: {} }],
      nextBefore: null,
    });

    await montar();

    // El volcado se va: un bloque que se abre y ensena `{}` es peor que nada.
    expect(contenedor.querySelector('pre')).toBeNull();
    // Lo tecnico se aparta, NO se borra: la IP sigue a un clic de distancia.
    expect(contenedor.querySelector('details')).not.toBeNull();
    expect(contenedor.textContent).toContain('203.0.113.7');
  });

  /* ---------------------- Legible para quien no programa ------------------ */

  /*
   * EL CASO QUE MOTIVO LA ETAPA. La pantalla enseñaba el JSON crudo con un
   * `staffId` dentro; ahora se lee quien entro en el equipo.
   */
  it('traduce los identificadores de la metadata a nombres', async () => {
    fetchAuditLog.mockResolvedValue({
      items: [
        {
          ...PAGINA.items[0]!,
          action: 'booking.team_changed',
          metadata: {
            reference: 'FT-2026-0002',
            before: [],
            after: [{ staffId: CLEO, isLead: false }],
          },
        },
      ],
      nextBefore: null,
    });

    await montar();

    expect(contenedor.textContent).toContain('Cleo Limpia');
    expect(contenedor.textContent).toContain('Booking FT-2026-0002');
  });

  /*
   * El UUID no desaparece del sistema: se aparta a «detalles tecnicos». Lo
   * que no puede es estar en la vista principal, que es donde mira quien
   * solo quiere saber que paso.
   */
  it('el UUID no sale en la vista principal, solo en el bloque tecnico', async () => {
    fetchAuditLog.mockResolvedValue({
      items: [
        {
          ...PAGINA.items[0]!,
          action: 'booking.team_changed',
          metadata: { reference: 'FT-1', before: [], after: [{ staffId: CLEO, isLead: false }] },
        },
      ],
      nextBefore: null,
    });

    await montar();

    const principal = contenedor.querySelector('li')?.cloneNode(true) as HTMLElement;
    principal.querySelector('details')?.remove();
    expect(principal.textContent).not.toContain(CLEO);

    // Y en el volcado sigue estando, entero.
    expect(contenedor.querySelector('pre')?.textContent).toContain(CLEO);
  });

  it('agrupa por dia con una cabecera por jornada', async () => {
    const hoy = new Date();
    const ayer = new Date(hoy.getTime() - 86_400_000);

    fetchAuditLog.mockResolvedValue({
      items: [
        { ...PAGINA.items[0]!, id: 'a', occurredAt: hoy.toISOString() },
        { ...PAGINA.items[0]!, id: 'b', occurredAt: ayer.toISOString() },
      ],
      nextBefore: null,
    });

    await montar();

    const cabeceras = [...contenedor.querySelectorAll('section h3')].map((h) => h.textContent);
    expect(cabeceras).toEqual(['Today', 'Yesterday']);
  });

  /*
   * Veintitantas acciones en una lista alfabetica no se recorren; agrupadas
   * por «para que sirve», si.
   */
  it('el filtro de acciones va agrupado por categorias', async () => {
    await montar();

    const grupos = [
      ...contenedor.querySelectorAll<HTMLOptGroupElement>('#auditoria-accion optgroup'),
    ].map((grupo) => grupo.label);

    expect(grupos).toContain('Customer data');
    expect(grupos).toContain('Money');
  });
});

/**
 * Cambia el valor de un campo controlado por React.
 *
 * Asignar `.value` a secas no basta: React guarda el valor anterior en el
 * nodo y, al no ver diferencia, se salta el `onChange`. Hay que escribir a
 * traves del descriptor nativo para que el evento llegue.
 */
function cambiarValor(campo: HTMLInputElement | HTMLSelectElement, valor: string): void {
  const prototipo =
    campo instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototipo, 'value')?.set?.call(campo, valor);
  campo.dispatchEvent(new Event('change', { bubbles: true }));
}
