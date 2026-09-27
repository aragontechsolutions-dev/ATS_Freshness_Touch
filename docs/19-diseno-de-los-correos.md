# 19 — El diseño de los correos

Los cinco correos que manda el sistema comparten una sola maqueta, con el
logotipo y los colores de la marca. Este documento explica cómo está hecha y,
sobre todo, **por qué un correo no se maqueta como una página web**.

---

## 1. Los dos sistemas de correo, y cuál es el nuestro

Es la confusión más fácil de tener con este proyecto, así que va primero:

|                       | **El nuestro**                          | **El de Supabase**   |
| --------------------- | --------------------------------------- | -------------------- |
| Dónde vive            | `apps/api/src/notifications/templates/` | El panel de Supabase |
| Quién envía           | Resend, con nuestro remitente           | Supabase             |
| Idioma                | ES/EN según la persona                  | Uno solo             |
| Se revisa y se prueba | Sí, como cualquier código               | No                   |
| **Se usa hoy**        | **Sí, los cinco correos**               | **Ninguno**          |

Tras la etapa 2.20 **ninguna plantilla del panel de Supabase dispara**
(`docs/18`, sección 10). No hay que maquillarlas: no las ve nadie.

**Y la página «Templates» de Resend está vacía, y seguirá estándolo.** No
usamos esa función: nuestro código genera el HTML completo y se lo pasa a
Resend ya montado. Una plantilla en el panel de un proveedor está fuera del
repositorio, sin revisión, sin pruebas y en un solo idioma.

---

## 2. Un correo no es una página web

Casi todo lo raro de `templates/layout.ts` sale de aquí.

| Lo que se hace                              | Por qué                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Estilos en línea**, atributo por atributo | Muchos clientes tiran la hoja de estilos, y varios ignoran también el `<style>` del encabezado |
| **Tablas para maquetar**                    | No es nostalgia: Outlook en Windows usa el motor de Word, que no entiende ni flex ni grid      |
| Esquinas redondeadas **solo como adorno**   | Donde no se soportan, sale cuadrado. Nada que haya que entender depende de ellas               |
| `<meta viewport>`                           | Sin él, Outlook en móvil encoge el correo entero hasta hacerlo ilegible                        |
| `width` en atributo además de en el estilo  | Outlook ignora el estilo y pintaría la imagen a su tamaño real, rompiendo el ancho             |

---

## 3. La marca la llevan el color y el texto, no la imagen

**Las imágenes se bloquean por defecto** en Outlook, y en Gmail para quien no
esté en la libreta de direcciones. Si la identidad dependiera del logotipo,
una buena parte de los correos llegaría sin marca ninguna.

Por eso el orden de la cabecera es este:

1. **Una banda de 6 px con el azul oficial.** Es un color de fondo, y un
   color de fondo no se puede bloquear.
2. **El logotipo**, si está configurado, centrado sobre blanco.
3. **El nombre de la empresa en texto** cuando no hay logotipo — que es
   también lo que se lee cuando la imagen no carga, porque va en el texto
   alternativo con el color y el peso de la marca.

El pie cierra con un filete del **amarillo oficial**. Es el único sitio donde
aparece: como texto no se lee sobre blanco —lo dice el estudio de contraste
de `docs/09`—, pero como línea de tres píxeles cumple perfectamente.

### El fallo que solo se vio mirándolo

La primera versión ponía `width="240" height="160"` en la imagen. Con las
imágenes bloqueadas, **ese hueco de 160 px se reserva igual**, y el correo se
abría con un agujero blanco enorme antes del titular.

Se quitó el alto: Outlook escala en proporción a partir del ancho, y con las
imágenes apagadas el hueco se encoge hasta la línea de texto. Hay una prueba
que lo vigila, porque volver a añadirlo parece lo correcto.

---

## 4. El logotipo

|         |                                                                   |
| ------- | ----------------------------------------------------------------- |
| Archivo | `apps/landing/public/brand/logo-email.jpg`                        |
| Tamaño  | 480 × 320, mostrado a 240 → nítido en pantallas de doble densidad |
| Peso    | ~30 kB                                                            |
| Formato | **JPEG**, no WebP ni PNG                                          |

**Por qué JPEG y no WebP:** Outlook no pinta WebP. El logotipo del sitio
(`logo-full.webp`) no sirve aquí.

**Por qué JPEG y no PNG:** el mismo logotipo en PNG pesa **125 kB** por los
degradados del girasol; en JPEG al 88 % son 30 kB y a simple vista no se
distinguen. Cuatro veces menos peso en algo que se descarga en cada correo.

**Por qué sobre blanco y no transparente:** el logotipo lleva texto casi
negro. Sobre el fondo oscuro de un cliente en modo noche, el nombre de la
empresa desaparecería.

