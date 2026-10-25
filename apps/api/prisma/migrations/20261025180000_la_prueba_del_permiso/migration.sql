-- ===========================================================================
-- LA PRUEBA DEL PERMISO, NO SOLO SU REFERENCIA
-- ===========================================================================
-- Hasta ahora el registro guardaba el NUMERO del papel, no el papel. El dia
-- que haya que demostrar un permiso, una referencia a un PDF que esta en el
-- correo de alguien no sirve de nada: lo que se puede ensenar es el archivo.
--
-- ---------------------------------------------------------------------------
-- ES UNA RUTA, NO UNA DIRECCION
-- ---------------------------------------------------------------------------
-- El archivo vive en un bucket PRIVADO, distinto del de la galeria. El de la
-- galeria es publico de lectura —son imagenes hechas para que las vea todo
-- internet— y esto lleva el nombre del cliente, la direccion de su casa y su
-- firma, que es justo lo que el permiso promete no mostrar.
--
-- Por eso aqui no se guarda una URL: se guarda una ruta que solo sirve dentro
-- del servidor. Los bytes los entrega la API detras de la sesion del panel, y
-- no existe ninguna direccion de este bucket que funcione pegada en un
-- navegador. Ni siquiera una firmada de corta duracion: una direccion firmada
-- que alguien copia sigue abriendo el documento desde cualquier sitio.
--
-- ---------------------------------------------------------------------------
-- POR QUE ES NULA
-- ---------------------------------------------------------------------------
-- Las fichas anotadas hasta hoy no tienen archivo —el panel no permitia
-- subirlo— y obligarlas a tenerlo habria exigido inventarse uno. Ademas una
-- ficha sin prueba sigue siendo util: ampara piezas igual, y que le falte el
-- archivo es algo que se ve en la pantalla y se arregla.
--
-- Ver `docs/38-fotos-y-videos-antes-y-despues.md`, seccion 11.
-- ===========================================================================

ALTER TABLE "media_consents" ADD COLUMN "evidencePath" TEXT;

-- La ruta la compone el servidor: carpeta fija, nombre aleatorio de 32
-- caracteres y una de las cuatro extensiones admitidas. Comprobarlo tambien
-- aqui cierra el camino a una fila escrita desde una consola con una ruta
-- apuntando a otra carpeta del almacen.
ALTER TABLE "media_consents"
    ADD CONSTRAINT "media_consents_evidencePath_check"
    CHECK ("evidencePath" IS NULL OR "evidencePath" ~ '^evidence/[0-9a-f]{32}\.(pdf|jpg|png|webp)$');
