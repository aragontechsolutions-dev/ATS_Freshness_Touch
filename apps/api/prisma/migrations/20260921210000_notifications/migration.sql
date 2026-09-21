-- ===========================================================================
-- REGISTRO DE AVISOS ENVIADOS
-- ===========================================================================
-- Guarda cada intento de aviso (correo al cliente, mensaje interno) con su
-- resultado. Existe por dos razones distintas y las dos importan:
--
--   1. RESPONDER A "¿LE LLEGO EL CORREO?". Sin registro, la unica respuesta
--      posible es "deberia haberle llegado", que no sirve cuando un cliente
--      dice que no tiene confirmacion de una reserva que si pago.
--
--   2. NO ENVIAR DOS VECES. El proveedor de pago reenvia el mismo evento si no
--      recibe respuesta a tiempo. La restriccion unica de mas abajo convierte
--      el segundo intento en un error de clave duplicada en vez de en un
--      segundo correo al cliente.
-- ===========================================================================

CREATE TYPE "NotificationEvent" AS ENUM ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'TELEGRAM');
CREATE TYPE "NotificationAudience" AS ENUM ('CUSTOMER', 'INTERNAL');

-- SKIPPED no es un fallo: es "estaba apagado o sin configurar". Distinguirlo
-- de FAILED evita perder una tarde buscando una averia donde solo habia una
-- casilla desmarcada.
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "notifications" (
  "id"        UUID PRIMARY KEY,
  "bookingId" UUID NOT NULL,

  "event"    "NotificationEvent"    NOT NULL,
  "channel"  "NotificationChannel"  NOT NULL,
  "audience" "NotificationAudience" NOT NULL,
  "status"   "NotificationStatus"   NOT NULL,

  -- A donde se envio. Se guarda entero: el panel lo ensena enmascarado, pero
  -- para atender una reclamacion hace falta el destino exacto.
  "target" VARCHAR(200),

  -- Motivo del fallo, para diagnosticar sin abrir los registros del servidor.
  "failureReason" TEXT,

  -- Identificador que devuelve el proveedor. Permite buscar el envio en su
  -- panel cuando el cliente dice que no le llego y aqui consta enviado.
  "providerMessageId" VARCHAR(200),

  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "notifications_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- LA RESTRICCION QUE EVITA EL AVISO DUPLICADO
-- ---------------------------------------------------------------------------
-- Una reserva solo puede tener UN aviso por cada combinacion de hecho, canal y
-- destinatario. Si el webhook del proveedor de pago se reentrega, el segundo
-- intento choca aqui y no se envia nada.
--
-- Cubre solo los envios que de verdad salieron (SENT): un intento fallido o
-- omitido debe poder repetirse cuando se arregle la configuracion. Por eso es
-- un indice PARCIAL y no una restriccion normal.
CREATE UNIQUE INDEX "notifications_unicidad_envio"
  ON "notifications"("bookingId", "event", "channel", "audience")
  WHERE "status" = 'SENT';

-- La agenda del panel abre el detalle de una reserva y pide sus avisos.
CREATE INDEX "notifications_bookingId_createdAt_idx"
  ON "notifications"("bookingId", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- SEGURIDAD A NIVEL DE FILA
-- ---------------------------------------------------------------------------
-- Igual que el resto de tablas (ver 20260920170000_enable_rls): Supabase
-- publica automaticamente por API REST todo lo que haya en "public". Sin esto,
-- cualquiera con la clave publica del proyecto podria leer a que correos se
-- avisa de cada reserva, que es la lista de clientes.
--
-- Se activa SIN crear politicas: "denegar a todo el mundo salvo al
-- propietario", que es el rol con el que se conecta la API.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
