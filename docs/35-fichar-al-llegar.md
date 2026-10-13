# 35. Fichar al llegar: el fallo y la pregunta (Etapa 3.18)

Dos cosas que van juntas porque afectan al mismo momento: la empleada llega a
la casa y tiene que avisar al sistema.

---

# Parte 1 — El fallo: la pantalla no se enteraba de su propio fichaje

## 1. El síntoma

Se pulsaba **«He llegado»**. Aparecía el aviso confirmando el fichaje. Y el
botón seguía diciendo «He llegado». Había que **recargar a mano** para que
apareciera «He terminado». Lo mismo al terminar.

## 2. La causa

```ts
// apps/api/src/admin/my-jobs.service.ts
const actualizado = await this.prisma.db.$transaction(async (tx) => {
  const trabajo = await tx.booking.findUniqueOrThrow({ ..., select: JOB_SELECT });  // ← se LEE

  await tx.bookingClockIn.create({ ... });                                          // ← y DESPUÉS se ficha

  return trabajo;                                                                   // ← la foto de ANTES
});

return toMyJob(actualizado, staff.staffId, this.catalogo);
```

`toMyJob` deduce dos campos de los fichajes de esa foto:

```ts
iHaveArrived: trabajo.clockIns.some((f) => f.staffId === staffId && f.kind === 'ARRIVAL'),
iHaveLeft:    trabajo.clockIns.some((f) => f.staffId === staffId && f.kind === 'DEPARTURE'),
```

Como la foto se tomó **antes** de crear la fila del fichaje, los dos salían en
`false`. La petición iba bien, el fichaje quedaba guardado, y el servidor le
contestaba a la pantalla que esa persona no había llegado.

**La pantalla hacía lo correcto**: se pinta con lo que dice el servidor.

## 3. El arreglo

```ts
return this.getOne(bookingId, staff);
```

`getOne` lee **después** de que la transacción haya terminado. Es exactamente
lo que ya hacían marcar una tarea y proponer un ajuste; a este método se le
había escapado la regla que el propio código tenía escrita:

> Lo usan los endpoints que CAMBIAN algo de un trabajo… Así la pantalla se
> pinta con lo que decidió el servidor en vez de suponer que hizo lo que le
> pidieron.

## 4. Por qué no lo cazó ninguna prueba

Había una prueba llamada _«lo que la pantalla necesita para pintar el botón
correcto»_… y comprobaba **el listado**, que estaba bien. La respuesta del
`PATCH` —la que de verdad pinta la pantalla justo después de pulsar— no la
miraba nadie.

Ahora hay tres que sí, validadas **revirtiendo el arreglo**: las tres fallan.

**La lección, para la próxima**: si un endpoint devuelve el estado de después,
la prueba tiene que mirar **esa respuesta**, no volver a preguntar por otro
camino. Una respuesta que no refleja lo que acaba de pasar es peor que un
error: el error se ve; esto parecía que no se había guardado.

---

# Parte 2 — La pregunta al volver de la navegación

## 5. Qué hace

Quien pulsa **«Llévame allí»** sale de la aplicación, conduce, aparca y
vuelve. Al volver, la PWA pregunta:

> **¿Has llegado?**
> 123 East Church St, Monroe
> Marcar tu llegada avisa a la oficina y empieza el trabajo.
> **[ Sí, ya estoy aquí ] [ Todavía no ]**

Confirmar hace **exactamente lo mismo** que el botón «He llegado»: mide la
distancia, guarda el fichaje y avisa a operaciones si no cuadra. Son dos
caminos al mismo sitio, no un reemplazo.

## 6. No se usa el GPS para decidir si preguntar

Lo evidente sería mirar si está cerca de la casa. Se descartó: eso obliga a
pedir el permiso de ubicación **al volver** a la aplicación, sin que la persona
haya pulsado nada. Es justo lo que la etapa 3.3 decidió no hacer:

> que aparezca al abrir la aplicación —sin que la persona haya hecho nada que
> lo justifique— es la forma más rápida de que le dé a «Bloquear» para siempre

Y no hace falta: **la pregunta pregunta, no afirma.** Quien contesta que sí
ficha, y es ahí donde se mide la distancia, como siempre. Si fichó lejos,
operaciones recibe su aviso igual (etapa 3.13). La comprobación no se pierde:
se queda donde ya estaba.

## 7. Las decisiones que evitan que se convierta en ruido

| Regla                                           | Por qué                                                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Caduca a las 4 h**                            | Cubre el trayecto más largo del área con margen. Más allá, preguntar por una navegación de esta mañana es ruido                               |
| **No pregunta si ya fichó**                     | Por el botón o por una pregunta anterior                                                                                                      |
| **No pregunta si el trabajo ya no está**        | Cancelado, reasignado, de otro día                                                                                                            |
| **Se olvida al contestar, sea que sí o que no** | Una pregunta que insiste se contesta sin leerla                                                                                               |
| **Decir que no cuesta un toque**                | El botón de descartar está al mismo nivel. De una pregunta de la que cuesta salir se sale diciendo que sí, y entonces el dato ya no vale nada |

## 8. Dos detalles de implementación que no son evidentes

**`sessionStorage` y no una variable.** Un móvil con poca memoria mata la PWA
en segundo plano mientras se conduce, y al volver se carga entera. Una variable
no sobrevive a eso. Todo el acceso va en `try`: en navegación privada lanza, y
quedarse sin preguntar es un inconveniente — una pantalla en blanco en la
puerta de una casa, no.

**La decisión depende de `jobs` y de nada más.** Escuchar `visibilitychange`
directamente decidiría con la foto vieja, porque la lista todavía se está
pidiendo: se le preguntaría a quien ya fichó. Colgando de `jobs`, el efecto
vuelve a correr cuando llegan los datos frescos.

**Se usa el `<dialog>` del navegador.** `showModal()` trae de serie el foco
atrapado dentro, la tecla de escape y el fondo inerte — tres cosas que a mano
se olvidan y que con un lector de pantalla importan.

## 9. Qué comprobar tras desplegar

1. Pulsa **«He llegado»**: el botón tiene que cambiar a «He terminado» **solo**,
   sin recargar. Lo mismo al terminar.
2. Pulsa **«Llévame allí»**, vuelve a la PWA: debe aparecer la pregunta.
3. Dale a **«Todavía no»**: no debe volver a aparecer al cambiar de aplicación.
4. Pulsa «Llévame allí» otra vez, vuelve y dale a **«Sí, ya estoy aquí»**: tiene
   que fichar igual que el botón, con su aviso y su distancia.
