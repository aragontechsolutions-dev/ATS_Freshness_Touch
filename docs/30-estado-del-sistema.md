# 30. Estado del sistema y alarma (Etapa 3.12)

## 1. Por qué existe esto

El 10 y el 11 de octubre de 2026 pasaron dos cosas que resumen el problema
entero:

| Fallo                                            | Cuánto estuvo así | Cómo se descubrió                          |
| ------------------------------------------------ | ----------------- | ------------------------------------------ |
| Faltaba la migración `20261009110000_door_pin`   | Horas             | Un cliente no pudo reservar y hubo captura |
| La tabla de tarifas `2026.09.1` no se podía leer | Diez días         | De casualidad, revisando otra cosa         |

**Los dos estaban escritos en el log.** En castellano claro, con el nombre de
la columna que faltaba, repitiéndose cada media hora.

```
ERROR [DoorPinSweepService] column "doorPinLatitude" does not exist
ERROR [PricingRatesService] La tabla de tarifas 2026.09.1 no cumple el contrato
```

Cuando esto se escribió, la API ya tenía **38 registradores** y **dos sondas de
salud**. No faltaba información: faltaba que alguien la mirara.

> Un log que nadie lee no es vigilancia. Es un diario que se escribe solo.

Por eso esta etapa **no añade un sistema de logs**. Añade lo único que faltaba:
que el sistema venga a buscarte.

## 2. Lo que se descartó, y por qué

| Idea                        | Por qué no                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Una tabla `logs` en la base | Los logs crecen sin límite, y una tormenta de errores dispararía miles de escrituras **justo cuando la base está en apuros**. El sistema de vigilancia tumbando lo que vigila        |
| Grafana / Loki / ELK        | Más infraestructura que la propia aplicación, para una API en Render starter. Se monta, funciona dos meses y nadie vuelve a entrar                                                   |
| Meterlo en la auditoría     | La auditoría responde «¿quién hizo qué?» y se guarda un año para disputas legales. Esto responde «¿la máquina está sana?». Mezclarlos ensucia un registro legal con ruido de máquina |
| Retención propia de logs    | Render ya los guarda. Si hace falta más historial, un servicio externo se conecta sin escribir código                                                                                |

## 3. Las seis comprobaciones

Contrato en `packages/types/src/system-health.ts`, implementación en
`apps/api/src/health/system-checks.service.ts`.

| Comprobación      | Qué pregunta                                      | De dónde sale                     |
| ----------------- | ------------------------------------------------- | --------------------------------- |
| `database`        | ¿Responde la base?                                | `prisma.ping()`                   |
| `migrations`      | ¿Están aplicadas todas las del repositorio?       | **La caída del pin de la puerta** |
| `pricingRates`    | ¿Las tarifas salen de la tabla o del respaldo?    | **La caída de los precios**       |
| `paymentProvider` | ¿Se retiene dinero de verdad, o está en simulado? | El fallo más silencioso que hay   |
| `sweeps`          | ¿Siguen pasando los procesos automáticos?         | Un barrido muerto no se queja     |
| `errors`          | ¿Ha reventado alguna petición en la última hora?  | **Etapa 3.31**, ver `docs/47`     |

La sexta se añadió después y es la única que **no mira un estado, sino lo que
ha pasado**. Las otras cinco pueden decir «todo bien» mientras una ruta
devuelve 500 en cada petición: una excepción no deja la base caída ni las
migraciones pendientes, deja a una persona sin poder reservar. Cumple la regla
de abajo porque un 500 **no se nota desde dentro** —el cliente ve un mensaje
genérico y se va—. Cuenta y detalle en `docs/47-el-error-que-nadie-ve.md`.

**No se calla cuando la base está caída**, al contrario que `migrations` y
`pricingRates`. Allí el silencio está bien porque esas dos no _pueden_
ejecutarse sin base y su mensaje no añadiría nada. Aquí añade, y mucho:
«database: unreachable» dice que la base no responde; «errors: many (23)» dice
que veintitrés peticiones de personas de verdad se han estrellado contra eso
mientras pasaba. Lo segundo es lo que decide si hay que parar el coche.

### La regla para añadir una comprobación nueva

**Tiene que poder romperse sola, sin que nadie toque nada, y que no se note.**

Si para que falle hace falta que alguien despliegue algo roto y encima salte a
la vista en la primera pantalla, no hace falta vigilarla. Una lista larga se
convierte en una lista con algo siempre en ámbar, y una lista con algo siempre
en ámbar se deja de mirar: el mismo final que tuvo el log.

Hay una prueba que lo recuerda:

```ts
expect(SYSTEM_CHECK_IDS.length).toBeLessThanOrEqual(8);
```

