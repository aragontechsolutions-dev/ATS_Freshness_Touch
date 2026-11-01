-- TRES ESTADOS POR TAREA, Y EL MOTIVO CUANDO QUEDA PENDIENTE
-- =========================================================
-- Lo pidio la dueña con estas palabras, en la lista que escribio para la app
-- del equipo de limpieza:
--
--   «Cada tarea debe tener estas opciones: Completada / Pendiente / No
--    aplica. Si queda pendiente, debe permitir anotar el motivo.»
--
-- Hasta ahora una tarea estaba marcada o no estaba, y desmarcar BORRABA la
-- fila. Eso no sabe distinguir las dos cosas que de verdad importan cuando un
-- cliente llama diciendo que algo se quedo sin hacer:
--
--   - «no aplica»: no habia nada que hacer. En una casa vacia de mudanza son
--     la mitad de las tareas —cambiar las sabanas de una cama que no existe—.
--   - «pendiente»: habia que hacerlo y NO se hizo, por un motivo concreto.
--
-- Con un unico booleano las dos salian igual: sin marcar. Y una lista que
-- dice «quedaron 20 sin hacer» en una casa donde no habia nada que hacer en
-- 20 de ellas no sirve para responder a nadie.

-- ==========================================================================
-- SIGUE SIN HABER UNA FILA POR TAREA DE LA LISTA
-- ==========================================================================
-- No hay fila = la tarea no se ha tocado todavia. Es el estado de partida y
-- no se escribe, por el mismo motivo de la migracion 20261001160000: cuarenta
-- mil filas al año diciendo «no la he mirado» es exactamente lo mismo que no
-- tener fila.
--
-- «PENDIENTE» NO ES LO MISMO QUE «SIN TOCAR», y es la distincion que sostiene
-- todo esto: sin tocar significa que nadie ha mirado esa tarea; pendiente
-- significa que alguien la miro, decidio que no se podia hacer y lo explico.
-- Una es trabajo por decidir y la otra es una respuesta.

-- --------------------------------------------------------------------------
-- 1. LOS NOMBRES QUE YA NO DICEN LA VERDAD
-- --------------------------------------------------------------------------
-- `doneAt` y `doneByStaffId` se escribieron cuando una fila solo podia decir
-- «hecha». En una fila que dice «no aplica», una columna llamada `doneAt`
-- afirma literalmente lo contrario de lo que paso.
--
-- SE RENOMBRAN, NO SE CREAN DE NUEVO: `RENAME COLUMN` conserva los datos, los
-- indices y las claves ajenas. Crear columnas nuevas y copiar habria sido la
-- forma de perder la autoria de lo que ya esta marcado.
ALTER TABLE "booking_checklist_items" RENAME COLUMN "doneAt" TO "markedAt";
ALTER TABLE "booking_checklist_items" RENAME COLUMN "doneByStaffId" TO "markedByStaffId";

-- El nombre de la clave ajena tambien, porque hay pruebas y consultas de
-- integridad que la buscan por nombre.
ALTER TABLE "booking_checklist_items"
  RENAME CONSTRAINT "booking_checklist_items_doneByStaffId_fkey"
  TO "booking_checklist_items_markedByStaffId_fkey";

-- --------------------------------------------------------------------------
-- 2. EL ESTADO
-- --------------------------------------------------------------------------
-- UN ENUMERADO DE POSTGRES, al contrario que `itemCode`, que es texto. La
-- diferencia no es un descuido: las tareas se añaden y se retiran al ritmo en
-- que cambia como limpia la empresa, y con un enumerado cada cambio de la
-- lista seria una migracion. Los estados son tres y son los tres que puede
-- tener una tarea; añadir un cuarto SI es un cambio de modelo, y que obligue
-- a una migracion es lo correcto.
CREATE TYPE "ChecklistItemState" AS ENUM ('DONE', 'PENDING', 'NOT_APPLICABLE');

-- Se añade admitiendo nulos para poder rellenar las filas que ya existen.
ALTER TABLE "booking_checklist_items" ADD COLUMN "state" "ChecklistItemState";

-- TODAS LAS FILAS QUE YA EXISTEN SON «HECHA», y no es una suposicion: hasta
-- hoy una fila solo se creaba al marcar, y desmarcar la borraba. No existe
-- ninguna fila que signifique otra cosa.
UPDATE "booking_checklist_items" SET "state" = 'DONE' WHERE "state" IS NULL;

-- --------------------------------------------------------------------------
-- NOT NULL Y SIN VALOR POR OMISION, a proposito
-- --------------------------------------------------------------------------
-- Con `DEFAULT 'DONE'`, una insercion que se olvidara del estado quedaria
-- registrada como «completada», que es la afirmacion mas fuerte de las tres y
-- la que puede acabar delante de un cliente. Sin valor por omision, ese
-- descuido es un error de la base de datos en el primer intento.
ALTER TABLE "booking_checklist_items" ALTER COLUMN "state" SET NOT NULL;

-- --------------------------------------------------------------------------
-- 3. EL MOTIVO
-- --------------------------------------------------------------------------
-- Texto libre que escribe quien limpia, y solo tiene sentido en una tarea
-- PENDIENTE: es la respuesta a «¿por que no se hizo?». El servidor rechaza un
-- motivo en los otros dos estados, y esto NO es una restriccion de forma sino
-- de seguridad: un campo de texto que se acepta en cualquier estado es un
-- almacen de texto libre colgado de una reserva, que es justo lo que evita la
-- comprobacion del codigo de tarea contra el catalogo.
--
-- 300 CARACTERES. Es una frase escrita de pie y con guantes, no un informe.
-- Sin tope, cada toque podria escribir en la base una cadena de un megabyte.
--
-- ES OPCIONAL, Y NO SE EXIGE. La dueña escribio «debe PERMITIR anotar el
-- motivo», no «debe exigirlo», y la diferencia importa: exigirlo dejaria a
-- quien no puede escribir en ese momento —prisa, guantes, una mano— sin poder
-- marcar la tarea como pendiente, y la dejaria sin tocar. Se perderia la
-- informacion entera por intentar conseguirla completa.
ALTER TABLE "booking_checklist_items" ADD COLUMN "note" VARCHAR(300);

-- --------------------------------------------------------------------------
-- UNA FILA SIN ESTADO PENDIENTE NO PUEDE LLEVAR MOTIVO
-- --------------------------------------------------------------------------
-- La misma regla que comprueba el servidor, escrita tambien aqui. No es
-- redundancia por gusto: el servidor es un programa que se cambia, y esta
-- restriccion es la que sigue en pie si alguien escribe en la tabla por otro
-- camino —una consulta a mano durante una incidencia, un script de
-- migracion—. Lo que protege es que el motivo signifique siempre lo mismo.
ALTER TABLE "booking_checklist_items"
  ADD CONSTRAINT "booking_checklist_items_motivo_solo_si_pendiente"
  CHECK ("note" IS NULL OR "state" = 'PENDING');
