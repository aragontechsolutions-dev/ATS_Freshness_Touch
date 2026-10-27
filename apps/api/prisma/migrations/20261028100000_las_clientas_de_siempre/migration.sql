-- ===========================================================================
-- LAS CLIENTAS DE SIEMPRE: LA SERIE EMPIEZA A FUNCIONAR
-- ===========================================================================
-- La tabla `recurring_series` existe desde la etapa 1 y hasta hoy NO LA USABA
-- NADIE: ningun servicio la leia ni la escribia. Elegir «semanal» solo aplicaba
-- un descuento al precio de una cita suelta.
--
-- Ahora genera las citas de verdad, y para eso le faltaban dos columnas.
--
-- ---------------------------------------------------------------------------
-- EL PRECIO PACTADO VIVE EN LA SERIE, NO EN CADA CITA
-- ---------------------------------------------------------------------------
-- Una clienta de siempre puede tener una tarifa de hace dos anos. Si el
-- precio se recalculara en cada cita generada, el dia que se suban las
-- tarifas se le subirian a ella tambien, sin que nadie lo decidiera y sin que
-- nadie se enterara hasta que lo viera en la factura.
--
-- Nulo = manda el motor, que es lo normal.
--
-- ---------------------------------------------------------------------------
-- DE QUE CHOQUE YA SE AVISO
-- ---------------------------------------------------------------------------
-- Si al generar una cita la franja esta llena, no se crea y se avisa a
-- coordinacion. Pero el barrido pasa cada hora: sin recordar de que fecha ya
-- se aviso, la misma franja llena generaria un aviso cada hora hasta que
-- alguien la arreglara, y entonces la bandeja deja de servir para nada.
--
-- Guarda LA FECHA del choque, no un booleano: si se resuelve y mas adelante
-- choca otra distinta, esa si merece un aviso nuevo.
-- ===========================================================================

ALTER TABLE "recurring_series"
    ADD COLUMN "priceOverrideCents"  INTEGER,
    ADD COLUMN "conflictNotifiedFor" DATE;
