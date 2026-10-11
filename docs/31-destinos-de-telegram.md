# 31. Tres destinos de Telegram (Etapa 3.13)

## 1. Por qué tres y no uno

Hasta esta etapa todos los avisos internos iban al mismo chat: las reservas
nuevas y, desde la 3.12, también los fallos del sistema.

Mezclar «entró una reserva» con «faltan migraciones» tiene un coste concreto:
**quien no puede actuar sobre la mitad de los mensajes aprende a no leer
ninguno.** Es el mismo mecanismo por el que el log dejó de leerse.

| Destino                | Quién lo lee                 | Qué recibe                                                  |
| ---------------------- | ---------------------------- | ----------------------------------------------------------- |
| **Operaciones**        | Quien lleva el negocio       | Reservas nuevas, llegadas que no cuadran                    |
| **Equipo de limpieza** | El equipo que va a las casas | Trabajos asignados, **sin importes**                        |
| **Técnico**            | Quien mantiene el sistema    | Migraciones pendientes, pagos en simulado, procesos parados |

No hace falta ningún rol nuevo, y no se tocó el modelo de permisos: **un
destino es un `chat_id`, no un rol.** Quien mantiene el sistema entra como
ADMIN como cualquier otra persona de administración; recibe los avisos
técnicos porque su chat está en esa casilla.

## 2. El equipo de limpieza es un GRUPO, y no es una preferencia

**Un bot de Telegram no puede escribirle a una persona que no le haya escrito
antes al bot.** Es una regla de la plataforma.

Mandar mensajes privados a cada limpiadora exigiría:

- una columna nueva en personal para su `chat_id`,
- una pantalla y un código para que cada una enlace su cuenta,
- y sobre todo que **el bot reciba mensajes** (webhook o sondeo), que es
  infraestructura que este sistema no tiene.

Con un grupo, el coste es el mismo que los otros dos destinos: pegar un
identificador.

### La consecuencia, asumida a sabiendas

En un grupo, **todo el equipo ve la calle y la ciudad de todos los trabajos**,
no solo de los suyos. Para un equipo pequeño suele ser útil —se ve quién puede
cubrir a quién— pero es una decisión del negocio y conviene que esté escrita.

## 3. La regla que sostiene la etapa: el equipo no ve dinero

El aviso de reserva nueva lleva el importe total dentro, porque va a
operaciones:

```ts
totalCents: reserva.totalCents,
```

El del equipo **no lo lleva, y no puede llevarlo**: el dato no está en los
parámetros de la función. Añadirlo mañana exigiría cambiar la firma, que es un
gesto visible en una revisión en vez de una línea más en una plantilla.

Es la misma regla que `MyJob` ya cumple en la pantalla del equipo: quien limpia
una casa no necesita saber lo que paga quien vive en ella, y saberlo cambia la
relación.

Lo vigilan tres pruebas en `telegram-destinos.test.ts`, validadas rompiendo la
plantilla a propósito:

1. el texto no contiene ningún importe,
2. **la firma de la función no admite ninguno**,
3. las dos plantillas, comparadas: una lo lleva y la otra no.

Y el enrutado vive en **una sola función**, `telegramChatForAudience`. Repartido
por los tres servicios que mandan avisos, bastaría con copiar el bloque
equivocado una vez.

## 4. El aviso de llegada: solo las que no cuadran

No se avisa de cada fichaje. Solo cuando `isFarByNumbers` dice que la persona
**no puede** estar en la casa:

```ts
const distanciaMinimaPosible = distanceMeters - (accuracyMeters ?? 0);
return distanciaMinimaPosible > CLOCK_IN_FAR_METERS; // 250 m
```

**Al margen de error del GPS se le descuenta antes de comparar.** Una lectura
de «a 300 metros» con un margen de ±500 es compatible con estar en la puerta,
así que no salta: un teléfono impreciso no acusa a nadie.

