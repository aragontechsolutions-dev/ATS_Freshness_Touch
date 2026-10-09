# 29 — El pin de la puerta

El cliente marca en un mapa por dónde se entra de verdad a su casa, y ese pin
**se borra 24 horas después de que el trabajo termine**.

---

## 1. Por qué, si ya tenemos la dirección

Porque la dirección no siempre basta. El geocodificador del Censo de EE. UU.
resuelve bien una calle de Atlanta y **regular una carretera comarcal**:
interpola sobre el tramo de vía, así que en el campo deja la casa a cientos de
metros, a veces al otro lado de la carretera.

En la Georgia rural —que es casi todo nuestro territorio
(`docs/17-area-de-servicio.md`)— eso son vueltas con una furgoneta y una
limpieza que empieza tarde.

**Quien sabe dónde está la puerta es quien vive allí.**

---

## 2. La promesa, y por qué la primera versión habría sido mentira

Lo que se pidió fue «que se aclare que la ubicación se desecha a las 24 h». Al
mirar el código apareció un problema:

> **El sistema ya guarda las coordenadas de la casa para siempre.** Están en
> `addresses.latitude/longitude`, resueltas desde la dirección, y el propio
> esquema dice por qué: _«una casa no se mueve»_. La dirección completa está
> en texto plano al lado.

Prometer que «la ubicación» se borra mientras se conserva la coordenada
geocodificada **de esa misma casa** no es privacidad, es decoración. Y en
EE. UU. una frase así se lee como un compromiso.

La versión honesta es la que está construida:

|                          |                                                                              |
| ------------------------ | ---------------------------------------------------------------------------- |
| **Lo que se borra**      | El pin que marcó el cliente, y solo eso                                      |
| **Lo que se queda**      | La dirección y su coordenada geocodificada, porque hay que facturar y volver |
| **Lo que dice el texto** | «We delete this pin the day after your cleaning»                             |

Se promete el pin, no la memoria. **Una promesa de privacidad que no se cumple
al pie de la letra es peor que no hacerla.**

### 2.1 Las 24 h cuentan desde que el trabajo termina

Contarlas desde la reserva —que era lo literal— lo habría dejado **inútil**:
entre reservar y limpiar pasan días, así que el pin estaría borrado antes de
que ningún limpiador lo viera.

La regla es una sola expresión, y no hay columna de caducidad:

```
vence = COALESCE(completedAt, cancelledAt, scheduledEnd) + 24 h
```

> **Por qué no hay `pinExpiresAt`.** Esa columna habría que recalcularla al
> completar, al cancelar y al mover la cita, y bastaría olvidarse de **uno** de
> los tres sitios para que un pin sobreviviera a lo prometido. Un dato que se
> calcula de lo que ya hay no se puede desincronizar.

Y lo que sostiene la promesa: **si el equipo nunca marca que terminó**,
`completedAt` se queda nulo para siempre y el pin muere igual, medido desde el
final **previsto**. La promesa no depende de que nadie pulse nada.

---

## 3. Esto no toca el precio. Nunca.

**Es la regla que más protege de toda la etapa, y es de seguridad.**

Hoy la distancia —y con ella el recargo por milla y la zona— sale del **código
postal**, no de ninguna coordenada. El día que alguien, con toda su buena
intención, piense _«ya que tenemos las coordenadas exactas, calculemos la
distancia con ellas, que es más preciso»_, habrá abierto esto:

> **el cliente arrastra el pin hacia Atlanta y se cobra menos.**

Un fraude de un gesto, sin herramientas, desde el móvil, que no deja más rastro
que un punto en un mapa. Y lo peor: el sistema no lo vería como un ataque, sino
como una cotización correcta.

Un comentario que diga «no hagas esto» no lo impide. Hay **tres pruebas** que
leen el código fuente del motor de precios
(`packages/pricing/src/el-pin-no-toca-el-precio.test.ts`):

| Prueba                                                | Qué caza                                                  |
| ----------------------------------------------------- | --------------------------------------------------------- |
| No importa nada del pin                               | El import directo                                         |
| Lo que calcula dinero no lee coordenadas              | Copiar los números a otro nombre                          |
| La lista de archivos vigilados no se ha quedado vieja | Un archivo nuevo en el motor que nadie decidió si vigilar |

> **`config.ts` queda fuera, y no es una excepción cómoda.** Ahí viven las
> coordenadas de **la sede de la empresa**, que centran el mapa de zonas. La
> diferencia que importa no es «coordenadas sí o no», es **quién las
> controla**: las de la empresa las pone ADMIN; el pin lo pone el cliente.

