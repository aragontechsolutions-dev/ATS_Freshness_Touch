# 18 — Acceso al panel y recuperación de contraseña

Cómo entra por primera vez alguien del personal, qué pasa cuando pierde la
contraseña, y por qué el camino de recuperación se reescribió entero.

> **Esta etapa nace de un incidente, no de una idea.** Una persona del
> personal estuvo días sin poder entrar. Se le reenvió la invitación varias
> veces y siempre le decía lo mismo: «este enlace ya no vale». La salida que
> le ofrecíamos —«¿Has olvidado tu contraseña?»— **no podía funcionar**, y
> la causa no estaba a la vista en ninguna pantalla.

---

## 1. Los dos caminos, y en qué se diferencian de verdad

|                        | **Invitación**                 | **Recuperación**                      |
| ---------------------- | ------------------------------ | ------------------------------------- |
| Quién lo arranca       | Administración, desde el panel | La propia persona, desde el acceso    |
| Cuándo                 | Al dar acceso por primera vez  | Cuando perdió la contraseña           |
| Quién genera el enlace | **El servidor**                | **El servidor** (antes: el navegador) |
| Cómo vuelve            | Tokens en el fragmento         | Tokens en el fragmento                |
| Dónde termina          | Pantalla de elegir contraseña  | La misma pantalla                     |

La fila que importa es la tercera, y hasta esta etapa **no eran iguales**.

---

## 2. El fallo: por qué la recuperación no podía funcionar

El panel llamaba a `resetPasswordForEmail` de la librería de Supabase. Ese
camino usa **PKCE**, que funciona así:

1. El navegador inventa un _verificador_ y lo guarda.
2. Manda al servidor solo su huella.
3. Cuando vuelve el enlace, entrega el verificador para demostrar que es el
   mismo navegador que lo pidió.

Es un buen mecanismo, **y es el equivocado aquí**. La razón está en dónde se
guarda ese verificador: la librería usa **un solo almacén** para la sesión y
para el verificador, y en este panel ese almacén es `sessionStorage`. Esto
último es deliberado y está bien razonado —en un ordenador compartido de
oficina, `localStorage` dejaría la sesión viva para la siguiente persona—,
pero tiene una consecuencia que nadie ató:

> **`sessionStorage` muere con la pestaña y no se comparte entre pestañas.**

Y entonces:

| Paso | Qué pasa                                                          |
| ---- | ----------------------------------------------------------------- |
| 1    | Pide el enlace en la pestaña A → el verificador se guarda **ahí** |
| 2    | Se va al correo y pulsa el enlace                                 |
| 3    | **Se abre una pestaña nueva.** En el móvil, siempre               |
| 4    | Pestaña nueva = `sessionStorage` vacío → el verificador no está   |
| 5    | El canje falla y la pantalla dice «enlace caducado»               |

El enlace estaba recién generado. **El mensaje era verdad para la pantalla y
mentira para la persona**, y ese es el peor tipo de error: manda a pedir otro
enlace para repetir exactamente el mismo fallo.

Dónde está esto en la librería, comprobado y no recordado:

| Archivo                | Qué hace                                                      |
| ---------------------- | ------------------------------------------------------------- |
| `helpers.js:388`       | `getCodeChallengeAndMethod(storage, …)` guarda el verificador |
| `GoTrueClient.js:1622` | `retrievePKCEVerifier(this.storage, …)` lo recupera           |
| `GoTrueClient.js:3758` | `resetPasswordForEmail` lo crea si `flowType === 'pkce'`      |

---

## 3. La solución: el enlace lo genera el servidor

Un enlace pedido desde el servidor con `generate_link` **no lleva PKCE**: no
hay verificador porque ningún navegador participó en pedirlo. Vuelve con la
sesión en el **fragmento** de la dirección, exactamente igual que el de
invitación, y por eso funciona se abra donde se abra.

Es la misma decisión que ya se había tomado para las invitaciones en la etapa
2.10; lo que faltaba era aplicarla también aquí.

```
Pantalla de acceso  →  POST /api/v1/password-recovery  →  generate_link
                                                              ↓
                       Resend, con NUESTRA plantilla  ←  enlace de un solo uso
```

### Se intenta recuperación y, si falla, invitación

No son intercambiables: `recovery` es para una cuenta que ya confirmó su
correo, e `invite` para una que todavía no. Y **las dos situaciones llegan
por la misma pantalla**:

