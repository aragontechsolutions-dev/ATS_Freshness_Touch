# 15 — Dominio propio: Vercel, Resend y correo

Guía para pasar de los dominios `*.vercel.app` a **`freshnesstouchcleaning.com`**
y dejar el correo saliente funcionando de verdad.

Se escribe con ese dominio como ejemplo. Si compras otro, sustitúyelo en todas
partes.

> **Antes de nada.** Nada de lo que hay aquí obliga a tocar código, salvo el
> apartado 8 —mover la API—, que es **opcional y no recomendado de momento**.
> Todo lo demás son ajustes en los paneles de Vercel, Render, Resend y Supabase.

> **Sobre el plan de Vercel.** La cuenta está en **Hobby**, que Vercel destina a
> proyectos personales y **no comerciales**. Esto es el sitio de una empresa que
> cobra a clientes, así que conviene revisar la política de uso de Vercel y
> valorar el paso a Pro antes de poner el dominio de la empresa a producir. No
> es un detalle de estilo: un proyecto comercial en Hobby se puede suspender, y
> se llevaría por delante el sitio y el panel a la vez. Compruébalo tú en las
> condiciones vigentes; aquí solo se deja anotado.

---

## 1. Qué nombre va a cada cosa

Hay cuatro cosas distintas que necesitan nombre, y conviene decidirlas antes de
tocar ningún DNS:

| Nombre                             | Apunta a                    | Para qué                                  |
| ---------------------------------- | --------------------------- | ----------------------------------------- |
| `www.freshnesstouchcleaning.com`   | Vercel · proyecto `landing` | El sitio público. **Este es el canónico** |
| `freshnesstouchcleaning.com`       | Redirige (308) al `www`     | Lo que teclea la gente sin el `www`       |
| `panel.freshnesstouchcleaning.com` | Vercel · proyecto `admin`   | El panel del equipo                       |
| _(subdominio de envío)_            | Resend · solo registros DNS | Correo saliente. No es una página web     |
| `api.freshnesstouchcleaning.com`   | Render · **opcional**       | La API. Ver apartado 8                    |

**Cuál es el canónico, la raíz o el `www`:** da igual, mientras uno redirija al
otro y no queden los dos sirviendo lo mismo —eso sí penaliza en buscadores—. Al
añadir el dominio, Vercel ofrece marcada la casilla _«Redirect apex domains to
www»_, y con ella el canónico pasa a ser el `www`. Está bien así; lo único que
importa es recordarlo al escribir `CORS_ORIGINS`.

**Por qué el panel en un subdominio y no en `/panel`:** son dos aplicaciones
distintas, en dos proyectos de Vercel distintos, con políticas de seguridad
distintas —el panel prohíbe indexación y bloquea más cosas que el sitio
público—. Un subdominio mantiene esa separación; una ruta obligaría a juntarlos.

---

## 2. La decisión que hay que tomar antes de comprar: ¿vas a tener buzón?

Esto es lo que más gente pasa por alto y lo que peor se arregla después.

**Resend solo ENVÍA.** No recibe. Si un cliente responde a un correo de
confirmación, esa respuesta tiene que llegar a algún sitio, y ese algún sitio es
un buzón de verdad: Google Workspace, Zoho Mail, Fastmail, el que sea.

Tienes tres caminos:

| Opción                                           | Qué pasa cuando un cliente responde                 |
| ------------------------------------------------ | --------------------------------------------------- |
| **Buzón propio** en `freshnesstouchcleaning.com` | Lo recibes. Es lo que quieres a medio plazo         |
| Sin buzón, `EMAIL_REPLY_TO` a tu Gmail actual    | Lo recibes en el Gmail. Funciona, se ve menos serio |
| Sin buzón y sin `EMAIL_REPLY_TO`                 | **La respuesta rebota o se pierde.** Evítalo        |

El proveedor de buzón se queda con los registros **MX** de la raíz del dominio.
Por eso el correo saliente de Resend se configura aparte: para que no choquen.

> No hay prisa por el buzón: puedes empezar con `EMAIL_REPLY_TO` apuntando a un
> correo que ya leas, y montarlo más adelante sin tocar nada de esto.

---

## 3. Dónde vive el DNS: ya está decidido

