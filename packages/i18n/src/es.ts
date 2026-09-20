import type { TranslationResources } from './en';

/**
 * Textos en espanol. El tipo `TranslationResources` obliga a que existan
 * exactamente las mismas claves que en ingles: si falta una, no compila.
 */
export const es: TranslationResources = {
  common: {
    companyName: 'Freshness Touch',
    tagline: 'Limpieza profesional en todo Georgia',
    callUs: 'Llamanos',
    emailUs: 'Escribenos',
    getQuote: 'Cotiza al instante',
    bookNow: 'Reservar',
    learnMore: 'Saber mas',
    loading: 'Calculando...',
    from: 'desde',
    perVisit: 'por visita',
    optional: 'opcional',
    language: 'Idioma',
    theme: { light: 'Modo claro', dark: 'Modo oscuro' },
  },

  nav: {
    services: 'Servicios',
    quote: 'Cotizacion',
    areas: 'Zonas de servicio',
    whyUs: 'Por que nosotros',
    faq: 'Preguntas',
    contact: 'Contacto',
    menu: 'Menu',
  },

  hero: {
    badge: 'Con licencia · Asegurados · Afianzados',
    title: 'Una casa impecable, sin sorpresas en el precio',
    subtitle:
      'Obten un precio real en menos de un minuto. Sin llamadas de vuelta, sin cargos ocultos y con un deposito de traslado transparente que se descuenta de tu factura final.',
    primaryCta: 'Ver mi precio ahora',
    secondaryCta: 'Ver servicios',
    point1: 'Precios transparentes que ves antes de reservar',
    point2: 'Personal con verificacion de antecedentes',
    point3: 'En Georgia los servicios de limpieza no pagan sales tax',
  },

  services: {
    title: 'Servicios',
    subtitle: 'Limpieza residencial y comercial adaptada a como vives y trabajas.',
    startingAt: 'Desde',
    requiresVisit: 'Requiere visita previa al inmueble',
    STANDARD: {
      name: 'Limpieza estandar',
      description:
        'Cocina, banos, pisos, polvo y superficies. Ideal como servicio recurrente semanal, quincenal o mensual.',
    },
    DEEP: {
      name: 'Limpieza profunda',
      description:
        'Todo lo de la limpieza estandar mas zocalos, rejillas de ventilacion, fregado detallado y suciedad acumulada.',
    },
    MOVE_IN_OUT: {
      name: 'Mudanza (entrada o salida)',
      description:
        'Limpieza de vivienda vacia para inquilinos, propietarios y compradores. Incluye interior de gabinetes, electrodomesticos y closets.',
    },
    POST_CONSTRUCTION: {
      name: 'Post-construccion',
      description:
        'Retiro de polvo fino, escombros y trabajo de detalle tras una remodelacion u obra nueva.',
    },
    AIRBNB_TURNOVER: {
      name: 'Rotacion Airbnb',
      description:
        'Preparacion rapida entre huespedes con lista de verificacion, ropa de cama y reposicion bajo pedido.',
    },
    COMMERCIAL: {
      name: 'Comercial y oficinas',
      description:
        'Oficinas, clinicas y locales. Se cotiza tras una visita para ajustar alcance y horario a tus instalaciones.',
    },
  },

  addOns: {
    title: 'Extras',
    INSIDE_FRIDGE: 'Interior del refrigerador',
    INSIDE_OVEN: 'Interior del horno',
    INSIDE_CABINETS: 'Interior de gabinetes de cocina',
    INTERIOR_WINDOWS: 'Ventanas por dentro',
    LAUNDRY: 'Cargas de lavanderia',
    BASEMENT: 'Sotano',
    GARAGE: 'Garaje',
    PET_HAIR: 'Exceso de pelo de mascotas',
    PATIO: 'Balcon o patio',
    BED_LINENS: 'Cambio de ropa de cama',
  },

  frequency: {
    title: 'Con que frecuencia?',
    ONE_TIME: 'Una vez',
    WEEKLY: 'Semanal',
    BIWEEKLY: 'Cada 2 semanas',
    MONTHLY: 'Mensual',
    savePercent: 'Ahorra {{percent}}%',
  },

  calculator: {
    title: 'Cotizacion instantanea',
    subtitle: 'Responde cinco preguntas y ve tu precio. Sin registro y sin llamadas.',
    serviceLabel: 'Que necesitas?',
    bedroomsLabel: 'Habitaciones',
    bathroomsLabel: 'Banos',
    squareFeetLabel: 'Pies cuadrados aproximados',
    postalCodeLabel: 'Codigo postal',
    postalCodeHelp:
      'Solo necesitamos tu codigo postal para estimar el traslado. No pedimos tu direccion.',
    postalCodePlaceholder: '30303',
    addOnsLabel: 'Algo adicional?',
    quantityLabel: 'Cant.',
    submit: 'Calcular mi precio',
    recalculate: 'Actualizar precio',
    yourEstimate: 'Tu estimado',
    estimatedTotal: 'Total estimado',
    travelDeposit: 'Deposito de traslado (retenido, no cobrado)',
    dueAtService: 'Saldo a pagar el dia del servicio',
    distanceSummary: 'A unas {{miles}} millas de nuestra base — zona {{zone}}',
    breakdown: 'Desglose del precio',
    validUntil: 'Valido hasta {{date}}',
    noTax: 'Impuesto sobre ventas: $0.00 (exento en Georgia)',
    manualReviewTitle: 'Este caso necesita revision',
    manualReviewBody:
      'Cuentanos un poco mas y un miembro de nuestro equipo te enviara una propuesta personalizada.',
    requestCallback: 'Solicitar propuesta personalizada',
    errorTitle: 'No pudimos calcular tu precio',
    errorGeneric: 'Ocurrio un problema de nuestro lado. Intentalo de nuevo o llamanos.',
    errorNetwork: 'No pudimos contactar el servicio de precios. Revisa tu conexion e intenta otra vez.',
    errorValidation: 'Revisa los campos marcados.',
    errorPostalCode: 'Ingresa un codigo postal valido de 5 digitos.',
    errorRateLimited: 'Demasiadas cotizaciones en poco tiempo. Espera un momento e intenta de nuevo.',
  },

  quote: {
    line: {
      service: {
        STANDARD: 'Limpieza estandar · {{bedrooms}} hab / {{bathrooms}} banos · {{squareFeet}} pies2',
        DEEP: 'Limpieza profunda · {{bedrooms}} hab / {{bathrooms}} banos · {{squareFeet}} pies2',
        MOVE_IN_OUT: 'Mudanza · {{bedrooms}} hab / {{bathrooms}} banos · {{squareFeet}} pies2',
        POST_CONSTRUCTION:
          'Post-construccion · {{bedrooms}} hab / {{bathrooms}} banos · {{squareFeet}} pies2',
        AIRBNB_TURNOVER: 'Rotacion Airbnb · {{bedrooms}} hab / {{bathrooms}} banos · {{squareFeet}} pies2',
        COMMERCIAL: 'Limpieza comercial',
      },
      addOn: {
        INSIDE_FRIDGE: 'Interior del refrigerador',
        INSIDE_OVEN: 'Interior del horno',
        INSIDE_CABINETS: 'Interior de gabinetes de cocina',
        INTERIOR_WINDOWS: 'Ventanas por dentro (x{{quantity}})',
        LAUNDRY: 'Lavanderia ({{quantity}} cargas)',
        BASEMENT: 'Sotano',
        GARAGE: 'Garaje',
        PET_HAIR: 'Exceso de pelo de mascotas',
        PATIO: 'Balcon o patio',
        BED_LINENS: 'Ropa de cama (x{{quantity}})',
      },
      discount: {
        ONE_TIME: 'Descuento',
        WEEKLY: 'Descuento por servicio semanal ({{percent}}%)',
        BIWEEKLY: 'Descuento por servicio quincenal ({{percent}}%)',
        MONTHLY: 'Descuento por servicio mensual ({{percent}}%)',
      },
      minimumAdjustment: 'Minimo del servicio (${{minimum}})',
      zoneSurcharge: 'Recargo por traslado · zona {{zone}} ({{miles}} millas)',
      salesTax: 'Impuesto sobre ventas ({{percent}}%)',
    },
    disclaimer: {
      estimate:
        'Este es un estimado basado en la informacion que nos diste. El precio final se confirma en el lugar antes de comenzar.',
      deposit:
        'El deposito de traslado se autoriza en tu tarjeta al reservar y se acredita integramente contra tu factura final. Solo se cobra si cancelas cuando nuestro equipo ya va en camino.',
      taxExempt: 'Los servicios de limpieza estan exentos del impuesto sobre ventas en el estado de Georgia.',
      validity: 'Esta cotizacion es valida por 7 dias.',
      distanceEstimated:
        'La distancia se estima desde tu codigo postal y se confirma cuando tengamos la direccion completa.',
    },
    review: {
      commercialWalkthrough:
        'Los trabajos comerciales se cotizan tras una visita gratuita para ajustar el alcance a tus instalaciones.',
      outOfServiceArea:
        'Este codigo postal esta fuera de nuestra zona habitual. Aun asi podriamos ayudarte: consultanos.',
      outOfState: 'Por ahora operamos unicamente en el estado de Georgia.',
      largeProperty: 'Las propiedades grandes se cotizan de forma individual para que el estimado sea preciso.',
    },
    tax: {
      gaExempt: 'Exento — los servicios de limpieza no pagan impuesto en Georgia',
    },
  },

  whyUs: {
    title: 'Por que Freshness Touch',
    insured: {
      title: 'Asegurados y afianzados',
      body: 'Poliza de responsabilidad civil y fianza de limpieza que protegen tu hogar y tus bienes.',
    },
    vetted: {
      title: 'Equipo verificado',
      body: 'Cada persona del equipo pasa verificacion de antecedentes penales e identidad antes de su primer trabajo.',
    },
    transparent: {
      title: 'Precios transparentes',
      body: 'Ves el desglose completo antes de reservar: servicio, extras, traslado y deposito.',
    },
    guarantee: {
      title: 'Garantia de repaso',
      body: 'Algo no quedo bien? Avisanos dentro de 24 horas y volvemos a corregirlo.',
    },
  },

  areas: {
    title: 'Zonas de servicio',
    subtitle:
      'Trabajamos por zonas para reducir el tiempo de traslado y mantener tu precio justo. Ingresa tu codigo postal en el cotizador para ver tu zona.',
    zoneLabel: 'Zona {{zone}}',
    upToMiles: 'Hasta {{miles}} millas desde nuestra base',
    beyondMiles: 'Mas alla de {{miles}} millas',
    noSurcharge: 'Sin recargo por traslado',
    surcharge: 'Recargo por traslado de {{amount}}',
    outOfRange: 'Fuera de nuestra zona habitual — contactanos para una propuesta personalizada',
  },

  faq: {
    title: 'Preguntas frecuentes',
    q1: {
      q: 'Tengo que pagar impuesto sobre ventas?',
      a: 'No. En Georgia los servicios de limpieza estan exentos del sales tax, asi que el precio que ves es el que pagas.',
    },
    q2: {
      q: 'Que es exactamente el deposito de traslado?',
      a: 'Es una retencion reembolsable calculada segun la distancia entre tu casa y nuestra base. Se autoriza en tu tarjeta al reservar, se descuenta de la factura final y solo se cobra si cancelas cuando el equipo ya va en camino.',
    },
    q3: {
      q: 'Debo estar en casa durante la limpieza?',
      a: 'No. Muchos clientes dejan instrucciones de acceso al reservar. Tu decides que te resulta mas comodo.',
    },
    q4: {
      q: 'Llevan sus propios productos?',
      a: 'Si, el equipo llega con equipo y productos profesionales. Si prefieres que usemos los tuyos, solo avisanos.',
    },
    q5: {
      q: 'Debo dejar propina?',
      a: 'La propina nunca es obligatoria. Es comun dejar entre 15% y 20% en limpiezas puntuales, profundas o de mudanza; en servicios recurrentes muchos clientes prefieren un bono de fin de ano.',
    },
    q6: {
      q: 'Como reprogramo o cancelo?',
      a: 'Contactanos al menos 24 horas antes de tu cita y la movemos sin costo.',
    },
  },

  contact: {
    title: 'Cuando tu digas',
    subtitle: 'Obten tu precio en linea o habla con una persona: como prefieras.',
    phone: 'Telefono',
    email: 'Correo',
    hours: 'Horario',
    hoursValue: 'Lunes a sabado, 8:00 AM - 6:00 PM',
    serviceArea: 'Con base en {{city}}, {{state}}',
  },

  footer: {
    rights: 'Todos los derechos reservados.',
    legalNote: 'Los precios mostrados son estimados y se confirman antes de iniciar cualquier trabajo.',
    privacy: 'Privacidad',
    terms: 'Terminos',
  },
};
