# 0001 — Monorepo con Turborepo y pnpm

**Estado:** aceptada · **Fecha:** 2026-09-20

## Contexto

El sistema tendrá con el tiempo cinco aplicaciones (sitio público, portal del
cliente, aplicación del personal, panel de administración y API) que comparten
contratos de datos, reglas de precios y textos en dos idiomas.

## Decisión

Un único repositorio gestionado con **Turborepo sobre pnpm workspaces**.

## Alternativas descartadas

| Alternativa            | Por qué no                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositorios separados | El contrato de la API y sus consumidores cambian juntos; separarlos obliga a publicar paquetes y coordinar versiones para cada cambio pequeño                                             |
| Nx                     | Más potente, pero su valor (límites de módulo estrictos, generadores) aparece con equipos de más de 10 personas. Para un equipo pequeño es configuración que mantener sin beneficio claro |

## Consecuencias

- Un cambio de contrato se hace en un solo commit y rompe la compilación de
  ambos lados a la vez: el error aparece al desarrollar, no en producción.
- Una sola configuración de calidad para todo el proyecto.
- Turborepo cachea las tareas, así que la CI y el trabajo local son rápidos.
- Los despliegues filtran lo que necesitan
  (`turbo run build --filter=@freshness/api`).

## Revisar si...

El equipo de desarrollo supera las diez personas: entonces conviene reevaluar
Nx por sus límites de módulo.
