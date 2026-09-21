import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_BUSINESS_SETTINGS,
  emailHref,
  formatPhone,
  phoneHref,
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
 *   3. SIN TELEFONO NO HAY BOTON DE LLAMAR. Un enlace `tel:` vacio abre la
 *      aplicacion del telefono sin numero, que parece una web rota.
 */

/** Lo que necesita la interfaz, ya listo para pintar. */
export interface BusinessContact {
  settings: BusinessSettings;
  /** Numero legible, o `null` si no hay ninguno configurado. */
  phoneDisplay: string | null;
  /** Enlace `tel:`, o `null`. */
  phoneHref: string | null;
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
  phoneHref: null,
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
      phoneDisplay: formatPhone(settings.phone),
      phoneHref: phoneHref(settings.phone),
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
