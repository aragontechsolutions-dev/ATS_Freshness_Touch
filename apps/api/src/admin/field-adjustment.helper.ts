import { QuoteAddOnInputSchema, type FieldAdjustment } from '@freshness/types';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';

/**
 * LEER UN AJUSTE DE CAMPO, EN UN SOLO SITIO
 * =========================================
 * La selección y la traducción a contrato viven aquí porque las usan DOS
 * caminos: el detalle del panel y la pantalla del equipo. Si cada uno leyera
 * por su cuenta, coordinación y el responsable podrían estar viendo
 * propuestas distintas del mismo trabajo, que es la clase de discrepancia que
 * convierte «yo avisé» en una discusión sin árbitro.
 */

export const AJUSTE_SELECT = {
  id: true,
  state: true,
  bookedSquareFeet: true,
  bookedBedrooms: true,
  bookedBathrooms: true,
  bookedAddOns: true,
  foundSquareFeet: true,
  foundBedrooms: true,
  foundBathrooms: true,
  foundAddOns: true,
  note: true,
  differenceCents: true,
  newTotalCents: true,
  proposedAt: true,
  proposedBy: { select: { firstName: true } },
  resolvedAt: true,
  resolutionNote: true,
  resolvedBy: { select: { firstName: true } },
} satisfies Prisma.BookingFieldAdjustmentSelect;

export type FilaAjuste = Prisma.BookingFieldAdjustmentGetPayload<{
  select: typeof AJUSTE_SELECT;
}>;

/**
 * Los extras guardados, releídos con el contrato.
 *
 * El JSON de la base es opaco: lo que hay dentro lo escribió alguna versión
 * del código, puede que no la de hoy. Validarlo al leer es lo que impide que
 * un extra con forma vieja se cuele en el motor de precios y salga un importe
 * que nadie sabe explicar. `catch([])` porque una lista ilegible es «sin
 * extras», no una pantalla rota.
 */
export const ExtrasGuardadosSchema = z.array(QuoteAddOnInputSchema).catch([]);

export function ajusteAContrato(fila: FilaAjuste): FieldAdjustment {
  return {
    id: fila.id,
    state: fila.state,
    booked: {
      squareFeet: fila.bookedSquareFeet,
      bedrooms: fila.bookedBedrooms,
      bathrooms: fila.bookedBathrooms,
      addOns: ExtrasGuardadosSchema.parse(fila.bookedAddOns),
    },
    found: {
      squareFeet: fila.foundSquareFeet,
      bedrooms: fila.foundBedrooms,
      bathrooms: fila.foundBathrooms,
      addOns: ExtrasGuardadosSchema.parse(fila.foundAddOns),
    },
    note: fila.note,
    proposedByFirstName: fila.proposedBy.firstName,
    proposedAt: fila.proposedAt.toISOString(),
    differenceCents: fila.differenceCents,
    newTotalCents: fila.newTotalCents,
    resolvedByFirstName: fila.resolvedBy?.firstName ?? null,
    resolvedAt: fila.resolvedAt?.toISOString() ?? null,
    resolutionNote: fila.resolutionNote,
  };
}
