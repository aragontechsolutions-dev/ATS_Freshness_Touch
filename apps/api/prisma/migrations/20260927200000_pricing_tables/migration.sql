-- TABLA DE VERSIONES DE TARIFAS
--
-- Las tarifas salen del codigo y pasan al panel. Esta tabla es de SOLO
-- ANADIR: cada guardado escribe una fila y ninguna se actualiza ni se borra.
--
-- El motivo no es historico, es contable. `quotes.pricingVersion` y
-- `bookings.pricingVersion` existen desde el primer dia para poder
-- reproducir un presupuesto antiguo, pero hasta ahora apuntaban a un archivo
-- del codigo del que solo existe su version actual. Con esta tabla, cada
-- version es una fila que se puede volver a leer.

CREATE TABLE IF NOT EXISTS "pricing_tables" (
  "version"       VARCHAR(40)  PRIMARY KEY,
  "rates"         JSONB        NOT NULL,
  "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "createdBy"     UUID,
  "createdByName" VARCHAR(160)
);

-- Para «cual es la vigente», que es la consulta de cada peticion del
-- cotizador. La version se ordena sola por texto (AAAA.MM.DD.n), pero se
-- indexa la fecha porque es lo que no depende del formato del identificador.
CREATE INDEX IF NOT EXISTS "pricing_tables_createdAt_idx"
  ON "pricing_tables" ("createdAt" DESC);

-- LA SEMILLA NO VA AQUI, Y ES DELIBERADO.
--
-- La primera fila la escribe la API al arrancar, con las tarifas del codigo
-- y la version que ya llevan las cotizaciones existentes. Ponerla en SQL
-- obligaria a repetir aqui cada importe, y esa copia quedaria desfasada en
-- cuanto alguien tocara `packages/pricing/src/config.ts`: dos fuentes para
-- el mismo precio es justo el fallo que esta etapa viene a cerrar.

-- ---------------------------------------------------------------------------
-- SEGURIDAD A NIVEL DE FILA
-- ---------------------------------------------------------------------------
-- Igual que el resto de tablas (ver 20260920170000_enable_rls): Supabase
-- publica por API REST todo lo que haya en "public". Sin esto, cualquiera con
-- la clave publica del proyecto podria leer la estructura de costes entera de
-- la empresa —cada precio, cada minimo, cada descuento y su historial de
-- cambios—, que es exactamente lo que un competidor querria.
--
-- Se activa SIN crear politicas: "denegar a todo el mundo salvo al
-- propietario", que es el rol con el que se conecta la API.
ALTER TABLE "pricing_tables" ENABLE ROW LEVEL SECURITY;
