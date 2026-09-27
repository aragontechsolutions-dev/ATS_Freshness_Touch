import type { AddOnCode, AddOnUnit, Frequency, ServiceType, ServiceZone } from '@freshness/types';

/**
 * CONFIGURACION COMERCIAL DE FRESHNESS TOUCH
 * ------------------------------------------
 * ESTE ARCHIVO YA NO ES EL UNICO LUGAR DONDE VIVEN LOS PRECIOS, y conviene
 * saberlo antes de cambiar una cifra aqui. Desde la etapa 2.22 los precios
 * por servicio, los extras, los descuentos por recurrencia y el deposito SE
 * EDITAN DESDE EL PANEL y viven en la tabla `pricing_tables`, versionados
 * (ver `docs/20-tarifas-editables.md`).
 *
 * Lo que hay aqui sigue siendo la fuente de:
 *
 *   - Lo que NO es editable: duraciones, limites de validacion, impuesto y
 *     el servicio comercial.
 *   - LAS TARIFAS DE PARTIDA. La primera fila de la tabla se siembra desde
 *     aqui, y son tambien a las que se cae si la base no responde.
 *
 * Cambiar una tarifa en este archivo por tanto NO cambia los precios de un
 * despliegue que ya tiene su tabla guardada: solo los de uno nuevo.
 *
 * Las cifras iniciales se derivan de los rangos de mercado de Georgia
 * (limpieza estandar 120-250 USD, profunda 180-700, mudanza 160-750,
 * post-obra 280-900, Airbnb 90-320) y deben ser revisadas y firmadas por
 * la direccion de la empresa antes de salir a produccion.
 *
 * Todos los importes en CENTAVOS enteros.
 */

/**
 * LA TARIFA DE UN SERVICIO EN UNA CADENCIA.
 *
 * Son dos numeros y manda EL MAYOR de los dos:
 *
 *   precio = max(flatCents, centsPerSquareFoot * pies cuadrados)
 *
 * POR QUE EL MAYOR Y NO UN UMBRAL. Se penso primero como «hasta 809 pies se
 * cobra lo plano, por encima se cobra por pie», y con esos numeros eso crea
 * un ESCALON HACIA ABAJO: a 810 pies saldrian 243 $ y a 809, 250 $. Siete
 * dolares mas barata la casa mas grande. Con el maximo no hay escalon y la
 * regla dice lo mismo: hasta que el tamano alcanza al importe plano, se paga
 * el plano.
 */
export interface FrequencyRate {
  /** Lo que se cobra cuando el tamano no manda. */
  flatCents: number;
  /**
   * Centavos por pie cuadrado, o `null` si este servicio no mira el tamano.
   *
   * La limpieza estandar no lo mira a proposito: es un precio que se dice por
   * telefono sin preguntar nada.
   */
  centsPerSquareFoot: number | null;
}

export interface ServiceRate {
  /** false = requiere visita previa y propuesta manual. */
  instantQuote: boolean;
  /**
   * La tarifa de cada cadencia. `null` = ESE SERVICIO NO SE OFRECE ASI.
   *
   * Una limpieza profunda no se contrata cada semana: la casa ya esta
   * profunda. Dejarlo en `null` y no en un precio alto es la diferencia
   * entre «no se ofrece» y «se ofrece caro», y el cotizador responde
   * distinto a cada cosa.
   */
  byFrequency: Record<Frequency, FrequencyRate | null>;
}

export interface AddOnRate {
  unit: AddOnUnit;
  unitAmountCents: number;
  maxQuantity: number;
  /**
   * Si se ofrece hoy.
   *
   * LOS QUE SE RETIRAN NO SE BORRAN DEL CATALOGO, y es a proposito: su codigo
   * esta escrito dentro del JSON de cotizaciones y reservas que ya existen.
   * Quitarlo del enumerado haria ilegible un presupuesto del mes pasado. Se
   * apaga, y deja de aparecer en el sitio y de admitirse en una peticion.
   */
  offered: boolean;
}

export interface ZoneRule {
  code: ServiceZone;
  /** Limite superior en millas (inclusive). null = sin limite. */
  maxMiles: number | null;
  serviceable: boolean;
  /**
   * Si el precio sale solo en esta zona.
   *
   * ATENDIDA Y CON PRECIO AUTOMATICO NO SON LO MISMO. Se va a esa casa, pero
   * a trescientas millas el traslado pesa mas que la limpieza y ninguna
   * tabla de recargos acierta a ciegas: el cotizador recoge la solicitud y
   * el precio se da en persona.
   */
  instantQuote: boolean;
}

