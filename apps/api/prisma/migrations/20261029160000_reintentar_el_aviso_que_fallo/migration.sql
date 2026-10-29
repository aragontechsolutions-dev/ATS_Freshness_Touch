-- ===========================================================================
-- REINTENTAR EL AVISO QUE FALLO
-- ===========================================================================
-- Hasta hoy, un correo que fallaba se guardaba con `status = 'FAILED'` y su
-- motivo, y ahi se quedaba. Sin reintento y sin aviso.
--
-- Si el proveedor de correo estaba caido el minuto en que alguien confirmaba
-- su reserva, esa persona HABIA PAGADO Y NO TENIA NADA POR ESCRITO, y nadie
-- se enteraba hasta que alguien mirase este registro — que no tiene pantalla.
--
-- ---------------------------------------------------------------------------
-- LA FILA SE REESCRIBE, NO SE DUPLICA
-- ---------------------------------------------------------------------------
-- El indice unico de esta tabla es PARCIAL (`WHERE status = 'SENT'`), asi que
-- varias filas fallidas del mismo aviso podrian convivir. No se hace: una
-- fila por aviso, con el numero de intentos dentro. El registro contesta
-- «salio o no salio, y cuanto costo», no «aqui tienes cuatro filas casi
-- iguales».
--
-- La consecuencia, que hay que saber: `failureReason` guarda el motivo del
-- ULTIMO intento, no el de todos.
--
-- ---------------------------------------------------------------------------
-- LAS FILAS QUE YA ESTABAN FALLIDAS NO SE REINTENTAN
-- ---------------------------------------------------------------------------
-- `nextAttemptAt` nace NULO y nulo significa «no hay nada programado». Las
-- filas anteriores a esta migracion se quedan asi a proposito: reenviar hoy
-- la confirmacion de una reserva de hace tres semanas no ayuda a nadie y
-- confunde a quien la reciba.
-- ===========================================================================

ALTER TABLE "notifications"
    ADD COLUMN "attempts"      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3);

-- El barrido pregunta siempre lo mismo: que hay fallido y ya le toca. Indice
-- PARCIAL porque la inmensa mayoria de las filas estan enviadas y no tienen
-- nada que hacer aqui.
CREATE INDEX "notifications_reintento_idx"
    ON "notifications"("nextAttemptAt")
    WHERE "status" = 'FAILED' AND "nextAttemptAt" IS NOT NULL;
