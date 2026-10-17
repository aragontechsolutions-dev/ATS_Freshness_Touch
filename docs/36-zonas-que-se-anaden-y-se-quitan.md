# 36 — Las zonas: las del código y las del panel

> Etapas 3.19 y 3.20. El array de zonas del motor declaraba una banda que el
> área guardada no tiene, y el panel no sabía crear ni borrar zonas. Son dos
> arreglos del mismo agujero: **el código decía un negocio y la base decía
> otro.**

---

## 1. El fallo: leer el código llevaba a una conclusión falsa

En `packages/pricing/src/config.ts` estaba escrito esto:

```ts
zones: [
  { code: 'A', maxMiles: 35,  serviceable: true, instantQuote: true },
  { code: 'B', maxMiles: 60,  serviceable: true, instantQuote: true },   // ← no existe
  { code: 'C', maxMiles: 325, serviceable: true, instantQuote: false },
  { code: 'OUT_OF_RANGE', maxMiles: null, serviceable: false, instantQuote: false },
],
```

Y en la base, desde la etapa 2.26, el área guardada era **A y C**. La B se
había retirado porque el traslado ya se cobra por milla desde las 35 y una
banda intermedia no decidía nada.

Los dos únicos sitios que construyen una `PricingConfig` —`current()` y
`atVersion()` de `PricingConfigService`— hacen lo mismo:

```ts
zones: await this.serviceArea.zoneRules(),
```

Así que **ese array nunca se usaba en producción**. No fallaba nada. Y
justamente por eso costó caro: al diagnosticar por qué un código postal a 47
millas no recibía precio automático, el código decía que sí lo recibía. Una
sesión entera de diagnóstico buscando un fallo donde no lo había. El sistema
hacía lo correcto; lo que mentía era el archivo.

> **La regla que queda.** Un valor de partida que siempre se sobrescribe sigue
> siendo documentación, y la documentación que miente cuesta más que la que no
> está.

### Qué se hizo (etapa 3.19)

- El array de `config.ts` ahora es **igual** que `DEFAULT_SERVICE_AREA`: A
  hasta 35, C hasta 325, y `OUT_OF_RANGE`.
- Encima lleva un comentario que dice que **no manda en producción**, quién lo
  sobrescribe y por qué falta la B.
- `packages/pricing/src/zonas-de-partida.test.ts` **falla si alguien cambia
  uno de los dos sin el otro**. Hace la misma traducción que `zoneRules()` y
  compara.

### Las pruebas del motor describían un negocio que no existe

Tres pruebas afirmaban que a 45 millas hay precio automático y zona B. Están
reescritas, y el reparto es importante:

| Prueba                               | Con qué configuración | Qué dice                                                               |
| ------------------------------------ | --------------------- | ---------------------------------------------------------------------- |
| «las dos bandas del área de partida» | La de partida         | **Lo que cobra el negocio hoy**: a 36 millas ya es «te llamamos»       |
| «con una banda intermedia…»          | Una explícita, con B  | Que el motor sabe manejar una banda intermedia cuando el panel la pone |

### Un efecto que conviene tener presente

Con el área de hoy, **el recargo por milla no llega a cobrarse nunca**: donde
hay precio automático (hasta 35) no hay millas de exceso, y donde las hay
(zona C) no hay precio que recargar. No es un fallo: es la consecuencia de que
el radio sin recargo y la zona A coincidan.

El recargo sigue siendo código vivo —se calcula siempre, y aparece en el
desglose para que quien cotice a mano sepa cuántas millas se cobran— y se
activa en cuanto el panel sube la zona A o añade una banda intermedia con
precio automático. Las pruebas del traslado usan una configuración explícita
por eso.

---

## 2. El panel ya sabe crear y borrar zonas

> Etapa 3.20.

Hasta ahora el formulario solo editaba las filas que existían: el límite en
millas y la casilla de precio automático. **Para recuperar una banda
intermedia había que desplegar código.**

Ahora cada fila lleva dos botones: **«Añadir una zona después de la X»** y
**«Quitar la zona X»**.

### Por qué «después de esta» y no un botón al pie

Porque el área es A y C, y **el código de una zona retirada no se
reaprovecha**: está escrito en reservas que ya existen, donde «B» significa
«hasta 60 millas, con precio automático». Un botón al pie solo podría añadir
D y E —más lejos que C—, que es justo lo contrario de lo que hace falta.

Con un botón por fila, la B entra entre la A y la C, que es su sitio.

### Quién decide si el botón se puede pulsar

