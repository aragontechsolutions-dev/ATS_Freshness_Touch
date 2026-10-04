-- EL AJUSTE DE CAMPO
-- ==================
-- Lo que el equipo encuentra al llegar no siempre es lo que el cliente
-- reservo. Una casa de «900 pies» que son 1.300. Un «limpiar el horno» que
-- son tres neveras.

-- ==========================================================================
-- LA PROPUESTA ES UNA FILA APARTE. LA RESERVA NO SE TOCA.
-- ==========================================================================
-- Esta tabla NO modifica `bookings`. Guarda lo que el lider encontro, con la
-- diferencia ya calculada, y la reserva sigue intacta hasta que coordinacion
-- aprueba desde el panel.
--
-- Hasta hoy NO HABIA EN TODO EL SISTEMA un solo sitio capaz de mover un
-- precio ya pactado: el panel cambia el estado, asigna equipo, cobra y libera
-- el deposito, pero `serviceCents`, `totalCents` y `lines` estaban congelados
-- desde que se reservaba. Que el primero en poder moverlos fuera el movil de
-- quien esta en la puerta, sin revision, seria invertir el orden de las
-- cautelas:
--
--   1. EL CERO DE MAS. Teclear 13000 donde iban 1300 es el error mas
--      probable de esa pantalla, y se teclea de pie y con una mano.
--   2. NADIE HA HABLADO CON EL CLIENTE. Subirle el precio sin avisar es la
--      forma mas rapida de perderlo.
--
-- El trabajo, mientras tanto, se hace igual: el ajuste no bloquea nada.

-- Los cuatro estados de una propuesta.
--
-- SUPERSEDED existe porque el lider puede corregirse: si manda una segunda
-- propuesta, la primera no se borra —era lo que creyo ver, y eso tambien es
-- informacion— sino que queda sustituida. Borrarla dejaria un hueco donde
-- antes habia una cifra, que es justo lo que no se quiere al revisar algo.
CREATE TYPE "FieldAdjustmentState" AS ENUM ('PROPOSED', 'APPLIED', 'REJECTED', 'SUPERSEDED');

CREATE TABLE "booking_field_adjustments" (
  "id"        UUID NOT NULL,
  "bookingId" UUID NOT NULL,

  "state" "FieldAdjustmentState" NOT NULL DEFAULT 'PROPOSED',

  -- ------------------------------------------------------------------------
  -- LAS DOS COLUMNAS: LO CONTRATADO Y LO ENCONTRADO
  -- ------------------------------------------------------------------------
  -- Lo contratado se COPIA aqui, no se lee de `bookings` al pintarlo. Parece
  -- redundante y no lo es: si coordinacion aprueba el ajuste, la reserva pasa
  -- a tener los valores nuevos, y entonces la propuesta diria «de 1.300 a
  -- 1.300». El salto —que es lo unico que se revisa— se habria perdido.
  "bookedSquareFeet" INTEGER NOT NULL,
  "bookedBedrooms"   INTEGER NOT NULL,
  "bookedBathrooms"  INTEGER NOT NULL,
  "bookedAddOns"     JSONB   NOT NULL DEFAULT '[]',

  "foundSquareFeet" INTEGER NOT NULL,
  "foundBedrooms"   INTEGER NOT NULL,
  "foundBathrooms"  INTEGER NOT NULL,
  "foundAddOns"     JSONB   NOT NULL DEFAULT '[]',

  -- Por que. Lo lee una persona que no estuvo alli y que va a tener que
  -- llamar al cliente: sin esto, un «1.300» a secas no se puede defender por
  -- telefono.
  "note" TEXT NOT NULL,

  -- ------------------------------------------------------------------------
  -- LA DIFERENCIA, CALCULADA AL PROPONER
  -- ------------------------------------------------------------------------
  -- NULL cuando no hay precio automatico: una casa por encima del ultimo
  -- tramo de la tabla de precios no se tarifa sola, y entonces el importe lo
  -- pone coordinacion a mano. NULL y no cero, porque un cero diria «no cambia
  -- nada», que es lo contrario de lo que pasa.
  "differenceCents" INTEGER,
  "newTotalCents"   INTEGER,

  -- La version de tarifas con la que se calculo. Es la de la RESERVA, no la
  -- vigente: aprobar un ajuste no puede colar de tapadillo los precios de hoy
  -- en un trabajo contratado el mes pasado.
  "pricingVersion" TEXT NOT NULL,

  -- Quien lo propuso. RESTRICT, como los fichajes: es el registro de lo que
  -- alguien vio en una casa, y no debe borrarse porque se de de baja a esa
  -- persona.
  "proposedByStaffId" UUID NOT NULL,
  "proposedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  -- Quien decidio. NULL mientras espera.
  "resolvedByStaffId" UUID,
  "resolvedAt"        TIMESTAMPTZ(3),
  "resolutionNote"    TEXT,

  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "booking_field_adjustments_pkey" PRIMARY KEY ("id")
);