Si algún día hace falta calcular distancia con coordenadas, la forma segura es
usar la **geocodificada** de la dirección, que resuelve un servicio externo y
el cliente no puede arrastrar.

---

## 4. Dos defensas para una promesa

Un barrido que borra podría parecer suficiente. No lo es: puede fallar en
silencio —la API caída un fin de semana, una excepción que nadie mira, el
proceso reiniciándose a mitad de pasada— y entonces el dato seguiría ahí
**después** de haber prometido lo contrario, sin que nadie se entere.

| Defensa                                                | Qué garantiza                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Caduca al leerse** (`door-pin.helper.ts`)            | Un pin vencido **no lo puede devolver nadie**: ni el panel, ni la PWA, ni un endpoint futuro que alguien escriba sin acordarse |
| **Se borra por barrido** (`door-pin-sweep.service.ts`) | La fila deja de existir, cada 30 min                                                                                           |

La fila puede sobrevivir un rato de más; **el dato, no**.

### 4.1 Y la base de datos se defiende sola

Dos `CHECK`, que es lo que se pidió al decir «a nivel de BD»:

- **Las dos mitades van juntas o no va ninguna.** Media coordenada no es un
  punto: es un dato que parece útil y señala a cualquier sitio.
- **El punto cae dentro de Georgia.** El contrato de Zod ya lo valida, así que
  esto es la segunda capa, y existe porque el contrato protege la puerta de la
  API —no un `UPDATE` a mano, ni un script de migración, ni una versión futura
  que se olvide de validar. Caza en particular latitud y longitud
  intercambiadas, que dejan Georgia en el océano Índico.

### 4.2 La regla vive dos veces, y hay una prueba que las ata

Está en SQL (el barrido) y en TypeScript (la lectura), y **no pueden compartir
código**: una la ejecuta Postgres y la otra Node. Si se separan, el sistema
prometería una cosa y haría otra.

La prueba las compara con las mismas fechas en los mismos casos límite, y
**ejecuta la constante que usa el servicio**, no una copia escrita en la
prueba. Si la prueba escribiera su propio SQL, compararía dos cosas que ella
misma mantiene de acuerdo y no probaría nada.

---

## 5. Lo que el cliente ve, y lo que no se le pide

**No hay botón de «usar mi ubicación actual»**, y es deliberado:

- **Mentiría la mitad de las veces.** Mucha gente reserva desde el trabajo, y
  el GPS pondría el pin donde está la **persona**, no la casa. Un pin
  equivocado es peor que ninguno: el equipo se fía de él.
- **Cambia lo que es el dato.** Arrastrar un marcador sobre la casa que ya nos
  dieron por dirección no dice nada nuevo de nadie. Leer el GPS sí.

**El mapa abre sin marcador.** Poner uno en el centro invitaría a dejarlo donde
cayó —«ya está marcado»— y tendríamos pines que no señalan nada y en los que el
equipo confiaría.

**Es opcional y sin consecuencias**: reservar no puede depender de que alguien
sepa usar un mapa. Y si la API no da el catálogo, la sección no se pinta y la
reserva sigue.

---

## 6. Lo que ve el equipo

Un **segundo enlace** debajo de la dirección, que no la sustituye. Los dos
sirven para cosas distintas: la calle es la que se reconoce y la que se dice
por teléfono; el pin es el que lleva a la puerta correcta cuando la calle no
basta.

Y se le dice que **lo marcó el cliente**, no nosotros: es lo que permite
decidir de cuál fiarse si los dos no coinciden. El pin puede estar equivocado
—lo puso una persona—, así que quitar la dirección dejaría al equipo sin nada a
lo que volver.

`MyJob` sigue sin llevar un solo importe. Un punto en un mapa no es dinero.

---

## 7. Seguridad

Las defensas se validaron **rompiéndolas a propósito**:

| Guardia                                  | Al quitarla       |
| ---------------------------------------- | ----------------- |
| El SQL y TypeScript dicen lo mismo       | 5 pruebas en rojo |
| La lectura comprueba la caducidad        | 2 pruebas en rojo |
| El `CHECK` de Georgia                    | 2 pruebas en rojo |
| El motor no importa el pin               | 1 prueba en rojo  |
| Lo que calcula dinero no lee coordenadas | 1 prueba en rojo  |
| La lista de archivos vigilados           | 1 prueba en rojo  |

Además: seis decimales y ni uno más (unos 11 cm, más fino que la puerta que se
señala), `z.strictObject` para que no cuele un campo de más, y el barrido no
escribe auditoría —anotar «se borró el pin de la reserva X» en un registro que
se guarda un año convertiría el borrado en otro rastro del mismo hecho—.

