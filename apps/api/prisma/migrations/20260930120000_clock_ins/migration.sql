-- FICHAJE CON UBICACION
-- =====================
-- Una fila por PERSONA y por EVENTO. No son columnas en `bookings`, y la
-- razon es que el fichaje no es del trabajo: es de quien lo hace.
--
-- Si van dos personas a una casa, cada una ficha su llegada. El `startedAt`
-- de la reserva se pone una vez —la primera que marca que ha llegado—, pero
-- la distancia es de cada cual: una puede estar en la puerta y la otra
-- todavia en el coche a dos manzanas. Con columnas en `bookings` solo cabria
-- una de las dos, y la segunda persona que fichara borraria el dato de la
-- primera.

-- ==========================================================================
-- LO QUE ESTA TABLA NO TIENE, Y ES LA DECISION MAS IMPORTANTE DE TODA LA
-- ETAPA: NO HAY LATITUD NI LONGITUD DEL EMPLEADO.
-- ==========================================================================
-- Las coordenadas de quien ficha llegan al servidor, se convierten en un
-- numero de metros, y se descartan en el mismo metodo que las recibio. No hay
-- columna donde ponerlas ni aqui ni en ningun otro sitio.
--
-- La pregunta del negocio es «¿estaba en la casa?», y para eso la distancia
-- sobra. Guardar el punto construiria, sin que nadie lo decidiera, un
-- historial de por donde anda cada empleada: donde vive, a que hora sale,
-- donde come. Eso no hace falta para nada de lo que esta empresa necesita.
--
-- Y un dato que no se guarda no se puede filtrar en una brecha, ni citar en
-- un juicio, ni pedir por una orden judicial. La unica forma de garantizar
-- eso es no tenerlo.

-- Los dos momentos que se fichan.
CREATE TYPE "ClockInKind" AS ENUM ('ARRIVAL', 'DEPARTURE');

-- POR QUE UN ENUMERADO Y NO UN SIMPLE NULO EN LA DISTANCIA.
--
-- «Sin ubicacion» significa tres cosas muy distintas:
--   DENIED       la persona no dio permiso al navegador.
--   UNAVAILABLE  el GPS no pudo dar una posicion: sotano, zona sin
--                cobertura, movil viejo. No lo decidio nadie.
--   NO_HOUSE     la casa todavia no tiene coordenadas. EL FALLO ES NUESTRO.
--
-- Meter las tres en el mismo cajon señalaria a una empleada por un fallo de
-- nuestra geocodificacion. Con el motivo separado, un «sin ubicacion» se
-- puede leer sin acusar a nadie por error.
CREATE TYPE "ClockInLocationState" AS ENUM ('RECORDED', 'DENIED', 'UNAVAILABLE', 'NO_HOUSE');

CREATE TABLE "booking_clock_ins" (
  "id"        UUID          NOT NULL,
  "bookingId" UUID          NOT NULL,
  "staffId"   UUID          NOT NULL,
  "kind"      "ClockInKind" NOT NULL,

  -- Cuando ocurrio, segun el servidor. NO segun el reloj del movil: un reloj
  -- de telefono se puede cambiar a mano, y la hora del fichaje es justo el
  -- dato que alguien tendria interes en mover.
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  "locationState" "ClockInLocationState" NOT NULL,

  -- Metros en linea recta hasta la casa, enteros. NULL si no hubo ubicacion.
  --
  -- Enteros a proposito: ni el GPS de un movil ni un punto interpolado sobre
  -- una calle justifican decimales, y un 2483.7194 sugiere una exactitud que
  -- no existe.
  "distanceMeters" INTEGER,

  -- El margen de error que reporto el propio navegador.
  --
  -- SIN ESTE NUMERO LA DISTANCIA NO SE PUEDE INTERPRETAR. «A 250 metros» con
  -- un margen de 30 dice que no estaba en la puerta; «a 250 metros» con un
  -- margen de 2000 no dice nada, y actuar sobre ello seria acusar a alguien
  -- por el GPS de su movil.
  "accuracyMeters" INTEGER,

  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "booking_clock_ins_pkey" PRIMARY KEY ("id")
);

-- LA COHERENCIA, EN LA BASE DE DATOS Y NO SOLO EN EL CODIGO.
--
-- Hay distancia si y solo si el estado es RECORDED. Sin esto, un fallo futuro
-- podria dejar una fila que dice «no hubo ubicacion» con 40 metros al lado,
-- o un RECORDED sin distancia, y ninguna de las dos cosas se puede leer.
--
-- Va aqui y no solo en la aplicacion porque es una regla sobre los datos: se
-- cumple igual si algun dia se escribe desde una migracion, desde un script
-- de mantenimiento o desde otro servicio.
ALTER TABLE "booking_clock_ins"
  ADD CONSTRAINT "booking_clock_ins_distance_matches_state" CHECK (
    ("locationState" = 'RECORDED' AND "distanceMeters" IS NOT NULL)
    OR ("locationState" <> 'RECORDED' AND "distanceMeters" IS NULL)
  );

ALTER TABLE "booking_clock_ins"
  ADD CONSTRAINT "booking_clock_ins_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT y no CASCADE, igual que en las asignaciones: un fichaje es el
-- registro de que alguien estuvo en una casa a una hora. Que se borre solo
-- porque se da de baja a esa persona en el sistema es justo lo que no debe
-- pasar.
ALTER TABLE "booking_clock_ins"
  ADD CONSTRAINT "booking_clock_ins_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La consulta real es «los fichajes de este trabajo», que es lo que pinta
-- tanto la pantalla de limpieza como el detalle del panel.
CREATE INDEX "booking_clock_ins_bookingId_idx" ON "booking_clock_ins"("bookingId");

-- Y este es para el futuro modulo de nominas: «los fichajes de esta persona
-- en este periodo». Se crea ahora porque la tabla esta vacia y añadirlo mas
-- tarde, con historial dentro, es una migracion que bloquea escrituras.
CREATE INDEX "booking_clock_ins_staffId_occurredAt_idx"
  ON "booking_clock_ins"("staffId", "occurredAt");

-- ---------------------------------------------------------------------------
-- SEGURIDAD A NIVEL DE FILA
-- ---------------------------------------------------------------------------
-- Igual que el resto de tablas (ver 20260920170000_enable_rls): Supabase
-- publica por API REST todo lo que haya en "public".
--
-- AQUI ES DE LAS MAS GRAVES QUE FALTARA. Sin esto, cualquiera con la clave
-- publica del proyecto podria leer el historial completo de a que hora entro
-- y salio cada empleada de cada casa, y a que distancia estaba. Es
-- informacion sobre personas y sobre sus rutinas, no sobre el negocio.
--
-- Se activa SIN crear politicas: «denegar a todo el mundo salvo al
-- propietario», que es el rol con el que se conecta la API.
ALTER TABLE "booking_clock_ins" ENABLE ROW LEVEL SECURITY;
