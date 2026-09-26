-- ---------------------------------------------------------------------------
-- AUDITORIA: DESDE DONDE SE HIZO CADA COSA
-- ---------------------------------------------------------------------------
-- El registro ya decia QUIEN, QUE y CUANDO. Faltaba DESDE DONDE, que es lo
-- que distingue una accion hecha desde el panel en la oficina de la misma
-- accion hecha desde el sitio publico o por un barrido programado.
--
-- FIELD queda declarado sin usarse: es para la futura aplicacion de campo.
-- Anadirlo ahora cuesta cero y evita migrar el enumerado mas adelante, que en
-- PostgreSQL obliga a un ALTER TYPE que no puede ir dentro de una
-- transaccion con otros cambios.
-- ---------------------------------------------------------------------------

CREATE TYPE "AuditSurface" AS ENUM ('PANEL', 'SITE', 'SYSTEM', 'FIELD');

-- Se anade PERMITIENDO NULOS para poder rellenar las filas que ya existen.
ALTER TABLE "audit_logs" ADD COLUMN "surface" "AuditSurface";

-- ---------------------------------------------------------------------------
-- Relleno de lo que ya habia, SIN INVENTAR.
--
-- Todo lo registrado hasta hoy salio de dos sitios y de ninguno mas: acciones
-- de personal, que solo se pueden hacer desde el panel, y acciones del
-- sistema. No hay ninguna fila de cliente todavia, porque las reservas del
-- sitio no se auditaban: por eso CUSTOMER no aparece aqui.
--
-- Se deduce del actor en vez de poner un valor fijo: marcar como PANEL un
-- barrido nocturno seria escribir un dato falso en el unico sitio del sistema
-- que existe para no tener que fiarse de la memoria de nadie.
-- ---------------------------------------------------------------------------
UPDATE "audit_logs"
SET "surface" = CASE
  WHEN "actorType" = 'STAFF'    THEN 'PANEL'::"AuditSurface"
  WHEN "actorType" = 'CUSTOMER' THEN 'SITE'::"AuditSurface"
  ELSE 'SYSTEM'::"AuditSurface"
END
WHERE "surface" IS NULL;

-- Ya con todas las filas rellenas, pasa a obligatoria: a partir de aqui
-- ninguna entrada nueva puede quedarse sin decir de donde vino.
ALTER TABLE "audit_logs" ALTER COLUMN "surface" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Indices para las dos preguntas que de verdad se hacen al investigar.
-- Sin ellos, cada consulta recorre la tabla entera, y esta tabla solo crece.
-- ---------------------------------------------------------------------------

-- «Que hizo esta persona»
CREATE INDEX "audit_logs_actorId_createdAt_idx"
  ON "audit_logs" ("actorId", "createdAt");

-- «Ensename todas las cancelaciones» / «todos los accesos denegados»
CREATE INDEX "audit_logs_action_createdAt_idx"
  ON "audit_logs" ("action", "createdAt");

-- ---------------------------------------------------------------------------
-- NORMALIZACION DE LO YA REGISTRADO
-- ---------------------------------------------------------------------------
-- Al escribir el catalogo tipado de acciones y entidades salieron a la luz
-- dos incoherencias que llevaban meses ahi y que nadie podia ver, porque el
-- resultado de filtrar siempre parecia plausible:
--
--   1. La MISMA entidad estaba guardada con tres grafias: "booking",
--      "Booking" y "Staff"/"BusinessSetting" en mayusculas. Filtrar «todo lo
--      que le paso a esta reserva» devolvia la mitad de las filas.
--
--   2. El MISMO hecho —cambiar el estado de una reserva— se registraba con
--      dos nombres distintos segun quien lo hiciera: el panel ponia
--      "booking.status.<estado>" y la pantalla del equipo de limpieza ponia
--      "booking.status_changed". Filtrar «todas las completadas» se dejaba
--      fuera justo las que marca el equipo, que son la mayoria.
--
-- SOBRE TOCAR UN REGISTRO DE AUDITORIA. La regla del modulo es que la
-- aplicacion no puede editar ni borrar una fila, y se mantiene: no hay
-- ninguna ruta que lo haga. Esto es una normalizacion de una sola vez, en una
-- migracion, para dejar el historico consultable; no reescribe QUE paso, solo
-- COMO estaba escrito. La accion nueva se deriva de la metadata de la propia
-- fila, no se inventa: si una fila no dice a que estado paso, se queda como
-- estaba.
-- ---------------------------------------------------------------------------

UPDATE "audit_logs" SET "entityType" = 'booking'           WHERE "entityType" = 'Booking';
UPDATE "audit_logs" SET "entityType" = 'staff'             WHERE "entityType" = 'Staff';
UPDATE "audit_logs" SET "entityType" = 'business_settings' WHERE "entityType" = 'BusinessSetting';

UPDATE "audit_logs"
SET "action" = 'booking.status.' || lower("metadata" ->> 'to')
WHERE "action" = 'booking.status_changed'
  AND "metadata" ->> 'to' IS NOT NULL;
