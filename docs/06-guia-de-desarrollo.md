# 06 — Guía de desarrollo

## Requisitos

- **Node 22 o superior** (hay un `.nvmrc`).
- **pnpm 10 o superior**: `corepack enable`.

## Primer arranque

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/landing/.env.example apps/landing/.env
pnpm dev
```

- API: <http://localhost:3001> (salud en `/health`)
- Sitio: <http://localhost:5173>

No hace falta ninguna cuenta externa: el proveedor de distancia arranca en modo
simulado.

## Comandos

| Comando                                       | Qué hace                                         |
| --------------------------------------------- | ------------------------------------------------ |
| `pnpm dev`                                    | API y sitio en modo desarrollo, con recarga      |
| `pnpm build`                                  | Compila todo respetando el orden de dependencias |
| `pnpm test`                                   | Todos los tests                                  |
| `pnpm lint`                                   | ESLint                                           |
| `pnpm typecheck`                              | Tipos, sin generar archivos                      |
| `pnpm format`                                 | Aplica Prettier                                  |
| `pnpm --filter @freshness/pricing test:watch` | Tests de un paquete, en vigilancia               |

Turborepo cachea los resultados: repetir un comando sin cambios es instantáneo.

## Convenciones

### Idioma

- **Código, nombres de variables, ramas y mensajes de commit: inglés técnico
  donde es idiomático** (nombres de tipos, endpoints, claves de traducción).
- **Comentarios y documentación: español**, porque son para el equipo.
- **Textos de la interfaz: nunca escritos a mano en un componente.** Van siempre
  en `packages/i18n`, en inglés y español.

### Dinero

Siempre enteros de centavos, con nombres que terminan en `Cents`. La conversión
a texto ocurre solo al mostrar, con `formatCents`.

### Validación

Todo lo que entra por HTTP se valida con un esquema Zod estricto de
`@freshness/types`. No se aceptan cuerpos sin esquema.

### Lógica de negocio

Las reglas de negocio van en `packages/`, no en controladores ni componentes.
Si se puede probar sin levantar un servidor, está en el sitio correcto.

### Funciones puras

Las funciones de cálculo no leen el reloj ni generan identificadores: se los
pasa quien las llama. Así los tests son deterministas.

## Añadir un servicio nuevo al catálogo

1. Añadir el código a `ServiceTypeSchema` en `packages/types/src/enums.ts`.
2. Añadir sus tarifas en `packages/pricing/src/config.ts`.
3. Añadir nombre y descripción en `packages/i18n/src/en.ts` **y** `es.ts`
   (si falta uno de los dos, el proyecto no compila).
4. Añadir la etiqueta de línea en `quote.line.service.<CODIGO>`.
5. `pnpm test`: el test de paridad de i18n comprueba que no falta nada.

El sitio web lo mostrará solo, porque lee el catálogo del servidor.

## Añadir un extra

Igual que arriba, pero en `AddOnCodeSchema`, `config.addOns`, `addOns.<CODIGO>`
y `quote.line.addOn.<CODIGO>`.

## Tests

- `packages/pricing`: el motor de precios, exhaustivamente. Cualquier cambio de
  reglas debe venir con su test.
- `apps/api`: servicios instanciados a mano, sin levantar NestJS.
- `apps/landing`: utilidades puras (formato). La interfaz se verifica en
  navegador.

Un test que falla porque cambió un precio **a propósito** se actualiza; un test
que falla sin que nadie tocara los precios es un error real.

## Flujo de trabajo

1. Rama por cambio.
2. `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
3. Commit descriptivo (qué y por qué, no solo qué archivo).
4. La CI repite todo lo anterior antes de permitir la fusión.

## Estructura del monorepo

```
apps/api/src/
  common/      configuración de entorno, validación, errores, middleware
  distance/    interfaz de distancia, proveedores y caché
  quotes/      orquestación de la cotización y el catálogo
  health/      sonda de salud

apps/landing/src/
  components/  cabecera, pie, selectores, iconos
  sections/    bloques de la página (portada, servicios, cotizador...)
  hooks/       tema, catálogo, retardo
  lib/         cliente de la API y formato
  config/      datos de contacto de la empresa
```

## Problemas frecuentes

| Síntoma                                  | Causa habitual                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| El cotizador no carga los servicios      | La API no está arrancada, o el puerto del sitio no está en `CORS_ORIGINS` |
| `429` al probar                          | El límite de 10 cotizaciones por minuto; esperar un minuto                |
| Error de tipos al importar un paquete    | Falta compilarlo: `pnpm build`                                            |
| Cambios en un paquete que no se reflejan | En desarrollo el sitio lee el fuente; la API necesita recompilar          |
