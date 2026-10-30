-- ===========================================================================
-- MOVER LA CITA
-- ===========================================================================
-- Hasta hoy, reprogramar era CANCELAR Y CREAR OTRA. Eso perdia el historial,
-- cambiaba la referencia que el cliente tiene por escrito y dejaba la
-- retencion de 35 dolares colgando de una cita cancelada.
--
-- A partir de aqui la fila es la misma y lo que cambia es la hora. Esta
-- migracion prepara las dos cosas que eso rompia.
--
-- ---------------------------------------------------------------------------
-- 1. LA OCURRENCIA DE LA SERIE, QUE ES LO QUE SE HABRIA DUPLICADO
-- ---------------------------------------------------------------------------
-- El barrido de las series decide que citas faltan comparando las fechas del
-- calendario con las fechas de las citas que ya existen:
--
--     yaCreadas = fechas de scheduledStart de las reservas de la serie
--
-- Con eso, mover la cita del martes 3 al jueves 5 hace que el martes 3 deje
-- de estar cubierto. En la siguiente pasada —una hora despues— el barrido
-- CREA OTRA CITA EL MARTES 3, y la clienta acaba con dos citas esa semana:
-- la que pidio mover y una recien nacida en el hueco que acababa de dejar.
--
-- La causa es confundir dos cosas distintas: QUE DIA LE TOCABA en el
-- calendario de la serie, y CUANDO SE VA A HACER de verdad. Mientras no se
-- mueve nada son el mismo dia y por eso el error no se veia.
--
-- `seriesOccurrenceDate` guarda la primera. Es inmutable: la cita se puede
-- mover tres veces y sigue siendo la del martes 3, que es lo que el barrido
-- necesita saber para no volver a crearla.
--
-- NULO PARA LAS CITAS SUELTAS, que son casi todas: una cita que nadie
-- genero no ocupa ningun hueco de ningun calendario.
--
-- ---------------------------------------------------------------------------
-- 2. EL RECORDATORIO DE LA VISPERA
-- ---------------------------------------------------------------------------
-- No necesita columna, pero conviene saberlo aqui: el barrido del
-- recordatorio busca reservas SIN una fila `BOOKING_REMINDER` enviada. Si la
-- cita del martes ya recibio su recordatorio y luego se mueve a la semana
-- siguiente, esa fila la deja fuera para siempre y el cliente se queda sin
-- aviso de la fecha nueva.
--
-- Por eso al mover se BORRA esa fila (ver `BookingActionsService`). No se
-- marca como omitida: un recordatorio de un dia que ya no existe no es
-- prueba de nada, y el correo de «hemos movido tu cita» —ese si se conserva—
-- cuenta la fecha nueva.
-- ===========================================================================

ALTER TABLE "bookings" ADD COLUMN "seriesOccurrenceDate" DATE;

-- ---------------------------------------------------------------------------
-- LAS QUE YA EXISTEN SE RELLENAN CON SU PROPIA FECHA
-- ---------------------------------------------------------------------------
-- Mientras nadie las haya movido —y hasta esta migracion no se podia— el dia
-- que les tocaba y el dia que se hacen son el mismo. Se convierte a la zona
-- con la que se le mostro la cita al cliente, que es la que guarda la propia
-- fila: usar UTC moveria de dia las citas de antes de las 8 de la manana.
UPDATE "bookings"
   SET "seriesOccurrenceDate" = ("scheduledStart" AT TIME ZONE "timezone")::date
 WHERE "seriesId" IS NOT NULL;

-- El barrido pregunta por serie, y hasta ahora no habia por donde entrar.
CREATE INDEX "bookings_serie_ocurrencia" ON "bookings"("seriesId", "seriesOccurrenceDate");

-- ---------------------------------------------------------------------------
-- EL AVISO NUEVO
-- ---------------------------------------------------------------------------
-- Va en su propio paso porque Postgres no deja USAR un valor de enumeracion
-- recien anadido en la misma transaccion en que se anade, y el indice del
-- siguiente archivo lo nombra. Es el mismo reparto en dos migraciones que ya
-- se hizo con `JOB_ASSIGNED` (20261011120000 y 20261011120100).
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'BOOKING_RESCHEDULED' AFTER 'JOB_ASSIGNED';
