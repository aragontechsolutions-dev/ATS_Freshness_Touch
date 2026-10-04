-- POR QUE NO HAY PRECIO AUTOMATICO, Y EL IMPORTE PUESTO A MANO
-- ============================================================
-- Dos columnas que salen del mismo problema real: un ajuste de campo en una
-- casa de Gainesville se quedaba sin poder resolverse, y el panel decia un
-- motivo que no era.

-- ---------------------------------------------------------------------------
-- 1. EL MOTIVO
-- ---------------------------------------------------------------------------
-- El motor puede negarse a dar precio por SIETE razones distintas (zona
-- lejana, fuera de Georgia, casa por encima de la tabla, cadencia que ese
-- servicio no ofrece, comercial, fuera del area, propiedad grande). El panel
-- las juntaba todas en «este tamano no tiene precio automatico».
--
-- Casi nunca es el tamano. La mas frecuente con diferencia es la ZONA: fuera
-- de las 35 millas del area metropolitana, Georgia entera se atiende SIN
-- precio automatico por diseno (`docs/17-area-de-servicio.md`). Decirle a
-- quien decide que el problema es el tamano le hace buscar donde no es.
ALTER TABLE "booking_field_adjustments"
  ADD COLUMN "noPriceReasonKey" TEXT;

-- ---------------------------------------------------------------------------
-- 2. QUE EL IMPORTE SE PUSO A MANO
-- ---------------------------------------------------------------------------
-- Cuando no hay precio automatico, administracion teclea el total nuevo. Esa
-- cifra NO LA HA COMPROBADO NADIE: no sale de la tabla de tarifas ni del
-- motor, sale de la cabeza de una persona.
--
-- Por eso se marca. Un total calculado y un total tecleado valen lo mismo en
-- la factura y NO valen lo mismo cuando hay que revisar las cuentas de un
-- mes: ante un importe raro, lo primero que se pregunta es si lo puso el
-- sistema o alguien.
ALTER TABLE "booking_field_adjustments"
  ADD COLUMN "manualPrice" BOOLEAN NOT NULL DEFAULT false;

-- Y la coherencia, en la base: un importe a mano solo tiene sentido en una
-- propuesta que se aplico. Marcarlo en una rechazada o en una que todavia
-- espera seria un dato que contradice al estado.
ALTER TABLE "booking_field_adjustments"
  ADD CONSTRAINT "booking_field_adjustments_manual_price_applied" CHECK (
    "manualPrice" = false OR "state" = 'APPLIED'
  );
