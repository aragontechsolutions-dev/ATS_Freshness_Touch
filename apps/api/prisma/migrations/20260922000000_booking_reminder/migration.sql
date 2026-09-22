-- ===========================================================================
-- RECORDATORIO DE LA VISPERA
-- ===========================================================================
-- Un valor nuevo en el enum de avisos. El indice unico parcial que ya existe
-- sobre (bookingId, event, channel, audience) lo cubre automaticamente, asi
-- que el recordatorio hereda la misma garantia: una reserva no puede recibir
-- dos.
--
-- Eso importa aqui mas que en los demas avisos. La confirmacion la dispara un
-- hecho puntual; el recordatorio lo dispara un BARRIDO que pasa cada pocos
-- minutos y vuelve a ver la misma reserva hasta que llega la cita. Sin esa
-- restriccion serian decenas de correos identicos.
-- ===========================================================================

ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'BOOKING_REMINDER' AFTER 'BOOKING_CANCELLED';

-- ---------------------------------------------------------------------------
-- INDICE PARA EL BARRIDO
-- ---------------------------------------------------------------------------
-- El barrido pregunta lo mismo cada pocos minutos: que reservas CONFIRMADAS
-- empiezan dentro de la ventana. Sin indice, cada pasada recorre la tabla
-- entera de reservas, y esa tabla solo crece.
--
-- Es parcial: solo las confirmadas. Las canceladas y completadas nunca
-- necesitan recordatorio, y dejarlas fuera mantiene el indice pequeno.
CREATE INDEX IF NOT EXISTS "bookings_recordatorio_idx"
  ON "bookings"("scheduledStart")
  WHERE "status" = 'CONFIRMED';
