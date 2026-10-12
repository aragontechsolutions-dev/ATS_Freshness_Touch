import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_BUSINESS_SETTINGS,
  emailHref,
  formatPhone,
  whatsappHref,
  whatsappNumber,
  type BusinessSettings,
} from '@freshness/types';
import { fetchBusinessSettings } from '../lib/api';

/**
 * DATOS DE CONTACTO EN VIVO
 * -------------------------
 * Telefono, correo y horario se leen de la API al abrir la pagina, no se
 * incrustan al compilar. Asi la empresa corrige su telefono desde el panel y
 * la web lo refleja sin desplegar nada.
 *
 * TRES REGLAS QUE NO SE NEGOCIAN:
 *
 *   1. SI LA API NO RESPONDE, LA PAGINA NO SE ROMPE. Se parte del horario de
 *      partida y sin telefono, y la pagina se pinta entera igual. Esta es la
 *      pagina que genera los ingresos: que no cargue por no saber un numero
 *      de telefono seria absurdo.
 *
 *   2. MIENTRAS SE CARGA NO SE ENSENA UN TELEFONO EQUIVOCADO. Se ensena
 *      ninguno. Un numero de relleno que dura dos segundos es tiempo
 *      suficiente para que alguien lo marque.
 *
 *   3. SIN NUMERO NO HAY BOTON. Un enlace vacio abre WhatsApp sin
 *      destinatario, que parece una web rota.
 *
 * DESDE LA ETAPA 3.16 SE ESCRIBE, NO SE LLAMA. Todos los botones de contacto
 * del sitio abren WhatsApp en vez del marcador del telefono. El motivo es de
 * negocio: un enlace `tel:` en un ordenador abre Skype o nada, de noche nadie
 * llama, y sobre todo NO DEJA RASTRO —un cliente que no llama es un cliente
 * del que nunca te enteraste—. Por WhatsApp puede escribir, mandar un audio o
 * llamar igual, y queda la conversacion.
 */

/** Lo que necesita la interfaz, ya listo para pintar. */
export interface BusinessContact {
  settings: BusinessSettings;
  /** Numero legible por el que se escribe, o `null` si no hay ninguno. */
  phoneDisplay: string | null;
  /**
   * Enlace de WhatsApp, o `null` si no hay numero.
   *
   * ES UNA FUNCION Y NO UNA CADENA porque cada boton manda un mensaje
   * distinto: el del cotizador lejano lleva dentro el codigo postal y los
   * pies cuadrados, y los demas un saludo. Sin el mensaje, el cliente llega
   * a un chat vacio y la empresa no sabe de que le hablan.
   */
  whatsappHref: (message?: string) => string | null;
  email: string | null;
  /** Enlace `mailto:`, o `null`. */
  emailHref: string | null;
}

/**
 * Estado inicial: el horario de partida y SIN datos de contacto.
 *
 * Es tambien lo que se sirve si la API falla, y por eso no lleva telefono:
 * es preferible una web sin telefono a una web con un telefono que no es.
 */
const INICIAL: BusinessContact = {
  settings: DEFAULT_BUSINESS_SETTINGS,
  phoneDisplay: null,
  whatsappHref: () => null,
  email: null,
  emailHref: null,
};

const BusinessContext = createContext<BusinessContact>(INICIAL);

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchBusinessSettings(controller.signal)
      .then(setSettings)
      .catch(() => {
        /*
         * Se traga a proposito. Un fallo aqui no es un error que el visitante
         * pueda resolver ni deba ver: la pagina sigue funcionando con los
         * valores de partida. El cliente de API ya deja el detalle en la
         * consola para quien tenga que diagnosticarlo.
         */
      });

    return () => controller.abort();
  }, []);

  const valor = useMemo<BusinessContact>(() => {
    if (settings === null) return INICIAL;

    return {
      settings,
      /*
       * SE ENSENA EL NUMERO POR EL QUE SE ESCRIBE, no el telefono fijo. Si
       * la empresa configura un WhatsApp distinto, pintar el otro numero
       * seria el fallo que el contrato evita: ensenar uno y escribir a otro.
       */
      phoneDisplay: formatPhone(whatsappNumber(settings)),
      whatsappHref: (message?: string) => whatsappHref(settings, message),
      email: settings.email,
      emailHref: emailHref(settings.email),
    };
  }, [settings]);

  return <BusinessContext.Provider value={valor}>{children}</BusinessContext.Provider>;
}

/** Datos de contacto de la empresa, listos para pintar. */
export function useBusinessContact(): BusinessContact {
  return useContext(BusinessContext);
}