/**
 * EL DEPOSITO ES UNA CANTIDAD FIJA, y ya no depende de la distancia.
 *
 * Antes se calculaba con las millas y se acotaba entre un minimo y un
 * maximo, asi que dos clientes del mismo barrio podian ver retenciones
 * distintas sin entender por que. Ahora son siempre los mismos 35 dolares y
 * se explica en una frase: se retienen al reservar y se descuentan del
 * total.
 *
 * NO ES UN CARGO EXTRA. Una limpieza estandar son 185 $: 35 retenidos al
 * reservar y 150 al terminar. A la empresa le llegan 185.
 *
 * Para que sirve: si el cliente cancela con el equipo ya en camino, o nadie
 * abre la puerta porque se olvidaron la llave, esos 35 cubren el viaje.
 */
export interface DepositRule {
  amountCents: number;
}

/**
 * EL COSTE DEL TRASLADO.
 *
 * Hasta `freeRadiusMiles` no se cobra nada. Por encima se cobran LAS MILLAS
 * QUE SOBRAN, no un escalon: antes habia franjas con recargos fijos —25, 50,
 * 75 dolares— y dos casas separadas por una milla podian pagar veinticinco
 * dolares de diferencia por estar a un lado y otro de una raya.
 *
 * VA EN EL PRECIO Y NO EN EL DEPOSITO. Antes el traslado vivia dentro del
 * deposito y se recortaba al total, asi que parte del coste real no se
 * cobraba nunca. Ahora es una linea mas del presupuesto, visible y sumada.
 */
export interface TravelRule {
  /** Millas sin recargo alrededor de la base de operaciones. */
  freeRadiusMiles: number;
  /** Se cobran las millas de ida y vuelta. */
  roundTrip: boolean;
  /**
   * Centavos por milla, o `null` para usar la tarifa vigente del IRS.
   *
   * `null` por defecto: la tarifa del IRS es una cifra oficial y publicada,
   * asi que ante un cliente que discute el recargo hay algo que ensenar que
   * no se ha inventado la empresa.
   */
  centsPerMile: number | null;
}

/**
 * Cuanto se tarda en hacer el trabajo. Es una estimacion de tiempo REAL en el
 * domicilio para un equipo estandar, y sirve para dos cosas: decidir que
 * huecos caben en la agenda y no prometer al cliente una hora imposible.
 *
 * Estas cifras deben ajustarse con datos reales: el sector recomienda medir
 * los tiempos durante 4-6 semanas y usar la media movil.
 */
export interface DurationRate {
  baseMinutes: number;
  perBedroomMinutes: number;
  perBathroomMinutes: number;
  minutesPerSquareFoot: number;
}

export interface PricingConfig {
  /**
   * Version de esta tabla de tarifas. Se guarda en cada cotizacion y en cada
   * reserva: sin ella, un presupuesto de hace tres meses no se puede
   * reproducir despues de cambiar los precios.
   *
   * Hay que subirla CADA VEZ que se toque un importe de este archivo.
   */
  version: string;
  currency: 'USD';
  baseOfOperations: {
    city: string;
    state: string;
    postalCode: string;
    /** Donde se centra el mapa de zonas. El mismo punto desde el que se mide. */
    latitude: number;
    longitude: number;
  };
  services: Record<ServiceType, ServiceRate>;
  addOns: Record<AddOnCode, AddOnRate>;
  /*
   * YA NO HAY DESCUENTO POR RECURRENCIA. Cada cadencia tiene su propia
   * tarifa dentro de `services`, que es como se anuncia el precio: «120 a la
   * semana», no «185 menos un 35%». Un porcentaje obliga a hacer la cuenta
   * para saber lo que se paga, y el redondeo lo dejaba en cifras raras.
   */
  zones: readonly ZoneRule[];
  deposit: DepositRule;
  travel: TravelRule;
  /** Impuesto sobre ventas. En Georgia la limpieza esta exenta: 0. */
  taxRatePercent: number;
  taxExempt: boolean;
  taxReasonKey: string;
  /** Duracion estimada del trabajo, por servicio. */
  durations: Record<ServiceType, DurationRate>;
  /** Minutos que suma cada extra al trabajo. */
  addOnMinutes: Record<AddOnCode, number>;
  /** La duracion se redondea hacia arriba a este multiplo, para cuadrar agenda. */
  durationRoundingMinutes: number;
  durationMinMinutes: number;
  durationMaxMinutes: number;