## 4. Cuatro estados, no dos

| Estado     | Significa                              | Ejemplo                                      |
| ---------- | -------------------------------------- | -------------------------------------------- |
| `ok`       | Funciona                               | —                                            |
| `degraded` | Funciona a medias o por mal camino     | Tarifas desde el respaldo; pagos en simulado |
| `down`     | Hay algo que un cliente no puede hacer | Migraciones pendientes; base caída           |
| `unknown`  | **No se pudo comprobar**               | No se encontró el directorio de migraciones  |

`unknown` existe porque la alternativa es peor. Una comprobación que no puede
ejecutarse y devuelve `ok` por defecto **es una luz verde desconectada del
interruptor**, y así es exactamente como se pierde la confianza en un panel de
estado.

El estado del conjunto es **el peor de sus partes, nunca un promedio**. Con un
promedio, cuatro en verde taparían una en rojo y el panel diría «75 % bien»
mientras nadie puede reservar.

Orden de gravedad: `ok` < `degraded` < `unknown` < `down`. No saber si algo
funciona es más grave que saber que funciona a medias —lo segundo se puede
decidir, lo primero no— y menos grave que saber que está caído.

## 5. El detalle es una lista cerrada, y es seguridad

La primera versión validaba el **formato** `palabra.palabra`. Lo tumbó una
prueba de este mismo repositorio:

```
db.abcdefgh        <- medio nombre de servidor de Supabase
migrations.pending <- una clave de verdad
```

Las dos encajan en el mismo patrón. **Cualquier regla de forma deja pasar algo
con forma de clave**, y los identificadores de servidor, de proyecto y de
cuenta tienen todos esa forma.

Ahora es un `z.enum` con las ocho claves que existen. Lo que no está escrito en
el contrato no sale de la API. El mensaje de verdad —con el nombre del
servidor, de la tabla o de la cuenta dentro— se queda en el log del servidor,
al que solo se llega con credenciales.

**El nombre de la migración que falta tampoco sale**: por la API viaja solo la
cifra. Un nombre de migración dice qué tablas y columnas hay y cómo se llaman,
y eso es un plano del esquema. Hay una prueba que lo comprueba.

## 6. La alarma

`apps/api/src/health/system-alert.service.ts`. Mira cada
`SYSTEM_ALERT_MINUTES` (5 por defecto) y avisa **al chat de Telegram que ya
usaba la empresa** para las reservas nuevas.

### Las tres reglas que evitan que se convierta en ruido

1. **Solo cuando algo cambia.** Se avisa en la transición, no en cada pasada.
2. **Silencio mínimo por problema** (`SYSTEM_ALERT_SILENCE_HOURS`, 6 por defecto).
3. **Se avisa también al recuperarse.** Sin el «ya está bien», la única forma
   de saber si lo que hiciste funcionó es entrar a mirar: justo lo que esto
   viene a evitar.

### La cuenta que justifica la regla 2

El fallo del pin duró unas 48 horas. Con la alarma mirando cada 5 minutos:

|                     | Mensajes al teléfono del titular |
| ------------------- | -------------------------------- |
| Sin antirrebote     | **576**                          |
| Con silencio de 6 h | **9**                            |

Hay una prueba que simula los dos días enteros y exige el 9.

Nadie lee el mensaje 576. Nadie lee el cuarto. A partir de ahí la alarma no
solo deja de servir: **enseña activamente a ignorar los avisos**, y el día que
suene por algo distinto tampoco lo leerá nadie.

### Lo que no va nunca en un mensaje

Ni un dato de cliente, ni un nombre de tabla, ni una cadena de conexión. Solo
la clave del contrato y, como mucho, una cifra.

**Telegram es un servicio de terceros y el historial de ese chat queda en sus
servidores para siempre.** Lo que se manda ahí, se publica ahí.

### Cómo se apaga

`SYSTEM_ALERT_MINUTES=0`. **No** se apaga desde el panel, y es deliberado: el
ajuste `telegramOnNewBooking` es una preferencia comercial, y esto es «el
sistema está roto». Apagarlo tiene que ser una decisión del entorno, no una
casilla que alguien desmarca sin querer una tarde.

## 7. El latido de los barridos

`apps/api/src/health/sweep-heartbeat.service.ts`. Cuatro barridos avisan cuando
pasan: pines de puerta, recordatorios, geocodificación y purga de auditoría.

**En memoria, no en la base**, y está bien que así sea:

- Si el proceso se reinició, los temporizadores son nuevos y el historial del
  proceso anterior no dice nada del actual.