- Quien lleva un año entrando y olvidó la contraseña → `recovery`.
- Quien nunca llegó a abrir su invitación porque se le caducó → **`recovery`
  falla**, y sin red de seguridad esa persona se queda sin salida. Es
  literalmente el caso del incidente.

Se prueba `recovery` primero porque es lo que la persona pidió; `invite` es
la red. El texto del correo sigue **al tipo de enlace que se pudo generar**,
no a lo que se pidió: a quien nunca tuvo contraseña, «elige una nueva» le
suena raro.

### Lo que se ganó de paso

|                   | Antes                                                                                     | Ahora                                 |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------------- |
| Remitente         | «Supabase Auth»                                                                           | El de la empresa                      |
| Idioma            | Inglés, uno solo                                                                          | El de la persona                      |
| Plantilla         | Panel del proveedor                                                                       | En el repositorio, revisada y probada |
| Servicio de envío | El de Supabase, **limitado por hora y no apto para producción según el propio proveedor** | Resend                                |

---

## 4. Las tres guardias del endpoint público

Es público, y **tiene que serlo**: quien no puede entrar no tiene sesión con
la que pedir nada. Eso lo convierte en uno de los dos únicos sitios de la API
donde alguien sin credenciales provoca un correo.

### 4.1 La respuesta es siempre la misma

**202, sin cuerpo, exista o no la cuenta.** Cubre tres casos que por dentro
son distintos y por fuera tienen que ser idénticos:

- el correo no existe,
- la persona causó baja,
- nunca se la llegó a invitar.

Distinguirlos convertiría la pantalla de acceso en un directorio de la
plantilla: con cuatro apellidos de un pueblo se saca quién trabaja aquí, y
con eso se sabe a quién suplantar.

La garantía no es un acuerdo: **el servicio devuelve `void`**. Si devolviera
un resultado, tarde o temprano alguien lo pintaría.

### 4.2 Se responde sin esperar

Esto no es un atajo de rendimiento, **es la misma guardia**. Si se esperara,
el tiempo de respuesta contaría lo que el cuerpo calla: para un correo que no
existe se vuelve tras una consulta, y para uno que sí, tras hablar con el
proveedor de identidad y con el de correo. Son cientos de milisegundos,
medibles con un cronómetro.

Se puede hacer porque el servicio **no lanza nunca** —lo garantiza su propio
`try/catch`— y porque su resultado no le importa a nadie.

### 4.3 El límite es por IP

**Cinco cada cuarto de hora.** Cada petición manda un correo a una persona
real: sin tope, esta API es una forma gratuita de inundar un buzón ajeno y de
gastar la cuota de envío de la empresa por el camino.

Se cuenta **por IP y no por correo** a propósito: por correo, una sola
conexión podría recorrer la plantilla entera a razón de cinco correos por
persona.

Va como **override de ruta** (`@Throttle`) y no como limitador con nombre.
El motivo está en `common/throttling.ts`: un limitador con nombre se aplica a
**toda** la API, así que habría obligado a eximirlo en cada controlador que
existe y en cada uno que se escriba mañana. Un override solo puede afectar a
su ruta.

### Y una cuarta: el destino no viaja en la petición

El contrato **ni siquiera admite el campo**. Si lo eligiera quien llama,
cualquiera podría pedir un enlace para el correo de otra persona apuntando a
un sitio propio: llegaría a su buzón legítimo y, al abrirlo, entregaría la
sesión. Es el fallo clásico de redirección abierta, y aquí costaría el panel
entero.

---

## 5. A qué correo se manda

Al **de la cuenta** (`authEmail`), no al de contacto, cuando se sabe y son
distintos. Es la misma lección que dejó el reenvío de invitaciones: la cuenta
responde a su propio correo.

Pero **se busca por los dos**, insensible a mayúsculas. Tras editar el correo
de contacto en el panel, la cuenta sigue respondiendo al antiguo: buscar solo
por uno dejaría fuera justo a quien más probablemente está perdida.

---

## 6. La red de seguridad del verificador

Con la recuperación ya no dependemos de PKCE, pero el reparto del almacén se
arregló igualmente en `apps/admin/src/lib/supabase.ts`:

| Qué se guarda                         | Dónde            | Por qué                                       |
| ------------------------------------- | ---------------- | --------------------------------------------- |
| La sesión                             | `sessionStorage` | Muere con la pestaña: ordenadores compartidos |
| Claves que acaban en `-code-verifier` | `localStorage`   | Tienen que existir en la pestaña nueva        |

