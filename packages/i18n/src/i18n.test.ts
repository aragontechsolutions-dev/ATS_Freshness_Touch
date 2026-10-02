import { describe, expect, it } from 'vitest';
import {
  AddOnCodeSchema,
  AUDIT_ACTIONS,
  AuditEntityTypeSchema,
  AuditSurfaceSchema,
  CHECKLIST_ROOMS,
  FrequencySchema,
  JOB_CHECKLIST_CATALOG,
  ServiceTypeSchema,
} from '@freshness/types';
import { en } from './en';
import { es } from './es';

/** Devuelve todas las rutas de claves hoja de un objeto de traduccion. */
function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      leafKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

describe('recursos de traduccion', () => {
  it('ingles y espanol tienen exactamente las mismas claves', () => {
    const enKeys = leafKeys(en).sort();
    const esKeys = leafKeys(es).sort();

    expect(esKeys).toEqual(enKeys);
  });

  it('no hay textos vacios', () => {
    for (const [locale, resource] of Object.entries({ en, es })) {
      const empty = leafKeys(resource).filter((path) => {
        const value = path
          .split('.')
          .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], resource);
        return typeof value === 'string' && value.trim().length === 0;
      });
      expect(empty, `textos vacios en "${locale}"`).toEqual([]);
    }
  });

  it('cada servicio del catalogo tiene nombre, descripcion y etiqueta de linea', () => {
    for (const code of ServiceTypeSchema.options) {
      expect(en.services[code]?.name, code).toBeTruthy();
      expect(en.services[code]?.description, code).toBeTruthy();
      expect(en.quote.line.service[code], code).toBeTruthy();
    }
  });

  it('cada extra del catalogo tiene etiqueta en el formulario y en el desglose', () => {
    for (const code of AddOnCodeSchema.options) {
      expect(en.addOns[code], code).toBeTruthy();
      expect(en.quote.line.addOn[code], code).toBeTruthy();
    }
  });

  it('cada frecuencia tiene etiqueta y texto de descuento', () => {
    for (const code of FrequencySchema.options) {
      expect(en.frequency[code], code).toBeTruthy();
      expect(en.quote.line.discount[code], code).toBeTruthy();
    }
  });

  /*
   * EL CATALOGO DE TAREAS Y SUS TEXTOS TIENEN QUE IR JUNTOS.
   *
   * Es el mismo guardia que el de la auditoria, y existe por un fallo real de
   * la etapa anterior: una clave de i18n que no existe NO ES UN ERROR DE
   * TYPESCRIPT, es una cadena. En la pantalla del fichaje salio literalmente
   * «admin.clockIns.no_house» delante de quien coordina, con los tipos bien,
   * el lint limpio y las pruebas en verde.
   *
   * Aqui el riesgo es el mismo y peor: la lista de tareas se pinta entera, y
   * una tarea sin texto saldria como «checklist.items.KITCHEN_SINK» en la
   * puerta de una casa.
   */
  it('cada tarea del catalogo tiene texto en los dos idiomas', () => {
    const buscar = (recurso: unknown, ruta: string): unknown =>
      ruta
        .split('.')
        .reduce<unknown>(
          (acc, key) =>
            acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
          recurso,
        );

    for (const [locale, resource] of Object.entries({ en, es })) {
      for (const tarea of JOB_CHECKLIST_CATALOG) {
        expect(
          buscar(resource, `checklist.items.${tarea.code}`),
          `${locale}: falta checklist.items.${tarea.code}`,
        ).toBeTypeOf('string');
      }
    }
  });

  it('y cada estancia de la casa tambien', () => {
    for (const estancia of CHECKLIST_ROOMS) {
      expect(en.checklist.rooms[estancia], estancia).toBeTruthy();
      expect(es.checklist.rooms[estancia], estancia).toBeTruthy();
    }
  });

  /*
   * EL CATALOGO DE AUDITORIA Y SUS ETIQUETAS TIENEN QUE IR JUNTOS.
   *
   * La pantalla construye la clave pegando la accion tal cual
   * ("admin.audit.action." + "booking.status.confirmed"). Sin esta prueba,
   * anadir una accion al contrato deja una fila que en pantalla sale como
   * "admin.audit.action.lo.que.sea" —y solo se descubre cuando alguien esta
   * investigando algo, que es el peor momento posible.
   */
  it('cada accion, superficie y entidad de la auditoria tiene etiqueta en los dos idiomas', () => {
    const buscar = (recurso: unknown, ruta: string): unknown =>
      ruta
        .split('.')
        .reduce<unknown>(
          (acc, key) =>
            acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
          recurso,
        );

    for (const [locale, resource] of Object.entries({ en, es })) {
      for (const accion of AUDIT_ACTIONS) {
        expect(buscar(resource, `admin.audit.action.${accion}`), `${locale}: ${accion}`).toBeTypeOf(
          'string',
        );
      }
      for (const superficie of AuditSurfaceSchema.options) {
        expect(
          buscar(resource, `admin.audit.surface.${superficie}`),
          `${locale}: ${superficie}`,
        ).toBeTypeOf('string');
      }
      for (const entidad of AuditEntityTypeSchema.options) {
        expect(
          buscar(resource, `admin.audit.entity.${entidad}`),
          `${locale}: ${entidad}`,
        ).toBeTypeOf('string');
      }
    }
  });
});
