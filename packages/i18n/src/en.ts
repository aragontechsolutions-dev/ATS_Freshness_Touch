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
      radiusNote: 'The circle is the {{miles}} miles with no travel charge.',

      latitude: 'Latitude',
      longitude: 'Longitude',
      city: 'City',
      postalCode: 'ZIP code',
      postalCodeNote: 'The ZIP code is what the engine measures from to reach each customer.',

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
