# 08 — Variables de entorno y despliegue

Referencia única para configurar los entornos. Copia y pega desde aquí.

> **Regla de oro:** ningún secreto entra en el repositorio. Los secretos se
> escriben a mano en el panel de Render, Vercel o Supabase. El archivo `.env`
> está en `.gitignore` y debe seguir estándolo.

---

## 1. API en Render

**Servicio:** Web Service · **Runtime:** Node · **Región:** Ohio (US East, la
más cercana a Georgia) · **Plan:** Starter (ver `docs/05-despliegue.md` sobre
por qué el plan gratuito no sirve).

Si importas `render.yaml` como Blueprint, la mayoría ya viene puesta y solo
tendrás que rellenar las marcadas como **"a mano"**.

| Variable                     | Valor                         | Nota                                                                                                |
| ---------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `NODE_VERSION`               | `22`                          |                                                                                                     |
| `NODE_ENV`                   | `production`                  |                                                                                                     |
| `API_PREFIX`                 | `api/v1`                      |                                                                                                     |
| `CORS_ORIGINS`               | `https://TU-SITIO.vercel.app` | **A mano.** Dominios del sitio separados por coma, sin espacios ni barra final. Nunca `*`           |
| `DISTANCE_PROVIDER`          | `mock`                        | Cambiar a `google` cuando haya clave y facturación                                                  |
| `GOOGLE_MAPS_API_KEY`        | _(vacío)_                     | **A mano**, solo si usas `google`. Si pones `google` sin clave, la API **no arranca** (a propósito) |
| `DISTANCE_CACHE_TTL_SECONDS` | `86400`                       | 24 h                                                                                                |
| `DISTANCE_CACHE_MAX_ENTRIES` | `5000`                        |                                                                                                     |
| `DISTANCE_TIMEOUT_MS`        | `5000`                        |                                                                                                     |
| `RATE_LIMIT_TTL_SECONDS`     | `60`                          |                                                                                                     |
| `RATE_LIMIT_MAX`             | `60`                          | Peticiones por IP y minuto                                                                          |
| `QUOTE_RATE_LIMIT_MAX`       | `10`                          | Cotizaciones por IP y minuto                                                                        |
| `COMPANY_BASE_CITY`          | `Atlanta`                     | **A mano.** Base real de operaciones                                                                |
| `COMPANY_BASE_STATE`         | `GA`                          | **A mano.** Exactamente 2 letras                                                                    |
| `COMPANY_BASE_POSTAL_CODE`   | `30303`                       | **A mano.** Exactamente 5 dígitos                                                                   |

### Qué NO hay que configurar

- **`PORT`**: lo inyecta Render y la aplicación lo respeta automáticamente.
  No lo pongas a mano.
- Las variables `RENDER_*` que añade la plataforma se ignoran sin problema.

_Comprobado:_ la API arranca en un entorno equivalente al de Render (puerto
10000 inyectado, variables `RENDER_*` presentes, sin archivo `.env`), responde
en `/health` y cotiza correctamente.

### Comandos (ya definidos en `render.yaml`)

```
Build:  corepack enable && pnpm install --frozen-lockfile && pnpm turbo run build --filter=@freshness/api
Start:  node apps/api/dist/main.js
Health: /health
```

---

## 2. Sitio en Vercel

**Root Directory:** `apps/landing` · El resto lo define `vercel.json`.

| Variable            | Valor                                |
| ------------------- | ------------------------------------ |
| `VITE_API_BASE_URL` | `https://TU-API.onrender.com/api/v1` |

Es la única. Aplícala a los tres entornos (Production, Preview, Development).

> ⚠️ **Las variables `VITE_*` se incrustan en el archivo que descarga el
> navegador.** Cualquiera puede leerlas viendo el código fuente de la página.
> Nunca pongas ahí una clave secreta. La URL de la API es pública por
> naturaleza, así que no hay problema.

### Edición obligatoria en `vercel.json`

La política de seguridad de contenido lleva un marcador:

```
connect-src 'self' https://API-DOMAIN-PENDIENTE.onrender.com;
```

Sustitúyelo por el dominio real de la API. **Si no lo haces, el navegador
bloqueará todas las cotizaciones** aunque la API funcione. Es intencionado:
la lista de destinos permitidos tiene que ser explícita.

---

## 3. Orden de despliegue

Los dominios se necesitan mutuamente, así que hacen falta dos pasadas:

1. **Render**: desplegar la API con `CORS_ORIGINS` provisional (por ejemplo
   `http://localhost:5173`). Anotar el dominio, algo como
   `https://freshness-touch-api.onrender.com`.
2. **Repositorio**: poner ese dominio en `connect-src` de
   `apps/landing/vercel.json` y hacer commit.
3. **Vercel**: desplegar el sitio con `VITE_API_BASE_URL` apuntando a la API.
   Anotar el dominio, algo como `https://freshness-touch.vercel.app`.
