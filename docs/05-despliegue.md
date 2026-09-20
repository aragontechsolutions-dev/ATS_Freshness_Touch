# 05 — Despliegue

Dos servicios independientes: la API en **Render** y el sitio público en
**Vercel**.

---

## API — Render

El archivo `render.yaml` describe el servicio. En Render:
**Blueprints → New Blueprint Instance → seleccionar el repositorio**.

### El plan gratuito no sirve

El plan _free_ de Render **suspende el servicio tras 15 minutos sin tráfico**, y
el primer arranque después tarda entre 30 y 60 segundos. Para un cotizador eso
significa que el visitante ve un error o se cansa y se va: justo el tráfico que
más importa (el de fuera del horario de oficina) es el que se encontraría el
servicio dormido.

Por eso `render.yaml` fija `plan: starter` (~7 USD al mes). Es el único coste
fijo imprescindible de la Etapa 1.

### Variables de entorno

Las marcadas como `sync: false` se introducen a mano en el panel y **nunca** se
escriben en el repositorio.

| Variable                                      | Valor en producción                                          |
| --------------------------------------------- | ------------------------------------------------------------ |
| `CORS_ORIGINS`                                | Dominios reales del sitio, separados por coma. Sin comodines |
| `DISTANCE_PROVIDER`                           | `mock` al principio; `google` cuando haya clave              |
| `GOOGLE_MAPS_API_KEY`                         | Solo si se usa `google`                                      |
| `COMPANY_BASE_CITY` / `STATE` / `POSTAL_CODE` | Base real de operaciones                                     |

El resto tiene valores por defecto razonables en `render.yaml`.

### Sonda de salud

`healthCheckPath: /health`. Render reinicia el servicio si deja de responder.
La sonda no revela versión ni dependencias a propósito.

---

## Sitio público — Vercel

Proyecto nuevo apuntando a este repositorio, con **Root Directory =
`apps/landing`**. El archivo `vercel.json` ya define los comandos de instalación
y compilación para que Vercel construya solo lo necesario del monorepo.

### Variable de entorno

| Variable            | Valor                                  |
| ------------------- | -------------------------------------- |
| `VITE_API_BASE_URL` | `https://<tu-api>.onrender.com/api/v1` |

> Ojo: las variables `VITE_*` se **incrustan en el paquete que descarga el
> navegador** al compilar. Nunca poner un secreto ahí. La URL de la API es
> pública por naturaleza, así que no hay problema.

### Cabeceras de seguridad

`vercel.json` aplica CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy` y HSTS.

> **Antes de publicar:** en la directiva `connect-src` de la CSP hay que
> sustituir `https://API-DOMAIN-PENDIENTE.onrender.com` por el dominio real de
> la API. Si no se hace, el navegador bloqueará las cotizaciones.

---

## Orden de publicación

1. Desplegar la API en Render y anotar su dominio.
2. Poner ese dominio en `connect-src` de `vercel.json` y en `VITE_API_BASE_URL`.
3. Desplegar el sitio en Vercel y anotar su dominio.
4. Poner el dominio del sitio en `CORS_ORIGINS` de Render y reiniciar la API.
5. Comprobar de punta a punta: abrir el sitio, pedir una cotización y verificar
   que aparece el precio.

Los pasos 3 y 4 son circulares a propósito: hasta que ambos dominios no existen
no se pueden enlazar. Es normal necesitar dos despliegues.

## Comprobación tras cada despliegue

```bash
curl https://<api>/health
curl https://<api>/api/v1/pricing/catalog
```

Y en el sitio: pedir una cotización con un código postal de Georgia, verificar
que aparece el precio y que la consola del navegador no muestra errores.

## Dominios sugeridos

| Uso                               | Dominio                    |
| --------------------------------- | -------------------------- |
| Sitio público                     | `freshnesstouch.com`       |
| API                               | `api.freshnesstouch.com`   |
| Portal del cliente (Etapa 2)      | `app.freshnesstouch.com`   |
| Aplicación del personal (Etapa 3) | `crew.freshnesstouch.com`  |
| Administración (Etapa 2)          | `admin.freshnesstouch.com` |

## Registro de cambios en producción

Toda modificación pasa por la rama, con CI en verde (formato, lint, tipos, tests
y build) antes de fusionar. Render y Vercel despliegan automáticamente desde la
rama principal.
