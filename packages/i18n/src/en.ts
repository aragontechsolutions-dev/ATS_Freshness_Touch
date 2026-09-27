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
    callUs: 'Call us',
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

  nav: {
    services: 'Services',
    scope: "What's included",
    quote: 'Instant quote',
    areas: 'Service areas',
    whyUs: 'Why us',
    faq: 'FAQ',
    contact: 'Contact',
    menu: 'Menu',
  },

  hero: {
    badge: 'Licensed · Insured · Bonded',
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
      'Tell us a bit more and a member of our team will send you a personalised proposal.',
    requestCallback: 'Request a custom proposal',
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
      teamSaved: 'Team saved.',
      staffSaved: 'Staff record saved.',
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
    depositHeld: '{{amount}} is held on the card, not charged.',
    captureDeposit: 'Charge the deposit',
    releaseDeposit: 'Release the hold',
    depositHelp:
      'Charge it only if the customer cancelled once the team was on the way or was not home. Otherwise release it.',
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

      contact: 'Contact',
      phone: 'Phone number',
      phoneSaved: 'Will be saved as {{value}}',
      phoneEmpty: 'No phone number. The website will not show a call button.',
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
      emailInvalid: 'Enter a valid email address.',
      hoursInvalid: 'Check these hours: the closing time must be after the opening time.',

      save: 'Save changes',
      saving: 'Saving…',
      saved: 'Saved.',
      lastChange: 'Last changed by {{who}} on {{when}}.',
      unknownAuthor: 'someone no longer on the team',
    },
    /* -------------------------- Avisos ----------------------------- */
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
      telegramChatId: 'Telegram chat',
      telegramChatIdHelp:
        'The numeric chat id. Write to your bot, then open api.telegram.org/bot<token>/getUpdates to read it.',
      telegramChatIdInvalid: 'The chat id is a number, for example 123456789.',

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
      errFrequencyOrder:
        'The price cannot go up as the frequency goes up: someone coming weekly would pay more than someone coming once.',
      currentVersion: 'Version {{version}} · {{count}} saved in total',
    },

    /* ----------------------- Area de servicio ----------------------- */
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
      surcharge: 'Travel surcharge ($)',
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
        booking: {
          created: 'Booking placed',
          team_changed: 'Team changed',
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
        pricing: {
          updated: 'Rates changed',
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
      directions: 'Directions',
      rooms: '{{bedrooms}} bedrooms · {{bathrooms}} bathrooms',
      start: 'I have arrived',
      finish: 'I have finished',
      finished: 'Finished',
      finishHint:
        'Tap "I have arrived" when you enter the house. The time is recorded, and it is what backs up your work if anyone asks.',
      noActions: 'Dispatch handles the rest.',
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
    errorPaymentNotCapturable: 'There is no hold on this booking that can be charged or released.',
    errorHoldExpired: 'The card hold has expired and can no longer be charged.',
    errorCaptureTooLarge: 'You cannot charge more than the amount held.',
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
      schedule: 'Date & time',
      details: 'Your details',
      payment: 'Card',
    },

    /* ------------------------- 1. Fecha y hora ------------------------- */
    schedule: {
      title: 'Pick a date and time',
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
      customerNotes: 'Anything else we should know? (optional)',
      marketingOptIn: 'Send me occasional offers and cleaning tips.',
      priceNotice:
        'Your final price is confirmed with the full address, so it may differ slightly from the estimate.',
    },

    /* ----------------------------- 3. Pago ----------------------------- */
    payment: {
      title: 'Secure your booking',
      depositTitle: 'Travel deposit',
      depositExplainer:
        'We place a hold of {{amount}} on your card. It is not a charge: it is credited in full against your final invoice, and we only take it if you cancel once our team is already on the way.',
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
        'Your slot is held. Call us on {{phone}} and we will finish the booking with you.',
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
        'We could not start the card hold, so your booking is not confirmed yet. Call us on {{phone}} and we will finish it with you.',
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
    errorAlreadyBooked: 'You already have a booking at that time.',
    errorRequiresWalkthrough:
      'Commercial jobs are scheduled after a free on-site walkthrough. Contact us and we will arrange it.',
    errorDateOutOfRange: 'Please choose a date within the next 90 days.',
    errorNotBookable: 'We cannot book this job online. Contact us and we will help you.',
    errorPaymentNotFound: 'We could not find that payment. Please start again.',
  },
  quote: {
    line: {
      service: {
        STANDARD: 'Standard cleaning · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
        DEEP: 'Deep cleaning · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
        MOVE_IN_OUT:
          'Move in / move out · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
        POST_CONSTRUCTION:
          'Post-construction · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
        AIRBNB_TURNOVER:
          'Airbnb turnover · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
        COMMERCIAL: 'Commercial cleaning',
      },
      addOn: {
        INSIDE_FRIDGE: 'Inside the refrigerator',
        INSIDE_OVEN: 'Inside the oven',
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
      title: 'Insured and bonded',
      body: 'General liability coverage and a janitorial bond protect your home and belongings.',
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
      'Map of our service area: concentric rings around Atlanta reaching up to {{miles}} miles, covering the whole State of Georgia.',
    mapZoneInstant: 'Zone {{zone}} — up to {{miles}} miles · {{amount}}',
    mapZoneOnRequest: 'Up to {{miles}} miles — we come out here, and we price the job in person',
    mapViewLabel: 'Map view',
    viewWholeState: 'Whole state',
    viewInstantArea: 'Instant-price area ({{miles}} mi)',
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
      a: 'It is a refundable hold based on how far your home is from our base. It is authorised on your card at booking, credited against your final invoice, and only charged if you cancel once our team is already travelling to you.',
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
      a: 'Contact us at least 24 hours before your appointment and we will move it at no cost.',
    },
  },

  contact: {
    title: 'Ready when you are',
    subtitle: 'Get your instant price online, or talk to a human — whichever you prefer.',
    phone: 'Phone',
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
    serviceArea: 'Based in {{city}}, {{state}}',
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
