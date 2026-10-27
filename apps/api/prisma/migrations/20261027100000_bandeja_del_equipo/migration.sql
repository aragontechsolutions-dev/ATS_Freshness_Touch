-- ===========================================================================
-- LA BANDEJA DEL EQUIPO
-- ===========================================================================
-- Lo que una persona del panel tiene que enterarse al entrar, sin que nadie
-- se lo cuente: una reserva nueva que asignar, una devolucion que el banco
-- rechazo, un cliente que retiro sus fotos.
--
-- ---------------------------------------------------------------------------
-- NO ES LA TABLA `notifications` QUE YA EXISTIA
-- ---------------------------------------------------------------------------
-- Aquella es el REGISTRO DE ENVIOS al cliente: que correo salio, a que
-- direccion, si fallo, y cuelga de una reserva. Mira hacia fuera.
--
-- Esta mira hacia dentro. Son dos cosas distintas y mezclarlas habria
-- obligado a una de las dos a fingir que es la otra: la del cliente habria
-- tenido que admitir filas sin reserva, y esta habria arrastrado un
-- `bookingId` obligatorio que no significa nada en «hay un permiso sin
-- prueba».
--
-- ---------------------------------------------------------------------------
-- VAN A UN PUESTO, NO A UNA PERSONA — SALVO CUANDO SI
-- ---------------------------------------------------------------------------
-- «Hay una reserva nueva» le toca a coordinacion, sea quien sea quien entre
-- ese dia. Dirigirla a una persona concreta significaria que si esa persona
-- libra, nadie la ve.
--
-- Pero «te han asignado un trabajo» es de quien lo tiene asignado y de nadie
-- mas. Por eso `audience` dice el puesto y `staffId` lo estrecha cuando hace
-- falta. NULL en `staffId` = la ve todo el puesto.
--
-- ---------------------------------------------------------------------------
-- EL TEXTO NO SE GUARDA, SE GUARDAN LOS DATOS
-- ---------------------------------------------------------------------------
-- En la fila van `kind` y `params`; la frase la compone el panel en el idioma
-- de quien mira. Guardar el texto ya escrito dejaria las notificaciones de
-- ayer en el idioma de quien las provoco, y corregir una errata no arreglaria
-- las que ya estan.
--
-- Y `params` NO LLEVA NOMBRES NI DIRECCIONES, por la misma razon que la
-- auditoria: esto se mira en una pantalla compartida y se queda meses.
--
-- ---------------------------------------------------------------------------
-- QUIEN HA LEIDO QUE, EN SU PROPIA TABLA
-- ---------------------------------------------------------------------------
-- Y no como una marca en la notificacion, porque una del puesto la ven varias
-- personas: con un booleano, la primera que la abriera la haria desaparecer
-- del globo de las demas.
--
-- Ver `docs/39-la-bandeja-del-equipo.md`.
-- ===========================================================================

CREATE TABLE "staff_notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),

    -- Del catalogo cerrado de `@freshness/types`, no texto libre.
    "kind" TEXT NOT NULL,

    "audience" "StaffRole" NOT NULL,

    -- NULL = la ve todo el puesto.
    "staffId" UUID,

    "entityType" TEXT,
    "entityId"   TEXT,

    "params" JSONB NOT NULL DEFAULT '{}',

    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

    CONSTRAINT "staff_notifications_pkey" PRIMARY KEY ("id")
);

-- CASCADE y no RESTRICT: una notificacion no es un registro que haya que
-- poder demostrar —eso es la auditoria— sino un aviso. Si se da de baja a
-- quien iba dirigido, sus avisos se van con ella en vez de impedir la baja.
ALTER TABLE "staff_notifications"
    ADD CONSTRAINT "staff_notifications_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE;

-- La consulta de la bandeja es siempre la misma: lo de mi puesto, lo mas
-- reciente primero.
CREATE INDEX "staff_notifications_audience_createdAt_idx"
    ON "staff_notifications"("audience", "createdAt" DESC);

CREATE TABLE "staff_notification_reads" (
    "notificationId" UUID NOT NULL,
    "staffId"        UUID NOT NULL,
    "readAt"         TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

    -- La clave compuesta es lo que hace que marcar como leida dos veces sea
    -- inofensivo: la segunda choca con la primera en vez de duplicar la fila.
    CONSTRAINT "staff_notification_reads_pkey" PRIMARY KEY ("notificationId", "staffId")
);

ALTER TABLE "staff_notification_reads"
    ADD CONSTRAINT "staff_notification_reads_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "staff_notifications"("id") ON DELETE CASCADE;

ALTER TABLE "staff_notification_reads"
    ADD CONSTRAINT "staff_notification_reads_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE;

-- Para contar las no leidas de una persona sin recorrer la tabla entera.
CREATE INDEX "staff_notification_reads_staffId_idx"
    ON "staff_notification_reads"("staffId");

-- Supabase publica por REST todo lo que hay en el esquema `public`. Sin esto,
-- la bandeja interna del equipo seria consultable desde fuera.
ALTER TABLE "staff_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_notification_reads" ENABLE ROW LEVEL SECURITY;
