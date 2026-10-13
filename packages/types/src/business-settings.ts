import { z } from 'zod';

/**
 * CONFIGURACION DEL NEGOCIO
 * -------------------------
 * Los datos que la empresa cambia sola, sin tocar codigo ni desplegar:
 * telefono, correo y horario comercial.
 *
 * Tres decisiones gobiernan este contrato:
 *
 *   1. EL TELEFONO SE GUARDA UNA SOLA VEZ, en formato internacional. De ahi
 *      se derivan lo que se ve y lo que se marca. Guardar los dos por
 *      separado invita al fallo mas caro posible: que el sitio ENSENE un
 *      numero y MARQUE otro porque alguien edito uno y olvido el otro.
 *
 *   2. NO HAY VALORES DE RELLENO. Un telefono sin configurar es `null`, no
 *      "+1 (000) 000-0000". El sitio esconde el enlace en vez de publicar un
 *      numero inventado: no dar telefono es molesto, dar uno falso destruye
 *      la confianza y puede acabar en el telefono de un tercero.
 *
 *   3. EL HORARIO ES DATO, NO TEXTO TRADUCIDO. La frase "lunes a sabado de
 *      8:00 a 18:00" se compone en pantalla a partir de las horas reales.
 *      Si fuera un texto suelto, al cambiar el horario habria que acordarse
 *      de reescribirlo en cada idioma, y el sitio acabaria anunciando un
 *      horario distinto del que de verdad acepta reservas.
 */

/**
 * Telefono en formato internacional E.164: un mas y de 8 a 15 digitos.
 *
 * Ademas de validar, esto CIERRA UNA PUERTA: el valor acaba dentro de un
 * enlace `tel:`. Si se admitiera texto libre, alguien con acceso al panel
 * podria guardar `javascript:...` y convertir el boton de llamar de todo el
 * sitio en un ataque contra quien lo pulse. Al exigir que empiece por `+` y
 * siga con digitos, no existe forma de colar otro esquema.
 */
export const PhoneE164Schema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    'El telefono debe ir en formato internacional, por ejemplo +14045550123',
  );

/**
 * Hora local en formato de 24 horas.
 *
 * Se valida el rango real (no basta `\d{2}:\d{2}`): "25:70" tiene la forma
 * correcta y generaria una agenda imposible.
 */
export const LocalTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'La hora debe ir en formato HH:MM de 24 horas');

