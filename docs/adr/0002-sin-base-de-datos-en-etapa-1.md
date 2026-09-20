# 0002 — Sin base de datos en la Etapa 1

**Estado:** aceptada · **Fecha:** 2026-09-20

## Contexto

El plan original contemplaba Supabase (autenticación, PostgreSQL y
almacenamiento) desde el inicio. El alcance acordado para la Etapa 1, sin
embargo, es solo el sitio público con el cotizador.

## Decisión

La Etapa 1 **no incluye base de datos**. El cotizador es sin estado: recibe
datos, calcula y responde. Supabase entra en la Etapa 2, con las reservas.

## Razones

1. **Seguridad:** sin almacenamiento no hay datos personales que proteger ni que
   puedan filtrarse. La superficie de ataque se reduce drásticamente.
2. **Coste:** no se paga una base de datos hasta que haya algo que guardar.
3. **Simplicidad:** menos piezas que desplegar, vigilar y respaldar.
4. **Honestidad del alcance:** montar infraestructura que nada usa es trabajo no
   entregado disfrazado de progreso.

## Consecuencias

- No hay captura de contactos: quien cotiza y se va no deja rastro. Es la
  contrapartida real de esta decisión y se resuelve en la Etapa 2, cuando el
  formulario de reserva sí guarde el cliente.
- El motor de precios ya está preparado: al ser una función pura, el día que
  haya que guardar cotizaciones basta con persistir su resultado.

## Revisar si...

Antes de la Etapa 2, la empresa quiere capturar contactos de personas que
cotizan pero no reservan. Eso adelantaría la base de datos, y con ella el
consentimiento y la política de privacidad correspondientes.
