-- ===========================================================================
-- EL AVISO DE QUE LA CITA SE HA MOVIDO SE PUEDE REPETIR
-- ===========================================================================
-- `notifications_unicidad_envio` garantiza que una reserva no reciba dos
-- veces el mismo aviso: una confirmacion duplicada o dos recordatorios de la
-- misma cita son un fallo, y el indice lo impide en la base en vez de confiar
-- en que ningun camino del codigo lo intente.
--
-- `BOOKING_RESCHEDULED` es distinto, y por el mismo motivo que `JOB_ASSIGNED`
-- quedo fuera en la migracion 20261011120100: NO ES UN HECHO QUE OCURRA UNA
-- VEZ. Una cita se puede mover del martes al jueves, y el jueves volver a
-- moverla al sabado. Los dos correos son correctos y el segundo hace mas
-- falta que el primero.
--
-- Con el indice tal como estaba, el segundo movimiento guardaba su envio y
-- chocaba con la restriccion: el correo habria salido —se manda antes de
-- registrar— y lo que fallaba era la fila. El cliente avisado y el registro
-- diciendo que no.
--
-- Esto no abre la puerta a reenvios accidentales: el correo sale desde un
-- movimiento, que es alguien pulsando un boton. No hay reentrega que
-- deduplicar.
-- ===========================================================================

DROP INDEX IF EXISTS "notifications_unicidad_envio";

CREATE UNIQUE INDEX "notifications_unicidad_envio"
  ON "notifications"("bookingId", "event", "channel", "audience")
  WHERE "status" = 'SENT'
    AND "event" <> 'JOB_ASSIGNED'
    AND "event" <> 'BOOKING_RESCHEDULED';
