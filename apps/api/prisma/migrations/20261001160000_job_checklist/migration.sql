-- LA LISTA DE VERIFICACION DE UN TRABAJO
-- ======================================
-- Lo que hay que hacer en cada estancia de la casa, marcado a medida que se
-- hace.

-- ==========================================================================
-- UNA FILA POR TAREA MARCADA. NO HAY COPIA DE LA LISTA.
-- ==========================================================================
-- Esta tabla NO guarda la lista de tareas de cada reserva: guarda las que se
-- han MARCADO. La lista que se pinta sale del catalogo del codigo
-- (`packages/types/src/job-checklist.ts`).
--
-- La alternativa era copiar las veinticinco tareas sobre cada reserva al
-- crearla, como se hace con el precio. Se descarto por tres motivos:
--
--   1. EL PRECIO SE FOTOGRAFIA PORQUE ES UN ACUERDO con el cliente, y no
--      puede cambiar porque alguien toque la pantalla de Tarifas. Una lista
--      de tareas no es un acuerdo con nadie: es como trabaja esta empresa, y
--      cuando cambia, cambia para todos.
--   2. Serian veinticinco filas por reserva diciendo «no marcada», que es
--      exactamente lo mismo que no tener fila. Con mil trabajos al ano, son
--      veinticinco mil filas vacias.
--   3. Habria que escribirlas AL RESERVAR, dentro del camino del dinero. Ese
--      camino ya hace demasiado, y cualquier cosa que se le añada es una
--      forma nueva de que una reserva pagada falle.
--
-- El precio de esa decision se paga con una regla, escrita en el contrato: un
-- codigo de tarea NO SE BORRA NI SE REUTILIZA NUNCA. Se retira y se queda en
-- el catalogo. Es la misma regla que ya siguen los servicios retirados y las
-- zonas D y E: su codigo esta escrito en reservas que ya existen.

CREATE TABLE "booking_checklist_items" (
  "id"        UUID NOT NULL,
  "bookingId" UUID NOT NULL,

  -- El codigo de la tarea en el catalogo. TEXTO Y NO UN ENUMERADO DE
  -- POSTGRES, y es deliberado: las tareas se añaden y se retiran al ritmo en
  -- que la empresa cambia como limpia, y con un enumerado cada cambio de la
  -- lista seria una migracion. El catalogo del codigo es la unica fuente de
  -- verdad de que codigos valen, y el servidor lo comprueba antes de
  -- escribir aqui.
  "itemCode" VARCHAR(64) NOT NULL,

  -- Quien la marco.
  --
  -- RESTRICT y no CASCADE, igual que en los fichajes: que se marco y quien lo
  -- marco es el registro de un trabajo hecho, y no debe borrarse porque se de
  -- de baja a esa persona en el sistema.
  "doneByStaffId" UUID NOT NULL,

  -- Cuando se marco, segun el reloj del SERVIDOR. No segun el del movil: un
  -- reloj de telefono se cambia a mano.
  "doneAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "booking_checklist_items_pkey" PRIMARY KEY ("id")
);

-- UNA TAREA SOLO PUEDE ESTAR MARCADA UNA VEZ EN UN TRABAJO.
--
-- Es la guardia contra el doble toque, que en esta pantalla no es un caso
-- raro: se usa de pie, con una mano y a veces con guantes. Sin esto, dos
-- toques seguidos dejarian dos filas y la lista diria que la tarea se hizo
-- dos veces, con dos autores distintos si van dos personas a la casa.
--
-- Y es lo que hace que marcar sea idempotente: el servidor puede escribir sin
-- mirar antes si ya estaba, que es justo lo que hace falta con una conexion
-- mala en la puerta de una casa.
CREATE UNIQUE INDEX "booking_checklist_items_bookingId_itemCode_key"
  ON "booking_checklist_items"("bookingId", "itemCode");

ALTER TABLE "booking_checklist_items"
  ADD CONSTRAINT "booking_checklist_items_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_checklist_items"
  ADD CONSTRAINT "booking_checklist_items_doneByStaffId_fkey"
  FOREIGN KEY ("doneByStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La consulta real es «las tareas marcadas de este trabajo», que es lo que
-- pintan tanto la pantalla de limpieza como el detalle del panel. La
-- resuelve el indice unico de arriba, que empieza por "bookingId": no se
-- crea un segundo indice sobre la misma columna porque seria un duplicado que
-- solo cuesta escrituras.

-- ---------------------------------------------------------------------------
-- SEGURIDAD A NIVEL DE FILA
-- ---------------------------------------------------------------------------
-- Igual que el resto de tablas (ver 20260920170000_enable_rls): Supabase
-- publica por API REST todo lo que haya en "public".
--
-- Aqui lo que protege no es un dato del cliente, es un registro sobre el
-- trabajo de personas concretas: a que hora marco cada cual cada tarea en
-- cada casa. Con la clave publica del proyecto y sin esto, cualquiera podria
-- sacar el ritmo de trabajo de cada empleada.
--
-- Se activa SIN crear politicas: «denegar a todo el mundo salvo al
-- propietario», que es el rol con el que se conecta la API.
ALTER TABLE "booking_checklist_items" ENABLE ROW LEVEL SECURITY;
