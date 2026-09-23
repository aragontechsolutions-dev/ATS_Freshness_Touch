import type { TranslationResources } from './en';

/**
 * Textos en espanol. El tipo `TranslationResources` obliga a que existan
 * exactamente las mismas claves que en ingles: si falta una, no compila.
 *
 * Ortografia: el texto de cara al cliente lleva tildes y signos de apertura
 * (¿ ¡). Es contenido comercial y escribirlo mal resta credibilidad.
 */
export const es: TranslationResources = {
  common: {
    companyName: 'Freshness Touch',
    tagline: 'Limpieza profesional en todo Georgia',
    callUs: 'Llámanos',
    emailUs: 'Escríbenos',
    getQuote: 'Cotiza gratis',
    bookNow: 'Reservar limpieza',
    learnMore: 'Saber más',
    loading: 'Calculando...',
    from: 'desde',
    perVisit: 'por visita',
    optional: 'opcional',
    language: 'Idioma',
    theme: { light: 'Modo claro', dark: 'Modo oscuro' },
  },

  nav: {
    services: 'Servicios',
    quote: 'Cotización',
    areas: 'Zonas de servicio',
    whyUs: 'Por qué nosotros',
    faq: 'Preguntas',
    contact: 'Contacto',
    menu: 'Menú',
  },

  hero: {
    badge: 'Con licencia · Asegurados · Afianzados',
    title: 'Una casa impecable, sin sorpresas en el precio',
    subtitle:
      'Obtén un precio real en menos de un minuto. Sin llamadas de vuelta, sin cargos ocultos y con un depósito de traslado transparente que se descuenta de tu factura final.',
    primaryCta: 'Cotiza gratis',
    secondaryCta: 'Ver servicios',
    point1: 'Precios transparentes que ves antes de reservar',
    point2: 'Personal con verificación de antecedentes',
    point3: 'En Georgia los servicios de limpieza no pagan sales tax',
  },

  services: {
    title: 'Servicios',
    subtitle: 'Limpieza residencial y comercial adaptada a cómo vives y trabajas.',
    startingAt: 'Desde',
    requiresVisit: 'Requiere visita previa al inmueble',
    STANDARD: {
      name: 'Limpieza estándar',
      description:
        'Cocina, baños, pisos, polvo y superficies. Ideal como servicio recurrente semanal, quincenal o mensual.',
    },
    DEEP: {
      name: 'Limpieza profunda',
      description:
        'Todo lo de la limpieza estándar más zócalos, rejillas de ventilación, fregado detallado y suciedad acumulada.',
    },
    MOVE_IN_OUT: {
      name: 'Mudanza (entrada o salida)',
      description:
        'Limpieza de vivienda vacía para inquilinos, propietarios y compradores. Incluye interior de gabinetes, electrodomésticos y clósets.',
    },
    POST_CONSTRUCTION: {
      name: 'Post-construcción',
      description:
        'Retiro de polvo fino, escombros y trabajo de detalle tras una remodelación u obra nueva.',
    },
    AIRBNB_TURNOVER: {
      name: 'Rotación Airbnb',
      description:
        'Preparación rápida entre huéspedes con lista de verificación, ropa de cama y reposición bajo pedido.',
    },
    COMMERCIAL: {
      name: 'Comercial y oficinas',
      description:
        'Oficinas, clínicas y locales. Se cotiza tras una visita para ajustar el alcance y el horario a tus instalaciones.',
    },
  },

  addOns: {
    title: 'Extras',
    INSIDE_FRIDGE: 'Interior del refrigerador',
    INSIDE_OVEN: 'Interior del horno',
    INSIDE_CABINETS: 'Interior de gabinetes de cocina',
    INTERIOR_WINDOWS: 'Ventanas por dentro',
    LAUNDRY: 'Cargas de lavandería',
    BASEMENT: 'Sótano',
    GARAGE: 'Garaje',
    PET_HAIR: 'Exceso de pelo de mascotas',
    PATIO: 'Balcón o patio',
    BED_LINENS: 'Cambio de ropa de cama',
  },

  frequency: {
    title: '¿Con qué frecuencia?',
    ONE_TIME: 'Una vez',
    WEEKLY: 'Semanal',
    BIWEEKLY: 'Cada 2 semanas',
    MONTHLY: 'Mensual',
    savePercent: 'Ahorra {{percent}}%',
  },

  calculator: {
    title: 'Cotización instantánea',
    subtitle: 'Responde cinco preguntas y ve tu precio. Sin registro y sin llamadas.',
    serviceLabel: '¿Qué necesitas?',
    bedroomsLabel: 'Habitaciones',
    bathroomsLabel: 'Baños',
    squareFeetLabel: 'Pies cuadrados aproximados',
    postalCodeLabel: 'Código postal',
    postalCodeHelp:
      'Solo necesitamos tu código postal para estimar el traslado. No pedimos tu dirección.',
    postalCodePlaceholder: '30303',
    addOnsLabel: '¿Algo adicional?',
    quantityLabel: 'Cant.',
    submit: 'Calcular mi precio',
    recalculate: 'Actualizar precio',
    yourEstimate: 'Tu estimado',
    estimatedTotal: 'Total estimado',
    travelDeposit: 'Depósito de traslado (retenido, no cobrado)',
    dueAtService: 'Saldo a pagar el día del servicio',
    distanceSummary: 'A unas {{miles}} millas de nuestra base — zona {{zone}}',
    breakdown: 'Desglose del precio',
    validUntil: 'Válido hasta {{date}}',
    noTax: 'Impuesto sobre ventas: $0.00 (exento en Georgia)',
    manualReviewTitle: 'Este caso necesita revisión',
    manualReviewBody:
      'Cuéntanos un poco más y un miembro de nuestro equipo te enviará una propuesta personalizada.',
    requestCallback: 'Solicitar propuesta personalizada',
    errorTitle: 'No pudimos calcular tu precio',
    errorGeneric: 'Ocurrió un problema de nuestro lado. Inténtalo de nuevo o llámanos.',
    errorNetwork:
      'No pudimos contactar el servicio de precios. Revisa tu conexión e inténtalo otra vez.',
    errorValidation: 'Revisa los campos marcados.',
    errorPostalCode: 'Ingresa un código postal válido de 5 dígitos.',
    errorRateLimited:
      'Demasiadas cotizaciones en poco tiempo. Espera un momento e inténtalo de nuevo.',
  },

  admin: {
    title: 'Freshness Touch · Panel',

    /* --------------------------- Acceso ---------------------------- */
    signIn: 'Iniciar sesión',
    signingIn: 'Entrando…',
    signOut: 'Cerrar sesión',
    signInHint: 'Acceso solo para personal.',
    email: 'Correo electrónico',
    password: 'Contraseña',
    signedOut: {
      manual: 'Has cerrado la sesión.',
      idle: 'Se cerró tu sesión tras 30 minutos sin actividad.',
      expired: 'Tu sesión ha terminado. Vuelve a iniciar sesión.',
      noAccess: 'Esta cuenta no tiene acceso al panel de administración.',
    },

    /* --------------------------- Agenda ---------------------------- */
    filterDate: 'Fecha',
    filterStatus: 'Estado',
    filterAnyStatus: 'Cualquier estado',
    filterSearch: 'Buscar',
    filterSearchPlaceholder: 'Referencia, nombre o correo',
    noBookings: 'Ninguna reserva coincide con estos filtros.',
    assignedTo: 'Asignada a {{names}}',
    back: 'Volver a la agenda',
    durationMinutes: '{{minutes}} min en el domicilio',

    actions: 'Acciones',
    noActions: 'No queda nada por hacer en esta reserva.',
    reason: 'Motivo',
    reasonPlaceholder: '¿Por qué haces esto?',
    reasonHelp: 'Se guarda con tu nombre en el registro de auditoría.',
    reasonRequired: 'Escribe antes un motivo.',
    depositHeld: 'Hay {{amount}} retenidos en la tarjeta, sin cobrar.',
    captureDeposit: 'Cobrar el depósito',
    releaseDeposit: 'Liberar la retención',
    depositHelp:
      'Cóbralo solo si el cliente canceló con el equipo ya en camino o no estaba en casa. Si no, libéralo.',
    action: {
      CONFIRMED: 'Marcar como confirmada',
      IN_PROGRESS: 'El equipo ha llegado',
      COMPLETED: 'Marcar como completada',
      CANCELLED: 'Cancelar la reserva',
      NO_SHOW: 'El cliente no estaba',
      PENDING_PAYMENT: 'Volver a pendiente de pago',
    },
    status: {
      PENDING_PAYMENT: 'Pendiente de pago',
      CONFIRMED: 'Confirmada',
      IN_PROGRESS: 'En curso',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada',
      NO_SHOW: 'No estaban',
    },

    role: {
      ADMIN: 'Administración',
      DISPATCHER: 'Coordinación',
      CLEANER: 'Limpieza',
    },

    /* --------------------------- Detalle --------------------------- */
    customer: 'Cliente',
    name: 'Nombre',
    phone: 'Teléfono',
    address: 'Dirección',
    accessNotes: 'Instrucciones de acceso',
    accessNotesWarning:
      'Dato sensible: no lo leas en alto delante de terceros y cierra esta página al levantarte.',
    customerNotes: 'Notas del cliente',
    /* ---------------------------- Equipo ---------------------------- */
    team: 'Equipo',
    teamAssign: 'Asignar equipo',
    teamChange: 'Cambiar equipo',
    teamEmpty: 'Todavía no hay nadie asignado a este trabajo.',
    teamLead: 'Responsable',
    teamHelp:
      'Marca a quien va y elige un responsable. El responsable es quien decide si surge un imprevisto en la casa.',
    teamSave: 'Guardar equipo',
    teamDiscard: 'Descartar cambios',
    teamNoStaff: 'No hay personal activo al que asignar. Da de alta a alguien primero.',
    teamNoLeadWarning:
      'Este equipo no tiene responsable. Si surge algo en la casa, nadie sabrá quién decide.',
    teamCancelledNote:
      'La reserva está cancelada: el equipo se conserva como histórico y no se puede cambiar.',

    pricing: 'Desglose del precio',
    total: 'Total',
    deposit: 'Depósito de traslado',
    balanceDue: 'A pagar el día del servicio',
    payment: 'Pago',
    paymentStatus: 'Estado',
    held: 'Retenido en la tarjeta',
    card: 'Tarjeta',
    holdExpires: 'La retención caduca',
    noPayment: 'No se llegó a crear ninguna retención para esta reserva.',

    paymentState: {
      REQUIRES_PAYMENT_METHOD: 'Falta la tarjeta',
      REQUIRES_CONFIRMATION: 'Falta confirmar',
      REQUIRES_ACTION: 'Esperando al banco (3D Secure)',
      PROCESSING: 'En curso en el banco',
      REQUIRES_CAPTURE: 'Autorizado, sin cobrar',
      SUCCEEDED: 'Cobrado',
      CANCELED: 'Liberado',
      FAILED: 'Rechazado',
    },

    /* ----------------------- Configuracion ------------------------- */
    settings: {
      title: 'Datos del negocio',
      backToAgenda: 'Volver a la agenda',
      intro: 'Estos datos salen en la web publica. Los cambios aparecen alli en unos minutos.',

      contact: 'Contacto',
      phone: 'Telefono',
      phoneSaved: 'Se guardara como {{value}}',
      phoneEmpty: 'Sin telefono. La web no mostrara boton de llamar.',
      email: 'Correo electronico',
      emailHelp: 'Aparece en la seccion de contacto de la web.',
      emailEmpty: 'Sin correo. La web no mostrara enlace de correo.',

      hours: 'Horario',
      hoursHelp:
        'Este horario decide a que horas puede reservar un cliente. Cerrar un dia no cancela las reservas que ya haya ese dia.',
      open: 'Abierto',
      closed: 'Cerrado',
      opensAt: 'Hora de apertura del {{day}}',
      closesAt: 'Hora de cierre del {{day}}',
      day: {
        1: 'Lunes',
        2: 'Martes',
        3: 'Miercoles',
        4: 'Jueves',
        5: 'Viernes',
        6: 'Sabado',
        7: 'Domingo',
      },

      phoneInvalid: 'Escribe un telefono valido, por ejemplo (404) 555-0123.',
      emailInvalid: 'Escribe un correo valido.',
      hoursInvalid: 'Revisa este horario: la hora de cierre debe ser posterior a la de apertura.',

      save: 'Guardar cambios',
      saving: 'Guardando…',
      saved: 'Guardado.',
      lastChange: 'Ultimo cambio: {{who}}, el {{when}}.',
      unknownAuthor: 'alguien que ya no esta en el equipo',
    },

    /* -------------------------- Avisos ----------------------------- */
    notifications: {
      title: 'Avisos',
      intro: 'Qué se envía y a dónde llega.',

      customerEmails: 'Correos al cliente',
      emailBookingConfirmed: 'Enviar confirmación cuando se paga una reserva',
      emailBookingConfirmedHelp:
        'El cliente recibe su referencia, la fecha, la dirección y lo retenido en su tarjeta. Si lo apagas, quien acaba de pagar no recibe nada por escrito.',
      emailBookingCancelled: 'Enviar correo cuando se cancela una reserva',
      emailBookingCancelledHelp:
        'Nunca incluye el motivo interno que escribe el equipo: solo que la reserva quedó cancelada.',

      emailBookingReminder: 'Enviar un recordatorio la víspera',
      emailBookingReminderHelp:
        'Reduce las ausencias, que son el gasto más tonto de este negocio: el equipo se desplaza, no puede entrar y la franja ya no se puede vender.',
      reminderHoursBefore: 'Horas de antelación',
      reminderHoursBeforeHelp:
        'Entre 2 y 72. Las reservas se hacen con 24 horas mínimo, así que un número bajo pondría el recordatorio pegado a la confirmación.',
      reminderHoursBeforeInvalid: 'Escribe un número entre 2 y 72.',

      internal: 'Avisos para tu equipo',
      internalEmail: 'Copiar los correos del cliente a',
      internalEmailHelp: 'Ese buzón recibe el mismo correo que recibió el cliente.',
      internalEmailEmpty: 'No se envía copia.',
      internalEmailInvalid: 'Escribe un correo válido.',
      telegramOnNewBooking: 'Enviar un mensaje de Telegram por cada reserva nueva',
      telegramOnNewBookingHelp:
        'Solo de las reservas confirmadas y pagadas. Los formularios abandonados no se avisan, para que el aviso siga mereciendo la pena leerlo.',
      telegramChatId: 'Chat de Telegram',
      telegramChatIdHelp:
        'El identificador numérico del chat. Escribe a tu bot y ábrelo en api.telegram.org/bot<token>/getUpdates para leerlo.',
      telegramChatIdInvalid: 'El identificador de chat es un número, por ejemplo 123456789.',

      credentialsNote:
        'La clave del proveedor de correo y el token del bot se configuran en el servidor, no aquí. Una credencial guardada en la base de datos acaba en cada copia de seguridad, así que viven en el entorno del servidor junto a las claves de pago.',
    },

    /* --------------------------- Errores --------------------------- */
    errorSessionExpired: 'Tu sesión ha terminado. Vuelve a iniciar sesión.',
    errorNoAccess: 'Esta cuenta no tiene acceso al panel de administración.',
    errorBookingNotFound: 'No encontramos esa reserva.',
    errorStaffDoubleBooked:
      'Esa persona ya tiene otro trabajo a la misma hora. Quítala del equipo o cambia una de las dos citas.',
    errorStaffNotAssignable:
      'Alguien del equipo ya no está activo. Actualiza la página y vuelve a elegir.',
    errorAssignCancelled: 'No se puede asignar equipo a una reserva cancelada.',
    errorInvalidTransition:
      'Ese cambio no es posible desde el estado actual. Puede que alguien acabe de cambiarlo.',
    errorPaymentNotCapturable: 'Esta reserva no tiene una retención sobre la que se pueda actuar.',
    errorHoldExpired: 'La retención en la tarjeta ha caducado y ya no se puede cobrar.',
    errorCaptureTooLarge: 'No se puede cobrar más de lo que se retuvo.',
    errorInvalidCredentials: 'Esos datos no son correctos.',
    errorNetwork: 'No pudimos contactar con el servidor. Revisa tu conexión.',
    errorGeneric: 'Algo salió mal. Inténtalo de nuevo.',
    errorNotConfigured: 'El inicio de sesión no está configurado en este despliegue.',
  },
  booking: {
    /* ----------------------------- Llamada ----------------------------- */
    cta: 'Reservar esta limpieza',
    title: 'Reserva tu limpieza',
    close: 'Cerrar',
    back: 'Atrás',
    next: 'Continuar',
    stepOf: 'Paso {{current}} de {{total}}',
    steps: {
      schedule: 'Fecha y hora',
      details: 'Tus datos',
      payment: 'Tarjeta',
    },

    /* ------------------------- 1. Fecha y hora ------------------------- */
    schedule: {
      title: 'Elige día y hora',
      dateLabel: 'Fecha',
      loading: 'Consultando disponibilidad…',
      closed: 'Ese día no abrimos. Elige otro, por favor.',
      none: 'No quedan horas libres ese día. Elige otro, por favor.',
      duration: 'Este trabajo dura unas {{duration}}.',
      timezone: 'Todas las horas son de Georgia (hora del Este).',
      leadTime: 'Necesitamos al menos 24 horas para preparar al equipo.',
      fullyBooked: 'Sin equipo libre',
      tooSoon: 'Demasiado pronto',
      doesNotFit: 'No da tiempo ese día',
    },

    /* --------------------- 2. Direccion y contacto --------------------- */
    details: {
      title: 'Dónde y quién',
      addressTitle: 'Dirección del servicio',
      contactTitle: 'Datos de contacto',
      firstName: 'Nombre',
      lastName: 'Apellidos',
      email: 'Correo electrónico',
      phone: 'Teléfono',
      line1: 'Calle y número',
      line2: 'Apartamento, suite, unidad (opcional)',
      city: 'Ciudad',
      state: 'Estado',
      postalCode: 'Código postal',
      postalCodeLocked: 'Viene de tu cotización. Cámbialo allí para calcular otra zona.',
      accessNotes: 'Instrucciones de acceso (opcional)',
      accessNotesHelp:
        'Código del portón, dónde está la llave, si hay perro en el jardín. Solo lo ven el equipo asignado a tu trabajo y nuestra oficina.',
      customerNotes: '¿Algo más que debamos saber? (opcional)',
      marketingOptIn: 'Quiero recibir ofertas y consejos de limpieza de vez en cuando.',
      priceNotice:
        'El precio final se confirma con la dirección completa, así que puede variar ligeramente respecto a la estimación.',
    },

    /* ----------------------------- 3. Pago ----------------------------- */
    payment: {
      title: 'Asegura tu reserva',
      depositTitle: 'Depósito de traslado',
      depositExplainer:
        'Retenemos {{amount}} en tu tarjeta. No es un cobro: se acredita íntegro contra tu factura final y solo lo cobramos si cancelas cuando nuestro equipo ya va en camino.',
      holdExpires: 'Tu franja queda reservada hasta las {{time}}.',
      dueLater: 'A pagar el día del servicio',
      authorise: 'Autorizar retención de {{amount}}',
      working: 'Hablando con tu banco…',
      simulatedTitle: 'Pago simulado',
      simulatedBody:
        'El pago con tarjeta todavía no está conectado, así que no se mueve dinero ni se piden datos de tarjeta. Este botón completa la reserva igual que lo hará el de verdad.',
      simulatedDecline: 'Simular tarjeta rechazada',
      unavailableTitle: 'El pago con tarjeta no está disponible ahora mismo',
      unavailableBody:
        'Tu franja queda reservada. Llámanos al {{phone}} y terminamos la reserva contigo.',
      unavailableBodyNoPhone:
        'Tu franja queda reservada. Te escribiremos por correo para terminar la reserva contigo.',
    },

    /* -------------------------- Confirmacion --------------------------- */
    done: {
      title: 'Tu limpieza está reservada',
      reference: 'Referencia de la reserva',
      referenceHelp: 'Tenla a mano: es la forma más rápida de que encontremos tu reserva.',
      when: 'Cuándo',
      where: 'Dónde',
      held: 'Retenido en tu tarjeta',
      dueLater: 'A pagar el día del servicio',
      contact: 'Te llamaremos al {{phone}} si necesitamos algo antes de la visita.',
      contactNoPhone: 'Te escribiremos por correo si necesitamos algo antes de la visita.',
      finish: 'Listo',
      pendingTitle: 'Reserva recibida, pago pendiente',
      pendingBody:
        'No pudimos iniciar la retención en tu tarjeta, así que la reserva aún no está confirmada. Llámanos al {{phone}} y la terminamos contigo.',
      pendingBodyNoPhone:
        'No pudimos iniciar la retención en tu tarjeta, así que la reserva aún no está confirmada. Te escribiremos por correo para terminarla contigo.',
      declinedTitle: 'Tu tarjeta fue rechazada',
      declinedBody: 'La franja ha quedado libre. Puedes empezar de nuevo con otra tarjeta.',
      tryAgain: 'Empezar de nuevo',
    },

    /* ----------------------------- Errores ----------------------------- */
    errorTitle: 'No pudimos completar tu reserva',
    errorRequired: 'Este campo es obligatorio.',
    errorEmail: 'Escribe un correo electrónico válido.',
    errorPhone: 'Escribe un teléfono de EE. UU. válido.',
    errorPostalCode: 'Escribe un código postal válido de 5 dígitos.',
    errorDateRequired: 'Elige una fecha.',
    errorSlotRequired: 'Elige una hora.',
    errorSlotTaken: 'Acaban de ocupar esa hora. Elige otra franja, por favor.',
    errorAlreadyBooked: 'Ya tienes una reserva a esa hora.',
    errorRequiresWalkthrough:
      'Los trabajos comerciales se agendan tras una visita gratuita. Contáctanos y la organizamos.',
    errorDateOutOfRange: 'Elige una fecha dentro de los próximos 90 días.',
    errorNotBookable: 'No podemos reservar este trabajo en línea. Contáctanos y te ayudamos.',
    errorPaymentNotFound: 'No encontramos ese pago. Empieza de nuevo, por favor.',
  },
  quote: {
    line: {
      service: {
        STANDARD:
          'Limpieza estándar · {{bedrooms}} hab / {{bathrooms}} baños · {{squareFeet}} pies²',
        DEEP: 'Limpieza profunda · {{bedrooms}} hab / {{bathrooms}} baños · {{squareFeet}} pies²',
        MOVE_IN_OUT: 'Mudanza · {{bedrooms}} hab / {{bathrooms}} baños · {{squareFeet}} pies²',
        POST_CONSTRUCTION:
          'Post-construcción · {{bedrooms}} hab / {{bathrooms}} baños · {{squareFeet}} pies²',
        AIRBNB_TURNOVER:
          'Rotación Airbnb · {{bedrooms}} hab / {{bathrooms}} baños · {{squareFeet}} pies²',
        COMMERCIAL: 'Limpieza comercial',
      },
      addOn: {
        INSIDE_FRIDGE: 'Interior del refrigerador',
        INSIDE_OVEN: 'Interior del horno',
        INSIDE_CABINETS: 'Interior de gabinetes de cocina',
        INTERIOR_WINDOWS: 'Ventanas por dentro (x{{quantity}})',
        LAUNDRY: 'Lavandería ({{quantity}} cargas)',
        BASEMENT: 'Sótano',
        GARAGE: 'Garaje',
        PET_HAIR: 'Exceso de pelo de mascotas',
        PATIO: 'Balcón o patio',
        BED_LINENS: 'Ropa de cama (x{{quantity}})',
      },
      discount: {
        ONE_TIME: 'Descuento',
        WEEKLY: 'Descuento por servicio semanal ({{percent}}%)',
        BIWEEKLY: 'Descuento por servicio quincenal ({{percent}}%)',
        MONTHLY: 'Descuento por servicio mensual ({{percent}}%)',
      },
      minimumAdjustment: 'Mínimo del servicio (${{minimum}})',
      zoneSurcharge: 'Recargo por traslado · zona {{zone}} ({{miles}} millas)',
      salesTax: 'Impuesto sobre ventas ({{percent}}%)',
    },
    disclaimer: {
      estimate:
        'Este es un estimado basado en la información que nos diste. El precio final se confirma en el lugar antes de comenzar.',
      deposit:
        'El depósito de traslado se autoriza en tu tarjeta al reservar y se acredita íntegramente contra tu factura final. Solo se cobra si cancelas cuando nuestro equipo ya va en camino.',
      taxExempt:
        'Los servicios de limpieza están exentos del impuesto sobre ventas en el estado de Georgia.',
      validity: 'Esta cotización es válida por 7 días.',
      distanceEstimated:
        'La distancia se estima desde tu código postal y se confirma cuando tengamos la dirección completa.',
    },
    review: {
      commercialWalkthrough:
        'Los trabajos comerciales se cotizan tras una visita gratuita para ajustar el alcance a tus instalaciones.',
      outOfServiceArea:
        'Este código postal está fuera de nuestra zona habitual. Aun así podríamos ayudarte: consúltanos.',
      outOfState: 'Por ahora operamos únicamente en el estado de Georgia.',
      largeProperty:
        'Las propiedades grandes se cotizan de forma individual para que el estimado sea preciso.',
    },
    tax: {
      gaExempt: 'Exento — los servicios de limpieza no pagan impuesto en Georgia',
    },
  },

  whyUs: {
    title: '¿Por qué Freshness Touch?',
    insured: {
      title: 'Asegurados y afianzados',
      body: 'Póliza de responsabilidad civil y fianza de limpieza que protegen tu hogar y tus bienes.',
    },
    vetted: {
      title: 'Equipo verificado',
      body: 'Cada persona del equipo pasa verificación de antecedentes penales e identidad antes de su primer trabajo.',
    },
    transparent: {
      title: 'Precios transparentes',
      body: 'Ves el desglose completo antes de reservar: servicio, extras, traslado y depósito.',
    },
    guarantee: {
      title: 'Garantía de repaso',
      body: '¿Algo no quedó bien? Avísanos dentro de 24 horas y volvemos a corregirlo.',
    },
  },

  areas: {
    title: 'Zonas de servicio',
    subtitle:
      'Trabajamos por zonas para reducir el tiempo de traslado y mantener tu precio justo. Ingresa tu código postal en el cotizador para ver tu zona.',
    zoneLabel: 'Zona {{zone}}',
    upToMiles: 'Hasta {{miles}} millas desde nuestra base',
    beyondMiles: 'Más allá de {{miles}} millas',
    noSurcharge: 'Sin recargo por traslado',
    surcharge: 'Recargo por traslado de {{amount}}',
    outOfRange: 'Fuera de nuestra zona habitual — contáctanos para una propuesta personalizada',
  },

  faq: {
    title: 'Preguntas frecuentes',
    q1: {
      q: '¿Tengo que pagar impuesto sobre ventas?',
      a: 'No. En Georgia los servicios de limpieza están exentos del sales tax, así que el precio que ves es el que pagas.',
    },
    q2: {
      q: '¿Qué es exactamente el depósito de traslado?',
      a: 'Es una retención reembolsable calculada según la distancia entre tu casa y nuestra base. Se autoriza en tu tarjeta al reservar, se descuenta de la factura final y solo se cobra si cancelas cuando el equipo ya va en camino.',
    },
    q3: {
      q: '¿Debo estar en casa durante la limpieza?',
      a: 'No. Muchos clientes dejan instrucciones de acceso al reservar. Tú decides qué te resulta más cómodo.',
    },
    q4: {
      q: '¿Llevan sus propios productos?',
      a: 'Sí, el equipo llega con equipo y productos profesionales. Si prefieres que usemos los tuyos, solo avísanos.',
    },
    q5: {
      q: '¿Debo dejar propina?',
      a: 'La propina nunca es obligatoria. Es común dejar entre 15% y 20% en limpiezas puntuales, profundas o de mudanza; en servicios recurrentes muchos clientes prefieren un bono de fin de año.',
    },
    q6: {
      q: '¿Cómo reprogramo o cancelo?',
      a: 'Contáctanos al menos 24 horas antes de tu cita y la movemos sin costo.',
    },
  },

  contact: {
    title: 'Cuando tú digas',
    subtitle: 'Obtén tu precio en línea o habla con una persona: como prefieras.',
    phone: 'Teléfono',
    email: 'Correo',
    hours: 'Horario',
    closed: 'Cerrado',
    day: {
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
      6: 'Sábado',
      7: 'Domingo',
    },
    serviceArea: 'Con base en {{city}}, {{state}}',
  },

  footer: {
    rights: 'Todos los derechos reservados.',
    legalNote:
      'Los precios mostrados son estimados y se confirman antes de iniciar cualquier trabajo.',
    privacy: 'Privacidad',
    terms: 'Términos',
  },
};