---

## 8. Dónde está cada cosa

| Qué                        | Dónde                                                   |
| -------------------------- | ------------------------------------------------------- |
| El contrato y la caducidad | `packages/types/src/door-pin.ts`                        |
| La guardia del precio      | `packages/pricing/src/el-pin-no-toca-el-precio.test.ts` |
| La tabla                   | `apps/api/prisma/migrations/20261009110000_door_pin/`   |
| Leer con caducidad         | `apps/api/src/bookings/door-pin.helper.ts`              |
| Borrar                     | `apps/api/src/bookings/door-pin-sweep.service.ts`       |
| El mapa del cliente        | `apps/landing/src/components/DoorPinMap.tsx`            |
| Lo que ve el equipo        | `apps/admin/src/pages/MyJobs.tsx`                       |

---

## 8 bis. El mapa salió gris en producción, por dos fallos a la vez

Al desplegar, el mapa apareció como **un rectángulo gris con el marcador
roto**. Dos fallos distintos, y **los dos ya estaban resueltos en los mapas
que existían**: se escribió uno nuevo sin copiar el que funcionaba.

### 1. La URL de las teselas, bloqueada por la CSP

Se usó la URL clásica de Leaflet, `https://{s}.tile.openstreetmap.org/...`,
que la librería expande a `a.`, `b.` y `c.`. La CSP del sitio permite
**exactamente** `tile.openstreetmap.org` —host literal, sin comodín—, así que
el navegador bloqueó todas las teselas.

Faltaba además `referrerPolicy: 'strict-origin-when-cross-origin'`:
OpenStreetMap responde 403 a quien no se identifica.

**Lo que hace peligroso a este fallo es que no se ve venir:**

|                           |                                             |
| ------------------------- | ------------------------------------------- |
| Los tipos                 | No lo ven: es una cadena                    |
| El lint                   | No lo ve: es una cadena                     |
| Las pruebas               | No lo veían: ninguna miraba la CSP          |
| **El navegador en local** | **Tampoco**: en desarrollo no hay cabeceras |

Ahora hay una prueba (`teselas-permitidas.test.ts`) que lee la CSP de
`vercel.json` y **todas** las URL de teselas del código, y falla si alguna
quedaría bloqueada. No comprueba «que la URL sea esta» sino que cualquier URL
esté permitida, así que sigue sirviendo si algún día se cambia de proveedor.
Validada reintroduciendo el fallo exacto.

### 2. El marcador, una imagen rota

El marcador por defecto de Leaflet carga sus iconos por una ruta relativa que
los empaquetadores reescriben, así que pide un PNG que no existe. **Esto ya
estaba documentado** en `LocationPickerMap` del panel, que lo resolvió con un
círculo vectorial — pero aquí no sirve, porque un `circleMarker` **no se puede
arrastrar**.

Se usa un `divIcon`: HTML puro, sin archivo que perder, y arrastrable. El
`iconAnchor` apunta a la **punta** de la gota y no a su centro; si apuntara al
centro, el pin señalaría unos metros al norte de donde se soltó, que es justo
la precisión que esta pantalla existe para dar.

> **La lección, que es la misma de los otros fallos de esta familia:** antes
> de escribir un componente parecido a uno que ya existe, hay que leer el que
> existe. Las dos trampas estaban resueltas y comentadas a cuatro archivos de
> distancia.

### Y un fallo en la propia prueba

La primera versión de `teselas-permitidas.test.ts` quitaba los comentarios con
`.replace(/\/\/.*$/gm, '')` — **y eso se comía el `https://` de las URL que
tenía que mirar**. Leía basura y fallaba sin motivo. Ahora solo quita los
comentarios de línea que empiezan la línea. El mismo patrón estaba en la
prueba del motor de precios y se corrigió también.

---

## 9. Lo que quedó sin resolver

- **Coordinación no lo ve en el panel.** El equipo sí, en su PWA. Si alguien
  tiene que dirigir por teléfono a una furgoneta perdida, hoy no puede.
- **El mapa abre centrado en la sede**, no en la calle del cliente: la
  dirección todavía no está geocodificada cuando se rellena el formulario, y
  geocodificarla ahí metería una llamada externa justo antes de cobrar. El
  cliente tiene que desplazar el mapa hasta su zona.
- **Si el cliente reserva otra vez, vuelve a marcarlo.** Es el precio de que el
  pin viva en la reserva y no en la dirección, que es lo que hace que la
  promesa sea verificable.
