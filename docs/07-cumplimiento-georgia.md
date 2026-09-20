# 07 — Cumplimiento en Georgia (EE. UU.)

> ⚠️ **Esto no es asesoría legal ni fiscal.** Es un resumen de la investigación
> previa, recogido aquí para que las decisiones técnicas tengan contexto.
> Freshness Touch debe confirmar cada punto con un contador (CPA) o un abogado
> de Georgia antes de operar.

## Impuesto sobre ventas: exento

Los servicios de limpieza y conserjería **están exentos** del _sales tax_ de
Georgia (O.C.G.A. §§ 48-8-2(31) y 48-8-30(f)(1)). La empresa sí paga impuesto
sobre los **productos que compra**, pero no lo cobra al cliente por el servicio.

**Cómo está implementado:** el motor de precios emite `taxCents: 0`, muestra el
motivo al cliente y mantiene el campo configurable por si en el futuro se
revenden productos por separado en la factura (ese caso sí tributaría).

## Personal: W-2 frente a 1099

Es el riesgo legal más importante del sector. El IRS evalúa el control
**conductual, financiero y de relación**. Si la empresa fija los horarios,
entrega los productos, forma al personal y asigna los trabajos —que es
exactamente el modelo de Freshness Touch— las personas que limpian son con toda
probabilidad **empleadas (W-2)**, no contratistas independientes (1099).

Clasificar mal acarrea impuestos atrasados y sanciones.

**Consecuencia para el sistema:** el módulo de personal de la Etapa 4 se
diseñará alrededor de empleados W-2 (nómina, retenciones, seguro de accidentes
laborales), no de contratistas.

## Seguro de accidentes laborales: obligatorio con 3 empleados

En Georgia el umbral bajó de cinco a **tres empleados** con efecto **1 de enero
de 2026** (O.C.G.A. §§ 34-9-2 y 34-9-203). Georgia no tiene fondo estatal: hay
que contratarlo con una aseguradora privada.

**Consecuencia:** el módulo de personal debe existir **antes** de la tercera
contratación.

## Otros seguros y licencias

| Concepto                               | Coste aproximado |
| -------------------------------------- | ---------------- |
| Responsabilidad civil general          | 44-100 USD/mes   |
| Fianza de limpieza (_janitorial bond_) | 9-11 USD/mes     |
| Accidentes laborales                   | 114-163 USD/mes  |
| Automóvil comercial                    | 138-182 USD/mes  |

Paquete inicial estimado: ~293 USD/mes; ~466 USD/mes al añadir accidentes
laborales.

No existe una licencia estatal específica de limpieza, pero sí hace falta:

- Licencia de negocio local (_occupational tax certificate_).
- **Declaración jurada SAVE** notarizada, actualizada en cada renovación.
- **E-Verify** si la empresa llega a 11 empleados.

## Verificación de antecedentes

Práctica estándar: búsqueda penal por condado de 7 años, base nacional, registro
de ofensores sexuales, verificación de número de seguridad social e identidad,
todo conforme a la **FCRA**. Coste 25-75 USD por contratación; re-verificación
anual recomendada.

El sitio web afirma que el personal pasa verificación de antecedentes
(`whyUs.vetted`). **Ese texto debe ser cierto antes de publicar el sitio**, o
hay que cambiarlo: es publicidad.

## Propinas

No son obligatorias. La costumbre en EE. UU.:

- 15-20 % en limpiezas puntuales, profundas o de mudanza.
- En servicio recurrente, muchos clientes prefieren un bono de fin de año.

**Consecuencia:** la propina se implementará en la Etapa 2 como **opcional y
configurable**, nunca como cargo automático.

## Datos personales

- No almacenar números de tarjeta: tokenización con Stripe.
- Cifrar la información personal de clientes y direcciones.
- URLs firmadas y de corta duración para las fotos de trabajos.
- Consentimiento explícito para las fotos de antes y después.

En la Etapa 1 nada de esto aplica todavía porque no se guarda información.

## Afirmaciones del sitio que hay que verificar antes de publicar

El sitio contiene afirmaciones comerciales que deben ser **verdaderas**:

| Texto                                       | Qué hay que confirmar                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| "Con licencia · Asegurados · Afianzados"    | Que existan licencia local, póliza de responsabilidad civil y fianza vigentes |
| "Personal con verificación de antecedentes" | Que el proceso de verificación esté realmente implantado                      |
| "Garantía de repaso" (24 horas)             | Que la empresa acepte esa política                                            |
| "Lunes a sábado, 8:00 AM - 6:00 PM"         | Horario real                                                                  |
| Teléfono y correo                           | Hoy son marcadores de posición en `apps/landing/src/config/company.ts`        |
