/**
 * Textos en ingles (idioma por defecto del sitio).
 *
 * Este objeto es la FUENTE DE VERDAD de las claves de traduccion:
 * `es.ts` se declara con el tipo `typeof en`, asi que si falta una clave
 * en espanol el proyecto no compila.
 */
export const en = {
  common: {
    companyName: 'Freshness Touch',
    tagline: 'Professional cleaning across Georgia',
    whatsapp: 'WhatsApp',
    emailUs: 'Email us',
    getQuote: 'Get a Free Quote',
    bookNow: 'Book a Cleaning',
    learnMore: 'Learn more',
    loading: 'Calculating...',
    from: 'from',
    perVisit: 'per visit',
    optional: 'optional',
    language: 'Language',
    theme: { light: 'Light mode', dark: 'Dark mode' },
  },

  /*
   * LAS ETIQUETAS DEL MENU SON MAS CORTAS QUE LOS TITULOS DE SECCION, y es
   * deliberado: en la cabecera compiten por sitio con el logotipo, el
   * telefono, el idioma y el tema, y el contenedor no pasa de 1152 px.
   * «Zonas» en el menu y «Zonas de servicio» como titulo dicen lo mismo, y
   * el titulo es donde hace falta la frase entera.
   */
  nav: {
    services: 'Services',
    scope: "What's included",
    quote: 'Quote',
    areas: 'Areas',
    whyUs: 'Why us',
    faq: 'FAQ',
    contact: 'Contact',
    menu: 'Menu',
  },

  hero: {
    badge: 'Licensed · Insured',
    title: 'A cleaner home, without the guesswork',
    subtitle:
      'Get a real price in under a minute. No callbacks, no surprise fees, and a transparent travel deposit that is credited back on your final bill.',
    primaryCta: 'Get a Free Quote',
    secondaryCta: 'See our services',
    point1: 'Transparent pricing you can see before you book',
    point2: 'Background-checked cleaning professionals',
    point3: 'No sales tax on cleaning services in Georgia',
  },

  services: {
    title: 'Services',
    subtitle: 'Residential and commercial cleaning tailored to how you live and work.',
    startingAt: 'Starting at',
    requiresVisit: 'Requires an on-site walkthrough',
    STANDARD: {
      name: 'Standard cleaning',
      description:
        'Kitchens, bathrooms, floors, dusting and surfaces. Ideal as a recurring weekly, biweekly or monthly service.',
    },
    DEEP: {
      name: 'Deep cleaning',
      description:
        'Everything in a standard clean plus baseboards, vents, detailed scrubbing and hard-to-reach build-up.',
    },
    MOVE_IN_OUT: {
      name: 'Move in / move out',
      description:
        'Empty-property clean for tenants, landlords and buyers. Inside cabinets, appliances and closets included.',
    },
    POST_CONSTRUCTION: {
      name: 'Post-construction',
      description:
        'Fine dust removal, debris pickup and detail work after a renovation or a new build.',
    },
    AIRBNB_TURNOVER: {
      name: 'Airbnb turnover',
      description:
        'Fast, checklist-driven turnovers between guests, with linens and restocking on request.',
    },
    COMMERCIAL: {
      name: 'Commercial & office',
      description:
        'Offices, clinics and retail. Priced after a walkthrough so the scope and schedule match your facility.',
    },
  },

  addOns: {
    title: 'Add-ons',
    INSIDE_FRIDGE: 'Inside the refrigerator',
    INSIDE_OVEN: 'Inside the oven',
    WINDOWS_AND_CABINETS: 'Interior windows and cabinets',
    INSIDE_CABINETS: 'Inside kitchen cabinets',
    INTERIOR_WINDOWS: 'Interior windows',
    LAUNDRY: 'Laundry loads',
    BASEMENT: 'Basement',
    GARAGE: 'Garage',
    PET_HAIR: 'Heavy pet hair',
    PATIO: 'Balcony / patio',
    BED_LINENS: 'Change bed linens',
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
    title: 'What does a cleaning include?',
    subtitle:
      'This is the same task list our team carries when they arrive at your home. No fine print.',

    /** Los extras: se piden aparte y se cobran aparte. */
    extrasTitle: 'Additional services',
    extrasNote:
      'You add these in the quote tool and they are billed on top. They are not part of a regular cleaning.',

    /** Lo que se cobra por cada unidad, como las ventanas. */
    perUnit: 'each',

    notIncludedTitle: 'What we do not clean',
    notIncludedNote:
      'We say it up front, not afterwards: if you need something on this list, tell us and we will point you to someone who does it.',
    notIncluded: {
      patios: 'Patios',
      porches: 'Porches',
      exteriorWindows: 'Exterior windows',
      windowTracks: 'Window tracks',
      dishes: 'Dishes and dishwasher',
      walls: 'Walls',
      fullFridgeAndCabinets: 'Refrigerator and cabinets with items inside',
      smallAppliances: 'Mini ovens and air fryers',
    },
  },

  /* ------------------ La lista de verificacion de un trabajo ------------------ */
  /*
   * LA LISTA QUE EL EQUIPO MARCA EN LA CASA.
   *
   * Esta FUERA de `admin` a proposito, aunque hoy solo se use ahi: las mismas
   * tareas son las que el sitio publico promete en la seccion «que incluye
   * una limpieza» (`scope`). El dia que se pinten en los dos sitios, los dos
   * leeran el mismo texto, y no habra forma de que el sitio prometa una cosa
   * y el equipo lleve otra.
   */
  checklist: {
    title: 'What to do in the house',
    /** «Te quedan 3». Avisa, no bloquea: el trabajo se puede terminar igual. */
    pending_one: '{{count}} task left',
    pending_other: '{{count}} tasks left',
    /* Lo mismo contado para coordinacion, que lee un trabajo ya cerrado. */
    notTicked_one: '{{count}} task not ticked',
    notTicked_other: '{{count}} tasks not ticked',
    allDone: 'Everything on the list is done',
    /** Quien y cuando marco una tarea. */
    doneBy: '{{name}}, {{time}}',
    /** Una tarea que se marco cuando se pedia y que ya no se pide. */
    retired: 'No longer part of this service',

    rooms: {
      COMMON_AREAS: 'Living areas and bedrooms',
      BATHROOM: 'Bathrooms',
      KITCHEN: 'Kitchen',
    },

    /*
     * ======================================================================
     * LAS TAREAS, PENDIENTES DE CONTENIDO
     * ======================================================================
     * Las de las plantillas de trabajo del cliente —areas comunes (11),
     * baños (7) y cocina (7)— estan pendientes de transcribir desde la Etapa
     * 2 (`docs/21-modelo-de-operaciones.md` §4).
     *
     * No se rellena con tareas inventadas: una lista de limpieza plausible
     * pero que no es la de esta empresa es peor que ninguna, porque alguien
     * la daria por buena y quedaria registrado que se hizo un trabajo que
     * nadie pidio.
     *
     * Una clave por codigo del catalogo, con el mismo nombre exacto.
     */
    items: {},
  },

  frequency: {
    /** Para la cadencia que un servicio concreto no ofrece. */
    notOffered: 'We do not offer this service on this schedule',
    title: 'How often?',
    ONE_TIME: 'One time',
    WEEKLY: 'Weekly',
    BIWEEKLY: 'Every 2 weeks',
    MONTHLY: 'Monthly',
  },

  calculator: {
    title: 'Instant quote',
    subtitle: 'Answer five questions and see your price. No account, no phone call.',
    serviceLabel: 'What do you need?',
    bedroomsLabel: 'Bedrooms',
    bathroomsLabel: 'Bathrooms',
    squareFeetLabel: 'Approximate square feet',
    postalCodeLabel: 'ZIP code',
    postalCodeHelp: 'We only need your ZIP code to estimate travel. No street address required.',
    postalCodePlaceholder: '30303',
    addOnsLabel: 'Anything extra?',
    quantityLabel: 'Qty',
    submit: 'Calculate my price',
    recalculate: 'Update price',
    yourEstimate: 'Your estimate',
    estimatedTotal: 'Estimated total',
    travelDeposit: 'Travel deposit (held, not charged)',
    dueAtService: 'Balance due on service day',
    distanceSummary: 'About {{miles}} miles from our base — zone {{zone}}',
    breakdown: 'Price breakdown',
    validUntil: 'Valid until {{date}}',
    noTax: 'Sales tax: $0.00 (exempt in Georgia)',
    manualReviewTitle: 'We need to review this one',
    manualReviewBody:
      'Send us a WhatsApp message and we will put together a personalised proposal. Text, voice note or call — whatever suits you.',
    whatsappCta: 'Message us on WhatsApp',
    /*
     * EL MENSAJE QUE LLEVA EL BOTON YA ESCRITO.
     *
     * Son datos que el visitante acaba de teclear el mismo —codigo postal y
     * pies cuadrados—, no datos personales: el nombre y la direccion se
     * siguen pidiendo en el formulario de reserva. Sin esto el cliente llega
     * al chat con un «hola» y la empresa no sabe de que le hablan.
     */
    whatsappQuote:
      'Hi! I would like a custom proposal for a cleaning in ZIP {{zip}} (about {{sqft}} sq ft).',
    errorTitle: 'We could not calculate your price',
    errorGeneric: 'Something went wrong on our side. Please try again or call us.',
    errorNetwork: 'We could not reach our pricing service. Check your connection and try again.',
    errorValidation: 'Please review the highlighted fields.',
    errorPostalCode: 'Enter a valid 5-digit ZIP code.',
    errorRateLimited: 'Too many quotes in a short time. Please wait a moment and try again.',
  },

  admin: {
    title: 'Freshness Touch · Admin',

    /* ------------------- Comunes de toda la interfaz ------------------- */
    loading: 'Loading…',
    working: 'Working…',
    retry: 'Try again',
    agenda: 'Agenda',
    toastClose: 'Dismiss',

    /* --------------------- Las clientas de siempre --------------------- */
    repeat: {
      title: 'Does this repeat?',
      subtitle:
        'Turn this booking into a repeat schedule. We keep the next few weeks booked so the website cannot sell those slots.',
      frequency: 'How often',
      monthlyNote: 'Monthly means every four weeks, so it always lands on the same weekday.',
      endDate: 'Until (optional)',
      agreedPrice: 'Agreed price for this customer, in dollars (optional)',
      agreedPriceHelp:
        'It stays with the schedule, so a future price rise does not reach this customer unless someone decides it.',
      submit: 'Repeat this booking',
      alreadyInSeries: 'This booking is already part of a repeat schedule.',
    },

    series: {
      open: 'Repeat customers',
      title: 'Repeat customers',
      subtitle:
        'Who comes every week, every two weeks or every month. We keep the next six weeks booked.',
      empty: 'No repeat schedules yet. Open a booking and use “Does this repeat?”.',
      when: '{{day}} at {{time}} · {{frequency}}',
      agreedPrice: 'Agreed price: {{amount}}',
      until: 'Until {{date}}',
      upcoming_one: '1 visit booked. Next: {{next}}',
      upcoming_other: '{{count}} visits booked. Next: {{next}}',
      noUpcoming: 'No visits booked yet.',
      pause: 'Pause',
      resume: 'Resume',
      end: 'End it',
      pauseWarning_one:
        'Pausing or ending stops NEW visits being created. The 1 visit already in the schedule stays: cancel it from the booking itself.',
      pauseWarning_other:
        'Pausing or ending stops NEW visits being created. The {{count}} visits already in the schedule stay: cancel them from each booking.',
      status: {
        ACTIVE: 'Active',
        PAUSED: 'Paused',
        ENDED: 'Ended',
      },
      day: {
        sunday: 'Sundays',
        monday: 'Mondays',
        tuesday: 'Tuesdays',
        wednesday: 'Wednesdays',
        thursday: 'Thursdays',
        friday: 'Fridays',
        saturday: 'Saturdays',
      },
    },

    /* ---------------------- Meter una reserva a mano ------------------- */
    /*
     * Para la clienta de siempre que llama. No es una nota en la agenda: es
     * una reserva de verdad, y sobre todo OCUPA LA FRANJA, que es lo que
     * impedia que el cotizador publico volviera a vender ese mismo martes.
     */
    newBooking: {
      open: 'Add a booking',
      title: 'Add a booking by hand',
      subtitle:
        'For the customer who called. It books the slot, so the website can no longer sell it.',
      close: 'Close',
      saving: 'Saving…',
      submit: 'Create the booking',

      jobTitle: 'The job',
      service: 'Service',
      frequency: 'How often',
      frequencyOption: {
        ONE_TIME: 'One time',
        WEEKLY: 'Weekly',
        BIWEEKLY: 'Every two weeks',
        MONTHLY: 'Monthly',
      },
      bedrooms: 'Bedrooms',
      bathrooms: 'Bathrooms',
      squareFeet: 'Square feet',
      addOns: 'Add-ons',

      whenTitle: 'When',
      date: 'Date',
      time: 'Start time',

      customerTitle: 'The customer',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      emailHelp:
        'This is what identifies the customer: if they already exist, we reuse their record instead of creating a second one.',
      phone: 'Phone',

      addressTitle: 'Where',
      line1: 'Street address',
      city: 'City',
      postalCode: 'ZIP code',
      accessNotes: 'Access instructions (door code, key, dog)',
      customerNotes: 'Notes for the team',

      overridesTitle: 'Rules you are skipping',
      allowOutsideHours:
        'Book it even if it is outside business hours or inside the 24-hour notice',
      allowOverlap: 'Book it anyway: I know there is a crew free',
      notifyCustomer: 'Email the customer their confirmation',
      agreedPrice: 'Agreed price, in dollars (leave empty for the standard price)',
      agreedPricePlaceholder: '150',
      reason: 'Why',
      reasonMissing: 'Write why before creating it: it goes in the audit log.',
    },

    showPassword: 'Show password',
    hidePassword: 'Hide password',

    /*
     * Confirmaciones de acciones que hasta ahora no decian nada al terminar:
     * el boton se quedaba quieto y no habia forma de saber si habia pasado.
     */
    toast: {
      statusChanged: 'Booking updated.',
      depositCaptured: 'Deposit charged.',
      depositReleased: 'Hold released.',
      depositRefunded: 'Refunded. It can take a few days to show on the statement.',
      balanceRefunded: 'Balance refunded. It can take a few days to show on the statement.',
      balanceCharged: 'Balance charged.',
      teamSaved: 'Team saved.',
      staffSaved: 'Staff record saved.',
      adjustmentApplied: 'Charged. The booking now says what the team found.',
      adjustmentRejected: 'Turned down. The team can see why.',
      adjustmentSent: 'Sent. Dispatch will look at it and get back to you.',
      /*
       * LO QUE LE LLEGA AL EQUIPO cuando coordinacion decide, no al reves
       * que `adjustmentApplied`, que lo lee quien decidio.
       *
       * SIN CIFRAS: «se ajusto», nunca cuanto. Es la misma regla que impide
       * que esta pantalla lleve importes.
       */
      adjustmentApproved: 'Dispatch accepted your correction. The booking now says what you found.',
      adjustmentRejectedToTeam: 'Dispatch is not charging for your correction.',
      jobStarted: 'Arrival recorded.',
      jobFinished: 'Job marked as finished.',
    },

    /* --------------------------- Acceso ---------------------------- */
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    signOut: 'Sign out',
    signInHint: 'Staff access only.',
    email: 'Email',
    password: 'Password',
    signedOut: {
      manual: 'You have signed out.',
      idle: 'You were signed out after 30 minutes without activity.',
      expired: 'Your session has ended. Please sign in again.',
      noAccess: 'This account does not have access to the admin panel.',
    },

    /* --------------------------- Agenda ---------------------------- */
    filterDate: 'Date',
    filterStatus: 'Status',
    filterAnyStatus: 'Any status',
    filterSearch: 'Search',
    filterSearchPlaceholder: 'Reference, name or email',
    noBookings: 'No bookings match these filters.',
    assignedTo: 'Assigned to {{names}}',
    back: 'Back to agenda',
    durationMinutes: '{{minutes}} min on site',

    actions: 'Actions',
    noActions: 'There is nothing left to do on this booking.',
    reason: 'Reason',
    reasonPlaceholder: 'Why are you doing this?',
    reasonHelp: 'It is saved with your name in the audit log.',
    reasonRequired: 'Add a reason first.',

    /**
     * LA BANDEJA DEL EQUIPO.
     *
     * El texto NO se guarda en la base: alli van `kind` y `params`, y la
     * frase se compone aqui, en el idioma de quien mira. Por eso cada clase
     * tiene su titulo y su cuerpo, y el cuerpo usa los parametros.
     */
    inbox: {
      title: 'Notifications',
      open: 'Notifications',
      empty: 'Nothing new.',
      showAll: 'Show all',
      markAllRead: 'Mark all as read',
      unread: 'Unread',
      openEntity: 'Open the booking',
      /* Lo que pone el icono para quien usa un lector de pantalla. */
      badgeLabel_one: '1 unread notification',
      badgeLabel_other: '{{count}} unread notifications',
      /*
       * ANIDADA IGUAL QUE LA CLASE («booking.confirmed»), como las acciones
       * de auditoria: la clave se construye pegando el `kind` tal cual y no
       * hay tabla de equivalencias que mantener.
       *
       * Y con punto NO FUNCIONARIA: i18next separa por puntos, asi que una
       * clave literal «booking.confirmed» no se puede alcanzar.
       */
      kind: {
        booking: {
          confirmed: {
            title: 'New booking to assign',
            body: 'Booking {{reference}} is confirmed and has no team yet.',
          },
          hold_open: {
            title: 'Cancelled booking with the deposit still held',
            body: '{{amount}} is still held on the card. Decide: charge it or release it, or it expires on its own.',
          },
        },
        payment: {
          refund_failed: {
            title: 'A refund was rejected',
            body: 'The {{amount}} refund on {{reference}} failed. The money is still here and the customer is waiting for it.',
          },
        },
        media_consent: {
          self_revoked: {
            title: 'A customer took their photos down',
            body: 'Release {{reference}} was withdrawn from the link in their email. Their photos are off the website.',
          },
        },
        job: {
          assigned: {
            title: 'You have a job assigned',
            body: 'Booking {{reference}}, {{when}}.',
          },
        },
        series: {
          slot_taken: {
            title: 'A repeat booking could not be created',
            body: 'The {{time}} slot on {{when}} was already full, so that visit was not booked. Open the schedule and sort it out.',
          },
        },
      },
    },
    /*
     * EL MISMO AVISO, PERO A LA VISTA. `reasonRequired` vive en un `title`,
     * que solo aparece si el raton se queda quieto encima y que en movil NO
     * APARECE NUNCA. El resultado es un boton gris que no explica nada y una
     * persona convencida de que el sistema no deja cancelar.
     */
    reasonMissing:
      'Write the reason above to enable “Cancel the booking” and “The customer was not there”.',
    /*
     * CANCELAR NO TOCA EL DINERO, a proposito: son dos decisiones. Pero sin
     * decirlo, una retencion se queda viva detras de una reserva que ya nadie
     * va a mirar.
     */
    holdStillOpen_one:
      'This booking is cancelled and {{amount}} is still held on the card. Decide: charge it or release it. It expires on its own in 1 day.',
    holdStillOpen_other:
      'This booking is cancelled and {{amount}} is still held on the card. Decide: charge it or release it. It expires on its own in {{count}} days.',
    holdStillOpenToday:
      'This booking is cancelled and {{amount}} is still held on the card. It expires TODAY: after that it can no longer be charged.',
    holdStillOpenExpired:
      'This booking is cancelled and the hold of {{amount}} has expired: it can no longer be charged, and the money goes back to the customer on its own.',
    depositHeld: '{{amount}} is held on the card, not charged.',
    captureDeposit: 'Charge the deposit',
    releaseDeposit: 'Release the hold',
    depositHelp:
      'Charge it only if the customer cancelled once the team was on the way or was not home. Otherwise release it.',

    /* --- Devolver lo ya cobrado (etapa 3.21) --- */
    refundAvailable: '{{amount}} was charged and can still be refunded.',
    refundAmount: 'Refund ($)',
    refundAmountPlaceholder: 'All of it',
    refundDeposit: 'Refund the deposit',
    refundBalance: 'Refund the balance',
    refundTooLarge: 'At most {{amount}} can be refunded.',
    refundHelp:
      'This sends money back to the card. Leave the amount empty to refund everything that is left. It cannot be undone, and the bank can take a few days to show it.',
    action: {
      CONFIRMED: 'Mark as confirmed',
      IN_PROGRESS: 'Team has arrived',
      COMPLETED: 'Mark as completed',
      CANCELLED: 'Cancel booking',
      NO_SHOW: 'Customer was not there',
      PENDING_PAYMENT: 'Back to awaiting payment',
    },
    status: {
      PENDING_PAYMENT: 'Awaiting payment',
      CONFIRMED: 'Confirmed',
      IN_PROGRESS: 'In progress',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      NO_SHOW: 'No show',
    },

    role: {
      ADMIN: 'Administrator',
      DISPATCHER: 'Dispatcher',
      CLEANER: 'Cleaner',
    },

    /* --------------------------- Detalle --------------------------- */
    customer: 'Customer',
    name: 'Name',
    phone: 'Phone',
    address: 'Address',
    accessNotes: 'Access instructions',
    accessNotesWarning:
      'Sensitive: do not read aloud in front of others and close this page when you step away.',
    legal: {
      title: 'Terms and privacy',
      accepted: 'Accepted on {{when}} — Terms v{{terms}}.0, Privacy v{{privacy}}.0',
      /* «No consta» es un estado legitimo: ver el comentario en la pantalla. */
      none: 'Not recorded. Booked before this existed, or taken by phone from the panel.',
      outdated:
        'This is not the version published today. If there is a dispute, it is about the older text.',
    },
    customerNotes: 'Customer notes',
    /* ---------------------------- Equipo ---------------------------- */
    team: 'Team',
    teamAssign: 'Assign team',
    teamChange: 'Change team',
    teamEmpty: 'Nobody is assigned to this job yet.',
    teamLead: 'Lead',
    teamHelp:
      'Tick who is going and pick a lead. The lead is the one who decides if something unexpected comes up at the house.',
    teamSave: 'Save team',
    teamDiscard: 'Discard changes',
    teamNoStaff: 'There is no active staff to assign. Add someone first.',
    teamNoLeadWarning:
      'This team has no lead. If something comes up at the house, nobody knows who decides.',
    teamCancelledNote:
      'This booking is cancelled: the team is kept as history and cannot be changed.',

    pricing: 'Price breakdown',
    total: 'Total',
    deposit: 'Travel deposit',
    balanceDue: 'Due on the day',
    payment: 'Payment',
    paymentStatus: 'Status',
    held: 'Held on card',
    charged: 'Charged',
    refunded: 'Refunded',
    /* --- Cobrar el saldo final (etapa 3.23) --- */
    balanceDueNotice: '{{amount}} is still due for this job.',
    chargeBalance: 'Charge {{amount}}',
    chargeBalanceHelp:
      'This charges the card the customer left when booking. It can only be done once the job is finished.',
    noCardOnFile:
      'No card was saved for this booking, so it cannot be charged from here. Bookings made before this was added do not have one.',
    balanceCharged: 'Balance charged',
    refundFailedNotice:
      'A refund was turned down by the bank. That money is still in the company account and the customer is waiting for it: send it back another way and tell them.',
    card: 'Card',
    holdExpires: 'Hold expires',
    noPayment: 'No card hold was created for this booking.',

    paymentState: {
      REQUIRES_PAYMENT_METHOD: 'Waiting for card',
      REQUIRES_CONFIRMATION: 'Waiting for confirmation',
      REQUIRES_ACTION: 'Waiting for the bank (3D Secure)',
      PROCESSING: 'Processing at the bank',
      REQUIRES_CAPTURE: 'Authorised, not charged',
      SUCCEEDED: 'Captured',
      CANCELED: 'Released',
      FAILED: 'Declined',
    },

    /* ----------------------- Configuracion ------------------------- */
    settings: {
      title: 'Business settings',
      intro:
        'These details appear on the public website. Changes show up there within a few minutes.',

      legal: 'Legal details',
      legalHelp:
        'These appear in the Terms and the Privacy Policy on the website. Anything left empty is simply not shown there.',
      legalName: 'Registered company name',
      mailingAddress: 'Mailing address',
      mailingAddressHelp:
        'A physical address is required by law in any marketing email, so without it we cannot send offers.',
      county: 'County',
      countyHelp: 'Used by the Terms for the court that would hear a dispute.',
      contact: 'Contact',
      phone: 'Phone number',
      phoneSaved: 'Will be saved as {{value}}',
      phoneEmpty: 'No phone number. The website will not show a contact button.',
      whatsapp: 'WhatsApp number',
      whatsappHelp: 'Leave it empty to use the phone number above.',
      whatsappSameAsPhone: 'Messages will go to {{value}}, the same as the phone number.',
      whatsappUses: 'Messages will go to {{value}}.',
      email: 'Email address',
      emailHelp: 'Shown on the contact section of the website.',
      emailEmpty: 'No email address. The website will not show an email link.',

      hours: 'Business hours',
      hoursHelp:
        'These hours decide which times customers can book. Closing a day does not cancel bookings already made for that day.',
      open: 'Open',
      closed: 'Closed',
      opensAt: '{{day}} opening time',
      closesAt: '{{day}} closing time',
      day: {
        1: 'Monday',
        2: 'Tuesday',
        3: 'Wednesday',
        4: 'Thursday',
        5: 'Friday',
        6: 'Saturday',
        7: 'Sunday',
      },

      phoneInvalid: 'Enter a valid phone number, for example (404) 555-0123.',
      whatsappInvalid: 'Enter a valid WhatsApp number, for example (404) 555-0123.',
      emailInvalid: 'Enter a valid email address.',
      hoursInvalid: 'Check these hours: the closing time must be after the opening time.',

      save: 'Save changes',
      saving: 'Saving…',
      saved: 'Saved.',
      lastChange: 'Last changed by {{who}} on {{when}}.',
      unknownAuthor: 'someone no longer on the team',
    },
    /* -------------------------- Avisos ----------------------------- */
    /* ---------------------- Los permisos de imagen ------------------------ */
    consents: {
      title: 'Image releases',
      intro:
        'The signed paper that lets us publish a customer\u2019s home, linked to the items it covers. Withdrawing it unpublishes them straight away.',
      strictNotice:
        'Nothing is published without a release on file. An item with no release stays saved but does not appear on the website.',
      add: 'Record a release',
      empty:
        'No releases recorded yet. Until one is, nothing from the gallery appears on the website.',
      reference: 'Reference',
      referenceHelp:
        'The paper\u2019s number, the booking reference, or whatever identifies the message. It is how the proof is found again.',
      evidenceKind: 'How it was given',
      evidenceKindHelp:
        'All four count. This says where the proof is kept, for the day it has to be shown.',
      evidence: {
        SIGNED_PAPER: 'Paper, signed by hand',
        WEB_FORM: 'Ticked when booking',
        EMAIL: 'By email',
        MESSAGE: 'By written message',
      },
      customerName: 'Customer',
      propertyAddress: 'Property',
      propertyAddressHelp:
        'Never shown on the website. It lives here so the item can be found again.',
      customerEmail: 'Customer email',
      customerEmailHelp:
        'Optional. With it, they get a record of what they agreed to and a link that takes it down themselves, without waiting for us.',
      customerLocale: 'Writes to them in',
      customerLocaleHelp: 'What we send talks about publishing their home: it has to be readable.',
      locale: { en: 'English', es: 'Spanish' },
      occupancy: 'Who lives there',
      occupiedByOthers: 'Someone other than the signer lives in the property',
      occupiedByOthersHelp:
        'A landlord may let us film their property, but the furniture and belongings in shot are the tenant\u2019s. Nobody can give a release over someone else\u2019s private life.',
      occupantConsent: 'Whoever lives there has given a release too',
      occupantBlocked:
        'Until both releases are on file, this one cannot cover any photo or video. Record it anyway so the missing half is visible.',
      serviceDate: 'Service date',
      signedAt: 'Given on',
      signedAtHelp: 'The day it was signed, ticked or written.',
      removalDays: 'Removal deadline (days)',
      covers: 'What was filmed',
      coversInterior: 'Interior',
      coversExterior: 'Exterior',
      allowsBefore: 'The "before" footage may be published',
      allowsBeforeHelp:
        'The sensitive one: the "before" is that person\u2019s home, unclean. Only tick it if the paper says so.',
      channels: 'Where it may be published',
      channelsHelp:
        'As listed on the paper. The website must be ticked for an item to appear here.',
      channel: {
        WEBSITE: 'Website',
        FACEBOOK: 'Facebook',
        INSTAGRAM: 'Instagram',
        YOUTUBE: 'YouTube',
      },
      videoIds: 'Videos it covers',
      photoPaths: 'Photos it covers',
      piecesHelp: 'One per line, copied from the gallery screen.',
      notes: 'Notes',
      save: 'Save release',
      cancel: 'Cancel',
      saved: 'Release saved',
      edit: 'Edit',
      revoke: 'Withdraw',
      restore: 'Reinstate',
      revoked: 'Release withdrawn. Its items are off the website.',
      restored: 'Release reinstated',
      revokedChip: 'Withdrawn',
      beforeChip: 'Covers "before"',
      confirmRevoke:
        'Withdrawing this release takes its photos and videos off the website straight away. Continue?',
      summary: '{{videos}} video(s) and {{photos}} photo(s) \u00b7 removal within {{days}} days',
      signedOn: 'Signed {{when}}',
      revokedOn: 'Withdrawn {{when}}',
      errInvalid: 'Some of the release is not valid yet.',
      removalTitle: 'Takedown requested',
      removalAsk: 'The customer asked for a takedown',
      removalAskHelp:
        'The date on their email or message, not today\u2019s: the clock runs from when they asked, not from when we read it.',
      removalPending_one: 'Asked on {{when}} \u2014 1 day left, until {{deadline}}.',
      removalPending_other: 'Asked on {{when}} \u2014 {{count}} days left, until {{deadline}}.',
      removalToday: 'Asked on {{when}} \u2014 the deadline is today, {{deadline}}.',
      removalOverdue_one: 'Asked on {{when}} \u2014 1 day past the {{deadline}} deadline.',
      removalOverdue_other:
        'Asked on {{when}} \u2014 {{count}} days past the {{deadline}} deadline.',
      removalDone: 'Asked on {{when}}, taken down on {{fulfilled}}.',
      removalCancel: 'It was a mistake',
      removalSaved: 'Takedown request recorded',
      removalCancelled: 'Takedown request withdrawn',
      removalStillPublished: 'Its photos and videos are still on the website.',
      noEvidence: 'No proof filed: this release cannot be shown to anyone.',
      hasEvidence: 'Proof on file.',
      attachEvidence: 'File the proof',
      replaceEvidence: 'Replace',
      viewEvidence: 'Download',
      deleteEvidence: 'Delete',
      evidenceSaved: 'Proof filed',
      evidenceDeleted: 'Proof deleted',
      confirmEvidenceDelete:
        'The release stays, but its proof is deleted for good. Only do this to replace one filed by mistake. Continue?',
    },

    notifications: {
      title: 'Notifications',
      intro: 'What we send, and where it goes.',

      customerEmails: 'Emails to the customer',
      emailBookingConfirmed: 'Send a confirmation when a booking is paid',
      emailBookingConfirmedHelp:
        'The customer gets their reference, date, address and what was held on their card. Turning this off means a customer who just paid receives nothing in writing.',
      emailBookingCancelled: 'Send an email when a booking is cancelled',
      emailBookingCancelledHelp:
        'Never includes the internal reason written by the team — only that the booking was cancelled.',

      emailBookingReminder: 'Send a reminder the day before',
      emailBookingReminderHelp:
        'Cuts down on no-shows, which are the most wasteful cost in this business: the team drives out, cannot get in, and the slot can no longer be sold.',
      reminderHoursBefore: 'Hours before',
      reminderHoursBeforeHelp:
        'Between 2 and 72. Bookings are made at least 24 hours ahead, so a low number would land the reminder right after the confirmation.',
      reminderHoursBeforeInvalid: 'Enter a number between 2 and 72.',

      internal: 'Alerts for your team',
      internalEmail: 'Copy customer emails to',
      internalEmailHelp: 'This mailbox receives the same email the customer got.',
      internalEmailEmpty: 'No copy is sent.',
      internalEmailInvalid: 'Enter a valid email address.',
      telegramOnNewBooking: 'Send a Telegram message for each new booking',
      telegramOnNewBookingHelp:
        'Only for bookings that are confirmed and paid. Abandoned forms are not reported, so the alert stays worth reading.',
      telegramChatId: 'Operations chat',
      telegramChatIdHelp:
        'New bookings and arrivals that look wrong. The numeric chat id: write to your bot, then open api.telegram.org/bot<token>/getUpdates to read it.',
      telegramChatIdInvalid: 'The chat id is a number, for example 123456789.',

      telegramOnTeamArrivedFar: 'Tell operations when the team clocks in far from the house',
      telegramOnTeamArrivedFarHelp:
        'Only when the phone itself says the person cannot be at the house: the GPS margin of error is subtracted first. Normal arrivals send nothing.',

      telegramCleaningChatId: 'Cleaning team group',
      telegramCleaningChatIdHelp:
        'Must be a GROUP, not a person: a bot cannot message someone who has not written to it first. Add the bot to the group and paste its id (it starts with a minus sign). Everyone in the group sees the street and city of every job, and never any amount.',
      telegramCleaningChatIdInvalid: 'The group id is a number, for example -1001234567890.',

      telegramOnJobAssigned: 'Tell the team when a job is assigned or changed',
      telegramOnJobAssignedHelp:
        'Sent again when the team changes, so an old message is never left standing as if it were current.',

      telegramTechChatId: 'Technical chat',
      telegramTechChatIdHelp:
        'System failures only: pending migrations, payments in test mode, jobs that stopped running. If left empty they go to the operations chat, because a broken system nobody hears about is worse than a message to the wrong person.',
      telegramTechChatIdInvalid: 'The chat id is a number, for example 123456789.',

      credentialsNote:
        'The email API key and the Telegram bot token are set on the server, not here. Credentials stored in the database end up in every backup, so they stay in the server environment alongside the payment keys.',
    },

    rates: {
      title: 'Rates',
      intro:
        'The prices the site quotes with. Every new quote is calculated with whatever is here.',
      onlyFuture:
        'Anything already booked does not change: each booking stores the prices it was calculated with. This only affects quotes from now on.',

      services: 'Price per service and frequency',
      bands: {
        title: 'Price table by home size',
        help: 'One row per size bracket, in the same order as the pricing sheet. A home pays the first row whose size reaches it, so a 1,000 sq ft home pays the 1,200 row. A home larger than the last row gets no automatic price: we go and look at it.',
        upTo: 'Up to (sq ft)',
        deep: 'Deep / Move',
        monthly: 'Monthly',
        biweekly: 'Biweekly',
        weekly: 'Weekly',
        windows: 'Windows + cabinets',
        add: 'Add a bracket',
        remove: 'Remove bracket',
      },
      servicesHelp:
        'In each frequency the higher of the two wins: the flat amount or what the square footage gives. Unchecking a frequency means the service is not offered that way.',
      flat: 'Amount',
      perSquareFoot: 'Per sq ft',
      noSize: 'not used',
      notOffered: 'Not offered at this frequency',

      addOns: 'Add-ons',
      amount: 'Amount',
      maxQuantity: 'Max',

      depositAndTravel: 'Deposit and travel',
      depositHelp:
        'The deposit is held at booking and comes off the total: it is not an extra charge. Travel is free inside the radius; beyond it, the extra miles are charged.',
      deposit: 'Deposit',
      freeRadius: 'Free radius',
      perMile: 'Per mile',
      irsRate: 'IRS rate',
      roundTrip: 'Charge round-trip miles',

      save: 'Save rates',
      saved: 'Rates saved. New quotes already use these prices.',
      invalidNumbers: 'Check the amounts: one of the fields is not a number.',
      outOfRange:
        'That amount is beyond anything reasonable. Check "{{field}}": is there an extra zero?',
      errOneTimeRequired:
        'A service has to be bookable as a one-off: leave the "One time" frequency checked.',
      errBandOrder: 'Size brackets must go from smallest to largest, with no repeats.',
      errFrequencyOrder:
        'The price cannot go up as the frequency goes up: someone coming weekly would pay more than someone coming once.',
      currentVersion: 'Version {{version}} · {{count}} saved in total',
    },

    /* ----------------------- Area de servicio ----------------------- */
    /* ------------------------- Ubicación de la empresa ------------------------- */
    /**
     * ES EL ORIGEN DESDE EL QUE SE MIDE TODO. Los textos lo dicen sin
     * rodeos: quien abre esta pantalla tiene que entender, antes de tocar
     * nada, que mover el punto mueve el precio de cada reserva posterior.
     */
    pwa: {
      updateAvailable: 'A new version of the panel is ready',
      updateNow: 'Update',
      updateLater: 'Later',
    },
    siteCopy: {
      title: 'Website wording',
      intro:
        'The promises and the frequently asked questions the website publishes. These are commitments, not decoration: what you write here is what a customer will hold us to.',
      onlyNew:
        'Changing the wording does not change what was promised to someone who already booked. Their confirmation email keeps what it said.',
      promises: 'Our promises',
      promisesHelp: 'The four cards under "Why Freshness Touch".',
      faq: 'Frequently asked questions',
      faqHelp: 'The six questions at the bottom of the page.',
      fieldTitle: 'Heading',
      fieldBody: 'Text',
      fieldQuestion: 'Question',
      fieldAnswer: 'Answer',
      english: 'English',
      spanish: 'Spanish',
      current: 'On the site now',
      placeholder: 'Leave empty to keep the wording above',
      charCount: '{{count}} of {{max}}',
      tooLong: 'Too long by {{count}}',
      halfDone_one: '{{count}} text is written in one language only',
      halfDone_other: '{{count}} texts are written in one language only',
      halfDoneHelp:
        'Visitors reading the other language will see the original wording, so the site will promise two different things. Fill both, or clear both.',
      halfDoneHere: 'Missing in the other language',
      save: 'Save wording',
      saved: 'Wording saved.',
      reset: 'Undo changes',
      errInvalid: 'Check the fields marked below.',
      lastChange: 'Last changed {{when}} by {{who}}',
      lastChangeUnknown: 'Last changed {{when}}',
      never: 'The website is showing its original wording.',
    },
    /* ---------------------- La galeria de antes y despues ---------------- */
    /*
     * Los avisos de esta pantalla son mas duros que los de cualquier otra, y
     * a proposito: aqui se publica el interior de la casa de un cliente.
     */
    gallery: {
      title: 'Before and after',
      intro:
        'The videos shown on the home page. Paste the YouTube link and it appears on the site; remove it and it disappears.',
      consentWarning: 'Never publish a home without its written release.',
      consentHelp:
        'The release must name the property and allow the "before" footage. If the customer withdraws it, remove the video here and it is gone from the site within minutes.',
      empty: 'No videos yet. The before-and-after section is hidden on the website.',
      videoUrl: 'YouTube link',
      videoUrlPlaceholder: 'https://www.youtube.com/watch?v=...',
      titleEnglish: 'Caption (English)',
      titleSpanish: 'Caption (Spanish)',
      titlePlaceholder: 'Optional',
      add: 'Add a video',
      addBlocked: 'The section holds {{count}} videos at most.',
      remove: 'Remove',
      save: 'Save gallery',
      reset: 'Undo changes',
      saved: 'Gallery saved',
      errVideoId: 'That is not a YouTube link. Copy it from the address bar or from Share.',
      errDuplicate: 'That video is already in the gallery.',
      errInvalid: 'Some videos are not valid yet. Check the ones marked in red.',
      never: 'Never changed',
      lastChange: 'Last changed {{when}} by {{who}}',
      lastChangeUnknown: 'Last changed {{when}}',
      photos: 'Photos',
      photosHelp:
        'Uploaded straight from your phone or computer. The location data inside the file is removed before it is stored.',
      addPhoto: 'Add a photo',
      addPhotoBlocked: 'The section holds {{count}} photos at most.',
      photoAlt: 'Gallery photo',
      uploading: 'Uploading…',
      errTooBig: 'That photo is too large. The limit is 5 MB.',
      errNotAnImage: 'That file is not a JPEG, PNG or WebP image.',
      errUpload: 'The photo could not be uploaded. Try again.',
      poster: 'Thumbnail',
      posterHelp:
        'What visitors see before they press play. Without one, the card shows our brand colours. We do not use YouTube’s own thumbnail, because loading it would send visitor data to Google before anyone presses anything.',
      posterAlt: 'Video thumbnail',
      removePoster: 'Remove thumbnail',
      uploadPoster: 'Upload thumbnail',
      uncovered_one: '{{count}} item is saved but not published.',
      uncovered_other: '{{count}} items are saved but not published.',
      uncoveredHelp:
        'Nothing goes on the website without a signed release on file. Record it under Image releases and link it to the item.',
      notPublished: 'Not on the website: no release on file',
    },

    location: {
      title: 'Company location',
      intro:
        'Everything is measured from here: the distance on every quote, the travel miles we charge, and the centre of the map on the website.',
      onlyFuture:
        'Anything already booked does not change: each booking stores the distance it was calculated with. This affects quotes from now on.',

      pickTitle: 'Mark the spot on the map',
      pickHelp:
        'Click the map to place the base. It is safer than typing coordinates: one wrong sign sends it to another continent.',
      mapDescription:
        'Map of the State of Georgia showing the company location and the radius with no travel surcharge.',
      /*
       * EL CIRCULO ES EN LINEA RECTA Y LA FACTURA ES POR CARRETERA.
       * Decirlo cuesta una linea; no decirlo deja al cliente discutiendo
       * un recargo que el mapa parecia descartar.
       */
      radiusNote:
        'The circle is {{miles}} miles as the crow flies. Travel is billed by road miles, which are always more, so a house just inside the circle can still carry a charge.',

      latitude: 'Latitude',
      longitude: 'Longitude',
      city: 'City',
      postalCode: 'ZIP code',
      postalCodeNote:
        'For the record only. Distances are measured from the point marked on the map, not from this ZIP code.',

      save: 'Save location',
      saved: 'Location saved. New quotes are measured from here.',
      lastChanged: 'Moved by {{who}} on {{when}}',

      errOutsideGeorgia:
        'That point is outside Georgia. The company operates in this state only: pick a point inside it.',
      errNotNumbers: 'Check the latitude and longitude: one of them is not a number.',
      errInvalid: 'Check the details: something is missing, or the ZIP code is not five digits.',
    },

    serviceArea: {
      title: 'Service area',
      intro:
        'How far we travel, and where the price comes out automatically. Every booking placed from now on is priced with this.',
      preview: 'Preview',
      mapDescription:
        'Map of the service area: concentric rings around the base reaching up to {{miles}} miles.',
      mapZone: 'Zone {{zone}} — up to {{miles}} miles',
      legendInstant: 'Instant price',
      legendOnRequest: 'Priced in person',
      summary:
        'We travel up to {{total}} miles. The price comes out automatically up to {{instant}}.',

      zones: 'Zones',
      zonesHelp:
        'Each ring has to reach further than the one before it. Once a zone stops giving an instant price, the ones beyond it cannot give one either.',
      zoneName: 'Zone {{zone}}',
      maxMiles: 'Up to (miles)',

      /* --- Anadir y quitar zonas (etapa 3.20) --- */
      addAfter: 'Add a zone after {{zone}}',
      addBlocked:
        'No zone fits here: either there is no letter left between these two, or there is no room in miles between their limits.',
      remove: 'Remove zone {{zone}}',
      removeBlocked:
        'This one stays: there has to be at least one zone, and the closest one has to give an instant price.',
      codesKept:
        'Removing a zone does not free its letter. It is written in bookings that already exist, so the next zone you add takes the following one.',
      /*
       * Se dice lo que PASA si se desmarca, no el nombre del ajuste. «Precio
       * automatico» no le dice a nadie que el cotizador dejara de dar una
       * cifra en esa zona.
       */
      instantQuote: 'The quote tool gives a price here right away',
      invalidNumbers: 'Check the numbers: miles and surcharges must be valid figures.',
      saved: 'Service area saved.',
    },

    /* --------------------------- Personal --------------------------- */
    staff: {
      title: 'Staff',
      intro:
        'Who works here. Adding someone lets you assign them jobs; panel access is separate and granted with an invitation.',
      add: 'Add someone',
      edit: 'Edit',
      save: 'Save',
      discard: 'Discard',
      empty: 'Nobody has been added yet.',
      inactiveHeading: 'Inactive',

      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      emailHelp:
        'This is their contact address and where the invitation goes. Changing it does not change which account they sign in with.',
      phone: 'Phone',
      phoneOptional: 'Phone (optional)',
      role: 'Role',
      active: 'Active',
      activeHelp:
        'Deactivating stops their panel access immediately and removes them from assignment. The record and its history are kept.',

      locale: 'Language',
      localeHelp: 'This is the language we write to them in, starting with the invitation email.',
      localeName: { en: 'English', es: 'Spanish' },
      accessNONE: 'No access',
      accessINVITED: 'Invited',
      accessLINKED: 'Has access',
      accessNoneHelp: 'Can be assigned jobs, but cannot sign in to the panel.',
      accessInvitedHelp:
        'Invited on {{date}}. They can sign in once they open the emailed link and choose a password.',
      accessLinkedHelp: 'Has a linked account and can sign in to the panel.',
      invite: 'Invite to the panel',
      resend: 'Resend invitation',
      resendConfirm:
        'They will get a new link to choose a password. The previous link stops working. Continue?',
      resendSent: 'Invitation sent again.',
      signsInWith: 'Signs in with {{email}}',
      signsInWithHelp:
        'Their contact address was changed after the account was created. Changing it here does not change the account, so this is the address they have to use to sign in.',
      inviteConfirm:
        'They will get an email to create a password and will be able to see every customer\u2019s details. Continue?',
      inviteUnavailable:
        'This deployment has no invitation sending configured. The service key is missing on the server.',
      inviteSent: 'Invitation sent.',
      selfNote: 'This is your own record: you cannot change your own role or deactivate yourself.',
    },

    /* --------------------- Estado del sistema ---------------------- */
    systemHealth: {
      title: 'System status',
      intro:
        'Whether the system can do its job right now. This screen only reports: nothing here is fixed from a browser.',
      checkedAt: 'Checked at {{time}}',
      errorLoad: 'Could not read the system status.',

      state: {
        ok: 'Working',
        degraded: 'Partly working',
        down: 'Not working',
        unknown: 'Unknown',
      },

      check: {
        database: 'Database',
        migrations: 'Database schema',
        pricingRates: 'Pricing table',
        paymentProvider: 'Card payments',
        sweeps: 'Scheduled jobs',
      },

      /*
       * EL DETALLE SE EXPLICA EN LENGUAJE LLANO Y DICE QUE HACER.
       *
       * Quien lee esto no es quien escribio el codigo: es el titular del
       * negocio en su telefono. «migrations.pending» no le dice nada;
       * «bookings cannot be created» le dice si tiene que llamar a alguien
       * ahora mismo o puede esperar al lunes.
       */
      /*
       * ANIDADO DE VERDAD, NO CON PUNTOS DENTRO DE LA CLAVE.
       *
       * La primera version escribia `'database.notConfigured': '...'`, que es
       * como se llama la clave en el contrato. No funciona: i18next usa el
       * punto como separador de anidamiento, asi que al pedir
       * `detail.database.notConfigured` busca un objeto `database` que no
       * existia. Lo cazo la prueba de recursos de i18n.
       *
       * La clave del contrato sigue siendo `database.notConfigured`; aqui se
       * escribe como el arbol que esa clave describe.
       */
      detail: {
        database: {
          notConfigured: 'No database configured. Quotes work; bookings do not.',
          unreachable: 'The database is not responding. No bookings can be made.',
        },
        migrations: {
          pending:
            'The database is missing an update the current code needs. Bookings may fail. Pending updates:',
          unverifiable: 'The list of database updates could not be read.',
        },
        pricingRates: {
          fallback:
            'The saved pricing table cannot be read, so prices come from the code. Prices are correct, but old quotes cannot be reproduced.',
          unreadable: 'The pricing table could not be read.',
        },
        paymentProvider: {
          simulated: 'Payments are in test mode: bookings are accepted and NO deposit is held.',
        },
        sweeps: {
          stalled: 'A scheduled job has stopped running. Jobs affected:',
        },
      },
    },

    /* -------------------------- Auditoria -------------------------- */
    audit: {
      title: 'Activity log',
      intro:
        'Who did what, from where and when. Entries are never edited or deleted from here: they are kept for a year and then removed automatically.',

      /*
       * Aviso deliberado y permanente en pantalla. Quien abre esto tiene que
       * saber que su propia consulta queda anotada, porque es justo lo que
       * impide usar el registro para vigilar a los companeros sin que se sepa.
       */
      selfNote: 'Opening this screen is recorded too, with the filters you used.',

      filters: 'Filters',
      apply: 'Apply filters',
      clear: 'Clear',
      anyActor: 'Anyone',
      anyAction: 'Any action',
      anySurface: 'Anywhere',
      actor: 'Person',
      what: 'Action',
      where: 'From',
      from: 'From date',
      to: 'To date',

      empty: 'Nothing matches these filters.',
      loadMore: 'Load older entries',
      loadingMore: 'Loading…',
      endOfList: 'That is everything for these filters.',
      countShown: 'Showing {{count}} entries.',

      systemActor: 'The system',
      customerActor: 'A customer',
      unknownActor: 'Deleted staff record',
      ip: 'IP {{value}}',
      details: 'Details',

      /* ------------------- Lo que dice cada entrada ------------------- */
      /**
       * Nombres de los campos de la metadata. La clave es el nombre crudo
       * tal y como lo escribe el servidor, asi que anadir un campo nuevo a
       * una accion solo obliga a anadir su etiqueta aqui; mientras no este,
       * se pinta el nombre crudo en vez de desaparecer.
       */
      field: {
        role: 'Role',
        email: 'Email',
        reason: 'Reason',
        amountCents: 'Amount',
        totalCents: 'Booking total',
        /* Una devolucion que el banco aun no ha reflejado en el extracto. */
        pending: 'Still on the way',
        service: 'Service',
        zone: 'Zone',
        scheduledStart: 'Scheduled for',
        from: 'Before',
        to: 'After',
        fromDate: 'From',
        toDate: 'Until',
        source: 'Marked from',
        required: 'Roles allowed',
        isActive: 'Active',
        deleted: 'Entries removed',
        olderThan: 'Older than',
        changed: 'Changed',
        teamBefore: 'Team before',
        teamAfter: 'Team after',
        filters: 'Filters',
        actorId: 'Person',
        action: 'Action',
        surface: 'From',
        entityType: 'About',
        entityId: 'Record',
      },

      value: {
        yes: 'Yes',
        no: 'No',
        none: '—',
        nobody: 'Nobody',
        lead: '{{name}} (lead)',
        unknownPerson: 'Someone no longer on the staff list',
        zone: 'Zone {{zone}}',
        updated: 'Updated',
        noChanges: 'Nothing changed',
        noFilters: 'No filters: the whole log was requested',
        source: { 'my-jobs': 'The "My jobs" screen' },
      },

      /** Sobre qué fue. El nombre se resuelve al leer, no se guarda. */
      target: {
        booking: 'Booking {{reference}}',
        staff: 'Staff record: {{name}}',
      },

      /** Campos de configuración, por su nombre en la pantalla que los edita. */
      settingsField: {
        phone: 'Phone',
        email: 'Email',
        hours: 'Opening hours',
        radiusMilesBefore: 'Coverage before',
        radiusMilesAfter: 'Coverage after',
        instantRadiusMilesBefore: 'Instant price before',
        instantRadiusMilesAfter: 'Instant price after',
        zones: 'Zones',
        internalEmail: 'Internal mailbox',
        telegramChatId: 'Telegram chat',
        telegramOnNewBooking: 'Telegram on new booking',
        emailBookingConfirmed: 'Confirmation email',
        emailBookingCancelled: 'Cancellation email',
        emailBookingReminder: 'Reminder email',
        reminderHoursBefore: 'Reminder hours before',
      },

      day: {
        today: 'Today',
        yesterday: 'Yesterday',
      },

      /**
       * Detalles técnicos. Aquí van la IP, los identificadores y el JSON
       * crudo: nada se pierde, solo deja de estorbar a quien no lo necesita.
       */
      technical: 'Technical details',
      technicalHelp: 'The exact data as it was recorded. Useful if you need to report a problem.',
      rawData: 'Recorded data',

      /** Categorías del desplegable de acciones, en lenguaje llano. */
      group: {
        access: 'Signing in',
        bookings: 'Bookings',
        money: 'Money',
        staff: 'Staff',
        settings: 'Settings',
        sensitive: 'Customer data',
        log: 'This log',
      },

      /* Desde donde se hizo. */
      surface: {
        PANEL: 'Admin panel',
        SITE: 'Public website',
        SYSTEM: 'Automatic',
        FIELD: 'Field app',
      },

      /* Sobre que. */
      entity: {
        booking: 'Booking',
        staff: 'Staff record',
        business_settings: 'Settings',
        audit: 'Activity log',
        session: 'Session',
        media_consent: 'Image release',
      },

      /*
       * Etiqueta de cada accion del catalogo. Va anidada igual que la accion
       * ("booking.status.confirmed"), asi que la clave se construye pegando
       * la accion tal cual y no hay tabla de equivalencias que mantener.
       */
      action: {
        session: {
          opened: 'Signed in',
          closed: 'Signed out',
          denied: 'Access denied',
        },
        /* Las clientas de siempre: «esto se repite cada dos semanas». */
        series: {
          created: 'Repeat schedule created',
          updated: 'Repeat schedule changed',
        },
        booking: {
          created: 'Booking placed',
          created_manually: 'Booking added by hand',
          created_from_series: 'Booking generated by a repeat schedule',
          team_changed: 'Team changed',
          adjustment: {
            proposed: 'Reported the job is not what was booked',
            applied: 'Approved the on-site correction',
            rejected: 'Turned down the on-site correction',
          },
          viewed: 'Booking record opened',
          status: {
            pending_payment: 'Marked as awaiting payment',
            confirmed: 'Marked as confirmed',
            in_progress: 'Marked as in progress',
            completed: 'Marked as finished',
            cancelled: 'Cancelled',
            no_show: 'Marked as no-show',
          },
        },
        access_notes: {
          viewed: 'Entry instructions viewed',
        },
        payment: {
          captured: 'Deposit charged',
          released: 'Hold released',
          refunded: 'Money refunded',
          balance_charged: 'Balance charged',
          balance_refunded: 'Balance refunded',
        },
        staff: {
          created: 'Staff added',
          updated: 'Staff record changed',
          invited: 'Invited to the panel',
          reinvited: 'Invitation sent again',
          recovery_sent: 'Asked to get back in; the link was sent',
        },
        settings: {
          updated: 'Settings changed',
        },
        service_area: {
          updated: 'Service area changed',
        },
        company_location: {
          updated: 'Company location moved',
        },
        pricing: {
          updated: 'Rates changed',
        },
        site_copy: {
          updated: 'Website wording changed',
        },
        gallery: {
          updated: 'Before-and-after gallery changed',
        },
        media_consent: {
          created: 'Image release recorded',
          updated: 'Image release corrected',
          revoked: 'Image release withdrawn',
          restored: 'Image release reinstated',
          evidence_attached: 'Proof of a release filed',
          evidence_removed: 'Proof of a release deleted',
          removal_requested: 'Customer asked for a takedown',
          removal_request_cancelled: 'Takedown request withdrawn',
        },
        notifications: {
          updated: 'Alert settings changed',
        },
        audit: {
          queried: 'Activity log consulted',
          purged: 'Expired entries removed automatically',
        },
      },
    },

    /* ----------------------- Contraseña ----------------------- */
    passwordReset: {
      forgot: 'Forgot your password?',
      requestTitle: 'Recover access',
      requestIntro: 'Enter your work email and we will send you a link to choose a new password.',
      requestSend: 'Send link',
      backToSignIn: 'Back to sign in',
      requestSent:
        'If that address belongs to an account, an email with the link will arrive in a few minutes. Check your spam folder too.',

      chooseTitleInvite: 'Welcome to Freshness Touch',
      chooseIntroInvite: 'Choose a password to sign in to the panel.',
      chooseTitleRecovery: 'Choose a new password',
      chooseIntroRecovery: 'This link only works once.',
      newPassword: 'New password',
      repeatPassword: 'Repeat it',
      minLength: 'At least {{count}} characters. A phrase you remember beats a word with symbols.',
      choose: 'Save password',
      tooShort: 'It needs at least {{count}} characters.',
      mismatch: 'The two do not match.',
      saved: 'Password saved.',

      linkExpired:
        'This link is no longer valid: it works once and then expires. Request a new one from the sign-in screen.',
      linkOtherDevice:
        'This link has to be opened in the same browser you requested it from. Request it again from this device.',
      savedNoAccess:
        'Your password has been saved, but this account has no access to the panel. Talk to an administrator.',
      notConfigured: 'Sign-in is not configured on this deployment.',
    },

    /* ------------------------ Mis trabajos ------------------------ */
    myJobs: {
      title: 'My jobs',
      empty: 'You have no jobs assigned. When dispatch assigns you one, it will show up here.',
      today: 'Today',
      upcoming: 'Coming up',
      lead: 'You are the lead',
      withYou: 'With you',
      withYouLead: 'Lead',
      howToGetIn: 'How to get in',
      howToGetInWarning:
        'Do not read this aloud in front of anyone, and close the screen when you put your phone away.',
      customerNotes: 'What the customer asked for',
      call: 'Call',
      /* El pin que marco el cliente. Se dice QUIEN lo puso: si no coincide
       * con la calle, el equipo tiene que poder decidir de cual fiarse. */
      doorPin: 'The customer marked the entrance — open it',
      directions: 'Directions',
      /*
       * EL BOTON QUE NAVEGA, no el que ensena el sitio (etapa 3.17).
       *
       * Los enlaces de arriba son `?q=`: abren el mapa en el punto y dejan
       * «Como llegar» por pulsar. Esto abre la ruta ya trazada, que es lo
       * que hace falta con el coche en marcha.
       */
      takeMeThere: 'Take me there',
      /*
       * LA PREGUNTA AL VOLVER DE LA NAVEGACION (etapa 3.18).
       *
       * Pregunta, no afirma. La aplicacion no sabe si ha llegado —no mira el
       * GPS para decidir si preguntar— y decirle «has llegado» a quien
       * todavia esta aparcando es tratarla de mentirosa o de tonta.
       */
      arrivedTitle: 'Have you arrived?',
      arrivedBody: 'Marking your arrival lets the office know and starts the job.',
      arrivedConfirm: 'Yes, I am here',
      /* Corto y sin disculpas: decir que no tiene que costar un toque. */
      arrivedDismiss: 'Not yet',
      /*
       * Se nombra la aplicacion y no «otro mapa»: quien lo pulsa tiene que
       * saber a que aplicacion se va antes de salir de esta.
       */
      appleMaps: 'Apple Maps',
      rooms: '{{bedrooms}} bedrooms · {{bathrooms}} bathrooms',
      start: 'I have arrived',
      finish: 'I have finished',
      finished: 'Finished',
      finishHint:
        'Tap "I have arrived" when you enter the house. The time is recorded, and it is what backs up your work if anyone asks.',
      noActions: 'Dispatch handles the rest.',

      /*
       * EL FICHAJE CON UBICACION.
       *
       * Estos textos los lee quien acaba de fichar, y por eso dicen la
       * distancia que quedo registrada: no hay un expediente secreto sobre
       * nadie. Los tres motivos de «sin ubicacion» tienen texto propio, y
       * `noHouse` dice que el fallo es NUESTRO para que nadie crea que su
       * movil va mal.
       */
      /*
       * ======================================================================
       * CORREGIR LO CONTRATADO
       * ======================================================================
       * Lo lee el responsable, de pie en una casa que no se parece a lo que
       * pone la reserva. Ni una cifra de dinero: reporta lo que ve, y lo que
       * cuesta lo dice coordinacion.
       */
      adjustment: {
        open: 'This is not what was booked',
        /*
         * EL ENLACE PEQUEÑO, cuando ya hay una correccion aprobada.
         * Dice que el asunto esta cerrado Y que todavia se puede hablar, en
         * una linea: sin la primera mitad parece que no se resolvio nada;
         * sin la segunda, al equipo solo le queda el telefono.
         */
        openAgain: 'Found something else? Report it',
        title: 'What did you find?',
        intro: 'Change only what is different. Dispatch decides what happens with the price.',
        squareFeet: 'Square feet',
        bedrooms: 'Bedrooms',
        bathrooms: 'Bathrooms',
        addOns: 'Extras the customer asked for',
        asBooked: 'Same as booked',
        wasBooked: 'Booked as {{value}}',
        fewer: 'One fewer',
        more: 'One more',
        note: 'What is going on?',
        notePlaceholder: 'The house is much bigger than it said, and there are three fridges.',
        noteWhy: 'Whoever calls the customer will read this. Say what you saw.',
        cancel: 'Cancel',
        send: 'Send to dispatch',
        needsArrival: 'Tap "I have arrived" first if the house is not what was booked.',
        reportedSize: 'You reported {{from}} sq ft is really {{to}}',
        state: {
          PROPOSED: 'Sent to dispatch',
          APPLIED: 'Dispatch accepted it',
          REJECTED: 'Dispatch turned it down',
          SUPERSEDED: 'Replaced by a later report',
        },
      },

      clockIn: {
        distanceFeet: 'Recorded {{value}} ft from the house. Your location is not saved.',
        distanceMiles: 'Recorded {{value}} mi from the house. Your location is not saved.',
        denied: 'Recorded without location, because location is turned off for this app.',
        unavailable: 'Recorded without location: your phone could not get a GPS fix.',
        noHouse: 'Recorded without distance: we do not have this house on the map yet.',
        far: 'Far from the house',
      },
    },

    /* ------------------------ Ajustes de campo ------------------------ */
    /*
     * Lo que coordinacion ve cuando el equipo avisa de que la casa no es la
     * contratada. AQUI SI van los importes: es quien decide si se cobra la
     * diferencia y quien habla con el cliente.
     */
    adjustments: {
      title: 'What the team found',
      reportedBy: '{{name}} reported this on {{when}}',
      squareFeet: 'Square feet',
      bedrooms: 'Bedrooms',
      bathrooms: 'Bathrooms',
      newTotal: 'New total:',
      /*
       * EL MOTIVO, DICHO PARA DENTRO.
       * Los textos de `quote.review` estan escritos para el CLIENTE —«déjanos
       * tus datos y te llamamos»— y en el panel sonaban absurdos: quien los
       * lee aqui es quien decide, y necesita saber QUE PASA en media linea.
       * La clave que llega es `quote.review.<motivo>`; aqui se busca por su
       * ultimo trozo.
       */
      reason: {
        farZone: 'the house is outside the priced radius',
        outOfServiceArea: 'the postcode is outside the service area',
        outOfState: 'the house is outside Georgia',
        beyondSizeTable: 'the house is bigger than the rate table covers',
        largeProperty: 'it is a large property',
        frequencyUnavailable: 'this service is not sold on that schedule',
        commercialWalkthrough: 'commercial jobs are quoted after a walkthrough',
        ratesUnavailable: 'the rate table this booking used is no longer stored',
      },
      noAutoPriceBecause: 'No automatic price: {{reason}}.',
      typeBelow: 'Type the new total below.',
      manualTotal: 'New total for this job',
      currentTotal: 'It says {{value}} right now',
      manualNeedsAdmin:
        'An administrator has to set the amount for this one: the system cannot work it out.',
      noAutoPrice: 'This size has no automatic price. Work the new amount out by hand.',
      approve: 'Charge the difference',
      reject: 'Do not charge it',
      rejectReason: 'Why not? The team will read this.',
      confirmReject: 'Turn it down',
      resolvedNote: '{{name}}: {{note}}',
      state: {
        PROPOSED: 'Waiting on you',
        APPLIED: 'Charged',
        REJECTED: 'Not charged',
        SUPERSEDED: 'Replaced by a later report',
      },
    },

    /* ------------------------ Fichajes ------------------------ */
    /*
     * Lo que ve coordinacion en el detalle de un trabajo. El margen del GPS
     * se muestra junto a la distancia a proposito: «a 2.4 mi» invita a una
     * conversacion, y «a 2.4 mi ±30 ft» invita a la misma sabiendo que el
     * dato es solido.
     */
    clockIns: {
      title: 'Clock-ins',
      arrived: 'Arrived',
      left: 'Left',
      feet: '{{value}} ft from the house',
      miles: '{{value}} mi from the house',
      accuracy: '(±{{value}} {{unit}})',
      unit: { feet: 'ft', miles: 'mi' },
      denied: 'No location (turned off on their phone)',
      unavailable: 'No location (no GPS fix)',
      noHouse: 'No distance: we do not have this house on the map yet',
      privacyNote:
        'Only the distance is stored. The location of whoever clocked in is never saved: it is turned into a distance and discarded.',
    },

    unreachable: {
      title: 'We could not check your session',
      body: 'You are still signed in: this has not logged you out. It may be the connection, or the server starting up. Try again in a few seconds.',
    },

    /* --------------------------- Errores --------------------------- */
    errorSessionExpired: 'Your session has ended. Please sign in again.',
    errorNoAccess: 'This account does not have access to the admin panel.',
    errorBookingNotFound: 'We could not find that booking.',
    errorStaffNotFound: 'We could not find that staff record.',
    errorStaffEmailTaken: 'Someone is already registered with that email.',
    errorStaffLastAdmin:
      'Not possible: the system would be left with no active administrator and nobody could get back in.',
    errorStaffSelfChange:
      'You cannot change your own role or deactivate yourself: you would lock yourself out.',
    errorAlreadyInvited:
      'That person already signs in normally, so there is nothing to send. If they forgot their password, they can request a link themselves from the sign-in screen.',
    errorStaffAccountTaken:
      'That email already has an account, and it belongs to another staff record. Check whether the same person was added twice.',
    errorInviteInactive: 'You cannot invite someone who is inactive.',
    errorInviteUnavailable: 'Invitation sending is not configured on this deployment.',
    errorInviteNotDelivered:
      'The account was created, but the invitation email did not go out. That person can still get in by requesting the link from "Forgot your password?".',
    errorInviteFailed: 'The identity provider rejected the invitation.',
    errorStaffDoubleBooked:
      'That person already has another job at the same time. Remove them from the team or move one of the two bookings.',
    errorStaffNotAssignable:
      'Someone on the team is no longer active. Refresh the page and pick again.',
    errorAssignCancelled: 'You cannot assign a team to a cancelled booking.',
    errorInvalidTransition:
      'That change is not possible from the current status. Someone may have just updated it.',
    /*
     * Los dos de la lista de verificacion. Dicen QUE HACER, no solo que algo
     * fallo: quien los lee esta de pie en una casa y no puede investigar.
     */
    /*
     * LOS AJUSTES DE CAMPO. Los lee gente muy distinta: los tres primeros,
     * alguien de pie en la puerta de una casa; los tres ultimos,
     * coordinacion delante de un ordenador. Todos dicen QUE HACER.
     */
    errorAdjustmentNotLead:
      'Only the team lead can report that the job is not what was booked. Ask them to do it.',
    errorAdjustmentNoArrival:
      'Tap "I have arrived" first. We only record corrections for a house someone is actually at.',
    errorAdjustmentEmpty: 'Nothing is different from what was booked, so there is nothing to send.',
    errorAdjustmentClosed: 'This job is closed, so it can no longer be corrected.',
    errorAdjustmentNotFound: 'We could not find that correction.',
    errorAdjustmentResolved: 'Someone already decided on this correction. Refresh the page.',
    errorAdjustmentRejectNeedsNote:
      'Say why you are turning it down: the team needs to know whether they measured wrong or we are absorbing it.',
    errorAdjustmentManualNeedsAdmin:
      'Only an administrator can set the amount by hand. Dispatch can approve a price the system worked out, not type one.',
    errorAdjustmentNeedsAmount: 'Type the new total before charging it.',
    errorAdjustmentPriceIsAutomatic:
      'The system already worked out this price, so it cannot be typed by hand.',
    errorAdjustmentStale:
      'The price works out differently now than when this was reported. Ask the team to send it again so someone can look at the new figure.',
    errorChecklistClosed:
      'This job is closed, so its list cannot be changed any more. Talk to dispatch.',
    errorChecklistUnknownItem:
      'That task is no longer on the list for this job. Refresh the screen.',
    errorPaymentNotCapturable: 'There is no hold on this booking that can be charged or released.',
    errorHoldExpired: 'The card hold has expired and can no longer be charged.',
    errorCaptureTooLarge: 'You cannot charge more than the amount held.',
    errorPaymentNotRefundable:
      'There is nothing to refund here: that money was never charged, or it has already been refunded in full.',
    errorRefundTooLarge: 'You cannot refund more than is left of what was charged.',
    errorBalanceNotCompleted:
      'The balance is charged once the job is finished. Mark it as completed first.',
    errorBalanceNothingToCharge: 'There is no balance left to charge on this booking.',
    /* Coordinacion agenda; cambiar lo que se cobra es de administracion. */
    errorSeriesNotFound: 'That repeat schedule no longer exists.',
    errorAlreadyInSeries: 'This booking is already part of a repeat schedule.',
    errorSeriesEnded:
      'This schedule has ended and cannot be restarted. Create a new one from a booking.',
    errorPriceNeedsAdmin:
      'Only administration can set an agreed price. Book it at the standard price and ask them to adjust it.',
    errorNoCardOnFile:
      'No card was saved for this booking. Charge the customer another way: bookings made before we started saving cards do not have one.',
    errorCardNeedsCustomer:
      'The bank wants the cardholder to approve this payment, and they are not here. Send them a payment link instead.',
    errorChargeDeclined:
      'The card was declined. Check with the customer and try again, or charge them another way.',
    errorRefundFailed:
      'The payment provider turned down the refund, so nothing was recorded. Check the card in the provider dashboard before trying again.',
    errorInvalidCredentials: 'Those details are not correct.',
    errorNetwork: 'We could not reach the server. Check your connection.',
    errorGeneric: 'Something went wrong. Please try again.',
    errorNotConfigured: 'Sign-in is not configured on this deployment.',
  },
  booking: {
    /* ----------------------------- Llamada ----------------------------- */
    cta: 'Book this cleaning',
    title: 'Book your cleaning',
    close: 'Close',
    back: 'Back',
    next: 'Continue',
    stepOf: 'Step {{current}} of {{total}}',
    steps: {
      schedule: 'Home & time',
      details: 'Your details',
      payment: 'Card',
    },

    /* ------------------------- 1. Fecha y hora ------------------------- */
    schedule: {
      title: 'Your home, the day and the time',
      /**
       * POR QUE SE PIDEN AQUI Y NO EN EL COTIZADOR. No cambian el precio,
       * cambian cuánto dura el trabajo. Decirlo evita la pregunta obvia
       * —«¿y esto qué me cuesta?»— y justifica que se pidan ahora.
       */
      sizeHelp: 'This does not change the price: it tells us how much time to set aside.',
      dateLabel: 'Date',
      loading: 'Checking availability…',
      closed: 'We are closed that day. Please pick another one.',
      none: 'No times left that day. Please pick another one.',
      duration: 'This job takes about {{duration}}.',
      timezone: 'All times are Georgia time (US Eastern).',
      leadTime: 'We need at least 24 hours to get a team ready.',
      fullyBooked: 'Fully booked',
      tooSoon: 'Too soon',
      doesNotFit: 'Not enough time left that day',
    },

    /* --------------------- 2. Direccion y contacto --------------------- */
    details: {
      title: 'Where and who',
      addressTitle: 'Service address',
      contactTitle: 'Contact details',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email',
      phone: 'Phone',
      line1: 'Street address',
      line2: 'Apartment, suite, unit (optional)',
      city: 'City',
      state: 'State',
      postalCode: 'ZIP code',
      postalCodeLocked: 'Taken from your quote. Change it there to price a different area.',
      accessNotes: 'Access instructions (optional)',
      accessNotesHelp:
        'Gate code, where the key is, a dog in the yard. Only the team assigned to your job and our office can see this.',
      /*
       * EL PIN DE LA PUERTA.
       *
       * LA PROMESA SE DICE DONDE SE DA EL DATO, y se dice exacta: se borra
       * EL PIN, no «tu ubicacion». La direccion de la casa se queda, porque
       * hay que facturar y volver, y prometer que se olvida seria mentira.
       * Una promesa de privacidad que no se cumple al pie de la letra es
       * peor que no hacerla.
       */
      doorPin: 'Show us the door (optional)',
      doorPinHelp:
        'Tap the map where we should pull up. Street addresses out in the county often land a few hundred feet off, and this saves the crew driving in circles.',
      doorPinAria: 'Map to mark where the entrance to your home is',
      doorPinOptional: 'Nothing marked yet, and that is fine.',
      doorPinSet: 'Marked. Drag the pin if it is not quite right.',
      doorPinRetention: 'We delete this pin the day after your cleaning.',
      customerNotes: 'Anything else we should know? (optional)',
      marketingOptIn: 'Send me occasional offers and cleaning tips.',

      mediaConsentTitle: 'Before-and-after photos',
      mediaConsent: 'You may photograph and film this home and publish it on your website.',
      mediaConsentHelp:
        'Entirely optional: it changes neither the price nor the service. We never show the street number, and you can ask us to take it down at any time \u2014 by email or a message \u2014 and it is off the website within 5 days.',
      mediaConsentBefore: 'You may also publish the "before" footage.',
      mediaConsentTenant: 'Someone other than me lives in this home.',
      mediaConsentTenantHelp:
        'Then we also need their release before anything is published: the belongings in shot are theirs, and we will be in touch about it.',
      /*
       * LA UNICA CASILLA OBLIGATORIA. Los enlaces abren en pestana nueva
       * para que leer las condiciones no cueste perder la reserva.
       */
      legalAccept:
        'I have read and accept the <terms>Terms of Service</terms> and the <privacy>Privacy Policy</privacy>.',
      priceNotice:
        'Your final price is confirmed with the full address, so it may differ slightly from the estimate.',
    },

    /* ----------------------------- 3. Pago ----------------------------- */
    payment: {
      title: 'Secure your booking',
      depositTitle: 'Travel deposit',
      depositExplainer:
        'We place a hold of {{amount}} on your card. It is not a charge: it is credited in full against your final invoice, and we only take it if you cancel once our team is already on the way.',
      /* --- Se guarda la tarjeta para el saldo final (etapa 3.23) --- */
      cardKeptNotice:
        'We keep this card on file to charge the remaining {{amount}} once your cleaning is finished. Nothing else is charged to it, and you can ask us to remove it at any time.',
      holdExpires: 'Your slot is held until {{time}}.',
      dueLater: 'Due on the day of service',
      authorise: 'Authorise {{amount}} hold',
      working: 'Talking to your bank…',
      simulatedTitle: 'Simulated payment',
      simulatedBody:
        'Card payments are not connected yet, so no money moves and no card details are asked for. This button finishes the booking exactly as the real one will.',
      simulatedDecline: 'Simulate a declined card',
      unavailableTitle: 'Card payments are not available right now',
      unavailableBody:
        'Your slot is held. Message us on WhatsApp at {{phone}} and we will finish the booking with you.',
      // Variante sin telefono: la empresa puede no tener uno configurado, y
      // "llamanos al" seguido de nada deja al cliente sin saber que hacer.
      unavailableBodyNoPhone:
        'Your slot is held. We will email you to finish the booking with you.',
    },

    /* -------------------------- Confirmacion --------------------------- */
    done: {
      title: 'Your cleaning is booked',
      reference: 'Booking reference',
      referenceHelp: 'Keep it handy: it is the fastest way for us to find your booking.',
      when: 'When',
      where: 'Where',
      held: 'Held on your card',
      dueLater: 'Due on the day of service',
      contact: 'We will call you on {{phone}} if we need anything before the visit.',
      contactNoPhone: 'We will email you if we need anything before the visit.',
      finish: 'Done',
      pendingTitle: 'Booking received, payment pending',
      pendingBody:
        'We could not start the card hold, so your booking is not confirmed yet. Message us on WhatsApp at {{phone}} and we will finish it with you.',
      pendingBodyNoPhone:
        'We could not start the card hold, so your booking is not confirmed yet. We will email you to finish it with you.',
      declinedTitle: 'Your card was declined',
      declinedBody: 'The slot has been released. You can start again with a different card.',
      tryAgain: 'Start again',
    },

    /* ----------------------------- Errores ----------------------------- */
    errorTitle: 'We could not complete your booking',
    errorRequired: 'This field is required.',
    errorEmail: 'Enter a valid email address.',
    errorPhone: 'Enter a valid US phone number.',
    errorPostalCode: 'Enter a valid 5-digit ZIP code.',
    errorDateRequired: 'Pick a date.',
    errorSlotRequired: 'Pick a time.',
    errorSlotTaken: 'That time was just taken. Please pick another slot.',
    errorLegalRequired: 'You have to accept the Terms and the Privacy Policy to book.',
    /*
     * NO ES UN FORMULARIO MAL RELLENADO: es una pestana abierta de antes de
     * que la casilla existiera. Por eso dice que recargue, y dice tambien
     * que no se ha cobrado nada, que es lo primero que uno piensa.
     */
    errorLegalNotAccepted:
      'This page is out of date and could not accept your booking. Reload it and try again: nothing was charged.',
    errorAlreadyBooked: 'You already have a booking at that time.',
    errorRequiresWalkthrough:
      'Commercial jobs are scheduled after a free on-site walkthrough. Contact us and we will arrange it.',
    errorDateOutOfRange: 'Please choose a date within the next 90 days.',
    errorNotBookable: 'We cannot book this job online. Contact us and we will help you.',
    errorPaymentNotFound: 'We could not find that payment. Please start again.',
  },
  quote: {
    line: {
      fieldAdjustment: 'On-site correction',
      /*
       * LA LINEA DICE LO QUE ENTRA EN EL PRECIO, Y NADA MAS. Antes nombraba
       * habitaciones y banos; ninguno de los dos mueve la cifra, y leerlos
       * junto al importe hace pensar que con una habitacion mas costaria
       * mas. Los presupuestos guardados siguen pintandose bien: sus
       * parametros de sobra se ignoran al traducir.
       */
      service: {
        STANDARD: 'Standard cleaning · {{squareFeet}} sq ft',
        DEEP: 'Deep cleaning · {{squareFeet}} sq ft',
        MOVE_IN_OUT: 'Move in / move out · {{squareFeet}} sq ft',
        POST_CONSTRUCTION: 'Post-construction · {{squareFeet}} sq ft',
        AIRBNB_TURNOVER: 'Airbnb turnover · {{squareFeet}} sq ft',
        COMMERCIAL: 'Commercial cleaning',
      },
      addOn: {
        INSIDE_FRIDGE: 'Inside the refrigerator',
        INSIDE_OVEN: 'Inside the oven',
        WINDOWS_AND_CABINETS: 'Interior windows and cabinets',
        INSIDE_CABINETS: 'Inside kitchen cabinets',
        INTERIOR_WINDOWS: 'Interior windows (x{{quantity}})',
        LAUNDRY: 'Laundry ({{quantity}} loads)',
        BASEMENT: 'Basement',
        GARAGE: 'Garage',
        PET_HAIR: 'Heavy pet hair',
        PATIO: 'Balcony / patio',
        BED_LINENS: 'Bed linens (x{{quantity}})',
      },
      /**
       * El traslado que SE COBRA HOY: las millas que pasan del radio libre,
       * contadas ida y vuelta.
       */
      travel:
        'Travel · {{miles}} mi ({{freeRadius}} included, {{billableMiles}} billed round trip)',

      /*
       * LAS TRES DE ABAJO YA NO SE EMITEN. Se quedan porque el panel lee
       * presupuestos y reservas guardados, y sus lineas siguen apuntando a
       * estas claves: borrarlas dejaria el historial mostrando el nombre de
       * la clave en vez del concepto.
       */
      discount: {
        ONE_TIME: 'Discount',
        WEEKLY: 'Weekly service discount ({{percent}}%)',
        BIWEEKLY: 'Biweekly service discount ({{percent}}%)',
        MONTHLY: 'Monthly service discount ({{percent}}%)',
      },
      minimumAdjustment: 'Service minimum (${{minimum}})',
      zoneSurcharge: 'Travel surcharge · zone {{zone}} ({{miles}} mi)',

      /*
       * EL PRECIO PACTADO, cuando una reserva del panel no usa el del motor.
       * Se ensena como una linea mas para que el desglose siga sumando el
       * total y se vea de donde sale la diferencia.
       */
      agreedPrice: 'Agreed price adjustment',
      salesTax: 'Sales tax ({{percent}}%)',
    },
    disclaimer: {
      estimate:
        'This is an estimate based on the information you provided. The final price is confirmed on site before work begins.',
      deposit:
        'The travel deposit is authorised on your card when you book and is credited in full against your final invoice. It is only captured if you cancel after our team is already on the way.',
      taxExempt: 'Cleaning services are exempt from sales tax in the State of Georgia.',
      validity: 'This quote is valid for 7 days.',
      distanceEstimated:
        'Distance is estimated from your ZIP code and confirmed once we have the full address.',
    },
    review: {
      /*
       * EL MOTIVO, DICHO PARA DENTRO. Los textos de `quote.review` son para
       * el cliente —«déjanos tus datos y te llamamos»—; estos son para quien
       * decide en el panel y tienen que decir QUE PASA en una línea.
       */
      ratesUnavailable: 'The rate table this booking was priced with is no longer stored',
      commercialWalkthrough:
        'Commercial jobs are priced after a free on-site walkthrough so the scope matches your facility.',
      outOfServiceArea:
        'This ZIP code is outside the area we cover. We may still be able to help — ask us.',
      /*
       * Distinto de `outOfServiceArea`, y la diferencia importa: «no
       * vamos» y «vamos, te llamamos con el precio» son dos respuestas
       * opuestas para quien esta pidiendo un presupuesto.
       */
      farZone:
        'We do reach that far, but at that distance we price the job in person: travel changes the numbers a lot and we would rather give you a real figure. Leave us your details and we will call you.',
      outOfState: 'We currently operate in the State of Georgia only.',
      largeProperty: 'Large properties are quoted individually to keep the estimate accurate.',
      beyondSizeTable:
        'Your home is larger than our price list covers. We will come out, look at it and send you a price.',

      /**
       * El servicio existe, pero no en esa cadencia. Distinto de «no damos
       * precio automático»: aquí la salida está en la misma pantalla —
       * cambiar de frecuencia—, no en esperar una llamada.
       */
      frequencyUnavailable:
        'We do not offer this service on that schedule. Pick another frequency, or write to us and we will work it out with you.',
    },
    tax: {
      gaExempt: 'Exempt — cleaning services are not taxed in Georgia',
    },
  },

  whyUs: {
    title: 'Why Freshness Touch',
    insured: {
      title: 'Fully insured',
      body: 'General liability coverage protects your home and belongings.',
    },
    vetted: {
      title: 'Background-checked team',
      body: 'Every cleaner passes a criminal background check and identity verification before their first job.',
    },
    transparent: {
      title: 'Transparent pricing',
      body: 'You see the full breakdown before you book: service, add-ons, travel and deposit.',
    },
    guarantee: {
      title: 'Re-clean guarantee',
      body: 'Not happy with something? Tell us within 24 hours and we come back to fix it.',
    },
  },

  areas: {
    title: 'Service areas',
    subtitle:
      'We work in zones to keep drive time low and your price fair. Enter your ZIP code in the quote tool to see your zone.',
    zoneLabel: 'Zone {{zone}}',
    upToMiles: 'Up to {{miles}} miles from our base',
    beyondMiles: 'Beyond {{miles}} miles',
    noSurcharge: 'No travel surcharge',

    /**
     * EL TRASLADO YA NO ES UN IMPORTE POR ZONA. Se cobra por milla a partir
     * del radio libre, así que la tarjeta no puede prometer una cifra: lo
     * honesto es decir cómo se cuenta y que el cotizador dé el número.
     */
    travelByMile: 'Travel billed per mile beyond the included radius',
    outOfRange: 'Outside the area we cover — contact us for a custom proposal',

    /* --------------------------- El mapa --------------------------- */
    /** Lo que oye quien usa lector de pantalla: un mapa sin describir no dice nada. */
    mapDescription:
      'Map of our service area: concentric rings around {{city}} reaching up to {{miles}} miles, covering the whole State of Georgia.',
    mapRadiusNote:
      'The rings are straight-line distances. Travel is billed by road miles, which are always longer — the quote gives you the exact figure.',
    mapZoneInstant: 'Zone {{zone}} — up to {{miles}} miles · {{amount}}',
    mapZoneOnRequest: 'Up to {{miles}} miles — we come out here, and we price the job in person',
    mapViewLabel: 'Map view',
    viewWholeState: 'Whole state',
    viewInstantArea: 'Instant-price area ({{miles}} mi)',
    /*
     * EL ANILLO SIN RECARGO DE TRASLADO (etapa 3.15).
     *
     * Dice lo que se COBRA, no hasta donde se va ni donde sale el precio
     * solo. Es un ajuste distinto del limite de las zonas, y el mapa tiene
     * que poder contarlo por separado el dia que dejen de coincidir.
     */
    mapFreeRadius: 'Up to {{miles}} miles — no travel charge',
    legendFreeRadius: 'No travel charge ({{miles}} mi)',
    legendInstant: 'Instant price online',
    legendOnRequest: 'We price it in person',

    /**
     * Para las zonas sin precio automatico. NO se les puede decir «sin
     * recargo por traslado»: no es que sea gratis, es que el precio todavia
     * no esta hecho, y prometer lo primero deja a la empresa con una
     * expectativa que no puede cumplir.
     */
    onRequest: 'We price this one in person',
  },

  faq: {
    title: 'Frequently asked questions',
    q1: {
      q: 'Do I pay sales tax?',
      a: 'No. Cleaning services are exempt from sales tax in Georgia, so the price you see is the price you pay.',
    },
    q2: {
      q: 'What exactly is the travel deposit?',
      a: 'It is a flat $35 hold, not an extra cost: it is authorised on your card when you book and credited in full against your final invoice. Cancel more than 24 hours ahead and we release it. We only charge it if you cancel within 24 hours of the appointment, or once our team is already on the way.',
    },
    q3: {
      q: 'Do I need to be home during the cleaning?',
      a: 'No. Many clients leave access instructions at booking. You choose what works for you.',
    },
    q4: {
      q: 'Do you bring your own supplies?',
      a: 'Yes, our team arrives with professional equipment and products. If you prefer we use yours, just tell us.',
    },
    q5: {
      q: 'Should I tip?',
      a: 'Tipping is never required. It is common to tip 15-20% for one-time, deep or move-out cleans; for recurring service many clients prefer a holiday bonus instead.',
    },
    q6: {
      q: 'How do I reschedule or cancel?',
      a: 'Contact us at least 24 hours before your appointment and we will move it at no cost. Within 24 hours, or once our team is on the way, we charge the $35 deposit and nothing more.',
    },
  },

  /* ===================== Antes y despues ===================== */
  /*
   * La seccion no se pinta si no hay videos configurados, asi que estos
   * textos pueden existir mucho antes de que haya contenido.
   */
  /**
   * LA PAGINA DESDE LA QUE UN CLIENTE RETIRA SUS FOTOS.
   *
   * Textos cortos y sin rodeos: quien llega aqui viene de un correo a hacer
   * una cosa. No se le pide que explique por que, no se le ofrece cambiar de
   * idea a medias y no se le pregunta si esta seguro — pedir una razon para
   * retirar algo es una forma educada de poner una barrera.
   */
  removal: {
    title: 'Take your photos off our website',
    intro:
      'Press the button and the photos and videos of your home stop being published. It takes effect straight away.',
    help: 'You do not have to tell us why. If you change your mind, just write to us.',
    confirm: 'Yes, take them down',
    sending: 'Taking them down\u2026',
    done: 'Done. The photos and videos of your home are no longer published.',
    /*
     * MISMO TEXTO PARA UN ENLACE FALSO, UNO YA USADO Y UNO AUSENTE. Decir
     * cual de los tres es convertiria esta pagina en una forma de averiguar
     * que enlaces existieron.
     */
    invalid:
      'This link no longer works. It may have been used already. Write to us and we will take them down ourselves.',
    error: 'We could not reach the server. Try again in a moment.',
  },

  gallery: {
    title: 'Before and after',
    subtitle: 'Real homes we cleaned, shared with the owner’s written permission.',
    /*
     * EL AVISO DEL TERCERO VA ANTES DEL BOTON, NO DESPUES.
     *
     * Hasta que se pulsa, la pagina no pide nada a nadie. Al pulsar se carga
     * un marco de YouTube, y esa es la unica peticion a un tercero que hace
     * el sitio entero. El visitante tiene que poder decidirlo sabiendolo, no
     * enterarse despues.
     */
    thirdPartyNote:
      'Videos are hosted on YouTube. Nothing is requested from YouTube until you press play.',
    play: 'Play video',
    /* Lo que lee un lector de pantalla cuando la foto no tiene titulo. */
    photoAlt: 'Before and after of a home we cleaned',
    /* Los mandos de la fila. Sin texto visible, es lo unico que los nombra. */
    close: 'Close video',
    previous: 'Show previous',
    next: 'Show next',
  },

  contact: {
    title: 'Ready when you are',
    subtitle: 'Get your instant price online, or talk to a human — whichever you prefer.',
    whatsapp: 'WhatsApp',
    email: 'Email',
    hours: 'Hours',
    closed: 'Closed',
    /*
     * El horario ya NO es un texto: se compone desde los datos que la empresa
     * guarda en el panel. Solo quedan aqui los nombres de los dias, que si
     * son traduccion.
     */
    day: {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      7: 'Sunday',
    },
    serviceArea: 'Based in {{city}}, {{state}} - Serving Metro Atlanta',
  },

  /* ------------------- Las dos paginas legales ------------------- */
  legal: {
    effective: 'In effect since {{date}} · Version {{version}}',
    /* Lo que se pone cuando un dato de la empresa no esta configurado. */
    fallbackContact: 'the contact details at the end of this page',
    fallbackCounty: 'the county where our business is based',
    contact: {
      company: 'Company',
      mail: 'Mail',
      phone: 'Phone',
      email: 'Email',
    },
  },
  footer: {
    rights: 'All rights reserved.',
    legalNote: 'Prices shown are estimates and are confirmed before any work begins.',
    privacy: 'Privacy',
    terms: 'Terms',
  },
} as const;

/**
 * Convierte el objeto literal de `en` en una "forma" de traduccion:
 * conserva la estructura exacta de claves pero permite cualquier texto.
 * Asi `es` debe tener EXACTAMENTE las mismas claves, con textos distintos.
 */
type TranslationShape<T> = {
  [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]>;
};

export type TranslationResources = TranslationShape<typeof en>;
