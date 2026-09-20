-- ===========================================================================
-- SEGURIDAD: CERRAR EL ACCESO DIRECTO A LAS TABLAS
-- ===========================================================================
-- Supabase publica AUTOMATICAMENTE por API REST todas las tablas del esquema
-- "public". Sin seguridad a nivel de fila, cualquiera que tenga la clave
-- publica del proyecto (que es publica por diseno y acaba en el navegador)
-- puede leer y escribir esas tablas directamente, saltandose por completo
-- nuestra API y sus comprobaciones.
--
-- En este sistema eso expondria datos de clientes, importes de pagos y, lo
-- mas grave, "addresses.accessNotes": codigos de puerta y donde esta la llave.
--
-- MODELO DE ACCESO DE ESTE PROYECTO
-- Todo pasa por la API (NestJS), que se conecta con el rol propietario de las
-- tablas. En PostgreSQL el propietario NO se ve afectado por las politicas de
-- fila mientras no se active FORCE, asi que la API sigue funcionando igual.
-- Los roles publicos (anon, authenticated), en cambio, quedan sin acceso.
--
-- Se activa la seguridad de fila SIN crear ninguna politica: eso significa
-- "denegar a todo el mundo salvo al propietario", que es exactamente lo que
-- queremos mientras el unico camino de entrada sea nuestra API.
-- ===========================================================================

-- --- 1. Seguridad a nivel de fila en todas las tablas ----------------------
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurring_series" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- La tabla de control de Prisma tambien queda expuesta si no se protege.
-- Escribir en ella permitiria falsificar el historial de migraciones.
-- Solo existe cuando las migraciones las aplica Prisma; en las pruebas, que
-- ejecutan el SQL directamente, no esta.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;

-- --- 2. Retirar los permisos de los roles publicos de Supabase -------------
-- Segunda capa, independiente de la anterior: aunque alguien crease una
-- politica por error, sin permisos de tabla no hay acceso posible.
--
-- Los roles "anon" y "authenticated" solo existen en Supabase. El bloque
-- comprueba su existencia para que la migracion siga siendo valida en un
-- PostgreSQL normal, que es donde se prueba en la integracion continua.
DO $$
DECLARE
  rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', rol);

      -- Y lo mismo para las tablas que se creen en el futuro: sin esto, cada
      -- tabla nueva volveria a nacer accesible.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', rol);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', rol);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', rol);
    END IF;
  END LOOP;
END
$$;
