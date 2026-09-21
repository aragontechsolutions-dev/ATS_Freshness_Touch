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

  frequency: {
    title: 'How often?',
    ONE_TIME: 'One time',
    WEEKLY: 'Weekly',
    BIWEEKLY: 'Every 2 weeks',
    MONTHLY: 'Monthly',
    savePercent: 'Save {{percent}}%',
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

    /* --------------------------- Errores --------------------------- */
    errorSessionExpired: 'Your session has ended. Please sign in again.',
    errorNoAccess: 'This account does not have access to the admin panel.',
    errorBookingNotFound: 'We could not find that booking.',
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
      finish: 'Done',
      pendingTitle: 'Booking received, payment pending',
      pendingBody:
        'We could not start the card hold, so your booking is not confirmed yet. Call us on {{phone}} and we will finish it with you.',
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
        'This ZIP code is outside our standard service area. We may still be able to help — ask us.',
      outOfState: 'We currently operate in the State of Georgia only.',
      largeProperty: 'Large properties are quoted individually to keep the estimate accurate.',
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
    surcharge: '{{amount}} travel surcharge',
    outOfRange: 'Outside our standard area — contact us for a custom proposal',
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
    hoursValue: 'Monday to Saturday, 8:00 AM - 6:00 PM',
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
