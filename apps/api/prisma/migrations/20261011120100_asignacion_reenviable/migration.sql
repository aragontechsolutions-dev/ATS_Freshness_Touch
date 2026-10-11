-- ===========================================================================
-- EL AVISO DE ASIGNACION TIENE QUE PODER REPETIRSE
-- ===========================================================================
-- VA EN UNA MIGRACION APARTE DE LA ANTERIOR A PROPOSITO. PostgreSQL no deja
-- usar un valor de enumerado recien anadido dentro de la misma transaccion
-- que lo anadio, y Prisma ejecuta cada archivo en una. Como aqui hay que
-- nombrar 'JOB_ASSIGNED' en la condicion del indice, tiene que estar ya
-- confirmado: de ahi las dos carpetas con un minuto de diferencia.
--
-- ---------------------------------------------------------------------------
-- QUE PROBLEMA RESUELVE
-- ---------------------------------------------------------------------------
-- `notifications_unicidad_envio` garantiza que una reserva no reciba dos
-- veces el mismo aviso. Es justo lo que hace falta para la confirmacion y
-- para el recordatorio, que los dispara un barrido que vuelve a ver la misma
-- reserva una y otra vez.
--
-- Para la asignacion seria PELIGROSO:
--
--   1. Coordinacion asigna el trabajo a Ana. El grupo recibe el aviso.
--   2. Coordinacion lo reasigna a Pedro.
--   3. El segundo aviso choca con el indice y NO SE MANDA.
--   4. El grupo entero sigue creyendo que va Ana.
--
-- El resultado es peor que no haber avisado nunca: un mensaje antiguo que
-- nadie contradice se lee como vigente, y acaba yendo a la casa quien no
-- toca, o nadie.
--
-- La asignacion, ademas, no la dispara ningun barrido: la dispara una persona
-- pulsando un boton. No hay reentrega que deduplicar.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "notifications_unicidad_envio";

CREATE UNIQUE INDEX "notifications_unicidad_envio"
  ON "notifications"("bookingId", "event", "channel", "audience")
  WHERE "status" = 'SENT' AND "event" <> 'JOB_ASSIGNED';