4. **Render**: actualizar `CORS_ORIGINS` con el dominio de Vercel y reiniciar.
5. **Comprobar**:
   ```bash
   curl https://TU-API.onrender.com/health
   curl https://TU-API.onrender.com/api/v1/pricing/catalog
   ```
   Y en el sitio: pedir una cotización con un código postal de Georgia y
   confirmar que aparece el precio sin errores en la consola del navegador.

Cuando haya dominio propio, `CORS_ORIGINS` debe listar **todos** los que se
usen de verdad, por ejemplo:
`https://freshnesstouch.com,https://www.freshnesstouch.com`

### Sobre los despliegues de vista previa de Vercel

Cada rama genera una URL distinta (`...-git-rama-....vercel.app`) que **no
estará en `CORS_ORIGINS`**, así que el cotizador no funcionará ahí. Es lo
correcto desde el punto de vista de seguridad. Si quieres probar una vista
previa contra la API real, añade temporalmente esa URL concreta a
`CORS_ORIGINS` y quítala después. No uses comodines.

---

## 4. Supabase (Etapa 2 — preparación)

Todavía no hay código que use Supabase. Esto es lo que conviene dejar listo y
guardado al crear el proyecto.

**Al crear el proyecto:**

- **Región:** East US (North Virginia). Cercana a Georgia y a la región Ohio de
  Render: menos latencia en cada consulta.
- **Contraseña de la base de datos:** genérala larga y guárdala en un gestor de
  contraseñas. Aparece dentro de las cadenas de conexión y **no se puede
  recuperar después**, solo restablecer.

**Datos que hay que copiar y guardar** (los nombres exactos pueden variar según
la versión del panel):

| Dato                                                    | Dónde aparece               | Uso previsto                                                        | ¿Secreto?                 |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- | ------------------------- |
| URL del proyecto                                        | `https://<ref>.supabase.co` | API y navegador                                                     | No                        |
| Clave pública (`anon` / publishable)                    | Ajustes de API              | Navegador                                                           | No, pero limitada por RLS |
| Clave de servicio (`service_role` / secret)             | Ajustes de API              | **Solo servidor**                                                   | **Sí, crítica**           |
| Secreto o claves JWT                                    | Ajustes de API / JWT        | Que la API valide los tokens sin llamar a Supabase en cada petición | **Sí**                    |
| Cadena de conexión agrupada (_pooler_, puerto **6543**) | Ajustes de base de datos    | `DATABASE_URL` de la aplicación                                     | **Sí**                    |
| Cadena de conexión directa (puerto **5432**)            | Ajustes de base de datos    | `DIRECT_URL`, solo para migraciones                                 | **Sí**                    |

**Por qué dos cadenas de conexión:** el _pooler_ en modo transacción no admite
las sentencias preparadas que necesitan las migraciones de Prisma. La
aplicación usa la agrupada (aguanta muchas conexiones cortas) y las migraciones
la directa.

Variables de la API en la Etapa 2. `DIRECT_URL` ya se usa: es la que necesitan
las migraciones (ver `docs/10-modelo-de-datos.md`). El resto entra cuando la
aplicación se conecte a la base de datos.

```bash
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...        # NUNCA en Vercel ni en el navegador
SUPABASE_JWT_SECRET=...
DATABASE_URL=postgresql://...:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...:5432/postgres
```

Y el sitio o el portal del cliente, únicamente:

```bash
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

> 🔒 **La clave `service_role` salta todas las reglas de seguridad de filas
> (RLS).** Si acaba en el navegador, cualquiera puede leer y borrar toda la base
> de datos. Va solo en Render, nunca en Vercel, nunca en un archivo del
> repositorio, nunca en una variable `VITE_*`.

## 5. Stripe (Etapa 2 — preparación)

```bash
STRIPE_SECRET_KEY=sk_test_...          # solo servidor
STRIPE_WEBHOOK_SECRET=whsec_...        # solo servidor, para verificar firmas
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...  # navegador, es pública por diseño
```

Empezar siempre en modo de prueba (`sk_test_` / `pk_test_`) y no pasar a claves
reales hasta que el flujo completo de depósito y cobro esté verificado.

---

## 6. Resumen de qué va dónde

| Secreto                       | Render | Vercel | Repositorio |
| ----------------------------- | ------ | ------ | ----------- |
| `GOOGLE_MAPS_API_KEY`         | ✅     | ❌     | ❌          |
| `SUPABASE_SERVICE_ROLE_KEY`   | ✅     | ❌     | ❌          |
| `DATABASE_URL` / `DIRECT_URL` | ✅     | ❌     | ❌          |
| `STRIPE_SECRET_KEY`           | ✅     | ❌     | ❌          |
| Clave pública de Supabase     | ✅     | ✅     | ❌          |
| `VITE_API_BASE_URL`           | ❌     | ✅     | ❌          |

Si alguna vez un secreto llega a subirse al repositorio, **no basta con
borrarlo en un commit posterior**: queda en el historial. Hay que rotarlo en el
proveedor correspondiente.
