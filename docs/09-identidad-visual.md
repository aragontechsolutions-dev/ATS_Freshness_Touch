# 09 — Identidad visual

Cómo se traduce el manual de marca de Freshness Touch a la interfaz, y las
reglas que hay que respetar al añadir pantallas nuevas.

## Colores oficiales

| Color            | Código    | Significado                |
| ---------------- | --------- | -------------------------- |
| Azul primario    | `#145788` | Confianza, profesionalidad |
| Amarillo girasol | `#F9C400` | Energía, frescura          |
| Casi negro       | `#111111` | Elegancia, contraste       |
| Blanco roto      | `#F7F9FC` | Limpieza, espacio          |

## La regla de contraste (medida, no estimada)

Antes de escribir una línea de CSS se midió el contraste real de los colores
de marca:

| Color              | Sobre blanco roto | Sobre casi negro |
| ------------------ | ----------------: | ---------------: |
| Azul `#145788`     |     **7.24:1** ✅ |        2.47:1 ❌ |
| Amarillo `#F9C400` |         1.54:1 ❌ |   **11.62:1** ✅ |

De ahí sale la regla que gobierna toda la interfaz:

> **El azul lidera el modo claro; el amarillo lidera el modo oscuro.**
>
> El amarillo **nunca** es color de texto sobre fondo claro: solo relleno con
> texto casi negro encima. El azul de marca **nunca** es color de texto ni
> relleno de botón sobre fondo oscuro: ahí se usa el azul 300 (texto) o el
> 500 (relleno).

Consecuencias concretas ya aplicadas:

- El botón amarillo lleva un borde `#A88200` (3.40:1) para que su silueta se
  distinga del fondo claro; sin él, el botón se difumina con la página.
- El botón azul en modo oscuro usa el azul 500, no el de marca: el 700 solo da
  2.47:1 contra el fondo y su contorno resultaba invisible.
- En el logotipo, "Touch" es casi negro en claro pero **blanco** en oscuro.
  Mantener el negro lo haría desaparecer.

## Escalas

```
Azul   50 #EFF6FB · 100 #D9E9F4 · 200 #B3D2E9 · 300 #7FB3D9 · 400 #4A90C4
       500 #2A73A9 · 600 #1B6294 · 700 #145788* · 800 #10456C · 900 #0C3552

Sol    50 #FFF9E5 · 100 #FFF0BF · 200 #FDE380 · 300 #FBD340 · 400 #F9C400*
       500 #DCAC00 · 600 #A88200 · 700 #8A6B00 · 800 #5C4700 · 900 #3D2F00
```

`*` = color oficial de marca.

Papeles fijos dentro de la escala:

| Token       | Uso                                                          |
| ----------- | ------------------------------------------------------------ |
| `brand-300` | Texto y acentos en modo oscuro (8.41:1)                      |
| `brand-400` | Anillo de foco, único en ambos modos (3.28:1 y 5.46:1)       |
| `brand-500` | Relleno de botón azul en modo oscuro (3.71:1)                |
| `brand-700` | Color oficial: texto y botones en modo claro                 |
| `sun-400`   | Color oficial: relleno de botón primario y acentos en oscuro |
| `sun-600`   | Borde del botón amarillo en modo claro                       |
| `sun-700`   | Único amarillo legible como texto sobre fondo claro          |

## Tipografía

- **Titulares:** Montserrat (`--font-display`), peso 700.
- **Cuerpo:** Inter (`--font-sans`).

Ambas se sirven **desde nuestro propio dominio** con `@fontsource-variable`,
no desde Google Fonts. Tres motivos: la visita no se comparte con un tercero,
no hay una petición extra que retrase el primer pintado, y la política de
seguridad de contenido puede seguir prohibiendo orígenes externos.

La compilación genera doce archivos de fuente (cirílico, griego, latino y
latino extendido), pero **el navegador descarga solo dos**: los subconjuntos
latinos. El resto lleva `unicode-range` y no se pide nunca salvo que la página
contenga esos caracteres. Medido en el navegador: 2 archivos de fuente y cero
peticiones a dominios ajenos.

## Logotipo

`apps/landing/src/components/Logo.tsx` expone dos piezas:

- `LogoMark` — el isotipo en SVG (girasol, tejado y onda).
- `Logo` — el conjunto: isotipo + "Freshness Touch" + "CLEANING SERVICES",
  con el eslogan opcional.

Decisiones deliberadas:

1. **El isotipo es SVG, no imagen.** Escala sin perder nitidez, pesa unos pocos
   kilobytes y adapta sus colores al tema.
2. **El nombre es texto HTML, no parte del SVG.** Así lo lee un lector de
   pantalla, se puede seleccionar y cambia de color con el tema.
3. **La composición se eligió midiendo, no por gusto.** Se renderizaron tres
   variantes a 36, 56 y 96 píxeles sobre fondo claro y oscuro. Las que llevaban
   arco envolvente y ventana se descartaron: a 36 px —el tamaño real de la
   cabecera— se emborronaban.
4. **El eslogan "Fresh Spaces. A Touch Above." no se traduce.** Forma parte del
   logotipo, como cualquier eslogan de marca.

## Iconos de la aplicación

| Archivo                | Tamaño     | Contenido                                          |
| ---------------------- | ---------- | -------------------------------------------------- |
| `favicon.svg`          | cualquiera | Girasol y onda sobre azul, esquinas redondeadas    |
| `apple-touch-icon.png` | 180×180    | Isotipo completo, a sangre (iOS aplica su máscara) |

El favicon es **más simple** que el logotipo a propósito: se comprobó
renderizando ambas opciones a 16, 32, 48 y 180 px, y a 16 px la versión con
tejado se volvía ilegible. Es la práctica habitual en sistemas de marca:
marca simplificada en tamaños pequeños, completa en grandes.

## Jerarquía de botones

| Nivel      | Estilo                                        | Cuándo                                                 |
| ---------- | --------------------------------------------- | ------------------------------------------------------ |
| Primario   | `ft-btn-primary` — amarillo, texto casi negro | La acción que genera negocio: "Get a Free Quote"       |
| Secundario | `ft-btn-secondary` — azul, texto blanco       | Acción importante pero no principal: "Book a Cleaning" |
| Terciario  | `ft-btn-outline` — contorno azul              | Acciones de apoyo: "Contact Us", "See our services"    |

Regla: **un solo botón amarillo por pantalla visible.** Si hay dos, ninguno
destaca y se pierde su función.

## Cómo verificar el contraste al añadir pantallas

El proyecto incluye una auditoría que mide los colores **realmente pintados por
el navegador**, no los que uno cree haber puesto. Recorre cada elemento con
texto, compone las capas de fondo con su transparencia y compara contra WCAG AA
(4.5:1 en texto normal, 3:1 en texto grande).

Estado actual: **36 combinaciones de color auditadas, todas cumplen.** La más
ajustada es 4.76:1 en modo claro y 6.3:1 en oscuro.

Advertencia para quien repita la auditoría: Chromium devuelve los colores en
formato `oklch()`/`oklab()`. Si se intenta leer esos números como si fueran RGB
salen fallos que no existen. Hay que convertir el color con el propio navegador
(pintándolo en un canvas de 1×1 y leyendo el píxel).
