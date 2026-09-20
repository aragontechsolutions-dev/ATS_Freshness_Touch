# Freshness Touch — Sistema de gestión

Plataforma web para la empresa de limpieza **Freshness Touch** (Georgia, EE. UU.).

> **Estado actual: Etapa 1 completada.** Sitio público bilingüe con cotizador
> instantáneo y depósito por distancia. Las reservas, los pagos y el panel de
> administración llegan en las etapas siguientes (ver
> [docs/00-alcance-y-etapas.md](docs/00-alcance-y-etapas.md)).

---

## Qué hace hoy

- Sitio público en **inglés y español**, con modo claro/oscuro y diseño móvil primero.
- **Cotizador instantáneo**: el visitante elige servicio, tamaño de la vivienda,
  frecuencia y extras, introduce su código postal y ve un precio real con desglose.
- **Depósito por distancia**: se calcula con la tarifa de millaje del IRS vigente y
  se acredita contra la factura final.
- **Zonas de servicio** con recargo por traslado y radio máximo atendido.
- Los casos que no se pueden cotizar automáticamente (comercial, fuera de área,
  propiedades muy grandes) se encaminan a una propuesta manual.

## Tecnologías

| Capa          | Tecnología                                         |
| ------------- | -------------------------------------------------- |
| Monorepo      | Turborepo + pnpm workspaces                        |
| Sitio público | React 19 + Vite 7 + Tailwind CSS 4 + react-i18next |
| API           | NestJS 12 + Zod 4                                  |
| Lenguaje      | TypeScript 5.9 en modo estricto                    |
| Tests         | Vitest (54 tests)                                  |
| Calidad       | ESLint 9 + Prettier + GitHub Actions               |

## Estructura

```
apps/
  api/        API NestJS: cotizador, catálogo de precios y sonda de salud
  landing/    Sitio público con el cotizador
packages/
  types/      Contratos Zod compartidos (fuente única de verdad del API)
  pricing/    Motor de precios y depósito (lógica pura, sin framework)
  i18n/       Textos EN/ES con paridad de claves garantizada por tipos
docs/         Documentación del proyecto (en español)
```

## Puesta en marcha

Requisitos: **Node 22+** y **pnpm 10+** (`corepack enable`).

```bash
pnpm install

# Configuración local
cp apps/api/.env.example apps/api/.env
cp apps/landing/.env.example apps/landing/.env

# Arrancar API (puerto 3001) y sitio (puerto 5173)
pnpm dev
```

Abrir <http://localhost:5173>. No hace falta ninguna cuenta externa: el
proveedor de distancia funciona en modo simulado por defecto.

## Comandos

| Comando          | Qué hace                               |
| ---------------- | -------------------------------------- |
| `pnpm dev`       | Arranca API y sitio en modo desarrollo |
| `pnpm build`     | Compila todo el monorepo               |
| `pnpm test`      | Ejecuta todos los tests                |
| `pnpm lint`      | Analiza el código con ESLint           |
| `pnpm typecheck` | Comprueba tipos sin generar archivos   |
| `pnpm format`    | Aplica el formato de Prettier          |

## Documentación

| Documento                                                       | Contenido                                     |
| --------------------------------------------------------------- | --------------------------------------------- |
| [00 — Alcance y etapas](docs/00-alcance-y-etapas.md)            | Qué se construyó, qué falta y en qué orden    |
| [01 — Arquitectura](docs/01-arquitectura.md)                    | Cómo encajan las piezas y por qué             |
| [02 — Motor de precios](docs/02-motor-de-precios.md)            | Fórmulas, tarifas y cómo cambiarlas           |
| [03 — Integraciones](docs/03-integraciones.md)                  | Proveedores simulados y reales                |
| [04 — Seguridad](docs/04-seguridad.md)                          | Análisis de riesgos y controles aplicados     |
| [05 — Despliegue](docs/05-despliegue.md)                        | Publicación en Vercel y Render                |
| [06 — Guía de desarrollo](docs/06-guia-de-desarrollo.md)        | Convenciones y flujo de trabajo               |
| [07 — Cumplimiento en Georgia](docs/07-cumplimiento-georgia.md) | Impuestos, personal, seguros y avisos legales |
| [Decisiones (ADR)](docs/adr/)                                   | Registro de decisiones técnicas               |

## Pendiente antes de publicar

1. Sustituir teléfono y correo en `apps/landing/src/config/company.ts`.
2. Revisar y aprobar las tarifas de `packages/pricing/src/config.ts`.
3. Confirmar con un contador o abogado de Georgia lo indicado en el documento 07.