**El contrato, no la pantalla.** En `packages/types/src/service-area.ts`:

| Función                        | Qué responde                                                               |
| ------------------------------ | -------------------------------------------------------------------------- |
| `zoneToAddAfter(zones, index)` | La zona entera que cabe ahí —código, millas y precio automático—, o `null` |
| `canRemoveZone(zones, index)`  | Si esa se puede quitar                                                     |

La pantalla no inventa ni el código ni las millas, que son las dos cosas que
las reglas del conjunto pueden rechazar. Si devuelve `null`, el botón está
apagado y el `title` dice por qué.

**Lo que propone `zoneToAddAfter`:**

- **Código**: el primero sin usar que quede _entre_ esta zona y la siguiente;
  al final, el siguiente que quede. Entre A y B no hay ninguno, y después de
  la E tampoco.
- **Millas**: a mitad de camino entre las dos; al final, cincuenta más, sin
  pasar del tope duro de 500. Entre 35 y 36 millas no cabe nada.
- **Precio automático**: **el de la siguiente**, nunca el de la anterior. Como
  una vez apagado ya no vuelve a encenderse, copiar el de arriba crearía un
  área inválida en el mismo momento de pulsar el botón.

**Lo que impide `canRemoveZone`:** quitar la única zona, y quitar la primera
cuando la que quedaría no da precio automático —el sitio pediría los datos
para no darle una cifra a nadie, ni siquiera a quien vive al lado—. Con el
área de hoy eso significa que **la A no se puede quitar y la C sí**.

### Con un número a medio teclear no se hace nada

Mientras el campo de millas no sea un número, los dos botones están apagados:
no se sabe sobre qué área se estaría operando. El campo vacío no es cero.

---

## 3. Seguridad

Nada de esto cambia quién puede tocar el área: **sigue siendo solo ADMIN**, y
el servidor vuelve a validar con `ServiceAreaSettingsSchema`, el mismo esquema
que usa la pantalla. Los botones nuevos no abren ninguna puerta: componen una
petición que ya existía y que ya estaba protegida y auditada (etapa 2.18).

Lo que sí hay que tener presente es **el alcance comercial**: añadir una zona
con precio automático a 120 millas hace que el cotizador prometa cifras para
traslados que nadie ha calculado. La pantalla lo enseña en el mapa mientras se
escribe, y el aviso sigue siendo el de siempre: esta es la configuración que
más dinero mueve.

---

## 4. Qué se comprueba

**17 pruebas del contrato** (`packages/types/src/service-area.test.ts`) y
**7 de la pantalla** (`apps/admin/src/components/ServiceAreaForm.test.tsx`).

| Prueba                                                           | Qué protege                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Lo que propone añadir **siempre pasa el esquema**                | Un botón que crea un área inválida es peor que un botón que no está |
| Quitar lo que se puede quitar deja siempre un área válida        | Lo mismo, por el otro lado                                          |
| Entre A y C propone la B, a mitad de camino                      | Que la banda intermedia se pueda recuperar sin desplegar            |
| Hereda el precio automático de la **siguiente**                  | La regla que no se puede romper ni un instante                      |
| Añadiendo al final se llega a A, C, D y E —no a cinco—           | Que el código de una zona retirada no se reaprovecha                |
| La zona más cercana no se puede quitar                           | Que el cotizador no se quede mudo para todo el mundo                |
| Con un campo a medio teclear no se añade ni se quita nada        | Que el vacío no se lea como cero                                    |
| `PRICING_CONFIG.zones` ≡ `DEFAULT_SERVICE_AREA` + `OUT_OF_RANGE` | Etapa 3.19: que el código no vuelva a describir otro negocio        |
| Las dos bandas caen donde deben, con la configuración de partida | Lo que cobra el negocio hoy, por escrito                            |

---

## 5. Si mañana hay que tocar esto

- **No renombres un código de zona para que queden seguidos.** Está escrito en
  reservas que ya existen. Los saltos son a propósito.
- **No pongas el valor de partida de las zonas en dos sitios distintos.** Si
  hace falta otro, que lo derive de `DEFAULT_SERVICE_AREA`; si no, la prueba
  de sincronización avisará.
- **No decidas en la pantalla qué zona cabe.** Las cuatro reglas del conjunto
  están en el contrato, y es donde el servidor las va a volver a comprobar.
- Si algún día las zonas se versionan como las tarifas, el sitio es el modelo
  de `docs/20-tarifas-editables.md`, y entonces `atVersion` podría reconstruir
  el cuadro completo.