Se sirve desde el sitio público y la dirección va en **`EMAIL_LOGO_URL`**.
Es opcional: sin ella los correos salen con el nombre en texto. Va en
variable de entorno y no escrita en el código porque depende del dominio del
despliegue, y **un correo con una imagen rota apuntando a un dominio que ya
no es de la empresa es peor que un correo sin imagen**.

---

## 5. Los cinco correos

| Correo              | Cuándo                     | Lleva                               |
| ------------------- | -------------------------- | ----------------------------------- |
| Reserva confirmada  | Al quedar en firme         | Tabla de datos y nota del depósito  |
| Reserva cancelada   | Al cancelar                | Tabla de datos, sin el motivo       |
| Recordatorio        | La víspera                 | Tabla corta: cuándo, dónde y cuánto |
| Invitación al panel | Al dar acceso              | Botón con el enlace de un solo uso  |
| Recuperación        | Al pedirla desde el acceso | Lo mismo, con otro tono             |

Todos pasan por `emailHtml()`. **Antes había dos funciones `comoHtml` casi
idénticas**, una para los correos de reservas y otra para los del personal,
cada una con su propia función de escapado. _Casi_ idénticas es el problema:
un arreglo se aplicaba a una y no a la otra, y la que menos se mira es la que
acaba rota. Ahora cada archivo solo traduce sus datos al vocabulario del
diseño.

### Qué no sale nunca en un correo

Esto no cambia con el rediseño y conviene repetirlo:

- **Las instrucciones de acceso a la casa** (código de la puerta, dónde está
  la llave). Las da el cliente y son suyas, pero el correo viaja por
  servidores ajenos y se queda para siempre en un buzón que puede acabar
  comprometido. Devolvérselas no le aporta nada —ya las sabe— y multiplica
  los sitios donde están.
- **El motivo de una cancelación.** Lo escribe el equipo en el panel y es una
  nota interna. Reenviársela al cliente es un incidente, no una
  funcionalidad.
- **Ninguna contraseña**, ni inicial ni temporal. No existe tal cosa aquí: la
  persona elige la suya al abrir el enlace.
- **Ni una palabra sobre otras personas** en los correos al personal.

---

## 6. El botón, y por qué el enlace va además en texto

Siempre van los dos: el botón, y justo debajo el enlace completo en texto
pequeño y copiable.

Hay clientes de correo que no pintan botones, y quien lea esto en un móvil
viejo o en un cliente de texto tiene que poder copiarlo a mano. **Es la
diferencia entre que alguien entre o que llame por teléfono.**

Y el enlace **se escapa como atributo**, que no es lo mismo que escapar
texto: va dentro de `href="..."`, así que unas comillas sin escapar
permitirían cerrar el atributo y añadir otros. El enlace lo construye el
proveedor y no un usuario, pero escapar solo donde uno cree que hace falta es
exactamente como se cuelan estas cosas.

---

## 7. Qué se comprueba

Doce pruebas sobre la maqueta, y están elegidas por lo que cuesta caro
equivocarse, no por cubrir líneas:

| Prueba                                           | Qué protege                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Sin logotipo sale el nombre en texto             | Que el correo se entienda con las imágenes bloqueadas                                     |
| No se fija el alto de la imagen                  | El agujero blanco de la sección 3                                                         |
| La banda de color va siempre                     | Que la marca no dependa de una descarga                                                   |
| Se escapa el cuerpo **y** el atributo del enlace | Que un apellido con `<` no rompa nada                                                     |
| El enlace aparece dos veces                      | El botón y la copia en texto                                                              |
| El texto plano nunca va vacío                    | Hay clientes que solo lo pintan, y los filtros de correo basura penalizan el HTML a secas |
| `<html lang>` sigue al idioma                    | Los lectores de pantalla, y que el cliente no ofrezca traducir lo que ya está traducido   |

### Comprobado en navegador

Los cinco correos, renderizados y mirados de verdad en Chromium: a 680 px y a
390 px, en español y en inglés, con y sin logotipo, y **con las peticiones de
imágenes abortadas** para ver exactamente lo que ve quien las tiene
bloqueadas. Así se encontró el fallo del alto.

---

## 8. Si mañana hay que tocar la maqueta

- **No metas acentos graves en los comentarios de `layout.ts`.** Están dentro
  de literales de plantilla y cierran la cadena: el error que sale
  (`';' expected`) no señala al comentario. Pasó dos veces escribiendo este
  módulo.
- **Mira el resultado con las imágenes bloqueadas** antes de dar nada por
  bueno. Es la mitad de los destinatarios.
- **No añadas un segundo sitio donde se maquete un correo.** Es exactamente
  lo que esta etapa vino a deshacer.
