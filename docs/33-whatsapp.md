# 33. El sitio se escribe, no se llama (Etapa 3.16)

## 1. De dónde sale

Al revisar el botón **«Request a custom proposal»** —el que sale cuando una
dirección queda fuera del radio con precio automático— apareció que no hacía
lo que prometía.

El texto decía _«déjanos tus datos y te llamamos»_. El botón era esto:

```tsx
<a href={contacto.phoneHref ?? '#contact'}>   // tel:+16783947184
```

**No se dejaba ningún dato en ninguna parte.** Se abría el marcador del
teléfono y el cliente tenía que llamar él.

## 2. Por qué un `tel:` era mal negocio

| Problema                                 | Consecuencia                               |
| ---------------------------------------- | ------------------------------------------ |
| En un ordenador abre Skype, Teams o nada | El visitante pulsa y no pasa nada visible  |
| De noche o desde el trabajo nadie llama  | Se va                                      |
| **No deja rastro**                       | **La empresa no se entera de que existió** |

El tercero es el caro. Un cliente que no llega a llamar es un cliente del que
nunca supiste nada: no hay reserva, ni aviso de Telegram, ni fila en el panel.
Y las zonas lejanas —las que llegan a ese botón— son justo donde los trabajos
son más grandes.

## 3. Qué se hizo

**Todos** los botones de contacto del sitio público abren WhatsApp:

| Dónde                              | Antes  | Ahora                               |
| ---------------------------------- | ------ | ----------------------------------- |
| Cabecera (escritorio y menú móvil) | `tel:` | WhatsApp                            |
| Barra flotante del móvil           | `tel:` | WhatsApp                            |
| Sección de contacto                | `tel:` | WhatsApp                            |
| Aviso de error del cotizador       | `tel:` | WhatsApp                            |
| Propuesta personalizada            | `tel:` | WhatsApp **con el mensaje escrito** |
| Pago no disponible                 | `tel:` | WhatsApp                            |
| Reserva con pago pendiente         | `tel:` | WhatsApp                            |

Ahí el cliente escribe, manda una nota de voz o llama igual —y **queda la
conversación**.

### `wa.me`, no `whatsapp://`

`wa.me` es el enlace oficial y resuelve solo según el dispositivo: abre la
aplicación si está instalada, la tienda si no, y `web.whatsapp.com` en un
ordenador. Un esquema `whatsapp://` no hace nada en un navegador sin la
aplicación, que es justo donde más gente se quedaría sin poder escribir.

## 4. El campo nuevo, y la mina que lleva dentro

```ts
export const BusinessSettingsSchema = z.strictObject({
  phone: PhoneE164Schema.nullable(),
  whatsapp: PhoneE164Schema.nullable().default(null),   // ← OBLIGATORIO
  ...
});
```

**El `.default(null)` no es un adorno.** Esto es un `strictObject` y la fila
guardada se valida al leerla. Sin el valor por defecto, la fila que ya existe
—que no tiene `whatsapp`— dejaría de cumplir el contrato, y
`business-settings.service.ts` devolvería `DEFAULT_BUSINESS_SETTINGS`, donde
`phone: null`.

Es decir: **el teléfono desaparecería de toda la web** —cabecera, barra del
móvil, contacto, cotizador— **sin un solo error en ninguna pantalla**. Es la
misma caída muda que costó diez días con los precios, y la que ya se esquivó
en la etapa 3.13 con los chats de Telegram.

Hay una prueba que mete la fila de antes de la etapa y comprueba que el
teléfono sobrevive.

### Vacío significa «el mismo teléfono»

La regla 1 de `business-settings.ts` dice que el número se guarda **una sola
vez** para que el sitio no pueda _enseñar_ uno y _marcar_ otro. Un segundo
campo obligatorio sería exactamente eso.

Por eso el campo es opcional: por defecto hay un solo número, y existe sólo
para el caso real de que el WhatsApp del negocio sea una línea distinta. El
panel dice en todo momento a dónde irán los mensajes, con el número delante.

## 5. El mensaje llega escrito

El botón de la propuesta personalizada no deja al cliente ante un chat vacío:

> _¡Hola! Me gustaría una propuesta personalizada para una limpieza en el
> código postal 30655 (unos 1800 ft²)._

Sale de `quote.input`, que el componente ya tiene a mano.

**Son datos que el visitante acaba de teclear él mismo**, no datos personales:
el nombre, el correo y la dirección se siguen pidiendo en el formulario de
reserva. Hay una prueba que falla si alguna vez se cuela uno de esos campos en
el mensaje, porque esto sale hacia un servicio de terceros.

## 6. Lo que se retiró

- **`phoneHref`** del contrato: desde esta etapa no se llama a nadie desde el
  sitio, así que el ayudante que construía los `tel:` no tenía ni un uso.
- **`PhoneIcon`** del sitio público, por lo mismo.

Las pruebas vigilan que no vuelvan: una recorre todo el código del sitio y
falla si aparece un `tel:` o el ayudante retirado.

## 7. Seguridad

| Qué                                    | Cómo se cierra                                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un número manipulado desde el panel    | `PhoneE164Schema` exige `+` y dígitos. No hay forma de colar otro esquema en el `href`, y los dígitos del enlace salen de una cadena que ya pasó por ahí                                              |
| `target="_blank"` sin `rel="noopener"` | Daría a la página destino una referencia a `window.opener`, con la que puede redirigir esta pestaña. Hay una prueba que cuenta las aperturas y las protecciones de cada archivo y exige que coincidan |
| El mensaje corta la URL                | Va con `encodeURIComponent`: un `&` o un `#` en el texto dejarían al cliente con media frase                                                                                                          |
| Datos personales hacia un tercero      | El mensaje sólo lleva código postal y pies cuadrados, y hay una prueba que lo vigila                                                                                                                  |

## 8. Cómo se configura

**Panel → Datos del negocio → Contacto**

- **Número de WhatsApp:** déjalo **vacío** si el WhatsApp es el mismo número
  que el teléfono. Debajo del campo verás siempre a dónde irán los mensajes.
- Si el WhatsApp del negocio es otra línea, escríbela ahí.

### ⚠️ Comprobación obligatoria tras desplegar

**El número configurado tiene que tener WhatsApp activo.** Si es un número VoIP
o de centralita sin WhatsApp, el enlace abre la aplicación diciendo «este
número no está en WhatsApp», que es peor que lo de antes.

Se comprueba en diez segundos: abre el sitio, pulsa cualquier botón de
contacto y mira si se abre el chat contigo.

## 9. Lo que NO entra

**Un formulario que recoja la solicitud.** Se valoró y se descartó por ahora:
con WhatsApp ya queda el rastro y el aviso llega al móvil al instante, que es
el 90 % del valor con el 10 % del trabajo. Si algún día el volumen lo pide, la
maquinaria para ponerle precio a mano ya existe desde la etapa 3.7.b.
