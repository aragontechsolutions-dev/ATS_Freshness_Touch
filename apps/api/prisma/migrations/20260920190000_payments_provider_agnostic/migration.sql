-- ===========================================================================
-- PAGOS INDEPENDIENTES DEL PROVEEDOR
-- ===========================================================================
-- La tabla "payments" nacio hablando de Stripe: "stripePaymentIntentId",
-- "stripeCustomerId". Al construir el modulo de pagos con adaptadores (igual
-- que el de distancia) eso deja de ser cierto: el simulador local tambien
-- guarda movimientos aqui, y escribir sus identificadores en una columna que
-- dice "stripe" seria guardar un dato que miente sobre su origen.
--
-- Se renombran las columnas y se anade "provider", que dice quien custodia
-- de verdad el movimiento. La unicidad pasa a ser del par (proveedor,
-- identificador): el simulador imita el formato "pi_..." de Stripe, asi que
-- el identificador por si solo no distingue nada.
-- ===========================================================================

-- --- 1. Quien custodia el movimiento ---------------------------------------
-- Se crea con valor por defecto para rellenar las filas existentes y despues
-- se retira: a partir de ahora cada insercion debe declarar su proveedor.
ALTER TABLE "payments" ADD COLUMN "provider" VARCHAR(20) NOT NULL DEFAULT 'stripe';
ALTER TABLE "payments" ALTER COLUMN "provider" DROP DEFAULT;

-- --- 2. Nombres que no prometen un proveedor concreto ----------------------
ALTER TABLE "payments" RENAME COLUMN "stripePaymentIntentId" TO "providerPaymentIntentId";
ALTER TABLE "payments" RENAME COLUMN "stripeCustomerId" TO "providerCustomerId";

-- --- 3. Unicidad del par -----------------------------------------------------
DROP INDEX IF EXISTS "payments_stripePaymentIntentId_key";
CREATE UNIQUE INDEX "payments_provider_providerPaymentIntentId_key"
  ON "payments"("provider", "providerPaymentIntentId");

-- --- 4. Estados que faltaban -------------------------------------------------
-- El enum original solo cubria una parte de los estados reales de una
-- autorizacion de tarjeta. Sin estos dos valores habria que guardar un estado
-- que no es el verdadero:
--   REQUIRES_ACTION: el banco pide verificar al titular (3D Secure). La
--     autorizacion no esta rechazada, esta esperando al cliente.
--   PROCESSING:      el banco todavia esta decidiendo.
-- Guardar cualquiera de los dos como "REQUIRES_CONFIRMATION" haria que el
-- equipo de soporte leyera una situacion distinta de la real.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_ACTION' AFTER 'REQUIRES_CONFIRMATION';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING' AFTER 'REQUIRES_ACTION';