/** Minutos desde medianoche. Sirve para comparar horas sin lidiar con fechas. */
export function minutesOfDay(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/**
 * Horario de un dia. Un dia cerrado se representa con `null`, no con
 * `{ open: '00:00', close: '00:00' }`: un intervalo vacio se colaria por
 * cualquier comprobacion y el dia parecerian abierto cero minutos.
 */
export const BusinessHoursSchema = z
  .strictObject({
    /** Hora de apertura, local. */
    open: LocalTimeSchema,
    /** Hora de cierre. El trabajo debe TERMINAR antes de esta hora. */
    close: LocalTimeSchema,
  })
  .refine((hours) => minutesOfDay(hours.open) < minutesOfDay(hours.close), {
    message: 'La hora de cierre debe ser posterior a la de apertura',
    path: ['close'],
  });
export type BusinessHours = z.infer<typeof BusinessHoursSchema>;

/** Dias de la semana segun ISO-8601: 1 = lunes ... 7 = domingo. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/**
 * Horario semanal completo. Los siete dias son obligatorios: si un dia
 * pudiera faltar, "cerrado" y "sin configurar" serian indistinguibles, y el
 * motor de agenda tendria que adivinar cual de las dos cosas es.
 */
export const WeeklyHoursSchema = z.strictObject({
  1: BusinessHoursSchema.nullable(),
  2: BusinessHoursSchema.nullable(),
  3: BusinessHoursSchema.nullable(),
  4: BusinessHoursSchema.nullable(),
  5: BusinessHoursSchema.nullable(),
  6: BusinessHoursSchema.nullable(),
  7: BusinessHoursSchema.nullable(),
});
export type WeeklyHours = z.infer<typeof WeeklyHoursSchema>;

/**
 * La configuracion completa, tal y como se guarda y se edita.
 *
 * El telefono y el correo son opcionales porque al arrancar el proyecto no
 * estan; el horario no, porque sin horario no hay agenda que ofrecer.
 */
export const BusinessSettingsSchema = z.strictObject({
  phone: PhoneE164Schema.nullable(),
  /**
   * EL NUMERO DE WHATSAPP, cuando no es el mismo que el telefono.
   *
   * ======================================================================
   * EL `.default(null)` NO ES UN ADORNO (etapa 3.16)
   * ======================================================================
   * Esto es un `strictObject`, y la fila guardada se valida contra el al
   * leerla. Un campo nuevo sin valor por defecto deja invalida la fila que
   * ya existe, y entonces `business-settings.service.ts` devuelve
   * `DEFAULT_BUSINESS_SETTINGS`, que lleva `phone: null`.
   *
   * Es decir: EL TELEFONO DESAPARECERIA DE TODA LA WEB —cabecera, barra
   * del movil, contacto, cotizador— sin un solo error en ninguna pantalla.
   * Es la misma caida muda que costo diez dias con los precios.
   *
   * VACIO SIGNIFICA «EL MISMO TELEFONO», y por eso es opcional en vez de
   * obligatorio. La regla 1 de este archivo dice que el numero se guarda
   * UNA sola vez para que el sitio no pueda ensenar uno y marcar otro; un
   * segundo campo obligatorio seria exactamente eso. Asi, por defecto hay
   * un solo numero, y el campo existe solo para el caso real de que el
   * WhatsApp del negocio sea una linea distinta.
   */
  whatsapp: PhoneE164Schema.nullable().default(null),
  email: z.string().trim().toLowerCase().email().max(160).nullable(),
  hours: WeeklyHoursSchema,
});
export type BusinessSettings = z.infer<typeof BusinessSettingsSchema>;
export type BusinessSettingsInput = z.input<typeof BusinessSettingsSchema>;

/**
 * Horario de partida, el mismo que estaba escrito en el codigo antes de que
 * esto fuera editable. Se conserva para que una instalacion nueva funcione
 * desde el primer minuto en vez de nacer sin agenda.
 */
export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  phone: null,
  whatsapp: null,
  email: null,
  hours: {
    1: { open: '08:00', close: '18:00' },
    2: { open: '08:00', close: '18:00' },
    3: { open: '08:00', close: '18:00' },
    4: { open: '08:00', close: '18:00' },
    5: { open: '08:00', close: '18:00' },
    6: { open: '09:00', close: '16:00' },
    7: null,
  },
};

// ---------------------------------------------------------------------------
// Derivados para mostrar
// ---------------------------------------------------------------------------

/** Enlace para escribir. Mismo criterio que el telefono. */
export function emailHref(email: string | null): string | null {
  return email === null ? null : `mailto:${email}`;
}

/** Lo minimo que hace falta para construir un enlace de WhatsApp. */
export type WhatsAppNumbers = Pick<BusinessSettings, 'whatsapp' | 'phone'>;

/**
 * El numero por el que se escribe: el de WhatsApp si lo hay, y si no el
 * telefono. `null` cuando no hay ninguno.
 *
 * Existe aparte del enlace porque el panel necesita poder DECIR cual se va a
 * usar. Un campo vacio que silenciosamente usa otro numero es util hasta el
 * dia que alguien se pregunta por que los mensajes llegan a otro sitio.
 */
export function whatsappNumber(settings: WhatsAppNumbers): string | null {
  return settings.whatsapp ?? settings.phone;
}

/**
 * Enlace para escribir por WhatsApp, con el mensaje ya redactado.
 *
 * ==========================================================================
 * POR QUE `wa.me` Y NO UN ENLACE `whatsapp://`
 * ==========================================================================
 * `wa.me` es el enlace oficial y resuelve solo segun el dispositivo: abre la
 * aplicacion si esta instalada, la tienda si no, y `web.whatsapp.com` en un
 * ordenador. Un esquema `whatsapp://` no hace nada en un navegador sin la
 * aplicacion, que es justo donde mas gente se queda sin poder escribir.
 *
 * EL NUMERO VA SIN SIGNOS, que es lo que exige `wa.me`. Los digitos se sacan
 * de una cadena que YA paso `PhoneE164Schema`, asi que no hay forma de colar
 * otro esquema en el enlace: lo que queda despues de quitar lo que no es un
 * digito solo pueden ser digitos.
 */
