import type {
  AddOnCode,
  AddOnUnit,
  Frequency,
  PricingSizeBand,
  ServiceType,
  ServiceZone,
} from '@freshness/types';

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
/**
 * QUE COLUMNA DE LA TABLA POR TRAMOS LEE UNA CADENCIA.
 *
 * El precio ya no esta aqui: esta en `sizeBands`. Lo que queda en el codigo
 * es el ENLACE entre un servicio y la columna que le corresponde, que es
 * decision de producto y no una tarifa:
 *
 *   - La profunda y las dos de mudanza leen la misma columna, porque son el
 *     mismo trabajo con distinto nombre segun por que se pida.
 *   - La estandar lee una columna por cadencia.
 */
export type BandColumn =
  'deepCents' | 'standardMonthlyCents' | 'standardBiweeklyCents' | 'standardWeeklyCents';

export interface ServiceRate {
  /**
   * Si se ofrece hoy en el sitio.
   *
   * NO ES LO MISMO QUE `instantQuote`, y la diferencia importa:
   *
   *   - `offered: false` -> no aparece en ningun sitio. Ni en la lista de
   *     servicios, ni en el cotizador, ni en el formulario de reserva.
   *   - `instantQuote: false` -> si aparece, pero sin precio automatico: se
   *     recoge la solicitud y se llama al cliente.
   *
   * LOS RETIRADOS NO SE BORRAN DEL ENUMERADO. Su codigo esta escrito en
   * reservas que ya existen, y quitarlo haria ilegible una del mes pasado.
   * Se apagan, y el dia que vuelvan a ofrecerse se enciende esta linea.
   */
  offered: boolean;
  /** false = requiere visita previa y propuesta manual. */
  instantQuote: boolean;
  /**
   * De que columna sale el precio en cada cadencia. `null` = ESE SERVICIO NO
   * SE OFRECE ASI.
   *
   * Una limpieza profunda no se contrata cada semana: la casa ya esta
   * profunda. Y desde la etapa 3.4 la ESTANDAR NO SE OFRECE PUNTUAL: la
   * tabla del cliente solo le pone precio mensual, quincenal y semanal, y
   * quien quiere una limpieza suelta contrata la profunda. Es practica
   * habitual del sector —la primera limpieza de una casa siempre es
   * profunda—.
   *
   * `null` y «sin precio automatico» NO son lo mismo, y el cotizador
   * responde distinto a cada cosa: «elige otra frecuencia» frente a «te
   * llamamos».
   */
  byFrequency: Record<Frequency, BandColumn | null>;
}

