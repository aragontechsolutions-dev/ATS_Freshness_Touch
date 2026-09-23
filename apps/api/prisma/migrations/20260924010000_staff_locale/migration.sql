-- ===========================================================================
-- IDIOMA DEL PERSONAL
-- ===========================================================================
-- Los clientes lo tienen desde la migracion inicial; al personal le faltaba,
-- y hasta ahora no habia hecho falta porque no se le escribia nunca.
--
-- Ahora si: la invitacion al panel deja de mandarla el proveedor de identidad
-- con su plantilla unica y pasa a salir de aqui, con la nuestra. Ese correo es
-- el PRIMER contacto con alguien que acaba de entrar en la empresa, y en una
-- empresa de limpieza en Georgia mandarselo en un idioma que no lee no es un
-- caso raro.
--
-- Por defecto ingles, como el resto del sistema. Quien da de alta lo elige.
-- ===========================================================================

ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "locale" "Locale" NOT NULL DEFAULT 'en';
