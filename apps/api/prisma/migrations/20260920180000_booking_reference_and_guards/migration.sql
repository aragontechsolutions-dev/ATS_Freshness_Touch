-- ===========================================================================
-- SALVAGUARDAS DE RESERVA
-- ===========================================================================

-- --- 1. Referencia legible y unica: FT-2026-0001 ---------------------------
-- Se usa una secuencia de PostgreSQL y no un "contar reservas + 1" porque
-- contar es una condicion de carrera: dos reservas simultaneas obtendrian el
-- mismo numero. La secuencia es atomica por diseno.
CREATE SEQUENCE IF NOT EXISTS booking_reference_seq START 1;

-- --- 2. Un cliente no puede tener dos citas a la misma hora ----------------
-- Protege contra el doble envio del formulario (doble clic, reintento del
-- navegador, pulsar "atras" y volver a enviar). Sin esto, el cliente acabaria
-- con dos reservas identicas y dos depositos retenidos.
--
-- Las canceladas quedan fuera del indice: tras cancelar, el cliente debe poder
-- volver a reservar esa misma hora.
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_customer_start_unique"
  ON "bookings" ("customerId", "scheduledStart")
  WHERE "status" <> 'CANCELLED';