export interface AddOnRate {
  unit: AddOnUnit;
  /**
   * Lo que cuesta. SE IGNORA cuando `pricedBySize` es true: en ese caso el
   * importe sale de la tabla por tramos, y dejarlo aqui seria tener el
   * precio en dos sitios.
   */
  unitAmountCents: number;
  /**
   * Si el precio lo pone el tramo de tamano de la casa.
   *
   * Solo lo usa «ventanas y gabinetes interiores», que en la tabla del
   * cliente cuesta de 30 a 85 dolares segun el tamano. El horno y la nevera
   * son planos a proposito: limpiar un horno cuesta lo mismo en un
   * apartamento que en una mansion.
   */
  pricedBySize: boolean;
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
  /**
   * LA TABLA DE PRECIOS POR TAMANO. De aqui sale el precio de cada limpieza.
   * `services` ya no lleva importes: dice que columna lee cada cadencia.
   */
  sizeBands: PricingSizeBand[];
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
   * ========================================================================
   * LOS PRECIOS DE FRESHNESS TOUCH: UNA TABLA, NO UNA FORMULA
   * ========================================================================
   * Transcritos de la hoja de calculo que paso el cliente en octubre de
   * 2026. UNA FILA POR TRAMO DE TAMANO, con el tope del tramo inclusive, y
   * una casa toma el primer tramo cuyo tope alcanza (ver `sizeBandFor`).
   *
   * LA TRANSCRIPCION ESTA VERIFICADA, no leida a ojo: la suma de las 26
   * filas por las ocho columnas da 47.275, exactamente el total que mostraba
   * la hoja. Hay una prueba que lo vuelve a comprobar.
   *
   * ------------------------------------------------------------------------
   * UNA INCOHERENCIA DE LA HOJA, CONSERVADA A PROPOSITO
   * ------------------------------------------------------------------------
   * La estandar MENSUAL de 900 pies cuesta 160 $ y la de 1.200 cuesta 150 $:
   * la casa mas grande paga diez dolares menos al mes. Es la unica columna
   * donde el precio baja al crecer la casa, y parece una errata del cliente.
   *
   * NO SE CORRIGE AQUI. Son sus precios, y arreglarlos en silencio seria
   * cobrar algo distinto de lo que el dijo. Queda anotado, en la
   * documentacion y en una prueba que lo deja por escrito, para que quien lo
   * vea sepa que esta visto y no es un fallo de la transcripcion.
   */
  sizeBands: [
    /* 900          */ {
      maxSquareFeet: 900,
      deepCents: 26000,
      standardMonthlyCents: 16000,
      standardBiweeklyCents: 13500,
      standardWeeklyCents: 12000,
      windowsAndCabinetsCents: 3000,
    },
    /* 1.200        */ {
      maxSquareFeet: 1200,
      deepCents: 27000,
      standardMonthlyCents: 15000,
      standardBiweeklyCents: 14000,
      standardWeeklyCents: 13000,
      windowsAndCabinetsCents: 3000,
    },
    /* 1.400        */ {
      maxSquareFeet: 1400,
      deepCents: 29000,
      standardMonthlyCents: 16000,
      standardBiweeklyCents: 15000,
      standardWeeklyCents: 14000,
      windowsAndCabinetsCents: 3000,
    },
    /* 1.500        */ {
      maxSquareFeet: 1500,
      deepCents: 29000,
      standardMonthlyCents: 16000,
      standardBiweeklyCents: 15000,
      standardWeeklyCents: 14000,
      windowsAndCabinetsCents: 3000,
    },
    /* 1.600        */ {
      maxSquareFeet: 1600,
      deepCents: 29000,
      standardMonthlyCents: 16000,
      standardBiweeklyCents: 15000,
      standardWeeklyCents: 14000,
      windowsAndCabinetsCents: 4000,
    },
    /* 1.700        */ {
      maxSquareFeet: 1700,
      deepCents: 30000,
      standardMonthlyCents: 17500,
      standardBiweeklyCents: 15000,
      standardWeeklyCents: 14000,
      windowsAndCabinetsCents: 4000,
    },
    /* 1.800        */ {
      maxSquareFeet: 1800,
      deepCents: 31000,
      standardMonthlyCents: 18000,
      standardBiweeklyCents: 16000,
      standardWeeklyCents: 14000,
      windowsAndCabinetsCents: 4500,
    },
    /* 1.900        */ {
      maxSquareFeet: 1900,
      deepCents: 31500,
      standardMonthlyCents: 18000,
      standardBiweeklyCents: 16500,
      standardWeeklyCents: 14000,
      windowsAndCabinetsCents: 4500,
    },
    /* 2.000        */ {
      maxSquareFeet: 2000,
      deepCents: 32000,
      standardMonthlyCents: 18500,
      standardBiweeklyCents: 16500,
      standardWeeklyCents: 15000,
      windowsAndCabinetsCents: 5000,
    },
    /* 2.100-2.200  */ {
      maxSquareFeet: 2200,
      deepCents: 32000,
      standardMonthlyCents: 19000,
      standardBiweeklyCents: 17000,
      standardWeeklyCents: 16000,
      windowsAndCabinetsCents: 5000,
    },
    /* 2.300-2.400  */ {
      maxSquareFeet: 2400,
      deepCents: 32500,
      standardMonthlyCents: 19000,
      standardBiweeklyCents: 17000,
      standardWeeklyCents: 16000,
      windowsAndCabinetsCents: 5000,
    },
    /* 2.500-2.600  */ {
      maxSquareFeet: 2600,
      deepCents: 33000,
      standardMonthlyCents: 19000,
      standardBiweeklyCents: 17500,
      standardWeeklyCents: 16500,
      windowsAndCabinetsCents: 5000,
    },
    /* 2.700-2.900  */ {
      maxSquareFeet: 2900,
      deepCents: 33000,
      standardMonthlyCents: 19500,
      standardBiweeklyCents: 18000,
      standardWeeklyCents: 17000,
      windowsAndCabinetsCents: 5500,
    },
    /* 3.000-3.100  */ {
      maxSquareFeet: 3100,
      deepCents: 33500,
      standardMonthlyCents: 20000,
      standardBiweeklyCents: 19000,
      standardWeeklyCents: 17000,
      windowsAndCabinetsCents: 6000,
    },
    /* 3.200-3.500  */ {
      maxSquareFeet: 3500,
      deepCents: 34500,
      standardMonthlyCents: 22000,
      standardBiweeklyCents: 19000,
      standardWeeklyCents: 17000,
      windowsAndCabinetsCents: 6000,
    },
    /* 3.600        */ {
      maxSquareFeet: 3600,
      deepCents: 35000,
      standardMonthlyCents: 23000,
      standardBiweeklyCents: 20000,
      standardWeeklyCents: 18000,
      windowsAndCabinetsCents: 6500,
    },
    /* 3.700-3.800  */ {
      maxSquareFeet: 3800,
      deepCents: 37500,
      standardMonthlyCents: 23500,
      standardBiweeklyCents: 20500,
      standardWeeklyCents: 18000,
      windowsAndCabinetsCents: 6500,
    },
    /* 3.900-4.000  */ {
      maxSquareFeet: 4000,
      deepCents: 38000,
      standardMonthlyCents: 28000,
      standardBiweeklyCents: 21000,
      standardWeeklyCents: 18500,
      windowsAndCabinetsCents: 7000,
    },
    /* 4.100-4.300  */ {
      maxSquareFeet: 4300,
      deepCents: 40000,
      standardMonthlyCents: 28000,
      standardBiweeklyCents: 23000,
      standardWeeklyCents: 18500,
      windowsAndCabinetsCents: 7000,
    },
    /* 4.400-4.800  */ {
      maxSquareFeet: 4800,
      deepCents: 42500,
      standardMonthlyCents: 30500,
      standardBiweeklyCents: 23500,
      standardWeeklyCents: 19000,
      windowsAndCabinetsCents: 7000,
    },
    /* 4.900-5.100  */ {
      maxSquareFeet: 5100,
      deepCents: 45000,
      standardMonthlyCents: 32500,
      standardBiweeklyCents: 24000,
      standardWeeklyCents: 20000,
      windowsAndCabinetsCents: 7500,
    },
    /* 5.200-5.400  */ {
      maxSquareFeet: 5400,
      deepCents: 50000,
      standardMonthlyCents: 34000,
      standardBiweeklyCents: 25000,
      standardWeeklyCents: 20000,
      windowsAndCabinetsCents: 7500,
    },
    /* 5.500-5.700  */ {
      maxSquareFeet: 5700,
      deepCents: 53000,
      standardMonthlyCents: 35000,
      standardBiweeklyCents: 25500,
      standardWeeklyCents: 22000,
      windowsAndCabinetsCents: 8000,
    },
    /* 5.800-6.000  */ {
      maxSquareFeet: 6000,
      deepCents: 55000,
      standardMonthlyCents: 35500,
      standardBiweeklyCents: 26000,
      standardWeeklyCents: 24000,
      windowsAndCabinetsCents: 8000,
    },
    /* 6.100-6.600  */ {
      maxSquareFeet: 6600,
      deepCents: 58500,
      standardMonthlyCents: 37500,
      standardBiweeklyCents: 28000,
      standardWeeklyCents: 26000,
      windowsAndCabinetsCents: 8500,
    },
    /* 6.700-6.900  */ {
      maxSquareFeet: 6900,
      deepCents: 60000,
      standardMonthlyCents: 39500,
      standardBiweeklyCents: 30000,
      standardWeeklyCents: 27000,
      windowsAndCabinetsCents: 8500,
    },
  ],

