-- ===========================================================================
-- LO QUE EL CLIENTE ACEPTO AL RESERVAR
-- ===========================================================================
-- Hasta hoy el sitio cobraba y recogia direcciones sin que nadie aceptara
-- nada: no habia condiciones publicadas, no habia politica de privacidad y no
-- habia casilla. Ahora las hay, y esto es lo que permite demostrarlo despues.
--
-- ---------------------------------------------------------------------------
-- SE GUARDA LA VERSION, NO EL TEXTO
-- ---------------------------------------------------------------------------
-- Guardar el documento entero en cada reserva serian trescientas lineas
-- multiplicadas por cada cita. Se guarda el numero, y las versiones son
-- archivos del repositorio con su historia en git.
--
-- LA REGLA QUE LO SOSTIENE: corregir un texto ya publicado no es editar el
-- archivo, es publicar una version nueva. Si se edita sin subir el numero, lo
-- guardado apunta a un texto que ya no es el que esa persona acepto.
--
-- ---------------------------------------------------------------------------
-- NULO SIGNIFICA ALGO, Y NO ES «FALTA EL DATO»
-- ---------------------------------------------------------------------------
-- Nulo = nadie marco ninguna casilla. Pasa en dos casos legitimos:
--
--   1. Las reservas ANTERIORES a esta migracion. No habia nada que aceptar.
--   2. Las que mete el panel por telefono y las que genera una serie: alli no
--      hay formulario. Inventarles una aceptacion seria escribir que hicieron
--      algo que no hicieron, que es peor que no tener el dato.
--
-- Por eso las tres columnas admiten nulo y no llevan valor por defecto: un
-- defecto convertiria «no consta» en «acepto la version 1».
-- ===========================================================================

ALTER TABLE "bookings"
    ADD COLUMN "termsVersion"    INTEGER,
    ADD COLUMN "privacyVersion"  INTEGER,
    ADD COLUMN "legalAcceptedAt" TIMESTAMPTZ(3);
