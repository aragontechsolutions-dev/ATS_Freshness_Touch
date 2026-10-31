# 51 — Los huecos del PWA del equipo de limpieza

> Auditoría del 31/10/2026. Mira **una sola cosa**: qué puede y qué no puede
> hacer alguien con el puesto `CLEANER` desde el móvil, de pie en la puerta de
> una casa.
>
> No propone nada todavía: enumera lo que está construido, lo que falta y lo
> que cuesta cada hueco. Hermana de `docs/43`, que hace lo mismo con el
> sistema entero.

---

## Cómo se hizo

Leyendo el código, no la documentación. El recorrido:

- `App.tsx:260` — qué pantallas puede abrir el puesto.
- `apps/api/src/admin/my-jobs.controller.ts` — **los cuatro únicos endpoints**
  que `CLEANER` puede llamar.
- `packages/types/src/my-jobs.ts` — exactamente qué datos recibe de cada
  trabajo, y cuáles se le ocultan a propósito.
- `apps/admin/src/pages/MyJobs.tsx` — qué botones tiene delante.
- `apps/admin/vite.config.ts` — qué se guarda en el móvil y qué no.

---

## 1. Lo que SÍ está resuelto

Conviene decirlo antes, porque es mucho y está bien hecho:

| Puede                                                             | Dónde                               |
| ----------------------------------------------------------------- | ----------------------------------- |
| Ver sus trabajos de hoy en adelante, ordenados                    | `my-jobs.service.ts`                |
| Dirección, ciudad, código postal y notas de acceso                | `MyJobSchema`                       |
| **El pin de la puerta**, cuando el cliente lo marcó               | `doorPin`                           |
| Llamar al cliente de un toque                                     | `tel:` en `MyJobs.tsx`              |
| Navegar con Google o Apple Maps, según el móvil                   | `lib/navegacion.ts`                 |
| Que al volver de la navegación le pregunten «¿has llegado?»       | `DialogoLlegada`                    |
| Fichar llegada y salida con GPS                                   | `clock-in.ts`                       |
| Fichar **sin** GPS, sin que parezca culpa suya                    | Los tres motivos de «sin ubicación» |
| Marcar en curso y terminado                                       | `PATCH /progress`                   |
| Avisar de que la casa no es la contratada, y ver qué decidieron   | `PATCH /adjustment`                 |
| Saber quién va con ella y quién es la responsable                 | `teammates`, `iAmLead`              |
| Instalarlo en la pantalla de inicio                               | `vite-plugin-pwa`                   |
| Que una versión nueva se **ofrezca**, no se imponga a media faena | `registerType: 'prompt'`            |

Y lo que **no** ve, que importa igual: ningún importe, ningún apellido, ningún
correo de cliente, y nada de nadie más del equipo salvo su nombre.

---

## 2. Los huecos, por lo que cuesta cada uno

### H1. La lista de verificación está vacía — **y es el más grande**

```ts
// packages/types/src/job-checklist.ts:124
export const JOB_CHECKLIST_CATALOG: readonly ChecklistItem[] = [];
```

Está construido **todo**: el contrato, el endpoint, la pantalla, los permisos,
el registro de quién marcó qué y cuándo, las pruebas. Y no hay ni una tarea
dentro. El equipo abre un trabajo y la lista no existe.

**Lo que cuesta:** la promesa de `docs/27` —«esta es la misma lista que lleva
el equipo cuando llega a tu casa, sin letra pequeña»— hoy no se cumple. Y la
web la enseña al cliente.

**Lo que hace falta no es código, es contenido:** sentarse con la dueña y
escribir las tareas por estancia y por servicio. `checklistForService` ya
admite un catálogo por parámetro justamente para esto.

### H2. No se puede decir «no había nadie»

El equipo llega, llama, nadie abre. El PWA ofrece dos botones: «he llegado» y
«he terminado».

`MyJobProgressSchema` solo acepta `IN_PROGRESS` y `COMPLETED`. `NO_SHOW` es un
cambio de estado de administración o coordinación, desde el panel grande.

**Lo que cuesta:** una llamada de teléfono en el peor momento, y —peor— que el
registro de la ausencia dependa de que alguien se acuerde de marcarla después.
Una ausencia da derecho a cobrar el depósito (`docs/12`), así que no anotarla
es dinero.

### H3. Sin cobertura, el PWA no sirve para nada

El armazón se guarda en el móvil; **la API no se cachea nunca**, y eso está
bien razonado en `vite.config.ts`: cachear respuestas con sesión dejaría
direcciones, teléfonos y códigos de puerta en el disco del móvil, fuera de la
sesión y visibles para la siguiente persona que lo coja.

