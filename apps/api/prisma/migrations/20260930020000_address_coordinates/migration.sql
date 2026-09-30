-- COORDENADAS DE LA DIRECCION
-- ===========================
-- El sistema sabia la direccion de cada casa en texto, pero no donde cae en
-- el mapa. Sin eso no se puede responder a la unica pregunta que justifica
-- el fichaje con ubicacion: «¿estaba esta persona en la casa cuando dijo que
-- habia llegado?».
--
-- SOBRE PRIVACIDAD, PORQUE LA PREGUNTA ES LEGITIMA: geocodificar la casa NO
-- añade exposicion ninguna. La direccion completa ya estaba en esta misma
-- tabla, en texto plano. Un par de coordenadas no revela nada que
-- «123 Main St, Atlanta» no revelara. Lo que se decidio NO guardar es la
-- ubicacion del empleado, y eso se cumple en otro sitio: sus coordenadas se
-- descartan en el servidor en cuanto se calcula la distancia.
--
-- TODO NULL: una direccion sin geocodificar es el estado normal al empezar,
-- y lo sigue siendo si el servicio externo no encuentra la casa. Nada del
-- sistema depende de que esto tenga valor.

-- La precision de la coincidencia. NO es un adorno: decide si la distancia
-- de un fichaje significa algo.
--   ROOFTOP       el portal. «llego a 40 metros» quiere decir la puerta.
--   INTERPOLATED  un punto estimado sobre el tramo de calle, que es lo que
--                 devuelve el geocodificador del Censo casi siempre. Sirve
--                 para «estaba en esta calle», no para «en este portal».
CREATE TYPE "GeocodePrecision" AS ENUM ('ROOFTOP', 'INTERPOLATED');

-- `geocodeMatchedAddress` ES LA UNICA DEFENSA CONTRA EL FALLO SILENCIOSO DE
-- ESTA FUNCION, y merece la explicacion.
--
-- La guardia del contrato detecta la coincidencia que cae en OTRO ESTADO: si
-- el servicio manda la casa a Ohio, se rechaza. Lo que ninguna guardia puede
-- detectar es la coincidencia PLAUSIBLE: se pidio «123 Main St, Atlanta» y
-- el servicio entendio «123 Main Ave, Atlanta», dos calles del mismo barrio.
-- Eso pasa la guardia con nota, guarda coordenadas validas, y deja la casa a
-- kilometro y medio de donde esta. Nada falla. Simplemente miente.
--
-- La direccion tal y como la entendio el servicio es lo unico que permite
-- verla: se compara con la que se pidio, y la discrepancia salta a la vista.
--
-- NO es PII nueva: es la misma direccion que ya esta en las columnas de al
-- lado, en texto plano, en esta misma fila.
ALTER TABLE "addresses"
  ADD COLUMN "latitude"              DOUBLE PRECISION,
  ADD COLUMN "longitude"             DOUBLE PRECISION,
  ADD COLUMN "geocodePrecision"      "GeocodePrecision",
  ADD COLUMN "geocodeProvider"       TEXT,
  ADD COLUMN "geocodeMatchedAddress" TEXT,
  ADD COLUMN "geocodedAt"            TIMESTAMPTZ(3);

-- SIN INDICE, Y ES DELIBERADO.
--
-- El barrido busca «las direcciones sin coordenadas», o sea WHERE latitude
-- IS NULL. Un indice sobre createdAt no acelera eso en absoluto: solo
-- ordena. Y un indice parcial de verdad sobre la condicion no se puede
-- declarar en el esquema de Prisma, asi que quedaria solo en este archivo y
-- la siguiente migracion intentaria reconciliarlo.
--
-- A la escala real de esta tabla —cientos o pocos miles de direcciones— el
-- recorrido secuencial tarda milisegundos y lo ejecuta un barrido de fondo
-- cada varios minutos. Un indice aqui seria coste de mantenimiento sin
-- beneficio medible.
