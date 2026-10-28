# Textos legales

> ⚠️ **BORRADOR. NO ES ASESORÍA LEGAL.** Los redactó el equipo de desarrollo
> a partir de una investigación de la ley federal y la de Georgia y del
> inventario de lo que el sistema hace de verdad, leído del código.
> **Antes de darlos por buenos los tiene que revisar un abogado de Georgia.**
> El porqué de cada decisión está en
> `docs/40-politica-de-privacidad-y-condiciones.md`.

## Dónde está el texto

**Aquí ya no.** Hubo cuatro archivos Markdown en esta carpeta y se retiraron
a propósito: durante un rato existieron dos copias de cada documento —una en
Markdown y otra en la aplicación— y es exactamente la clase de duplicado que
se separa solo. Se corrige una, la otra se queda mintiendo, y la que el
cliente acepta es la que nadie corrigió.

**Lo que el cliente acepta es lo que la página enseña, así que la página es el
documento:**

| Documento                      | Archivo                                |
| ------------------------------ | -------------------------------------- |
| Condiciones — **inglés, rige** | `apps/landing/src/legal/terms-en.ts`   |
| Condiciones — español          | `apps/landing/src/legal/terms-es.ts`   |
| Privacidad — **inglés, rige**  | `apps/landing/src/legal/privacy-en.ts` |
| Privacidad — español           | `apps/landing/src/legal/privacy-es.ts` |
| El formato y por qué           | `apps/landing/src/legal/documento.ts`  |

Son listas de bloques con el texto dentro: se leen sin saber programar, y el
abogado puede revisar directamente **la página publicada**, que es lo que de
verdad importa.

La versión inglesa es la que gobierna: el servicio se presta en Georgia, el
contrato se rige por la ley de Georgia y un tribunal de Georgia trabaja en
inglés. Cada documento lo dice en su penúltima sección.

## La regla que no se puede romper

**Cambiar el fondo de un documento obliga a subir su versión** en
`packages/types/src/legal.ts` (`TERMS_VERSION`, `PRIVACY_VERSION`).

En cada reserva se guarda **el número**, no el texto. Si se edita un documento
publicado sin subir la versión, lo guardado apunta a un texto que ya no es el
que esa persona aceptó, y el registro entero deja de servir para lo único que
existe. Se sube al cambiar el fondo, no una errata ni una coma.

## Los datos de la empresa no están en el texto

Razón social, dirección postal, teléfono, correo y condado salen de **Datos
del negocio** en el panel. Si estuvieran escritos en el documento, cambiar un
teléfono exigiría tocar código y desplegar.

**Lo que no esté configurado no se pinta**: antes un hueco que un
«[RAZÓN SOCIAL]» publicado dentro de un contrato. Faltan por rellenar:

| Dato             | Para qué                                                                      |
| ---------------- | ----------------------------------------------------------------------------- |
| Razón social     | El nombre con el que se firma. Sin él, los documentos dicen «Freshness Touch» |
| Dirección postal | **La exige CAN-SPAM** en todo correo comercial                                |
| Condado          | La cláusula de jurisdicción de las condiciones                                |

## Decisiones de negocio que siguen abiertas

Están marcadas dentro del texto y explicadas en `docs/40` §6: la tarifa con
descuento cuando no hay recurrencia, la no competencia de personal y el
arbitraje (dejado fuera a propósito). La política de cancelación dentro de las
24 h ya está decidida y escrita.
