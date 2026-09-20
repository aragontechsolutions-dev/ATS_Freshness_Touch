# 01 — Arquitectura

## Vista general

```
                    ┌───────────────────────────┐
  Visitante ───────▶│  apps/landing  (Vercel)   │
                    │  React + Vite + Tailwind  │
                    └─────────────┬─────────────┘
                                  │ HTTPS (CORS restringido)
                                  ▼
                    ┌───────────────────────────┐
                    │  apps/api  (Render)       │
                    │  NestJS + Zod             │
                    └─────────────┬─────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                ▼                                   ▼
     @freshness/pricing                  DistanceProvider
     (cálculo puro)                      ├── mock   (local, sin coste)
                                         └── google (Routes API)
```

Los paquetes `@freshness/types` y `@freshness/i18n` los comparten ambas
aplicaciones.

## Reglas de diseño

### 1. El precio se calcula solo en el servidor

El navegador **nunca** calcula precios: pide una cotización y muestra lo que
recibe. Si el cálculo viviera en el front, cualquiera podría alterarlo desde las
herramientas del navegador antes de reservar. Esta regla se mantendrá cuando se
añadan los pagos: el importe a cobrar lo decide siempre el servidor.

### 2. Un único contrato

`@freshness/types` define con Zod la forma exacta de cada petición y cada
respuesta. La API lo usa para validar lo que entra; el sitio web lo usa para
tipar lo que envía y verificar lo que recibe. Cuando el contrato cambia, ambos
lados dejan de compilar a la vez, que es justo lo que se quiere: el error
aparece al desarrollar, no en producción.

### 3. La lógica de negocio no depende del framework

`@freshness/pricing` no importa NestJS, ni React, ni nada relacionado con HTTP.
Es una función: entran datos, sale un presupuesto. Por eso se puede probar
exhaustivamente (29 tests) sin levantar un servidor, y por eso mañana puede
reutilizarse desde el panel de administración o desde un script contable.

También es **pura**: no lee el reloj ni genera identificadores por su cuenta.
La fecha y el identificador se le pasan desde fuera. Gracias a eso los tests son
deterministas y un presupuesto se puede reproducir tal cual meses después.

### 4. Los proveedores externos van detrás de una interfaz

`DistanceProvider` define qué necesita el sistema (dar millas entre dos códigos
postales). Hay dos implementaciones y se elige con una variable de entorno. El
resto del código no sabe cuál está activa.

Esto permitió construir y demostrar el cotizador completo **sin contratar
Google**, y permitirá cambiar de proveedor sin tocar la lógica de negocio. El
mismo patrón se aplicará a pagos, SMS y correo en las etapas siguientes.

### 5. El dinero se maneja en centavos enteros

Nunca se usan decimales para importes. `0.1 + 0.2` no es `0.3` en coma flotante,
y esos errores se acumulan hasta producir facturas descuadradas. Todo el sistema
opera con enteros y solo se convierte a texto ("$185.00") en el último momento,
al mostrarlo.

### 6. La web no duplica precios

Los servicios, extras, zonas y límites del formulario se leen del endpoint
`/pricing/catalog`. Si la empresa sube una tarifa, se cambia en un solo archivo
del servidor y el sitio se actualiza solo.

### 7. Los textos viajan como claves, no como frases

La API devuelve `quote.line.addOn.INSIDE_OVEN`, no "Inside the oven". El idioma
lo resuelve el cliente. Así la misma respuesta sirve en inglés y en español, y
añadir un tercer idioma no obliga a tocar el servidor.

## Por qué monorepo

Cuatro razones concretas para este proyecto:

1. El contrato de la API y el sitio que lo consume cambian juntos; en un mismo
   repositorio se actualizan en el mismo commit.
2. Los textos EN/ES los usarán también el portal del cliente y la aplicación del
   personal (etapas 2 y 3).
3. Una sola configuración de calidad (lint, formato, tipos, CI) para todo.
4. Turborepo cachea las tareas: solo se recompila lo que cambió.

## Compilación y compatibilidad de módulos

Los paquetes compartidos se compilan a **CommonJS**, porque NestJS es CommonJS.
El sitio web, en cambio, se construye con Vite (ESM) y Rollup no analiza de
forma fiable las exportaciones nombradas de un módulo CommonJS.

Solución adoptada: Vite consume los paquetes internos **desde su código fuente
TypeScript** mediante alias (`apps/landing/vite.config.ts`). Es un patrón común
en monorepos, elimina el problema de interoperabilidad de raíz y además da
recarga en caliente al editar un paquete compartido. La comprobación de tipos
sigue usando los `.d.ts` compilados, así que no se pierde seguridad de tipos.

## Estructura de una petición de cotización

1. El navegador envía `POST /api/v1/quotes/estimate`.
2. `RequestIdMiddleware` asigna un identificador único a la petición.
3. `ThrottlerGuard` comprueba los límites por IP (60/min general, 10/min cotizaciones).
4. `ZodValidationPipe` valida el cuerpo contra `QuoteRequestSchema` en modo estricto.
5. `QuotesService` pide la distancia a `DistanceService` (con caché).
6. `calculateQuote` produce el presupuesto.
7. Si algo falla, `AllExceptionsFilter` devuelve un error con formato uniforme,
   sin filtrar detalles internos.
