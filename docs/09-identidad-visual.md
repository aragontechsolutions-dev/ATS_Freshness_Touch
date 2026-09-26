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

El isotipo oficial (girasol, hogar y onda sobre el círculo azul) lo entregó la
empresa como imagen. `apps/landing/src/components/Logo.tsx` expone:

- `LogoMark` — el isotipo oficial.
- `Logo` — el conjunto: isotipo + "Freshness Touch" + "CLEANING SERVICES",
  con el eslogan opcional.

### El nombre es texto, no parte de la imagen

Deliberado, por tres razones:

1. **Accesibilidad:** un lector de pantalla lo lee, y se puede seleccionar y buscar.
2. **Modo oscuro:** "Touch" es casi negro en claro pero **blanco** en oscuro. Si
   fuera parte de la imagen, desaparecería sobre el fondo negro.
3. **Nitidez y peso:** el texto se ve perfecto a cualquier tamaño y no añade
   kilobytes de descarga.

Cuando el nombre aparece al lado, el isotipo lleva `alt=""` porque es
decorativo: anunciarlo dos veces molesta a quien usa lector de pantalla.

### Activos de marca

| Archivo                                     | Uso                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/assets/logo-mark.webp` (256 px, 20 kB) | Isotipo en la interfaz; Vite le pone huella para cachearlo                     |
| `public/brand/logo-full.webp` (900 px)      | **Lockup horizontal completo**, con el nombre y el eslogan dentro de la imagen |
| `public/favicon-32.png` · `favicon-192.png` | Pestaña del navegador y Android                                                |
| `public/apple-touch-icon.png` (180 px)      | Pantalla de inicio de iOS                                                      |

El lockup completo **no se usa en la interfaz**: lleva fondo blanco y texto
negro fijos, así que en modo oscuro dejaría un recuadro blanco. Se conserva
como activo de marca para correos, facturas, prensa y documentos impresos.

Los favicons conservan la transparencia de las esquinas del círculo. El icono
de iOS, en cambio, va sobre fondo blanco, porque iOS no admite transparencia y
las esquinas saldrían negras.

Los archivos derivados se generaron redimensionando el original dentro del
navegador, ya que el entorno no tiene ninguna librería de imagen instalada.

### El logotipo y el contraste

Un logotipo está **exento** de los mínimos de contraste de WCAG (el criterio
1.4.11 excluye expresamente los logotipos). El círculo azul del isotipo sobre
el fondo casi negro del modo oscuro da 2.47:1, por debajo de lo que se exigiría
a un control, y aun así es correcto: su contenido interior (girasol amarillo,
tejado blanco) es brillante y la marca se reconoce sin dificultad.

## Jerarquía de botones

| Nivel      | Estilo                                        | Cuándo                                                 |
| ---------- | --------------------------------------------- | ------------------------------------------------------ |
| Primario   | `ft-btn-primary` — amarillo, texto casi negro | La acción que genera negocio: "Get a Free Quote"       |
| Secundario | `ft-btn-secondary` — azul, texto blanco       | Acción importante pero no principal: "Book a Cleaning" |
| Terciario  | `ft-btn-outline` — contorno azul              | Acciones de apoyo: "Contact Us", "See our services"    |

Regla: **un solo botón amarillo por pantalla visible.** Si hay dos, ninguno
destaca y se pierde su función.

## Interfaz pensada primero para móvil

La mayoría del tráfico de un servicio de limpieza es móvil, así que el ancho de
referencia es **390 píxeles**, no el escritorio.

Decisiones que salieron de medir en ese ancho:

| Problema                                                        | Solución                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| "Menu" se cortaba en la cabecera                                | Iconos para idioma, tema y menú                                                              |
| Dos botones EN/ES ocupaban el doble de lo necesario             | Un botón que **alterna**: muestra el idioma activo, la etiqueta accesible dice a cuál cambia |
| El botón de tema medía 34 px                                    | Los tres controles a **44 px**, el mínimo para tocar con el dedo sin fallar                  |
| El logotipo completo desbordaba junto a tres controles de 44 px | Nombre más pequeño en móvil y descriptor oculto por debajo de `sm`                           |
| "CLEANING SERVICES" se partía en dos líneas                     | Oculto en móvil: la marca ya se reconoce con isotipo y nombre                                |
| El teléfono competía por espacio en la cabecera                 | Se movió dentro del menú, donde además gana protagonismo                                     |

La barra fija inferior respeta `safe-area-inset-bottom`: sin eso, en un iPhone
los botones quedan medio tapados por la barra del sistema.

**Comprobado en cada cambio**, con un navegador real a 390 píxeles: que no haya
desplazamiento horizontal, que ningún elemento desborde y que todos los
controles lleguen a 44 píxeles de alto.

## Movimiento

Las animaciones están para guiar la mirada, no para lucirse. Tres reglas
gobiernan todas:

### 1. Nada se mueve sin permiso

Todo cuelga de la clase `ft-motion`, que el script de arranque añade **solo**
si el sistema no pide reducir el movimiento. Para quien lo pidió —hay personas
a las que el movimiento les provoca mareo— o si JavaScript falla, el contenido
se ve **completo y quieto**, nunca invisible.

Ese orden importa: las animaciones de entrada parten de opacidad cero, así que
ese estado inicial solo puede aplicarse cuando hay permiso. Por eso la decisión
se toma antes del primer pintado, en `public/theme-init.js`, y no dentro de un
componente.

Hay además una regla `@media (prefers-reduced-motion: reduce)` que anula
duraciones globalmente, como cinturón de seguridad.

### 2. Solo se animan `opacity` y `transform`

Son las dos propiedades que el navegador compone sin recalcular el diseño de la
página, así que no provocan tirones ni en móviles modestos. Nunca se anima
`width`, `height`, `top` ni `margin`.

### 3. Recorridos cortos y rápidos

Entre 12 y 16 píxeles, y menos de medio segundo. Una animación que se nota es
una animación que estorba.

### Qué se anima

| Elemento                    | Efecto                                            | Para qué                                                                                                |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Portada                     | Entrada en cascada al cargar                      | Orden de lectura: distintivo, titular, texto, botones                                                   |
| Tarjetas y secciones        | Aparición al entrar en pantalla, en cascada corta | Acompaña el desplazamiento sin que todo surja de golpe                                                  |
| Tarjetas de servicio y zona | Elevación al pasar el ratón                       | Indica que son elementos con entidad propia                                                             |
| Botones                     | Reducción al pulsar                               | Confirma el toque, sobre todo en móvil                                                                  |
| Total del presupuesto       | Destello amarillo al cambiar                      | Sin él, el precio se actualiza en silencio y no queda claro si ya refleja lo que se acaba de tocar      |
| Espera del cotizador        | Esqueleto en vez de texto                         | Muestra la forma del resultado; un "cargando" deja la columna vacía y el salto posterior resulta brusco |
| Cabecera                    | Sombra al desplazar                               | Arriba del todo ensucia; al bajar separa la cabecera del contenido                                      |

La cascada usa un retardo corto que se reinicia cada tres elementos: si creciera
con cada tarjeta, las últimas tardarían demasiado en aparecer.

### Cómo se verifica

Un navegador real comprueba los tres escenarios y exige que **ningún elemento
animado quede invisible** en ninguno:

| Escenario            | Resultado                                                      |
| -------------------- | -------------------------------------------------------------- |
| Movimiento reducido  | Sin clase `ft-motion`, 27 elementos animados, **0 invisibles** |
| Movimiento permitido | Con clase, tras recorrer la página, **0 invisibles**           |
| Sin JavaScript       | Nada queda oculto por CSS                                      |

> Aviso para quien repita la comprobación: con el desplazamiento suave activo,
> un bucle de `scrollTo` redirige la animación anterior en cada paso y la página
> nunca llega al final, de modo que la medición saldría mal sin que el sitio
> tenga ningún problema. Hay que desplazarse con `behavior: 'instant'`.

Coste de todo esto: **+0.7 kB** comprimidos en JavaScript y **+0.6 kB** en CSS.
No se añadió ninguna librería de animación; una típica ronda los 50 kB.

## Cómo verificar el contraste al añadir pantallas

El proyecto incluye una auditoría que mide los colores **realmente pintados por
el navegador**, no los que uno cree haber puesto. Recorre cada elemento con
texto, compone las capas de fondo con su transparencia y compara contra WCAG AA
(4.5:1 en texto normal, 3:1 en texto grande).

Estado actual: **36 combinaciones auditadas en el sitio público y 68 textos
medidos en el panel, todos cumplen.** El más ajustado del panel es 4.76:1 en
modo claro y 5.09:1 en oscuro.

Una advertencia que costó un fallo real: **no basta con calcular sobre la
paleta**. Al montar las pestañas del panel se puso texto casi negro sobre
`brand-500` copiando lo que hace el botón amarillo, dando por hecho que era
«lo coherente». Da **3.71:1** y no llega. El botón amarillo funciona porque el
amarillo es muy claro; ese azul no lo es. Con texto blanco sube a 5.09:1. Cada
par se mide, incluso —sobre todo— cuando parece copiado de uno que ya
funcionaba.

Advertencia para quien repita la auditoría: Chromium devuelve los colores en
formato `oklch()`/`oklab()`. Si se intenta leer esos números como si fueran RGB
salen fallos que no existen. Hay que convertir el color con el propio navegador
(pintándolo en un canvas de 1×1 y leyendo el píxel).