  /** Dias de validez del presupuesto. */
  validityDays: number;
  /** Por encima de estos pies cuadrados se exige revision humana. */
  manualReviewSquareFeetThreshold: number;
  limits: {
    bedrooms: { min: number; max: number };
    bathrooms: { min: number; max: number };
    squareFeet: { min: number; max: number };
    addOnsMax: number;
  };
}

export const defaultPricingConfig: PricingConfig = {
  version: '2026.09.1',
  currency: 'USD',
  baseOfOperations: {
    city: 'Atlanta',
    state: 'GA',
    postalCode: '30303',
    latitude: 33.749,
    longitude: -84.388,
  },

  /*
   * LOS PRECIOS DE FRESHNESS TOUCH.
   *
   * La estandar es PLANA y no mira el tamano: es el precio que se dice por
   * telefono sin preguntar nada, y baja segun el compromiso. La profunda y
   * la de mudanza si miran los pies cuadrados, porque el trabajo escala con
   * la casa, y solo se contratan puntualmente.
   */
  services: {
    STANDARD: {
      instantQuote: true,
      byFrequency: {
        ONE_TIME: { flatCents: 18500, centsPerSquareFoot: null },
        MONTHLY: { flatCents: 15000, centsPerSquareFoot: null },
        BIWEEKLY: { flatCents: 13500, centsPerSquareFoot: null },
        WEEKLY: { flatCents: 12000, centsPerSquareFoot: null },
      },
    },
    DEEP: {
      instantQuote: true,
      byFrequency: {
        // 250 $ o 30 centavos el pie, lo que salga mas alto: se igualan a
        // los 833 pies cuadrados.
        ONE_TIME: { flatCents: 25000, centsPerSquareFoot: 30 },
        MONTHLY: null,
        BIWEEKLY: null,
        WEEKLY: null,
      },
    },
    MOVE_IN_OUT: {
      instantQuote: true,
      byFrequency: {
        ONE_TIME: { flatCents: 25000, centsPerSquareFoot: 30 },
        MONTHLY: null,
        BIWEEKLY: null,
        WEEKLY: null,
      },
    },
    /*
     * A CONSULTAR, las tres. Una obra recien terminada y un apartamento de
     * alquiler vacacional se parecen en lo unico que importa aqui: lo que
     * cuestan depende de como esten, y a ciegas no se acierta. El cotizador
     * recoge la solicitud y el precio se da tras ver la casa.
     */
    POST_CONSTRUCTION: {
      instantQuote: false,
      byFrequency: { ONE_TIME: null, MONTHLY: null, BIWEEKLY: null, WEEKLY: null },
    },
    AIRBNB_TURNOVER: {
      instantQuote: false,
      byFrequency: { ONE_TIME: null, MONTHLY: null, BIWEEKLY: null, WEEKLY: null },
    },
    COMMERCIAL: {
      instantQuote: false,
      byFrequency: { ONE_TIME: null, MONTHLY: null, BIWEEKLY: null, WEEKLY: null },
    },
  },

  /*
   * Los cuatro que estan en las plantillas de trabajo. El resto se apagan:
   * ver `offered` en `AddOnRate` para por que no se borran.
   */
  addOns: {
    INSIDE_OVEN: { unit: 'FLAT', unitAmountCents: 5000, maxQuantity: 1, offered: true },
    INSIDE_FRIDGE: { unit: 'FLAT', unitAmountCents: 5000, maxQuantity: 1, offered: true },
    INSIDE_CABINETS: { unit: 'FLAT', unitAmountCents: 2500, maxQuantity: 1, offered: true },
    INTERIOR_WINDOWS: { unit: 'PER_UNIT', unitAmountCents: 600, maxQuantity: 40, offered: true },

    /* --- Retirados del catalogo, conservados para el historico --------- */
    LAUNDRY: { unit: 'PER_UNIT', unitAmountCents: 2000, maxQuantity: 6, offered: false },
    BASEMENT: { unit: 'FLAT', unitAmountCents: 4000, maxQuantity: 1, offered: false },
    GARAGE: { unit: 'FLAT', unitAmountCents: 4500, maxQuantity: 1, offered: false },
    PET_HAIR: { unit: 'FLAT', unitAmountCents: 3000, maxQuantity: 1, offered: false },
    PATIO: { unit: 'FLAT', unitAmountCents: 2500, maxQuantity: 1, offered: false },
    BED_LINENS: { unit: 'PER_UNIT', unitAmountCents: 1000, maxQuantity: 10, offered: false },
  },

  /**
   * TRES BANDAS, NO CINCO ANILLOS.
   *
   * Los cinco anillos con recargo fijo desaparecen: ahora el traslado se
   * cobra por milla (ver `TravelRule`), asi que lo unico que tienen que
   * decidir las zonas es hasta donde se va y hasta donde el precio sale
   * solo.
   *
   * Los codigos que ya no se usan —D, E— NO se borran del enumerado: estan
   * escritos en reservas que ya existen.
   */
  zones: [
    /** Dentro del radio sin recargo. */
    { code: 'A', maxMiles: 35, serviceable: true, instantQuote: true },
    /** Se cobra el traslado, pero el precio sigue saliendo solo. */
    { code: 'B', maxMiles: 60, serviceable: true, instantQuote: true },
    /**
     * El resto de Georgia. Se atiende, sin precio automatico: a doscientas
     * millas el dia se va en el viaje y ninguna tarifa por milla cubre eso.
     */
    { code: 'C', maxMiles: 325, serviceable: true, instantQuote: false },
    { code: 'OUT_OF_RANGE', maxMiles: null, serviceable: false, instantQuote: false },
  ],

  /** 35 dolares, siempre. Ver `DepositRule`. */
  deposit: { amountCents: 3500 },

  travel: {
    freeRadiusMiles: 35,
    roundTrip: true,
    /** La tarifa oficial del IRS. Ver `TravelRule`. */
    centsPerMile: null,
  },

  durations: {
    STANDARD: {
      baseMinutes: 45,
      perBedroomMinutes: 15,
      perBathroomMinutes: 20,
      minutesPerSquareFoot: 0.02,
    },
    DEEP: {
      baseMinutes: 75,
      perBedroomMinutes: 25,
      perBathroomMinutes: 35,
      minutesPerSquareFoot: 0.035,
    },
    MOVE_IN_OUT: {
      baseMinutes: 90,
      perBedroomMinutes: 30,
      perBathroomMinutes: 40,
      minutesPerSquareFoot: 0.04,
    },
    POST_CONSTRUCTION: {
      baseMinutes: 120,
      perBedroomMinutes: 35,
      perBathroomMinutes: 45,
      minutesPerSquareFoot: 0.05,
    },
    AIRBNB_TURNOVER: {
      baseMinutes: 30,
      perBedroomMinutes: 12,
      perBathroomMinutes: 18,
      minutesPerSquareFoot: 0.015,
    },
    COMMERCIAL: {
      baseMinutes: 0,
      perBedroomMinutes: 0,
      perBathroomMinutes: 0,
      minutesPerSquareFoot: 0,
    },
  },

  addOnMinutes: {
    INSIDE_FRIDGE: 20,
    INSIDE_OVEN: 25,
    INSIDE_CABINETS: 30,
    INTERIOR_WINDOWS: 5,
    LAUNDRY: 15,
    BASEMENT: 30,
    GARAGE: 30,
    PET_HAIR: 20,
    PATIO: 15,
    BED_LINENS: 8,
  },

  durationRoundingMinutes: 30,
  durationMinMinutes: 60,
  /** Diez horas: por encima de eso el trabajo se reparte en varios dias. */
  durationMaxMinutes: 600,

  taxRatePercent: 0,
  taxExempt: true,
  taxReasonKey: 'quote.tax.gaExempt',

  validityDays: 7,
  manualReviewSquareFeetThreshold: 6000,

  limits: {
    bedrooms: { min: 0, max: 12 },
    bathrooms: { min: 0, max: 12 },
    squareFeet: { min: 200, max: 20000 },
    addOnsMax: 20,
  },
};
