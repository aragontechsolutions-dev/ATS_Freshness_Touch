-- ===========================================================================
-- TRES DESTINOS DE TELEGRAM, Y DOS AVISOS NUEVOS
-- ===========================================================================
-- Hasta ahora todos los avisos internos iban al mismo chat: las reservas
-- nuevas y, desde la etapa 3.12, tambien los fallos del sistema. Mezclar
-- «entro una reserva» con «faltan migraciones» hace que quien no puede
-- actuar sobre la mitad de los mensajes aprenda a no leer ninguno.
--
-- A partir de aqui hay tres: operaciones, el grupo del equipo de limpieza y
-- el tecnico. LOS CHATS NO SE GUARDAN AQUI: viven en el JSON de ajustes
-- (`business_settings`), que no necesita migracion porque los campos nuevos
-- llevan valor por defecto. Lo que si hay que tocar son los enumerados.
--
-- SOBRE `IF NOT EXISTS`: igual que en `20260927150000_service_zone_e`, anadir
-- un valor a un enumerado no se puede deshacer en PostgreSQL. Un reintento
-- tras un fallo a medias encontraria el valor ya puesto y abortaria la
-- migracion entera por algo que ya estaba hecho.
-- ===========================================================================

-- EL EQUIPO FICHO LEJOS DE LA CASA.
-- No se avisa de cada llegada, solo de las que no cuadran: un mensaje por
-- cada fichaje normal serian varios al dia de rutina, y lo que se lee todos
-- los dias sin que pase nada se deja de leer.
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'TEAM_ARRIVED_FAR' AFTER 'BOOKING_REMINDER';

-- SE ASIGNO EQUIPO A UNA RESERVA, O SE CAMBIO EL QUE HABIA.
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'JOB_ASSIGNED' AFTER 'TEAM_ARRIVED_FAR';

-- LA AUDIENCIA NUEVA, Y NO ES UN DETALLE DE CLASIFICACION.
--
-- La audiencia decide QUE DATOS PUEDE LLEVAR UN MENSAJE DENTRO. El aviso de
-- reserva nueva (INTERNAL) lleva el importe total; el equipo de limpieza
-- NUNCA ve dinero, que es la misma regla que ya cumple el contrato de la PWA.
-- Sin una audiencia propia, la unica forma de mandarle algo al equipo seria
-- reutilizar INTERNAL, y con ella el precio de cada casa acabaria delante de
-- quien la limpia.
ALTER TYPE "NotificationAudience" ADD VALUE IF NOT EXISTS 'CLEANING' AFTER 'INTERNAL';
