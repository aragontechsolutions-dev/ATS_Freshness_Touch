-- DOS DESAJUSTES ENTRE EL ESQUEMA Y LA BASE, CORREGIDOS
-- =====================================================
-- Aparecieron al comprobar, contra un Postgres real, si la restriccion CHECK
-- del fichaje generaba deriva (no la genera: Prisma no ve los CHECK). De
-- paso, `prisma migrate diff` delato estos dos, que llevaban meses ahi.
--
-- NINGUNO ROMPIA NADA HOY. El problema era el de mañana: la siguiente vez
-- que alguien ejecutara `prisma migrate dev`, Prisma habria generado una
-- migracion «corrigiendo» los dos a su manera —incluido BORRAR un indice
-- util— mezclada con el trabajo que esa persona estuviera haciendo. Un
-- cambio de esquema que nadie pidio y que nadie revisa.

-- ---------------------------------------------------------------------------
-- 1. El indice de las tarifas: existia en la base y no en el esquema
-- ---------------------------------------------------------------------------
-- Lo creaba la migracion de la etapa 2.22 y nadie lo declaro en
-- `schema.prisma`, asi que para Prisma sobraba. Se arregla DECLARANDOLO, no
-- borrandolo: acelera «cual es la tabla de tarifas vigente», que es una
-- consulta de cada peticion del cotizador.
--
-- Nada que hacer en SQL —el indice ya esta— y el `CREATE INDEX IF NOT
-- EXISTS` lo deja igualmente correcto en una base recien creada.
CREATE INDEX IF NOT EXISTS "pricing_tables_createdAt_idx"
  ON "pricing_tables" ("createdAt" DESC);

-- ---------------------------------------------------------------------------
-- 2. La clave foranea de los avisos: le faltaba ON UPDATE
-- ---------------------------------------------------------------------------
-- La migracion de la etapa 2.5 la escribio a mano con `ON DELETE CASCADE` y
-- sin clausula de actualizacion, asi que Postgres le puso `NO ACTION`. El
-- esquema declara `onDelete: Cascade`, y de ahi Prisma deduce `ON UPDATE
-- CASCADE`: de ahi el desajuste.
--
-- TODAS LAS DEMAS CLAVES FORANEAS DEL PROYECTO LLEVAN `ON UPDATE CASCADE`,
-- porque las genero Prisma. Esta era la unica a mano, y la unica distinta.
--
-- EN LA PRACTICA NO CAMBIA NADA: el identificador de una reserva es un UUID
-- que no se modifica nunca, asi que la regla de actualizacion no llega a
-- aplicarse. Se alinea para que el esquema y la base digan lo mismo, no
-- porque hiciera falta funcionalmente.
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_bookingId_fkey";

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
