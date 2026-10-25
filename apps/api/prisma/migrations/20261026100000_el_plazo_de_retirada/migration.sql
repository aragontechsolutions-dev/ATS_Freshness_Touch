-- ===========================================================================
-- EL PLAZO DE RETIRADA DEJA DE DEPENDER DE QUE ALGUIEN SE ACUERDE
-- ===========================================================================
-- El papel promete que, si el cliente lo pide, sus fotos dejan de publicarse
-- en cinco dias. Hasta ahora el sistema cumplia la mitad: retirar es un boton
-- y despublica al momento.
--
-- La mitad que faltaba es la de antes del boton. El reloj NO empieza cuando
-- alguien pulsa, empieza cuando el cliente escribe, y el hueco peligroso es
-- justo ese: entre que llega el correo y que alguien entra al panel. Mirando
-- solo `revokedAt`, ese hueco no existe para el sistema y el plazo se cumple
-- siempre, por definicion — que es otra forma de decir que no se mide nada.
--
-- ---------------------------------------------------------------------------
-- DOS COLUMNAS, DOS TRABAJOS DISTINTOS
-- ---------------------------------------------------------------------------
-- `removalRequestedAt` es un hecho del cliente: el dia que lo pidio. Es DATE
-- y no un instante porque un correo que llega a las 23:50 no gasta un dia
-- entero del plazo, y porque es lo que se puede afirmar sin discutir.
--
-- `removalReminderSentAt` es ruido interno: cuando se aviso por ultima vez.
-- Esta en la base y no en la memoria del proceso para que un despliegue a
-- media manana no vuelva a avisar de todo lo que ya se aviso. Es un instante
-- porque solo sirve para comparar con «hoy».
--
-- ---------------------------------------------------------------------------
-- POR QUE NO SE DERIVA DE LA AUDITORIA
-- ---------------------------------------------------------------------------
-- El registro de auditoria sabe cuando se REVOCO, no cuando se PIDIO: nadie
-- se lo cuenta. Y aunque se le contara, la auditoria es un diario que se
-- purga; una promesa que hay que poder demostrar no puede vivir en algo que
-- esta disenado para borrarse.
--
-- Ver `docs/38-fotos-y-videos-antes-y-despues.md`, seccion 6.
-- ===========================================================================

ALTER TABLE "media_consents"
    ADD COLUMN "removalRequestedAt" DATE,
    ADD COLUMN "removalReminderSentAt" TIMESTAMPTZ(3);

-- El barrido pregunta siempre lo mismo: que peticiones siguen abiertas. Sin
-- indice, esa pregunta recorre la tabla entera cada hora para no encontrar
-- casi nunca nada, que es el caso normal y el que conviene que sea barato.
CREATE INDEX "media_consents_removalRequestedAt_idx"
    ON "media_consents"("removalRequestedAt")
    WHERE "removalRequestedAt" IS NOT NULL AND "revokedAt" IS NULL;
