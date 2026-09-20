import { defineConfig } from 'prisma/config';

/**
 * Configuracion de Prisma (formato de la version 7).
 *
 * Aqui va SOLO la conexion que usan los comandos de migracion, que debe ser
 * la conexion DIRECTA de Supabase (puerto 5432). La aplicacion en ejecucion
 * no usa este archivo: se conecta con un adaptador a la conexion agrupada
 * (puerto 6543), que es la que aguanta muchas conexiones cortas.
 *
 * Se lee `process.env` en vez del ayudante `env()` de Prisma a proposito:
 * `env()` aborta si la variable no existe, y eso romperia los comandos que
 * NO tocan la base de datos (`validate`, `generate`, `migrate diff`), que son
 * justo los que se ejecutan en la integracion continua, donde no hay ni debe
 * haber credenciales. Si falta la variable, el comando que si necesite
 * conectarse fallara con su propio mensaje, que es el momento correcto.
 *
 * Ninguna credencial vive en el repositorio: todo sale del entorno.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
  },

  datasource: {
    url: process.env.DIRECT_URL ?? '',
  },
});