export function whatsappHref(settings: WhatsAppNumbers, message?: string): string | null {
  const numero = whatsappNumber(settings);
  if (numero === null) return null;

  const digitos = numero.replace(/\D/g, '');
  const texto = message !== undefined && message.trim() !== '' ? message.trim() : null;

  return texto === null
    ? `https://wa.me/${digitos}`
    : `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

/**
 * Telefono legible.
 *
 * Los numeros de Estados Unidos y Canada (prefijo +1, diez digitos) se
 * presentan como `+1 (404) 555-0123`, que es como los lee un cliente de
 * Georgia. Cualquier otro pais se deja en formato internacional tal cual:
 * inventar un formato para un pais que no conocemos saldria mal.
 */
export function formatPhone(phone: string | null): string | null {
  if (phone === null) return null;

  const norteamerica = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return norteamerica ? `+1 (${norteamerica[1]}) ${norteamerica[2]}-${norteamerica[3]}` : phone;
}

/**
 * Quita todo lo que no sea digito o el mas inicial.
 *
 * Existe por comodidad de quien rellena el formulario: la gente escribe
 * "(404) 555-0123" porque asi ve el numero a diario. Sin esta ayuda el campo
 * rechazaria la forma natural de escribirlo y obligaria a aprenderse E.164.
 *
 * NO es la validacion: lo que salga de aqui pasa igualmente por
 * `PhoneE164Schema`. Normalizar y validar son cosas distintas, y confundirlas
 * es como se cuelan valores que "parecian limpios".
 */
export function normalizePhoneInput(raw: string): string {
  const limpio = raw.trim().replace(/[^\d+]/g, '');
  const soloDigitos = limpio.replace(/\+/g, '');

  if (limpio.startsWith('+')) return `+${soloDigitos}`;
  // Diez digitos sin prefijo es un numero de Estados Unidos escrito como se
  // escribe alli. Es la unica suposicion que hacemos, y solo con ese largo.
  if (soloDigitos.length === 10) return `+1${soloDigitos}`;
  return soloDigitos.length > 0 ? `+${soloDigitos}` : '';
}

/** Un tramo de dias seguidos que comparten horario. */
export interface HoursRange {
  /** Primer dia del tramo (ISO: 1 = lunes). */
  from: Weekday;
  /** Ultimo dia del tramo. Igual a `from` cuando el tramo es de un solo dia. */
  to: Weekday;
  /** `null` cuando el tramo esta cerrado. */
  hours: BusinessHours | null;
}

/**
 * Agrupa dias seguidos con el mismo horario.
 *
 * Sin esto, la seccion de contacto tendria siete lineas casi identicas. Con
 * esto dice "lunes a viernes 8:00-18:00 / sabado 9:00-16:00 / domingo
 * cerrado", que es como lo diria una persona.
 */
export function groupWeeklyHours(hours: WeeklyHours): HoursRange[] {
  const ranges: HoursRange[] = [];

  for (const day of WEEKDAYS) {
    const today = hours[day];
    const last = ranges.at(-1);

    if (last && sameHours(last.hours, today)) {
      last.to = day;
    } else {
      ranges.push({ from: day, to: day, hours: today });
    }
  }

  return ranges;
}

function sameHours(a: BusinessHours | null, b: BusinessHours | null): boolean {
  if (a === null || b === null) return a === b;
  return a.open === b.open && a.close === b.close;
}

/**
 * Formatea una hora local para mostrar, segun el idioma.
 *
 * En ingles se espera "8:00 AM"; en espanol, "8:00". Se usa el formateador
 * del navegador en vez de componer el texto a mano porque las reglas de cada
 * idioma no son adivinables.
 */
export function formatLocalTime(time: string, locale: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const fecha = new Date(Date.UTC(2000, 0, 1, hour ?? 0, minute ?? 0));

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(fecha);
}

// ---------------------------------------------------------------------------
// Vista del panel
// ---------------------------------------------------------------------------

/**
 * La configuracion mas quien la toco por ultima vez.
 *
 * Esto NO sale por el endpoint publico: al visitante le interesa el telefono,
 * no quien lo puso. Se ensena dentro del panel porque responde sola a la
 * pregunta que siempre llega tarde y mal —"¿quien ha cambiado esto?"— sin
 * tener que ir a buscar el registro de auditoria.
 */
export const AdminBusinessSettingsSchema = z.strictObject({
  settings: BusinessSettingsSchema,
  /** Fecha del ultimo cambio en ISO-8601, o `null` si nunca se ha guardado. */
  updatedAt: z.string().nullable(),
  /** Nombre de quien lo cambio. `null` si esa persona ya no esta en la tabla. */
  updatedBy: z.string().nullable(),
});
export type AdminBusinessSettings = z.infer<typeof AdminBusinessSettingsSchema>;