  /*
   * De donde saca el precio cada servicio. Los importes estan arriba.
   */
  services: {
    STANDARD: {
      offered: true,
      instantQuote: true,
      byFrequency: {
        /*
         * SIN PUNTUAL, DESDE LA ETAPA 3.4. La tabla del cliente solo pone
         * precio a la estandar en plan recurrente; una limpieza suelta es
         * una profunda.
         */
        ONE_TIME: null,
        MONTHLY: 'standardMonthlyCents',
        BIWEEKLY: 'standardBiweeklyCents',
        WEEKLY: 'standardWeeklyCents',
      },
    },
    DEEP: {
      offered: true,
      instantQuote: true,
      byFrequency: { ONE_TIME: 'deepCents', MONTHLY: null, BIWEEKLY: null, WEEKLY: null },
    },
    MOVE_IN_OUT: {
      offered: true,
      instantQuote: true,
      byFrequency: { ONE_TIME: 'deepCents', MONTHLY: null, BIWEEKLY: null, WEEKLY: null },
    },
    /*
     * A CONSULTAR, las tres, y desde la etapa 3.4 tampoco aparecen en el
     * formulario del sitio: el cliente ha pedido retirarlas de momento. No
     * se borran del enumerado porque su codigo esta escrito en reservas que
     * ya existen.
     */
    POST_CONSTRUCTION: {
      offered: false,
      instantQuote: false,
      byFrequency: { ONE_TIME: null, MONTHLY: null, BIWEEKLY: null, WEEKLY: null },
    },
    AIRBNB_TURNOVER: {
      offered: false,
      instantQuote: false,
      byFrequency: { ONE_TIME: null, MONTHLY: null, BIWEEKLY: null, WEEKLY: null },
    },
    COMMERCIAL: {
      offered: false,
      instantQuote: false,
      byFrequency: { ONE_TIME: null, MONTHLY: null, BIWEEKLY: null, WEEKLY: null },
    },
  },

