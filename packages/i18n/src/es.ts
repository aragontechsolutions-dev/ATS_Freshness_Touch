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
    scope: 'Qué incluye',
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

  /**
   * QUE ENTRA Y QUE NO ENTRA EN UNA LIMPIEZA
   * ----------------------------------------
   * Sale de las plantillas de trabajo que usa el equipo, no de un texto
   * comercial. Esa es la gracia: lo que el cliente lee aqui es EXACTAMENTE
   * la lista que la persona que va a su casa tiene delante.
   *
   * La lista de lo que NO se limpia esta en el sitio a proposito, y no
   * escondida en las condiciones. Casi todas las quejas de una limpieza
   * salen de algo que el cliente daba por incluido; decirlo antes cuesta
   * una seccion y evita la discusion entera.
   */
  scope: {
    title: '¿Qué incluye una limpieza?',
    subtitle:
      'Esta es la misma lista de tareas que lleva el equipo cuando llega a tu casa. Sin letra pequeña.',

    /** Los extras: se piden aparte y se cobran aparte. */
    extrasTitle: 'Servicios adicionales',
    extrasNote: 'Se añaden al cotizador y se suman al precio. No entran en la limpieza normal.',

    /** Lo que se cobra por cada unidad, como las ventanas. */
    perUnit: 'cada una',

    notIncludedTitle: 'Lo que no limpiamos',
    notIncludedNote:
      'Lo decimos antes, no después: si necesitas algo de esta lista, dínoslo y te orientamos hacia quien sí lo hace.',
    notIncluded: {
      patios: 'Patios',
      porches: 'Porches',
      exteriorWindows: 'Ventanas por fuera',
      windowTracks: 'Rieles de ventanas',
      dishes: 'Platos y lavavajillas',
      walls: 'Paredes',
      fullFridgeAndCabinets: 'Refrigerador y gabinetes con cosas dentro',
      smallAppliances: 'Mini hornos y freidoras de aire',
    },
  },

  frequency: {
    /** Para la cadencia que un servicio concreto no ofrece. */
    notOffered: 'Este servicio no se contrata con esta frecuencia',
    title: '¿Con qué frecuencia?',
    ONE_TIME: 'Una vez',
    WEEKLY: 'Semanal',
    BIWEEKLY: 'Cada 2 semanas',
    MONTHLY: 'Mensual',
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

    /* ------------------- Comunes de toda la interfaz ------------------- */
    loading: 'Cargando…',
    working: 'Un momento…',
    retry: 'Reintentar',
    agenda: 'Agenda',
    toastClose: 'Descartar aviso',
    showPassword: 'Mostrar la contraseña',
    hidePassword: 'Ocultar la contraseña',

    /*
     * Confirmaciones de acciones que hasta ahora no decian nada al terminar:
     * el boton se quedaba quieto y no habia forma de saber si habia pasado.
     */
    toast: {
      statusChanged: 'Reserva actualizada.',
      depositCaptured: 'Depósito cobrado.',
      depositReleased: 'Retención liberada.',
      teamSaved: 'Equipo guardado.',
      staffSaved: 'Ficha guardada.',
      jobStarted: 'Llegada registrada.',
      jobFinished: 'Trabajo marcado como terminado.',
    },

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

    rates: {
      title: 'Tarifas',
      intro:
        'Los precios con los que cotiza el sitio. Cada cotización nueva se calcula con lo que haya aquí.',
      onlyFuture:
        'Lo que ya está reservado no cambia: cada reserva guarda los precios con los que se calculó. Esto afecta solo a las cotizaciones a partir de ahora.',

      services: 'Precio por servicio y frecuencia',
      servicesHelp:
        'En cada frecuencia manda el importe más alto de los dos: el plano o el que sale por pies cuadrados. Desmarcar una frecuencia significa que ese servicio no se ofrece así.',
      flat: 'Importe',
      perSquareFoot: 'Por pie²',
      noSize: 'no aplica',
      notOffered: 'No se ofrece en esta frecuencia',

      addOns: 'Extras',
      amount: 'Importe',
      maxQuantity: 'Máx.',

      depositAndTravel: 'Depósito y traslado',
      depositHelp:
        'El depósito se retiene al reservar y se descuenta del total: no es un cargo extra. El traslado no se cobra dentro del radio; más allá se cobran las millas que sobran.',
      deposit: 'Depósito',
      freeRadius: 'Radio sin recargo',
      perMile: 'Por milla',
      irsRate: 'tarifa del IRS',
      roundTrip: 'Cobrar las millas de ida y vuelta',

      save: 'Guardar tarifas',
      saved: 'Tarifas guardadas. Las cotizaciones nuevas ya usan estos precios.',
      invalidNumbers: 'Revisa los importes: hay algún campo que no es un número.',
      outOfRange: 'Ese importe está fuera de lo razonable. Revisa «{{field}}»: ¿sobra un cero?',
      errOneTimeRequired:
        'Un servicio tiene que poder contratarse una sola vez: deja marcada la frecuencia «Una vez».',
      errFrequencyOrder:
        'El precio no puede subir al aumentar la frecuencia: quien viene cada semana pagaría más que quien viene una vez.',
      currentVersion: 'Versión {{version}} · {{count}} guardadas en total',
    },

    /* ----------------------- Area de servicio ----------------------- */
    serviceArea: {
      title: 'Área de servicio',
      intro:
        'Hasta dónde nos desplazamos y dónde sale el precio solo. Cada reserva que entre a partir de ahora se cobra con esto.',
      preview: 'Vista previa',
      mapDescription:
        'Mapa del área de servicio: anillos concéntricos alrededor de la base que llegan hasta {{miles}} millas.',
      mapZone: 'Zona {{zone}} — hasta {{miles}} millas',
      legendInstant: 'Precio al instante',
      legendOnRequest: 'Precio en persona',
      summary: 'Llegamos hasta {{total}} millas. El precio sale solo hasta {{instant}}.',

      zones: 'Zonas',
      zonesHelp:
        'Cada anillo tiene que llegar más lejos que el anterior. Cuando una zona deja de dar precio automático, las siguientes tampoco pueden darlo.',
      zoneName: 'Zona {{zone}}',
      maxMiles: 'Hasta (millas)',
      surcharge: 'Recargo por traslado ($)',
      /*
       * Se dice lo que PASA si se desmarca, no el nombre del ajuste. «Precio
       * automatico» no le dice a nadie que el cotizador dejara de dar una
       * cifra en esa zona.
       */
      instantQuote: 'El cotizador da precio aquí al momento',
      invalidNumbers:
        'Revisa los números: las millas y los recargos tienen que ser cifras válidas.',
      saved: 'Área de servicio guardada.',
    },

    /* --------------------------- Personal --------------------------- */
    staff: {
      title: 'Personal',
      intro:
        'Quién trabaja aquí. Dar de alta a alguien le permite recibir trabajos asignados; entrar al panel es aparte y se concede con una invitación.',
      add: 'Dar de alta',
      edit: 'Editar',
      save: 'Guardar',
      discard: 'Descartar',
      empty: 'Todavía no hay nadie dado de alta.',
      inactiveHeading: 'De baja',

      firstName: 'Nombre',
      lastName: 'Apellido',
      email: 'Correo electrónico',
      emailHelp:
        'Es su dirección de contacto y a donde va la invitación. Cambiarla no cambia con qué cuenta entra quien ya tiene acceso.',
      phone: 'Teléfono',
      phoneOptional: 'Teléfono (opcional)',
      role: 'Puesto',
      active: 'Activa',
      activeHelp:
        'Al dar de baja, deja de entrar al panel en el acto y no se le puede asignar trabajo. La ficha y su historial se conservan.',

      locale: 'Idioma',
      localeHelp: 'En este idioma se le escribe, empezando por el correo de invitación.',
      localeName: { en: 'Inglés', es: 'Español' },
      accessNONE: 'Sin acceso',
      accessINVITED: 'Invitada',
      accessLINKED: 'Con acceso',
      accessNoneHelp: 'Puede recibir trabajos asignados, pero no puede entrar al panel.',
      accessInvitedHelp:
        'Invitada el {{date}}. Podrá entrar cuando abra el enlace del correo y elija contraseña.',
      accessLinkedHelp: 'Tiene una cuenta vinculada y puede entrar al panel.',
      invite: 'Invitar al panel',
      resend: 'Reenviar la invitación',
      resendConfirm:
        'Recibirá un enlace nuevo para elegir contraseña. El anterior dejará de funcionar. ¿Continuar?',
      resendSent: 'Invitación reenviada.',
      signsInWith: 'Entra con {{email}}',
      signsInWithHelp:
        'Su correo de contacto se cambió después de crear la cuenta. Cambiarlo aquí no cambia la cuenta, así que esta es la dirección con la que tiene que iniciar sesión.',
      inviteConfirm:
        'Va a recibir un correo para crear su contraseña y podrá ver los datos de todos los clientes. ¿Continuar?',
      inviteUnavailable:
        'Este despliegue no tiene configurado el envío de invitaciones. Falta la clave de servicio en el servidor.',
      inviteSent: 'Invitación enviada.',
      selfNote: 'Esta es tu ficha: no puedes cambiarte el puesto ni darte de baja tú misma.',
    },

    /* -------------------------- Auditoria -------------------------- */
    audit: {
      title: 'Registro de actividad',
      intro:
        'Quién hizo qué, desde dónde y cuándo. Las entradas no se editan ni se borran desde aquí: se guardan un año y luego se eliminan solas.',

      /*
       * Aviso deliberado y permanente en pantalla. Quien abre esto tiene que
       * saber que su propia consulta queda anotada, porque es justo lo que
       * impide usar el registro para vigilar a los companeros sin que se sepa.
       */
      selfNote: 'Abrir esta pantalla también queda registrado, junto con los filtros que uses.',

      filters: 'Filtros',
      apply: 'Aplicar filtros',
      clear: 'Limpiar',
      anyActor: 'Cualquiera',
      anyAction: 'Cualquier acción',
      anySurface: 'Desde cualquier sitio',
      actor: 'Persona',
      what: 'Acción',
      where: 'Desde',
      from: 'Desde el día',
      to: 'Hasta el día',

      empty: 'No hay nada que coincida con estos filtros.',
      loadMore: 'Cargar entradas anteriores',
      loadingMore: 'Cargando…',
      endOfList: 'Esto es todo con estos filtros.',
      countShown: 'Se muestran {{count}} entradas.',

      systemActor: 'El sistema',
      customerActor: 'Un cliente',
      unknownActor: 'Ficha de personal eliminada',
      ip: 'IP {{value}}',
      details: 'Detalles',

      /* ------------------- Lo que dice cada entrada ------------------- */
      /**
       * Nombres de los campos de la metadata. La clave es el nombre crudo
       * tal y como lo escribe el servidor, asi que anadir un campo nuevo a
       * una accion solo obliga a anadir su etiqueta aqui; mientras no este,
       * se pinta el nombre crudo en vez de desaparecer.
       */
      field: {
        role: 'Puesto',
        email: 'Correo',
        reason: 'Motivo',
        amountCents: 'Importe',
        totalCents: 'Total de la reserva',
        service: 'Servicio',
        zone: 'Zona',
        scheduledStart: 'Agendada para',
        from: 'Antes',
        to: 'Después',
        fromDate: 'Desde',
        toDate: 'Hasta',
        source: 'Marcado desde',
        required: 'Puestos permitidos',
        isActive: 'Activo',
        deleted: 'Entradas borradas',
        olderThan: 'Anteriores a',
        changed: 'Se cambió',
        teamBefore: 'Equipo antes',
        teamAfter: 'Equipo después',
        filters: 'Filtros',
        actorId: 'Persona',
        action: 'Acción',
        surface: 'Desde',
        entityType: 'Sobre',
        entityId: 'Registro',
      },

      value: {
        yes: 'Sí',
        no: 'No',
        none: '—',
        nobody: 'Nadie',
        lead: '{{name}} (responsable)',
        unknownPerson: 'Alguien que ya no está en la lista de personal',
        zone: 'Zona {{zone}}',
        updated: 'Actualizado',
        noChanges: 'No cambió nada',
        noFilters: 'Sin filtros: se pidió el registro entero',
        source: { 'my-jobs': 'La pantalla «Mis trabajos»' },
      },

      /** Sobre qué fue. El nombre se resuelve al leer, no se guarda. */
      target: {
        booking: 'Reserva {{reference}}',
        staff: 'Ficha de personal: {{name}}',
      },

      /** Campos de configuración, por su nombre en la pantalla que los edita. */
      settingsField: {
        phone: 'Teléfono',
        email: 'Correo',
        hours: 'Horario',
        radiusMilesBefore: 'Cobertura antes',
        radiusMilesAfter: 'Cobertura después',
        instantRadiusMilesBefore: 'Precio automático antes',
        instantRadiusMilesAfter: 'Precio automático después',
        zones: 'Zonas',
        internalEmail: 'Buzón interno',
        telegramChatId: 'Chat de Telegram',
        telegramOnNewBooking: 'Telegram al entrar una reserva',
        emailBookingConfirmed: 'Correo de confirmación',
        emailBookingCancelled: 'Correo de cancelación',
        emailBookingReminder: 'Correo de recordatorio',
        reminderHoursBefore: 'Horas de antelación del recordatorio',
      },

      day: {
        today: 'Hoy',
        yesterday: 'Ayer',
      },

      /**
       * Detalles técnicos. Aquí van la IP, los identificadores y el JSON
       * crudo: nada se pierde, solo deja de estorbar a quien no lo necesita.
       */
      technical: 'Detalles técnicos',
      technicalHelp:
        'Los datos exactos tal y como se registraron. Útiles si hay que reportar un problema.',
      rawData: 'Datos registrados',

      /** Categorías del desplegable de acciones, en lenguaje llano. */
      group: {
        access: 'Entrar al sistema',
        bookings: 'Reservas',
        money: 'Dinero',
        staff: 'Personal',
        settings: 'Configuración',
        sensitive: 'Datos de clientes',
        log: 'Este registro',
      },

      /* Desde donde se hizo. */
      surface: {
        PANEL: 'Panel de administración',
        SITE: 'Sitio público',
        SYSTEM: 'Automático',
        FIELD: 'Aplicación de campo',
      },

      /* Sobre que. */
      entity: {
        booking: 'Reserva',
        staff: 'Ficha de personal',
        business_settings: 'Configuración',
        audit: 'Registro de actividad',
        session: 'Sesión',
      },

      /*
       * Etiqueta de cada accion del catalogo. Va anidada igual que la accion
       * ("booking.status.confirmed"), asi que la clave se construye pegando
       * la accion tal cual y no hay tabla de equivalencias que mantener.
       */
      action: {
        session: {
          opened: 'Inició sesión',
          closed: 'Cerró sesión',
          denied: 'Acceso denegado',
        },
        booking: {
          created: 'Reserva realizada',
          team_changed: 'Cambió el equipo',
          viewed: 'Abrió la ficha de una reserva',
          status: {
            pending_payment: 'Marcó como pendiente de pago',
            confirmed: 'Marcó como confirmada',
            in_progress: 'Marcó como en curso',
            completed: 'Marcó como terminada',
            cancelled: 'Canceló',
            no_show: 'Marcó como ausencia',
          },
        },
        access_notes: {
          viewed: 'Vio las instrucciones de acceso',
        },
        payment: {
          captured: 'Cobró el depósito',
          released: 'Liberó la retención',
        },
        staff: {
          created: 'Dio de alta a una persona',
          updated: 'Cambió una ficha de personal',
          invited: 'Invitó al panel',
          reinvited: 'Volvió a enviar la invitación',
          recovery_sent: 'Pidió volver a entrar y se le mandó el enlace',
        },
        settings: {
          updated: 'Cambió la configuración',
        },
        service_area: {
          updated: 'Cambió el área de servicio',
        },
        pricing: {
          updated: 'Cambió las tarifas',
        },
        notifications: {
          updated: 'Cambió los ajustes de avisos',
        },
        audit: {
          queried: 'Consultó el registro de actividad',
          purged: 'Se borraron solas las entradas caducadas',
        },
      },
    },

    /* ----------------------- Contraseña ----------------------- */
    passwordReset: {
      forgot: '¿Has olvidado tu contraseña?',
      requestTitle: 'Recuperar el acceso',
      requestIntro:
        'Escribe tu correo de trabajo y te enviaremos un enlace para elegir una contraseña nueva.',
      requestSend: 'Enviar enlace',
      backToSignIn: 'Volver al acceso',
      /*
       * EL MISMO MENSAJE EXISTA O NO LA CUENTA. Decir "ese correo no está
       * registrado" convertiría esta pantalla en una forma de averiguar quién
       * trabaja aquí, probando direcciones una a una.
       */
      requestSent:
        'Si esa dirección corresponde a una cuenta, en unos minutos llegará un correo con el enlace. Revisa también la carpeta de no deseado.',

      chooseTitleInvite: 'Bienvenida a Freshness Touch',
      chooseIntroInvite: 'Elige una contraseña para entrar al panel.',
      chooseTitleRecovery: 'Elige una contraseña nueva',
      chooseIntroRecovery: 'Este enlace solo sirve una vez.',
      newPassword: 'Contraseña nueva',
      repeatPassword: 'Repítela',
      minLength:
        'Al menos {{count}} caracteres. Mejor una frase que recuerdes que una palabra con símbolos.',
      choose: 'Guardar contraseña',
      tooShort: 'Necesita al menos {{count}} caracteres.',
      mismatch: 'Las dos no coinciden.',
      saved: 'Contraseña guardada.',

      linkExpired:
        'Este enlace ya no vale: solo sirve una vez y caduca. Pide uno nuevo desde la pantalla de acceso.',
      linkOtherDevice:
        'Este enlace hay que abrirlo en el mismo navegador desde el que lo pediste. Pídelo de nuevo desde este dispositivo.',
      savedNoAccess:
        'Tu contraseña se ha guardado, pero esta cuenta no tiene acceso al panel. Habla con administración.',
      notConfigured: 'El acceso no está configurado en este despliegue.',
    },

    /* ------------------------ Mis trabajos ------------------------ */
    myJobs: {
      title: 'Mis trabajos',
      empty: 'No tienes trabajos asignados. Cuando coordinación te asigne uno, aparecerá aquí.',
      today: 'Hoy',
      upcoming: 'Próximos',
      lead: 'Tú eres la responsable',
      withYou: 'Contigo va',
      withYouLead: 'Responsable',
      howToGetIn: 'Cómo entrar',
      howToGetInWarning:
        'No leas esto en alto delante de nadie y cierra la pantalla al guardar el móvil.',
      customerNotes: 'Lo que pidió el cliente',
      call: 'Llamar',
      directions: 'Cómo llegar',
      rooms: '{{bedrooms}} habitaciones · {{bathrooms}} baños',
      start: 'He llegado',
      finish: 'He terminado',
      finished: 'Terminado',
      finishHint:
        'Marca «He llegado» al entrar en la casa. Queda la hora, y es lo que respalda tu trabajo si alguien pregunta.',
      noActions: 'Coordinación se encarga del resto.',
    },

    unreachable: {
      title: 'No pudimos comprobar tu sesión',
      body: 'Sigues dentro: esto no te ha cerrado la sesión. Puede ser la conexión o que el servidor esté arrancando. Inténtalo de nuevo en unos segundos.',
    },

    /* --------------------------- Errores --------------------------- */
    errorSessionExpired: 'Tu sesión ha terminado. Vuelve a iniciar sesión.',
    errorNoAccess: 'Esta cuenta no tiene acceso al panel de administración.',
    errorBookingNotFound: 'No encontramos esa reserva.',
    errorStaffNotFound: 'No encontramos esa ficha de personal.',
    errorStaffEmailTaken: 'Ya hay alguien dado de alta con ese correo.',
    errorStaffLastAdmin:
      'No se puede: el sistema se quedaría sin ningún administrador activo y nadie podría volver a entrar.',
    errorStaffSelfChange:
      'No puedes cambiarte tu propio puesto ni darte de baja: te quedarías fuera del panel.',
    errorAlreadyInvited:
      'Esa persona ya entra con normalidad, así que no hay nada que enviar. Si ha olvidado su contraseña, puede pedir el enlace ella misma desde la pantalla de acceso.',
    errorStaffAccountTaken:
      'Ese correo ya tiene cuenta, y es de otra ficha de personal. Comprueba si se dio de alta a la misma persona dos veces.',
    errorInviteInactive: 'No se puede invitar a alguien que está de baja.',
    errorInviteUnavailable: 'El envío de invitaciones no está configurado en este despliegue.',
    errorInviteNotDelivered:
      'Se creó la cuenta, pero el correo de invitación no salió. Esa persona puede entrar igualmente pidiendo el enlace desde «¿Has olvidado tu contraseña?».',
    errorInviteFailed: 'El proveedor de identidad rechazó la invitación.',
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
      /**
       * El traslado que SE COBRA HOY: las millas que pasan del radio libre,
       * contadas ida y vuelta.
       */
      travel:
        'Traslado · {{miles}} millas ({{freeRadius}} incluidas, {{billableMiles}} facturadas ida y vuelta)',

      /*
       * LAS TRES DE ABAJO YA NO SE EMITEN. Se quedan porque el panel lee
       * presupuestos y reservas guardados, y sus lineas siguen apuntando a
       * estas claves: borrarlas dejaria el historial mostrando el nombre de
       * la clave en vez del concepto.
       */
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
        'Este código postal queda fuera del área que cubrimos. Aun así podríamos ayudarte: consúltanos.',
      /*
       * Distinto de `outOfServiceArea`, y la diferencia importa: «no
       * vamos» y «vamos, te llamamos con el precio» son dos respuestas
       * opuestas para quien esta pidiendo un presupuesto.
       */
      farZone:
        'Llegamos hasta ahí, pero a esa distancia el precio lo damos en persona: el traslado cambia mucho las cuentas y preferimos darte una cifra real. Déjanos tus datos y te llamamos.',
      outOfState: 'Por ahora operamos únicamente en el estado de Georgia.',
      largeProperty:
        'Las propiedades grandes se cotizan de forma individual para que el estimado sea preciso.',

      /**
       * El servicio existe, pero no en esa cadencia. Distinto de «no damos
       * precio automático»: aquí la salida está en la misma pantalla —
       * cambiar de frecuencia—, no en esperar una llamada.
       */
      frequencyUnavailable:
        'Este servicio no se contrata con esa frecuencia. Elige otra cadencia o escríbenos y lo vemos contigo.',
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

    /**
     * EL TRASLADO YA NO ES UN IMPORTE POR ZONA. Se cobra por milla a partir
     * del radio libre, así que la tarjeta no puede prometer una cifra: lo
     * honesto es decir cómo se cuenta y que el cotizador dé el número.
     */
    travelByMile: 'Traslado por milla a partir del radio incluido',
    outOfRange: 'Fuera del área que cubrimos — contáctanos para una propuesta personalizada',

    /* --------------------------- El mapa --------------------------- */
    /** Lo que oye quien usa lector de pantalla: un mapa sin describir no dice nada. */
    mapDescription:
      'Mapa de nuestra área de servicio: anillos concéntricos alrededor de Atlanta que llegan hasta {{miles}} millas y cubren todo el estado de Georgia.',
    mapZoneInstant: 'Zona {{zone}} — hasta {{miles}} millas · {{amount}}',
    mapZoneOnRequest:
      'Hasta {{miles}} millas — llegamos hasta aquí, y el precio lo damos en persona',
    mapViewLabel: 'Vista del mapa',
    viewWholeState: 'Todo el estado',
    viewInstantArea: 'Área con precio al instante ({{miles}} mi)',
    legendInstant: 'Precio al instante en la web',
    legendOnRequest: 'Precio en persona',

    /**
     * Para las zonas sin precio automatico. NO se les puede decir «sin
     * recargo por traslado»: no es que sea gratis, es que el precio todavia
     * no esta hecho, y prometer lo primero deja a la empresa con una
     * expectativa que no puede cumplir.
     */
    onRequest: 'El precio lo damos en persona',
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
