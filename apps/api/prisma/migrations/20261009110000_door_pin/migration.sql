-- EL PIN DE LA PUERTA
-- ===================
-- Donde el cliente marca, sobre un mapa, por donde se entra de verdad a su
-- casa. El geocodificador del Censo resuelve bien una calle de Atlanta y
-- regular una carretera comarcal: interpola sobre el tramo de via y en el
-- campo deja la casa a cientos de metros. Quien sabe donde esta la puerta es
-- quien vive alli.

-- ---------------------------------------------------------------------------
-- 1. POR QUE EN LA RESERVA Y NO EN LA DIRECCION
-- ---------------------------------------------------------------------------
-- `addresses` ya tiene latitude/longitude, y ahi era donde «tocaba» ponerlo.
-- Se descarto por una razon que no es tecnica: en la direccion, el pin seria
-- una propiedad PERMANENTE de la casa, igual que la coordenada geocodificada,
-- y entonces la promesa que se le hace al cliente —«esto se borra»— no
-- tendria de donde colgar. Una direccion no termina nunca; un trabajo si.
--
-- En la reserva, el pin nace y muere con el trabajo, y la promesa es
-- verificable. Cuesta que el cliente vuelva a marcarlo si reserva otra vez.
-- Se acepta ese coste a cambio de que lo prometido sea verdad.
ALTER TABLE "bookings" ADD COLUMN "doorPinLatitude"  DOUBLE PRECISION;
ALTER TABLE "bookings" ADD COLUMN "doorPinLongitude" DOUBLE PRECISION;

-- ---------------------------------------------------------------------------
-- 2. LAS DOS MITADES VAN JUNTAS O NO VA NINGUNA
-- ---------------------------------------------------------------------------
-- Media coordenada no es un punto: es un dato que parece util y señala a
-- cualquier sitio. Mejor que no exista a que exista a medias.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_door_pin_completo" CHECK (
    ("doorPinLatitude" IS NULL) = ("doorPinLongitude" IS NULL)
  );

-- ---------------------------------------------------------------------------
-- 3. Y CAEN DENTRO DE GEORGIA, COMPROBADO EN LA BASE
-- ---------------------------------------------------------------------------
-- El contrato de Zod ya lo valida, asi que esto es la SEGUNDA capa, y existe
-- por lo de siempre: el contrato protege la puerta de entrada de la API, no
-- protege un UPDATE a mano, un script de migracion de datos ni una version
-- futura del codigo que se olvide de validar.
--
-- Caza en particular el fallo clasico de intercambiar latitud y longitud, que
-- deja Georgia en medio del oceano Indico.
--
-- NO es una comprobacion de area de servicio: de eso se encargan las zonas, y
-- son editables desde el panel. Esto son los limites del estado con margen,
-- que no cambian.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_door_pin_en_georgia" CHECK (
    "doorPinLatitude" IS NULL OR (
      "doorPinLatitude"  BETWEEN 29.5 AND 35.5 AND
      "doorPinLongitude" BETWEEN -86.0 AND -80.0
    )
  );

-- ---------------------------------------------------------------------------
-- 4. SIN INDICE, Y ES DELIBERADO
-- ---------------------------------------------------------------------------
-- El barrido que borra los pines vencidos recorre `bookings` entero cada
-- pasada. Lo suyo seria un indice PARCIAL sobre las filas con pin, pero en
-- este proyecto los indices parciales causan deriva de esquema: Prisma los ve
-- y no sabe expresarlos, asi que intentaria «arreglarlos» en cada migracion
-- (ver `docs/10-modelo-de-datos.md`).
--
-- A la escala de una empresa de limpieza —miles de reservas, no millones— un
-- recorrido cada media hora no se nota. Si algun dia se nota, la salida es un
-- indice normal sobre "scheduledEnd", no uno parcial.