-- LA COHERENCIA DE LA RESOLUCION, EN LA BASE Y NO SOLO EN EL CODIGO.
--
-- Una propuesta resuelta tiene quien y cuando; una que espera, no tiene ni lo
-- uno ni lo otro. Sin esto, un fallo futuro podria dejar una fila que dice
-- «aprobada» sin que conste quien la aprobo, que es exactamente el dato por
-- el que se mira una fila asi.
ALTER TABLE "booking_field_adjustments"
  ADD CONSTRAINT "booking_field_adjustments_resolution_complete" CHECK (
    ("state" = 'PROPOSED' AND "resolvedByStaffId" IS NULL AND "resolvedAt" IS NULL)
    OR ("state" = 'SUPERSEDED')
    OR ("state" IN ('APPLIED', 'REJECTED') AND "resolvedByStaffId" IS NOT NULL
        AND "resolvedAt" IS NOT NULL)
  );

-- Y la del importe: o estan las dos cifras o no esta ninguna. Una diferencia
-- sin total nuevo —o al reves— no se puede leer ni actuar sobre ella.
ALTER TABLE "booking_field_adjustments"
  ADD CONSTRAINT "booking_field_adjustments_amounts_together" CHECK (
    ("differenceCents" IS NULL AND "newTotalCents" IS NULL)
    OR ("differenceCents" IS NOT NULL AND "newTotalCents" IS NOT NULL)
  );

ALTER TABLE "booking_field_adjustments"
  ADD CONSTRAINT "booking_field_adjustments_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_field_adjustments"
  ADD CONSTRAINT "booking_field_adjustments_proposedByStaffId_fkey"
  FOREIGN KEY ("proposedByStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking_field_adjustments"
  ADD CONSTRAINT "booking_field_adjustments_resolvedByStaffId_fkey"
  FOREIGN KEY ("resolvedByStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La consulta real es «los ajustes de este trabajo, el mas reciente primero»,
-- que es lo que pintan la pantalla del lider y el detalle del panel.
CREATE INDEX "booking_field_adjustments_bookingId_proposedAt_idx"
  ON "booking_field_adjustments"("bookingId", "proposedAt" DESC);

-- NO HAY INDICE UNICO PARCIAL PARA «UNA SOLA PROPUESTA ABIERTA», y conviene
-- decir por que no: Prisma SI ve los indices parciales y no sabe expresarlos
-- en el esquema, asi que cada uno deja una deriva permanente entre el esquema
-- y la base (`docs/10-modelo-de-datos.md`). En la Etapa 3.2 se decidio no
-- usar ninguno por eso mismo.
--
-- La regla —como mucho una propuesta en PROPOSED por reserva— la garantiza el
-- servicio dentro de una transaccion: al proponer, marca SUPERSEDED las
-- abiertas anteriores y crea la nueva. La carrera que eso no cubre exige dos
-- lideres mandando a la vez en el mismo trabajo, y un trabajo tiene UN lider.

-- ---------------------------------------------------------------------------
-- SEGURIDAD A NIVEL DE FILA
-- ---------------------------------------------------------------------------
-- Igual que el resto de tablas (ver 20260920170000_enable_rls): Supabase
-- publica por API REST todo lo que haya en "public".
--
-- Aqui lo que protege es dinero: los importes propuestos de trabajos reales,
-- con el tamano de la casa de cada cliente al lado. Se activa SIN crear
-- politicas: «denegar a todo el mundo salvo al propietario», que es el rol
-- con el que se conecta la API.
ALTER TABLE "booking_field_adjustments" ENABLE ROW LEVEL SECURITY;
