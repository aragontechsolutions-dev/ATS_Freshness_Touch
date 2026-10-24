# 38 — Fotos y vídeos de antes y después

> Etapa 2.A de la galería: **los permisos, antes del código.** La dueña quiere
> colgar vídeos de antes y después, y la web va a tener una galería. Lo que se
> publica es **el interior de la casa de un cliente**, y el «antes» es, por
> definición, la imagen de su casa sucia. Sin un permiso bien hecho, ese es el
> escenario de demanda más probable de todo el proyecto — más que los cobros.

> **ESTO NO ES ASESORÍA LEGAL.** Es el borrador operativo para que un abogado
> de Georgia lo revise, junto con `docs/37-dossier-operativo.md`. Lo escribe
> quien construyó el sistema, no un letrado. Nada de aquí se publica sin que
> alguien con licencia en Georgia lo haya leído.

---

## 1. Las dos cosas que no hay que confundir

Es el error más fácil de cometer y el más caro, porque las dos son «fotos del
trabajo»:

|              | **Marketing**                                 | **Prueba del trabajo**                             |
| ------------ | --------------------------------------------- | -------------------------------------------------- |
| Para qué     | Vender                                        | Defenderse de una queja o de una disputa de Stripe |
| Quién lo ve  | Todo internet                                 | Solo administración                                |
| Dónde vive   | YouTube (vídeo) y la galería de la web (foto) | Dentro del sistema, con acceso restringido         |
| Permiso      | **Imprescindible y por escrito**              | No es publicación: es registro del servicio        |
| ¿Existe hoy? | No                                            | No                                                 |

**Una foto de prueba del trabajo no se publica nunca, aunque salga bien.** Y
una foto de marketing no sirve como prueba, porque está elegida y recortada.

Hoy no existe ninguna de las dos. El dossier las tiene apuntadas como huecos
(punto 9 y apartado L). Esta etapa resuelve la primera; la segunda queda para
una etapa propia.

---

## 2. El modelo de consentimiento

La web es bilingüe, así que el permiso también. **Se firma el del idioma en
que se hable con el cliente**, y las dos versiones dicen lo mismo.

### Lo que el documento tiene que recoger

| Campo                                          | Por qué                                                  |
| ---------------------------------------------- | -------------------------------------------------------- |
| Nombre del cliente y dirección de la propiedad | El permiso es **de esa casa**, no del cliente en general |
| Fecha del servicio                             | Ata el permiso a un trabajo concreto                     |
| Qué se graba                                   | Interior, exterior, o ambos — marcado, no supuesto       |
| Dónde se publica                               | Web, Facebook, Instagram, YouTube: **enumerados**        |
| Si se puede mostrar el «antes»                 | Es la parte sensible; va en su propia casilla            |
| Si se puede identificar la zona                | «Marietta» sí, la calle no, nunca el número              |
| Duración                                       | Indefinido hasta que se revoque                          |
| Cómo se revoca                                 | Un correo o un WhatsApp bastan, y por escrito            |
| Plazo de retirada                              | **Cuántos días** tarda la empresa en quitarlo            |
| Firma y fecha                                  | Sin firma no hay permiso                                 |
| Que no se paga por ello                        | Si se paga, es otra figura legal distinta                |

**Un permiso verbal no vale.** No porque sea inválido en todos los casos, sino
porque no se puede demostrar, y el día que haga falta es precisamente el día
en que el cliente dice que no lo dio.

### Texto en inglés

```
BEFORE-AND-AFTER PHOTO AND VIDEO RELEASE

Customer name: ______________________  Phone: ______________________
Property address: ___________________________________________________
Date of service: ____________________

I allow Freshness Touch to take photographs and video of the following
areas of this property in connection with the cleaning service performed
on the date above:

  [ ] Interior      [ ] Exterior      [ ] Both

I allow Freshness Touch to publish that material for advertising on:

  [ ] Its website   [ ] Facebook   [ ] Instagram   [ ] YouTube

I specifically allow the "before" images, showing the property prior to
cleaning, to be published:            [ ] Yes      [ ] No

The city may be named (for example, "Marietta"). The street name and the
house number may never be shown or named.   [ ] Agreed

This permission lasts until I withdraw it. I may withdraw it at any time,
in writing, by email or text message to Freshness Touch. Freshness Touch
will remove the material from the places listed above within ____ days of
receiving my request. Material already downloaded or reshared by other
people may not be recoverable, and I understand that.

I receive no payment for this permission and I am not required to give it
in order to receive the cleaning service.

Signature: __________________________  Date: __________________
```