- Escribir en la base cada media hora solo para vigilar añade escrituras cuyo
  único fin es vigilar, y la primera que fallaría en una caída de base de datos
  es justo esa.

**El latido va antes de cualquier guarda**, también la de conexión. Significa
«el temporizador sigue disparando», no «el trabajo salió bien». Si se anotara
después, una caída de base de datos pintaría **además** los barridos en rojo, y
el aviso diría dos problemas donde hay uno.

Tolerancia: **dos veces el intervalo más dos minutos**. Para saltar tiene que
haberse perdido una pasada entera; un reloj que avisa al primer segundo de
retraso avisa todos los días.

Un barrido **apagado** (intervalo a cero, como en las pruebas) no se registra,
así que no sale como atrasado.

## 8. Quién puede verlo

| Ruta                              | Quién                   | Qué cuenta                |
| --------------------------------- | ----------------------- | ------------------------- |
| `GET /health`                     | Público (lo usa Render) | Si el proceso está en pie |
| `GET /health/ready`               | Público                 | Si la base responde       |
| `GET /api/v1/admin/system-health` | **Solo ADMIN**          | El diagnóstico completo   |

Las dos primeras **no cambiaron** y siguen sin contar nada del diagnóstico. Hay
una prueba que lo comprueba: lo que se le cuenta a Render se le cuenta a
cualquiera.

El detallado es solo para administración porque **decir que hay migraciones
pendientes es decir que el esquema de la base no coincide con el código
desplegado**, y decir que el pago está en simulado es decir que ahora mismo se
pueden hacer reservas sin que se retenga dinero. Coordinación mueve citas;
saber esto no le ayuda a hacerlo.

**No se audita la consulta**, al revés que el registro de auditoría. Allí lo
que se mira son los actos de las personas; aquí se mira una máquina. Si cada
vistazo escribiera una fila, la pantalla —que se refresca sola— llenaría la
auditoría de ruido y enterraría lo que esa auditoría existe para conservar.

## 9. La pantalla

`apps/admin/src/components/SystemHealthPanel.tsx`, en Datos del negocio →
Estado del sistema.

**No hay ningún botón que arregle nada**, y es a propósito. Aplicar migraciones
desde un navegador es exactamente la clase de botón que parece útil hasta el
día que alguien lo pulsa sin entenderlo. Esta pantalla **informa**.

Tres decisiones que no se ven leyendo el componente:

1. **Recorre la lista del contrato, no la de la respuesta.** Así, si el
   servidor deja de mandar una comprobación, la fila aparece diciendo «no se
   sabe» en vez de desaparecer y dejar el panel en verde sin haber mirado.
2. **El estado se lee, no solo se ve.** Cada fila lleva su texto además del
   punto de color: alrededor de uno de cada doce hombres no distingue bien el
   rojo del verde.
3. **La hora de la comprobación va siempre a la vista.** Sin ella, una pantalla
   congelada por un fallo de red se ve exactamente igual que un sistema sano.

Desde la etapa 3.31 hay una **segunda tarjeta** debajo,
`ErroresRecientes.tsx`, con las huellas de los errores del servidor de las
últimas 24 horas. Son dos tarjetas y no una para que el fallo de una no apague
a la otra. Ver `docs/47-el-error-que-nadie-ve.md` §7, que cuenta además la
trampa de despliegue que destapó esa fila nueva: el panel validaba el informe
con una enumeración cerrada, así que **añadir una comprobación apagaba la
pantalla** de los paneles sin desplegar.

## 10. Variables de entorno

| Variable                     | Defecto | Qué hace                                        |
| ---------------------------- | ------- | ----------------------------------------------- |
| `SYSTEM_ALERT_MINUTES`       | `5`     | Cada cuánto se mira. **Cero lo apaga**          |
| `SYSTEM_ALERT_SILENCE_HOURS` | `6`     | Silencio mínimo entre avisos del mismo problema |

Ninguna es un secreto: van en `render.yaml` sin `sync: false`.

**La comprobación `errors` no añadió ninguna.** Sus dos plazos y su umbral son
constantes del contrato (`error-monitor.ts`): una variable de entorno más es
una cosa más que se puede dejar mal puesta en Render, y aquí no hay ninguna
decisión que dependa del entorno. Se apaga con `SYSTEM_ALERT_MINUTES=0`, como
el resto.

## 11. Lo que esto NO sustituye

**`DIRECT_URL` en Render sigue siendo más importante que todo lo anterior.**

Una alarma te avisa de un incendio; esa variable impide que el incendio ocurra.
Con ella, la migración del pin se habría aplicado sola en el despliegue y **no
habría habido nada que avisar**.

Monitorizar es el segundo mejor plan. El primero es no romperse.