La consecuencia operativa, aun así, es dura: **en un sótano o en la Georgia
rural no hay dirección, ni código de puerta, ni teléfono del cliente**. Y el
fichaje no se guarda para enviarlo luego: se pierde.

La pantalla se cura sola cuando vuelve la cobertura (el sondeo lo reintenta),
que es lo correcto, pero mientras no vuelve no hay nada.

El propio archivo deja escrito cuál sería la solución buena: _«guardarlos a
propósito y borrarlos al cerrar sesión, no dejar que el service worker los
recoja de paso»_.

### H4. «He terminado» es un toque, y no se puede deshacer

```tsx
// MyJobs.tsx:911
onClick={() => void onMarcar(job, 'COMPLETED')}
```

Sin confirmación. Y `COMPLETED` es un estado **final**: no hay transición de
salida ni para el equipo ni para administración —el histórico tiene que contar
lo que de verdad pasó—.

**Lo que cuesta:** un toque sin querer, con el móvil en el bolsillo o con las
manos mojadas, cierra un trabajo a mitad. Es el botón más barato de arreglar
de toda esta lista: pedir confirmación.

### H5. Dos botones muertos en la campana

Para `CLEANER`, `App.tsx:261` fija la pantalla:

```ts
const actual: Vista = soloMisTrabajos ? 'myJobs' : vista;
```

La campana de avisos **sí** se pinta para el puesto, y recibe los suyos
(`job.assigned`). Pero sus dos acciones —«ver todas» y «abrir la reserva»—
cambian `vista`, que para limpieza no se mira nunca. **No pasa nada al
pulsar.**

No es un agujero de seguridad: la ficha completa de una reserva está cerrada
por rol en la API (`@Roles('ADMIN','DISPATCHER')`), así que ni siquiera
podría cargarse. Es algo distinto y también malo: un botón que no responde.

### H6. No se puede contactar con un compañero

`teammates` lleva `{ name, isLead }` y nada más — por la misma regla que
oculta los datos de clientes.

**Lo que cuesta:** «voy con retraso, empieza tú» exige tener el teléfono
guardado aparte, en el móvil personal. En un equipo que cambia de
composición cada semana, eso falla.

### H7. Nadie avisa antes de que caduque la sesión

La API devuelve `sessionExpiresAt` en cada sesión. **El panel no lo usa en
ningún sitio** (`grep` lo confirma: solo aparece en una prueba de la API).

**Lo que cuesta:** la sesión puede morir a mitad de turno y la persona se
entera al intentar fichar la salida, que es justo cuando ya no tiene tiempo
para volver a entrar.

### H8. El equipo no puede hacer fotos del trabajo

`docs/38` §1 separa bien las dos clases de foto —marketing y prueba del
trabajo— y deja la segunda para una etapa propia. Sigue pendiente.

**Lo que cuesta:** documentar un destrozo, una mancha que ya estaba o el
estado en que se encontró la casa se hace hoy con el móvil personal, fuera
del sistema. Y es la prueba que hace falta el día de una reclamación o de una
disputa con el proveedor de pago.

---

## 3. Lo que NO es un hueco, aunque lo parezca

- **Que solo vea una pantalla.** Es deliberado y correcto: su puesto no
  necesita más, y cada pantalla de más es una lista de clientes de más.
- **Que no vea precios.** Igual: quien limpia no factura.
- **Que la lista llegue hasta 60 trabajos y un mes.** Nadie mira más en un
  móvil.
- **Que una cancelada desaparezca de su lista.** Es lo que impide que alguien
  se presente en una casa donde ya no se le espera.

---

## 4. Por dónde empezar, si hubiera que elegir

Ordenado por lo que cuesta no hacerlo, no por lo que cuesta hacerlo:

1. **H1, la lista de verificación.** Es la única función del puesto que está
   construida entera y no hace nada. No es código: es una tarde con la dueña
   escribiendo las tareas.
2. **H4, confirmar «he terminado».** Media hora, y evita un estado final
   puesto sin querer.
3. **H2, «no había nadie».** Es la situación real que hoy no tiene botón, y la
   que cuesta dinero cuando no se anota.
4. **H5, los dos botones muertos.** Pequeño, y es de las cosas que hacen que
   alguien deje de confiar en una aplicación.
5. **H7, avisar de la sesión.** Pequeño también.
6. **H6, el teléfono del compañero.** Decisión de la dueña antes que de
   código: es dar el número de una persona a otra.
7. **H3, trabajar sin cobertura.** El más caro y el más delicado: hay que
   guardar datos de clientes en el móvil a propósito, con su borrado al cerrar
   sesión. Merece su propia etapa y su repaso de seguridad.
8. **H8, las fotos de prueba del trabajo.** Ya estaba apuntado en `docs/38`.