### Texto en español

```
AUTORIZACIÓN DE FOTOGRAFÍA Y VÍDEO DE ANTES Y DESPUÉS

Nombre del cliente: __________________  Teléfono: ____________________
Dirección de la propiedad: __________________________________________
Fecha del servicio: _________________

Autorizo a Freshness Touch a tomar fotografías y vídeo de las siguientes
zonas de esta propiedad, en relación con el servicio de limpieza
realizado en la fecha indicada:

  [ ] Interior      [ ] Exterior      [ ] Ambos

Autorizo a Freshness Touch a publicar ese material con fines publicitarios
en:

  [ ] Su sitio web  [ ] Facebook   [ ] Instagram   [ ] YouTube

Autorizo expresamente la publicación de las imágenes del «antes», que
muestran la propiedad sin limpiar:    [ ] Sí       [ ] No

Se puede nombrar la ciudad (por ejemplo, «Marietta»). El nombre de la
calle y el número de la casa no se pueden mostrar ni nombrar nunca.
                                      [ ] Conforme

Esta autorización dura hasta que la retire. Puedo retirarla en cualquier
momento, por escrito, por correo electrónico o por mensaje de texto a
Freshness Touch. Freshness Touch retirará el material de los lugares
indicados en un plazo de ____ días desde que reciba mi petición. El
material que otras personas ya hayan descargado o compartido puede no ser
recuperable, y lo entiendo.

No recibo ningún pago por esta autorización y no estoy obligado a darla
para recibir el servicio de limpieza.

Firma: ______________________________  Fecha: _________________
```

### Dos decisiones que faltan en el modelo

1. **El plazo de retirada** (los `____ días`). Recomendado: **5 días
   laborables.** Prometer «inmediatamente» es prometer algo que no se puede
   cumplir un domingo.
2. **Si el permiso se pide antes o después del servicio.** Recomendado:
   **antes**, al confirmar la reserva. Después de limpiar, pedirlo delante de
   la casa recién limpia es una situación en la que el cliente se siente
   obligado a decir sí, y eso debilita el permiso.

---

## 3. Lo que nunca entra en el encuadre

Esto es una lista para leer **antes de grabar**, no después:

- **El número de la casa y la placa de la calle.**
- **Nada de la puerta**: cerradura, llavero, teclado de alarma, panel de
  control. Esto conecta con una regla que el sistema ya cumple a conciencia:
  el código de la puerta no entra nunca en una URL ni en un registro
  (`docs/29-pin-de-la-puerta.md`). Sería absurdo protegerlo ahí y luego
  grabarlo en vídeo.
- **Correo, paquetes, facturas, recetas, cualquier papel con un nombre.**
- **Fotos de familia, diplomas, cuadros con dedicatoria.**
- **Niños.** Ni de lejos, ni de espaldas, ni un juguete con el nombre puesto.
- **Matrículas** de coches, en la entrada o en la calle.
- **Pantallas de ordenador o móvil encendidas.**
- **Medicamentos**, botes con etiqueta, cualquier cosa de un botiquín abierto.
- **Objetos religiosos, políticos o de orientación personal.** No porque haya
  nada malo en ellos, sino porque publican algo del cliente que el cliente no
  publicó.
- **Audio de conversaciones.** Mejor sin voz, o solo la voz de quien graba.

Regla sencilla para la grabación: **si la toma permitiría a un desconocido
llegar a esa casa o saber quién vive en ella, se repite la toma.**

---

## 4. El empleado también tiene que dar permiso

Si en el vídeo sale una persona del equipo, hace falta **su propio permiso,
aparte del del cliente**, y por escrito. Georgia reconoce el derecho de una
persona sobre el uso comercial de su imagen; usar la cara de una empleada en
un anuncio sin su permiso es un problema distinto y adicional al del cliente.

Dos cosas más:

- **No se puede condicionar el empleo a dar el permiso.** Si alguien dice que
  no, se graba sin que salga, y no pasa nada.
- **Si la persona deja la empresa**, su permiso no caduca solo. Conviene que
  el documento diga qué ocurre entonces.

---

## 5. La música es la causa número uno de problemas

No es un detalle menor: **usar música con derechos es lo que más vídeos tira
abajo**, y un aviso de copyright puede llevarse el canal entero.

Qué hacer: **solo la biblioteca de audio de YouTube**, o nada. Nada funciona
mejor de lo que parece: el sonido real de una casa quedando limpia vende.

---

## 6. La retirada tiene que ser un procedimiento, no una buena intención

Prometer en el permiso que se retira en X días obliga a poder hacerlo. Hace
falta saber, de un vídeo cualquiera, **de qué cliente es**. Si no, una
petición de retirada se convierte en revisar el canal entero a ojo.

Mínimo viable, mientras no exista el registro en el sistema (etapa 2.D):

- Una hoja de cálculo con una fila por pieza publicada: fecha del servicio,
  cliente, dirección, enlace del vídeo o nombre del archivo de la foto, y
  dónde se publicó.
- El permiso firmado, escaneado y guardado con un nombre que lleve la misma
  referencia.
- **La grabación original, guardada aparte.** Si un día YouTube quita el
  vídeo, el material no se pierde.

Cuando montemos el registro dentro del sistema esto pasa a ser automático,
pero la hoja de cálculo vale desde el primer día y no depende de mí.

---

## 7. Lo que se enseña tiene que ser lo que se vende

Esto es publicidad, y la publicidad responde de lo que promete:

- **No enseñar una limpieza profunda como resultado de una limpieza
  estándar.** Si el vídeo es de un servicio de los caros, hay que decirlo.
- **Nada de testimonios inventados**, ni de «resultados» recreados a propósito
  para la cámara.
- **No prometer un tiempo** («en 2 horas») si no es el tiempo real del
  servicio que se vende.

El dossier legal ya tiene abierta esta cuestión para el abogado, en el
apartado de lo que se vende frente a lo que se cobra.

---

## 8. Lo técnico que resolvemos nosotros

Esto no es cosa de la dueña; queda escrito aquí porque es parte del mismo
problema:

- **Se quitan los metadatos (EXIF) de toda foto antes de publicarla.** Una
  foto hecha con el móvil lleva dentro **las coordenadas GPS** del sitio donde
  se tomó. Publicar la foto del salón de un cliente con su GPS incrustado es
  publicar su dirección, aunque la imagen no enseñe el número de la casa. Es
  exactamente la misma razón por la que del fichaje de los empleados solo se
  guarda la distancia y nunca las coordenadas (`docs/25-fichaje-con-ubicacion.md`).
- **De los vídeos solo se guarda el identificador validado**, nunca una URL
  libre: así quien entre al panel no puede incrustar en la portada un marco de
  cualquier sitio, y la CSP sigue siendo un muro de verdad.
- **El vídeo no carga nada de Google hasta que el visitante pulsa play.** Se
  enseña una miniatura servida desde nuestro propio dominio. El modo «sin
  cookies» de YouTube **no es tan limpio como Google dice** —las pruebas
  independientes encuentran que escribe un identificador en el navegador y
  manda la IP al cargar, antes de que nadie le dé al play—, así que la única
  forma de mantener el «esta web no pone cookies ni manda datos a terceros» es
  no cargar el marco hasta que el visitante lo pida. Hay que comprobarlo en el
  navegador cuando esté montado, no darlo por bueno.

---

## 9. Qué hace falta para seguir

Por orden, y lo primero bloquea el resto:

1. **Un abogado de Georgia revisa el modelo** de la sección 2, junto con el
   dossier.
2. **La dueña decide** el plazo de retirada y si el permiso se pide antes o
   después del servicio.
3. **Se firman los primeros permisos** y se graban 3–5 piezas cortas.
4. Con eso ya en la mano, se monta el código: la galería y la sección de
   vídeos (etapa 2.B), la subida desde el panel (2.C) y el registro de
   consentimientos (2.D).

Mientras no haya permisos firmados, **la sección se puede construir pero no se
puede publicar con material real.**
