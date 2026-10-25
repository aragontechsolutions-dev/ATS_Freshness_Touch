-- ===========================================================================
-- COMO SE OBTUVO EL PERMISO, Y QUIEN VIVE EN ESA CASA
-- ===========================================================================
-- El registro nacio suponiendo un papel firmado en el salon del cliente. Ese
-- supuesto no aguanta el caso NORMAL: en una limpieza de mudanza la casa esta
-- vacia, en una recurrente el cliente esta trabajando, y hay clientes que
-- contratan desde otro estado. Si el permiso solo se puede obtener en persona,
-- no se obtiene casi nunca — y lo que no se obtiene, con el modo estricto, no
-- se publica.
--
-- ---------------------------------------------------------------------------
-- UNA FIRMA ELECTRONICA ES UNA FIRMA
-- ---------------------------------------------------------------------------
-- La E-SIGN Act federal y la UETA de Georgia dan a un registro electronico el
-- mismo valor que al papel, siempre que se pueda acreditar quien, que y
-- cuando. Lo que no vale es lo que no se puede DEMOSTRAR: una llamada de
-- telefono, el silencio de quien no contesta, una casilla premarcada.
--
-- Por eso `evidenceKind` no distingue permisos buenos de malos —los cuatro
-- valen— sino que dice DONDE ESTA LA PRUEBA: el archivador, la fila de la
-- reserva, el buzon de correo o el hilo de mensajes.
--
-- Por defecto `SIGNED_PAPER`, porque las fichas anotadas hasta hoy son todas
-- de papel: es lo unico que el panel permitia anotar.
--
-- ---------------------------------------------------------------------------
-- EL DUENO QUE ALQUILA NO PUEDE AUTORIZAR LA CASA DE SU INQUILINO
-- ---------------------------------------------------------------------------
-- Es el caso que se cuela sin que nadie lo note: el dueno contrata, el dueno
-- firma, y en las imagenes salen los muebles, la ropa y los objetos de OTRA
-- persona, que no ha dicho nada. Sobre la vida privada de un tercero no se
-- puede dar permiso.
--
-- Es el mismo criterio que ya se aplica a los empleados que salen en un video:
-- hacen falta los dos permisos, o no se publica.
--
-- La restriccion no prohibe anotar la ficha —es util saber que existe y que
-- falta la otra mitad— sino ATARLE PIEZAS. Y sin piezas atadas, el modo
-- estricto no publica ninguna: la regla se cumple sola en vez de depender de
-- que alguien se acuerde.
--
-- Ver `docs/38-fotos-y-videos-antes-y-despues.md`, seccion 11.
-- ===========================================================================

ALTER TABLE "media_consents"
    ADD COLUMN "evidenceKind" TEXT NOT NULL DEFAULT 'SIGNED_PAPER',
    ADD COLUMN "occupiedByOthers" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "occupantConsent" BOOLEAN NOT NULL DEFAULT false;

-- Los cuatro medios por los que puede llegar un permiso. Cerrado en la base y
-- no solo en el contrato: una fila escrita desde una consola tambien tiene que
-- poder responder donde esta su prueba.
ALTER TABLE "media_consents"
    ADD CONSTRAINT "media_consents_evidenceKind_check"
    CHECK ("evidenceKind" IN ('SIGNED_PAPER', 'WEB_FORM', 'EMAIL', 'MESSAGE'));

-- Si vive alli un tercero y no ha dado su permiso, la ficha no ampara piezas.
ALTER TABLE "media_consents"
    ADD CONSTRAINT "media_consents_occupant_check"
    CHECK (
        NOT "occupiedByOthers"
        OR "occupantConsent"
        OR (cardinality("videoIds") = 0 AND cardinality("photoPaths") = 0)
    );