Un mensaje por cada llegada normal serían varios al día de pura rutina, y lo
que se lee todos los días sin que pase nada se deja de leer.

**No viajan coordenadas, solo metros.** Misma línea que la auditoría y la base
de datos desde la etapa 3.3: la ubicación de un empleado no se guarda ni se
transmite en ningún sitio.

El texto sugiere las dos causas inocentes —GPS malo, dirección mal
geocodificada— porque quien lo lee tiene que poder pensar «será el GPS» antes
que «me están mintiendo».

## 5. El aviso de asignación TIENE que poder repetirse

Los demás avisos pasan por una guardia que impide mandar dos veces el mismo.
Este no, y la migración `20261011120100` lo saca del índice único a propósito:

1. Coordinación asigna el trabajo a Ana. El grupo lo lee.
2. Coordinación lo reasigna a Pedro.
3. Con el índice, el segundo aviso **no se manda**.
4. El grupo entero sigue creyendo que va Ana.

Un mensaje antiguo que nadie contradice se lee como vigente, y acaba yendo a la
casa quien no toca, o nadie. **Peor que no haber avisado nunca.**

Además no hay nada que deduplicar: esto no lo dispara un barrido, lo dispara
una persona pulsando un botón.

## 6. La mina que casi se pisa otra vez

Los ajustes de avisos se guardan como **un JSON validado con `strictObject`**,
exactamente igual que la tabla de tarifas:

```ts
const parsed = NotificationSettingsSchema.safeParse(stored);
if (!parsed.success) return DEFAULT_NOTIFICATION_SETTINGS;
```

Añadir campos al contrato sin más habría dejado inválida la fila guardada, y el
servicio habría vuelto a los valores de partida: **`telegramChatId: null`**. El
chat que la empresa ya tenía configurado se habría apagado solo, sin un error
en ningún sitio.

Es la misma caída que costó diez días con los precios.

Por eso:

- los campos nuevos llevan **`.default(null)`**, así que la fila que hay hoy
  sigue entrando,
- `telegramChatId` **no se renombró** a `telegramOperationsChatId` aunque sería
  el nombre natural. Un nombre feo es más barato que una caída muda.
- hay una prueba que mete la fila de antes de la etapa y comprueba que el chat
  no se pierde.

## 7. Cómo se configura

### El chat de operaciones y el técnico

Escribe a tu bot desde cada cuenta y abre:

```
https://api.telegram.org/bot<TOKEN>/getUpdates
```

El número de `chat.id` es lo que se pega en el panel.

### El grupo del equipo

1. Crea un grupo de Telegram con el equipo.
2. **Añade el bot al grupo.**
3. Escribe cualquier mensaje en el grupo.
4. Abre el mismo `getUpdates`: el `chat.id` del grupo **empieza por un signo
   menos** (`-1001234567890`).

Todo se pega en **Datos del negocio → Avisos**.

> El **token** del bot no va aquí: vive en `TELEGRAM_BOT_TOKEN`, en el entorno
> del servidor, junto a las claves de Stripe. Un identificador de chat no es un
> secreto; sin el token no sirve para enviar nada.

## 8. Qué pasa si falta un destino

| Falta             | Qué ocurre                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Operaciones       | No se avisa de reservas ni de llegadas. Queda `SKIPPED` en el registro                              |
| Grupo de limpieza | No se avisa de asignaciones. **No cae al de operaciones**: sería el fallo que toda esta etapa evita |
| Técnico           | Los fallos del sistema van al de **operaciones**. Esta caída sí es deliberada                       |

La asimetría es intencionada y hay una prueba para cada mitad.

## 9. Lo que NO entra en esta etapa

**Mensajes privados a cada limpiadora.** Requiere que el bot reciba mensajes,
que es una etapa aparte y bastante mayor (§2). Mientras tanto, el equipo ve sus
trabajos en la PWA, que es la fuente de verdad; el grupo es un aviso, no el
sistema.
