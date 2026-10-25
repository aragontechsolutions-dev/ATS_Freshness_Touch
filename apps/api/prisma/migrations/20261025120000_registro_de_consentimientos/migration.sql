-- ===========================================================================
-- EL REGISTRO DE CONSENTIMIENTOS DE IMAGEN
-- ===========================================================================
-- El papel que firma un cliente autorizando que se publique el interior de su
-- casa, anotado y ATADO A LAS PIEZAS QUE AMPARA.
--
-- El permiso promete dos cosas que solo se pueden cumplir si el sistema sabe
-- de quien es cada pieza: que se puede retirar, y que se retira en un plazo.
-- Sin esto, cumplirlo significa revisar el canal entero a ojo intentando
-- reconocer una cocina. Con esto, revocar es un boton y las piezas dejan de
-- servirse al momento.
--
-- TABLA PROPIA Y NO UN CAMPO EN LA GALERIA, por dos razones que van juntas:
-- la fila de la galeria SE SIRVE AL PUBLICO, y esto lleva el nombre del
-- cliente y la direccion de su casa — justo lo que el permiso promete no
-- mostrar. Y ademas esto no es configuracion: es un registro que se firma, se
-- archiva y se puede revocar.
--
-- NO SE BORRA AL REVOCAR. Un permiso retirado es exactamente lo que hay que
-- poder demostrar: que existio, que amparaba estas piezas y cuando dejo de
-- hacerlo. Borrarlo dejaria el registro contando solo la mitad buena.
--
-- Ver `docs/38-fotos-y-videos-antes-y-despues.md`.
-- ===========================================================================

CREATE TABLE "media_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),

    -- Lo que va escrito en el papel, para emparejar el escaneo. NO es unico a
    -- proposito: quien archiva puede repetir un numero sin querer, y
    -- rechazarselo en ese momento le haria perder la ficha que estaba
    -- escribiendo. El panel avisa; la base no estorba.
    "reference" TEXT NOT NULL,

    "customerName" TEXT NOT NULL,
    -- La casa. NUNCA sale al sitio publico.
    "propertyAddress" TEXT NOT NULL,

    -- Fechas sin hora: es lo que hay escrito en un papel.
    "serviceDate" DATE NOT NULL,
    "signedAt" DATE NOT NULL,

    "coversInterior" BOOLEAN NOT NULL,
    "coversExterior" BOOLEAN NOT NULL,
    -- La parte sensible: el «antes» es la casa sucia de una persona concreta.
    "allowsBefore" BOOLEAN NOT NULL,

    -- Los sitios que el papel enumera. Se guardan todos aunque solo
    -- publiquemos en la web: lo que se firmo es lo que vale.
    "channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    "removalDays" INTEGER NOT NULL,

    -- Las piezas que ampara. Es lo que convierte esto en algo util.
    "videoIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "photoPaths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    "notes" TEXT,

    -- Cuando el cliente retiro el permiso. NULL mientras siga en pie.
    "revokedAt" TIMESTAMPTZ(3),

    "updatedByStaffId" UUID,

    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

    CONSTRAINT "media_consents_pkey" PRIMARY KEY ("id")
);

-- RESTRICT, como los fichajes: es el registro de un permiso firmado y no debe
-- borrarse porque se de de baja a quien lo anoto.
ALTER TABLE "media_consents"
    ADD CONSTRAINT "media_consents_updatedByStaffId_fkey"
    FOREIGN KEY ("updatedByStaffId") REFERENCES "staff"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- LO QUE LA BASE NO DEJA PASAR
-- ---------------------------------------------------------------------------
-- El contrato de la aplicacion ya comprueba esto, y aun asi va aqui: una fila
-- escrita a mano desde una consola no pasa por el contrato, y una ficha que
-- no cubre ni el interior ni el exterior no ampara nada — pero lo PARECE, que
-- es peor que no tenerla.
ALTER TABLE "media_consents"
    ADD CONSTRAINT "media_consents_cubre_algo"
    CHECK ("coversInterior" OR "coversExterior");

-- Prometer mas de un mes no es una promesa, y cero no se puede cumplir un
-- domingo.
ALTER TABLE "media_consents"
    ADD CONSTRAINT "media_consents_plazo_razonable"
    CHECK ("removalDays" BETWEEN 1 AND 30);

-- ---------------------------------------------------------------------------
-- INDICES
-- ---------------------------------------------------------------------------
-- La consulta de la galeria publica es «dame los revocados», y corre en CADA
-- visita: de ella depende que una foto retirada deje de verse.
CREATE INDEX "media_consents_revokedAt_idx" ON "media_consents"("revokedAt");

-- La del panel es «dame todos, el mas reciente primero».
CREATE INDEX "media_consents_createdAt_idx" ON "media_consents"("createdAt" DESC);

-- ---------------------------------------------------------------------------
-- SEGURIDAD A NIVEL DE FILA
-- ---------------------------------------------------------------------------
-- Igual que el resto de tablas (ver 20260920170000_enable_rls): Supabase
-- publica por API REST todo lo que haya en "public".
--
-- AQUI ES DE LO MAS GRAVE QUE PODRIA FALTAR. Esta tabla lleva el nombre de
-- cada cliente y LA DIRECCION DE SU CASA, que es justo lo que el permiso que
-- firmo promete no mostrar. Sin esto, cualquiera con la clave publica del
-- proyecto podria leerse el listado entero saltandose la API y sus permisos.
--
-- Se activa SIN crear politicas: «denegar a todo el mundo salvo al
-- propietario», que es el rol con el que se conecta la API.
ALTER TABLE "media_consents" ENABLE ROW LEVEL SECURITY;