El dominio se compró **en la propia Vercel**, así que Vercel es a la vez
registrador y servidor de nombres (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`).
Eso quita trabajo:

- **Para la parte web no hay que copiar ningún registro a mano.** Al conectar
  el dominio a un proyecto, Vercel crea y mantiene los registros solo.
- **Todo lo demás también va ahí**: los registros de Resend, el DMARC y, el día
  que lo haya, el buzón. Vercel → Domains → el dominio → **DNS Records**.

> **No añadas a mano un registro `A` apuntando a Vercel.** El formulario de la
> página viene precargado con un ejemplo (`subdomain` / `A` / una IP), y es
> solo eso: un ejemplo. Conectar el proyecto es lo que hay que hacer; un
> registro puesto a mano puede estorbar al que crea Vercel.

### Los registros CAA que ya vienen puestos

El dominio trae tres registros `CAA` (`pki.goog`, `sectigo.com`,
`letsencrypt.org`). Son correctos y **no hay que tocarlos**: dicen qué
autoridades pueden emitir certificados para este dominio, y son justo las que
usa Vercel. Aparecen con un candado porque los gestiona Vercel.

---

## 4. Vercel: los dos dominios

### 4.1. El sitio público

1. Proyecto **`ats-freshness-touch-landing`** → Settings → Domains.
2. Añade `freshnesstouchcleaning.com` **y** `www.freshnesstouchcleaning.com`.
3. Marca el de la raíz como principal; Vercel configura solo la redirección del
   `www` hacia él.
4. Vercel te enseña **los registros DNS exactos** que hay que crear. Cópialos
   tal cual: no los busques en un tutorial, porque esos valores cambian con el
   tiempo y el que manda es el que te muestre tu panel en ese momento.

### 4.2. El panel

1. Proyecto **`ats-freshness-touch-admin`** → Settings → Domains → Add.
2. Escribe **`panel.freshnesstouchcleaning.com`**, el subdominio entero.

> **El error fácil aquí es escribir el dominio raíz.** El cuadro de diálogo es
> idéntico al del sitio público y el buscador autocompleta
> `freshnesstouchcleaning.com`, que ya pertenece al otro proyecto. Un dominio
> solo puede estar conectado a un proyecto a la vez: o Vercel lo rechaza, o te
> lo lleva del sitio público al panel y **tiras el sitio abajo**.
>
> La casilla _«Redirect apex domains to www»_ no pinta nada aquí: solo actúa
> sobre dominios raíz, y `panel.` no lo es. Da igual cómo la dejes.

### 4.3. Los dominios viejos siguen vivos

`ats-freshness-touch-landing.vercel.app` y el del panel **no dejan de
funcionar** al añadir el dominio propio. Eso es bueno durante la transición:
nada se rompe de golpe. Cuando lleves un par de semanas con el dominio nuevo,
quita los viejos de `CORS_ORIGINS` (apartado 6) para reducir la superficie.

---

## 5. Resend: dominio de envío

### 5.1. Dar de alta el dominio

1. Resend → **Domains** → Add Domain.
2. Escribe el dominio y Resend te da una lista de registros DNS.
3. **Mira la lista antes de pegarla.** Si incluye un registro **MX en la raíz**
   (`freshnesstouchcleaning.com`), chocaría con el de tu proveedor de buzón y
   dejarías de recibir correo.
   - Si el MX que te da cuelga de un subdominio suyo, no hay conflicto.
   - Si va a la raíz y tú vas a tener buzón ahí, **da de alta en Resend un
     subdominio de envío** (`send.freshnesstouchcleaning.com`, por ejemplo) en
     vez de la raíz. Entonces el remitente será `algo@send.freshness…`.
4. Crea los registros en tu DNS y pulsa **Verify** en Resend.

La propagación suele tardar minutos, a veces horas. Hasta que Resend no diga
**Verified**, no cambies `EMAIL_PROVIDER` a `resend` en producción.

### 5.2. DMARC: ponlo, aunque Resend no lo exija

SPF y DKIM dicen «este servidor puede enviar en mi nombre». DMARC dice qué
hacer cuando algo no cuadra, y **es lo que más peso tiene hoy** para que Gmail
y Outlook no te manden a la carpeta de no deseado.

Registro TXT en `_dmarc.freshnesstouchcleaning.com`:

```
v=DMARC1; p=none; rua=mailto:dmarc@freshnesstouchcleaning.com
```

`p=none` significa «no rechaces nada todavía, solo infórmame». Es lo correcto
al empezar: primero miras los informes unas semanas, confirmas que todo tu
correo legítimo pasa, y solo entonces subes a `p=quarantine` y luego a
`p=reject`. Poner `p=reject` el primer día es cómo se tira el correo bueno de
uno mismo.

### 5.3. La clave de API

Resend → API Keys → Create. Guárdala **solo** en Render, como
`RESEND_API_KEY`. Nunca en el navegador ni en el repositorio: con ella se puede
enviar correo en nombre de tu dominio.

---

## 6. Variables que hay que cambiar

Esto es lo que el código lee de verdad. Nada más.

### 6.1. Render — la API

| Variable                       | Valor nuevo                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `CORS_ORIGINS`                 | `https://www.freshnesstouchcleaning.com,https://freshnesstouchcleaning.com,https://panel.freshnesstouchcleaning.com` |
| `EMAIL_PROVIDER`               | `resend`                                                                                                             |
| `RESEND_API_KEY`               | `re_...`                                                                                                             |
| `EMAIL_FROM`                   | `Freshness Touch <hola@freshnesstouchcleaning.com>` — el dominio **tiene que ser el verificado en Resend**           |
| `EMAIL_REPLY_TO`               | Un buzón que alguien lea de verdad (ver apartado 2)                                                                  |
| `SUPABASE_INVITE_REDIRECT_URL` | `https://panel.freshnesstouchcleaning.com`                                                                           |

Sobre `CORS_ORIGINS`: separados por coma, **sin barra final**. Los espacios
después de la coma sí se toleran (el código los recorta), pero la barra final
no: `https://ejemplo.com/` y `https://ejemplo.com` son orígenes distintos para
el navegador.

Durante la transición puedes dejar también los `*.vercel.app` en la lista, y
quitarlos cuando estés seguro.

> **La API no arranca** con `EMAIL_PROVIDER=resend` si falta `RESEND_API_KEY` o
> `EMAIL_FROM`. Es deliberado: mejor un fallo al desplegar que enterarte por un
> cliente que no recibió su confirmación.

### 6.2. Vercel — sitio público

| Variable         | Valor nuevo                                |
| ---------------- | ------------------------------------------ |
| `VITE_ADMIN_URL` | `https://panel.freshnesstouchcleaning.com` |

`VITE_API_BASE_URL` no cambia (la API se queda donde está).

### 6.3. Vercel — panel

Ninguna cambia, salvo que muevas la API (apartado 8).

### 6.4. Supabase — esto es lo que rompe las invitaciones

Authentication → **URL Configuration**:

| Campo             | Valor                                               |
| ----------------- | --------------------------------------------------- |
| **Site URL**      | `https://panel.freshnesstouchcleaning.com`          |
| **Redirect URLs** | Añade `https://panel.freshnesstouchcleaning.com/**` |

Si no lo haces, los enlaces de invitación y de recuperación de contraseña
llevarán al dominio viejo o serán rechazados por no estar en la lista blanca.
El correo se enviará igual, y el fallo solo aparecerá cuando alguien pulse el
enlace: es de los que se descubren tarde.

---

## 7. El paso que más se olvida: volver a desplegar

Las variables que empiezan por `VITE_` **se incrustan al construir**, no se leen
al ejecutar. Guardarlas en Vercel no cambia nada por sí solo: el despliegue que
ya está publicado sigue con los valores viejos hasta que se reconstruya.

Después de tocar cualquier `VITE_*`:

> Vercel → proyecto → Deployments → el último → **Redeploy**

Las de Render (`CORS_ORIGINS`, `EMAIL_*`, `SUPABASE_*`) sí se leen al arrancar:
Render reinicia el servicio solo al guardarlas.

Esta diferencia ya nos costó un despiste: la puerta de servicio del logotipo no
llevaba al panel porque `VITE_ADMIN_URL` no estaba en el momento de construir.
El síntoma era que el logotipo abría una pestaña en `/#top`.

---

## 8. Mover la API a `api.freshnesstouchcleaning.com` (opcional)

**Recomendación: no lo hagas todavía.** La dirección de la API solo la ve quien
abre las herramientas de desarrollo; el beneficio es estético y el coste es
real:

1. Dominio propio en Render (confirma que tu plan lo permite).
2. Registro DNS.
3. Editar **dos archivos del repositorio**, porque la dirección está escrita en
   las políticas de seguridad:
   - `apps/landing/vercel.json` → `connect-src`
   - `apps/admin/vercel.json` → `connect-src`
4. Cambiar `VITE_API_BASE_URL` en los dos proyectos de Vercel.
5. Volver a desplegar los dos.

Si te saltas el paso 3, **el navegador bloquea todas las llamadas** y el panel
deja de funcionar aunque todo lo demás esté bien. Cuando quieras hacerlo, es
una etapa pequeña y la preparo entera.

---

## 9. Orden recomendado

1. Comprar el dominio.
2. Decidir dónde vive el DNS (apartado 3).
3. Añadir los dominios en los dos proyectos de Vercel y crear sus registros.
4. Esperar a que Vercel los dé por válidos y el certificado esté emitido.
5. Dar de alta el dominio en Resend y crear sus registros. Esperar a
   **Verified**.
6. Añadir el DMARC.
7. Cambiar las variables de Render (apartado 6.1).
8. Cambiar `VITE_ADMIN_URL` en Vercel y **volver a desplegar el sitio público**.
9. Cambiar las URLs de Supabase (apartado 6.4).
10. Comprobar (apartado 10).
11. Desde el panel → Configuración, poner el correo público nuevo para que
    aparezca en el sitio.

Los pasos 3 a 6 se pueden hacer en paralelo: ninguno depende del otro.

---

## 10. Cómo comprobar que ha quedado bien

Hazlo en este orden; cada punto descarta una causa distinta.

| #   | Qué haces                                                       | Qué tiene que pasar                                                           |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Abrir `https://freshnesstouchcleaning.com`                      | El sitio, con candado y sin aviso de certificado                              |
| 2   | Abrir `https://www.freshnesstouchcleaning.com`                  | Redirige al de la raíz                                                        |
| 3   | Abrir `https://panel.freshnesstouchcleaning.com`                | La pantalla de acceso                                                         |
| 4   | Iniciar sesión en el panel                                      | Entra. Si falla, mira la consola: un error de CORS señala a `CORS_ORIGINS`    |
| 5   | En el sitio, `Ctrl`+`Shift`+clic en el logotipo                 | Lleva al panel. Si abre `/#top`, falta `VITE_ADMIN_URL` **o el redespliegue** |
| 6   | Panel → Configuración → Personal → invitar a una dirección tuya | Llega el correo, y su enlace lleva al **dominio nuevo** del panel             |
| 7   | En ese correo (Gmail): ⋮ → **Mostrar original**                 | `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`                                      |
| 8   | Responder a un correo de confirmación                           | Llega a donde apunta `EMAIL_REPLY_TO`                                         |
| 9   | Hacer una reserva de prueba                                     | Llega la confirmación al cliente, sin caer en no deseado                      |

El punto 7 es el que de verdad dice si el correo va a llegar. Los tres en `PASS`
es el objetivo; uno solo en `FAIL` basta para acabar en no deseado.

---

## 11. Lo que puede salir mal, y a qué se parece

| Síntoma                                                     | Causa casi segura                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| El logotipo abre una pestaña en `/#top`                     | `VITE_ADMIN_URL` sin poner, o puesta pero **sin volver a desplegar** |
| El panel carga pero no trae datos; error de CORS en consola | Falta el dominio del panel en `CORS_ORIGINS`                         |
| El enlace de invitación lleva al dominio viejo              | `SUPABASE_INVITE_REDIRECT_URL` sin actualizar                        |
| El enlace de invitación da «redirect URL no permitida»      | Falta en la lista de **Redirect URLs** de Supabase                   |
| Los correos llegan a no deseado                             | Dominio sin verificar en Resend, o falta DMARC                       |
| La API no arranca tras tocar el correo                      | `EMAIL_PROVIDER=resend` sin `RESEND_API_KEY` o sin `EMAIL_FROM`      |
| Dejas de recibir correo en tu buzón                         | Un registro **MX** de Resend pisó el del proveedor de buzón          |
| El certificado no se emite                                  | Los registros DNS aún no han propagado, o hay un CAA que lo impide   |

---

## 12. Qué NO hay que hacer

- **No pongas la clave de Resend en el navegador.** Solo en Render. Con ella se
  envía correo en nombre de tu dominio.
- **No pongas `p=reject` en el DMARC el primer día.** Empieza en `p=none`.
- **No borres los dominios `.vercel.app`** hasta tener el nuevo funcionando: son
  la vía de vuelta si algo sale mal.
- **No uses un `noreply@`** como `EMAIL_REPLY_TO`. Un cliente que responde y no
  recibe nada es un cliente que cree que no le atiendes.
- **No metas comodines en `CORS_ORIGINS`.** La lista explícita es lo que impide
  que otro sitio hable con tu API desde el navegador de tus clientes.

---

## 13. Lo que esta guía no puede decirte

Los **valores concretos** de los registros DNS de Vercel y de Resend salen de
sus propios paneles en el momento en que añades el dominio, y cambian con el
tiempo. Copia siempre los que te muestren ellos, no los de un tutorial —ni los
de esta guía, que a propósito no los lleva.