**Qué se acepta a cambio.** El verificador queda en `localStorage` hasta que
se canjea. Por sí solo **no vale nada**: hace falta además el código que
llega al correo de esa persona, y quien tenga acceso a ese correo ya no
necesita esto. Es un riesgo incomparablemente menor que guardar ahí la
sesión, que es lo que seguimos sin hacer.

Si mañana alguien vuelve a usar un camino con PKCE, funcionará en vez de
fallar de una forma que nadie sabría diagnosticar.

---

## 7. La auditoría

Se registra `staff.recovery_sent`, y **solo cuando el correo sale de verdad**.

Registrar también los intentos fallidos convertiría este registro en la lista
ordenada por hora de las direcciones que alguien ha ido probando, **dentro de
la propia herramienta que existe para detectar eso**.

No se guarda el enlace, ni recortado: es una credencial de un solo uso y
quien leyera esa fila entraría en lugar de su dueña.

---

## 8. Qué se comprueba

Doce pruebas nuevas contra PostgreSQL real y un proveedor de identidad
simulado que **distingue los dos tipos de enlace** —si aceptara los dos
siempre, la rama de la red de seguridad no se probaría nunca—.

Lo que más importa de todas ellas:

```ts
expect(correo.sent[0]?.text).toContain('#access_token=');
expect(correo.sent[0]?.text).not.toContain('?code=');
```

**Es la comprobación que habría evitado el incidente.** Un enlace con `?code=`
exige un verificador guardado en el navegador que lo pidió; uno con
`#access_token=` no exige nada.

Además: que la respuesta sea idéntica para un correo que no existe, para
quien causó baja y para quien nunca fue invitada; que el límite corte a la
sexta; que el contrato rechace un `redirectTo` inyectado; que se encuentre a
quien cambió su correo de contacto; y que la auditoría no deje fila cuando no
hubo envío.

En el panel, cinco pruebas más sobre el reparto del almacén: ese reparto es
invisible mirando las pantallas, y volver a romperlo **no daría ningún
error**. Simplemente, nadie podría recuperar su contraseña.

---

## 9. Cómo desbloquear a alguien a mano

Cuando todo lo anterior no basta —el correo no llega, un escáner de seguridad
del buzón consume el enlace antes que su destinataria, la persona no tiene
acceso a su correo—, el enlace se puede generar y entregar en mano:

```bash
# La clave de servicio NUNCA se escribe en un chat ni en un fichero del repo.
export SRK='...'   # SUPABASE_SERVICE_ROLE_KEY, copiada de Render

curl -X POST \
  "https://<ref>.supabase.co/auth/v1/admin/generate_link?redirect_to=<URL del panel>" \
  -H "apikey: $SRK" -H "Authorization: Bearer $SRK" \
  -H "Content-Type: application/json" \
  -d '{"type":"invite","email":"persona@example.com"}'
```

El enlace está en `properties.action_link`.

**Tres avisos:**

1. **Es una credencial.** Quien lo abra entra como esa persona. Va por un
   canal privado, avisando antes, y se abre en ese momento. Se gasta al
   primer uso.
2. La URL del panel tiene que estar en **Supabase → Authentication → URL
   Configuration → Redirect URLs**. Si no, se ignora el `redirect_to`.
3. Se usa `invite` y no `recovery` porque funciona en los dos casos: sobre un
   correo que ya existe devuelve la cuenta existente con un enlace nuevo.

---

## 10. Los correos de Supabase ya no se usan

Tras esta etapa, **ninguna de las seis plantillas del panel de Supabase
dispara**:

| Plantilla            | Por qué no se usa                                  |
| -------------------- | -------------------------------------------------- |
| Confirm signup       | Las cuentas las crea la API de administración      |
| Invite user          | Mandamos nuestro correo con el enlace              |
| Magic link / OTP     | No hay acceso por enlace mágico                    |
| Change email address | El correo de la cuenta no se cambia desde el panel |
| **Reset password**   | **Era la única que quedaba. Ya no**                |
| Reauthentication     | No se usa                                          |

No hace falta maquillarlas: no las ve nadie. Los correos que sí se mandan
están en `apps/api/src/notifications/templates/` y se describen en
**`docs/19-diseno-de-los-correos.md`**.