  /*
   * Los cuatro que estan en las plantillas de trabajo. El resto se apagan:
   * ver `offered` en `AddOnRate` para por que no se borran.
   */
  addOns: {
    /* --- Planos: cuestan lo mismo en cualquier casa ------------------- */
    INSIDE_OVEN: {
      unit: 'FLAT',
      unitAmountCents: 5000,
      maxQuantity: 1,
      offered: true,
      pricedBySize: false,
    },
    INSIDE_FRIDGE: {
      unit: 'FLAT',
      unitAmountCents: 5000,
      maxQuantity: 1,
      offered: true,
      pricedBySize: false,
    },

    /* --- Por tamano: el importe sale de la tabla de arriba ------------ */
    /*
     * De 30 a 85 dolares segun el tramo. `unitAmountCents: 0` no es un
     * descuido: con `pricedBySize` el importe de aqui se ignora, y poner un
     * numero que no se usa es justo como acaban dos precios distintos para
     * la misma cosa.
     */
    WINDOWS_AND_CABINETS: {
      unit: 'FLAT',
      unitAmountCents: 0,
      maxQuantity: 1,
      offered: true,
      pricedBySize: true,
    },

    /* --- Retirados del catalogo, conservados para el historico --------- */
    /*
     * Estos dos se ofrecian por separado hasta la etapa 3.4. La tabla del
     * cliente los junta en una sola columna, asi que se apagan; sus codigos
     * siguen escritos en cotizaciones y reservas que ya existen.
     */
    INSIDE_CABINETS: {
      unit: 'FLAT',
      unitAmountCents: 2500,
      maxQuantity: 1,
      offered: false,
      pricedBySize: false,
    },
    INTERIOR_WINDOWS: {
      unit: 'PER_UNIT',
      unitAmountCents: 600,
      maxQuantity: 40,
      offered: false,
      pricedBySize: false,
    },
    LAUNDRY: {
      unit: 'PER_UNIT',
      unitAmountCents: 2000,
      maxQuantity: 6,
      offered: false,
      pricedBySize: false,
    },
    BASEMENT: {
      unit: 'FLAT',
      unitAmountCents: 4000,
      maxQuantity: 1,
      offered: false,
      pricedBySize: false,
    },
    GARAGE: {
      unit: 'FLAT',
      unitAmountCents: 4500,
      maxQuantity: 1,
      offered: false,
      pricedBySize: false,
    },
    PET_HAIR: {
      unit: 'FLAT',
      unitAmountCents: 3000,
      maxQuantity: 1,
      offered: false,
      pricedBySize: false,
    },
    PATIO: {
      unit: 'FLAT',
      unitAmountCents: 2500,
      maxQuantity: 1,
      offered: false,
      pricedBySize: false,
    },
    BED_LINENS: {
      unit: 'PER_UNIT',
      unitAmountCents: 1000,
      maxQuantity: 10,
      offered: false,
      pricedBySize: false,
    },
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
    /*
     * Los dos juntos. Era la suma de los dos sueltos —30 de gabinetes mas
     * 25 de ventanas—, que es lo que se tarda en hacer las dos cosas.
     */
    WINDOWS_AND_CABINETS: 55,
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
