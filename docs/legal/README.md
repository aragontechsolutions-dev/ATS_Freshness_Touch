# Textos legales del sitio

> ⚠️ **BORRADOR. NO ES ASESORÍA LEGAL.** Estos cuatro documentos los redactó
> el equipo de desarrollo a partir de (a) una investigación de lo que exige la
> ley federal de EE. UU. y la de Georgia y (b) el inventario de lo que el
> sistema hace de verdad, leído del código. **Antes de publicarlos los tiene
> que revisar un abogado de Georgia.** El porqué de cada decisión y la
> investigación completa están en `docs/40-politica-de-privacidad-y-condiciones.md`.

## Qué hay aquí

| Archivo                  | Qué es                                    |
| ------------------------ | ----------------------------------------- |
| `privacy-policy.en.md`   | Política de privacidad — **inglés, rige** |
| `privacy-policy.es.md`   | Traducción al español, de cortesía        |
| `terms-of-service.en.md` | Términos y condiciones — **inglés, rige** |
| `terms-of-service.es.md` | Traducción al español, de cortesía        |

**La versión inglesa es la que gobierna.** El servicio se presta en Georgia,
el contrato se rige por la ley de Georgia y un tribunal de Georgia trabaja en
inglés. La española existe porque buena parte de la clientela lee en español y
no se puede pedir a alguien que acepte un contrato que no entiende; así lo
dice cada documento en su última sección.

## Huecos que hay que rellenar antes de publicar

Están escritos entre corchetes y en mayúsculas, así que se encuentran con
`grep -rn "\[.*\]" docs/legal/`. **Ninguno lo puede inventar el sistema.**

| Hueco               | Qué es                                                | Dónde se consigue                                         |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| `[LEGAL NAME]`      | La razón social exacta, con su sufijo (LLC, Inc.)     | El certificado de constitución de la Secretaría de Estado |
| `[MAILING ADDRESS]` | Dirección postal física                               | La de la empresa. **CAN-SPAM la exige en los correos**    |
| `[PHONE]`           | Teléfono de contacto                                  | El mismo que el panel publica                             |
| `[PRIVACY EMAIL]`   | Buzón para peticiones de privacidad                   | Puede ser el general, pero mejor uno dedicado             |
| `[EMAIL]`           | Buzón general de contacto, el que ya publica el panel | El mismo que el sitio                                     |
| `[EFFECTIVE DATE]`  | Fecha de entrada en vigor                             | El día que se publiquen                                   |
| `[COUNTY]`          | Condado de Georgia donde está la empresa              | Para la cláusula de jurisdicción                          |

Además hay **tres cláusulas marcadas y no redactadas** porque son decisiones de
negocio, no huecos de datos: `[RECURRING RATE RULE]` (Términos §9),
`[NON-SOLICITATION]` (§14) y `[ARBITRATION]` (§16). Cada marca dice qué hay que
decidir y remite a `docs/40` §6.

## Reglas para mantenerlos

1. **Si cambia lo que hace el sistema, cambia el documento.** Una política de
   privacidad que describe un tratamiento que ya no existe —o que se calla uno
   nuevo— es peor que no tenerla: es una afirmación falsa por escrito.
2. **La versión se sube al cambiar el fondo**, no la ortografía. Lo que el
   cliente aceptó queda guardado con su número de versión, y dos clientes que
   aceptaron textos distintos tienen que poder distinguirse.
3. **Lo que se promete aquí tiene que ser verdad en el sitio y al revés.** Las
   preguntas frecuentes ya prometen cosas concretas (el depósito solo se cobra
   si se cancela con el equipo en camino, 24 h para mover una cita sin coste,
   repaso gratis avisando en 24 h). Estos documentos repiten esas mismas
   promesas a propósito. Si una cambia, cambian las dos.
