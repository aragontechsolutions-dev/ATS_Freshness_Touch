-- ===========================================================================
-- QUE EL CLIENTE PUEDA RETIRAR SUS FOTOS SIN PEDIRLE PERMISO A NADIE
-- ===========================================================================
-- Hasta aqui, retirar dependia SIEMPRE de una persona: el cliente escribia,
-- alguien del equipo leia el mensaje, alguien entraba al panel y pulsaba. El
-- barrido de plazos evita que se olvide, pero no quita el intermediario.
--
-- Estas dos columnas lo quitan.
--
-- ---------------------------------------------------------------------------
-- `customerEmail`: SIN ESTO NO HAY NADA QUE AUTOMATIZAR
-- ---------------------------------------------------------------------------
-- El registro sabia de quien es cada foto —nombre y direccion— pero no tenia
-- forma de ESCRIBIRLE. Con el correo se le puede mandar constancia de lo que
-- autorizo, que hoy no recibe, y el enlace que lo retira.
--
-- Nulo a proposito: una ficha de papel en la que nadie apunto el correo sigue
-- siendo un permiso valido. Lo que no tiene es salida automatica.
--
-- NO SALE AL SITIO PUBLICO NI A LA AUDITORIA, como el nombre y la direccion.
--
-- ---------------------------------------------------------------------------
-- `removalTokenHash`: EL RESUMEN, NUNCA EL TESTIGO
-- ---------------------------------------------------------------------------
-- Quien tenga el testigo puede despublicar esa ficha sin identificarse de
-- ninguna otra forma: es una credencial. Por eso aqui solo vive su resumen
-- criptografico, igual que con una contrasena. Ni esta tabla ni una copia de
-- seguridad robada sirven para retirar nada.
--
-- UNICO porque la pagina publica busca por el: con indice es una busqueda
-- directa, y sin el seria recorrer la tabla comparando cadenas en cada
-- intento — que es ademas como se mide un sistema desde fuera.
--
-- Nulo cuando la ficha no tiene enlace (no hay correo) o cuando ya se uso: el
-- testigo es de un solo uso y al gastarse se borra.
--
-- ---------------------------------------------------------------------------
-- LO QUE PUEDE HACER QUIEN ROBE UN ENLACE
-- ---------------------------------------------------------------------------
-- Despublicar unas fotos. No lee la ficha, no ve el nombre ni la direccion,
-- no publica nada y no toca ninguna otra. Y se deshace desde el panel con el
-- boton de restituir. Es la direccion de fallo que se eligio a proposito: un
-- enlace que PUBLICARA habria sido irreversible y en el sentido malo.
--
-- Ver `docs/38-fotos-y-videos-antes-y-despues.md`, seccion 11.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- `customerLocale`: EN QUE IDIOMA SE LE ESCRIBE
-- ---------------------------------------------------------------------------
-- Lo que se le manda habla de publicar fotos de su casa. En un idioma que no
-- lee, ese correo no sirve de constancia y ademas nadie se atreve a pulsar un
-- boton que no entiende. Es el mismo criterio que ya rige para la invitacion
-- al panel.
--
-- Por defecto `en`, que es el idioma del sitio: las fichas anteriores no lo
-- declararon y el ingles es lo que se habla en Georgia por defecto.

ALTER TABLE "media_consents"
    ADD COLUMN "customerEmail" TEXT,
    ADD COLUMN "customerLocale" TEXT NOT NULL DEFAULT 'en',
    ADD COLUMN "removalTokenHash" TEXT;

ALTER TABLE "media_consents"
    ADD CONSTRAINT "media_consents_customerLocale_check"
    CHECK ("customerLocale" IN ('en', 'es'));

CREATE UNIQUE INDEX "media_consents_removalTokenHash_key"
    ON "media_consents"("removalTokenHash");
