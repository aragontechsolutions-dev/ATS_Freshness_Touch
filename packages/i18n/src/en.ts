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
    getQuote: 'Get an instant quote',
    bookNow: 'Book now',
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
    primaryCta: 'Get my instant quote',
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

  quote: {
    line: {
      service: {
        STANDARD: 'Standard cleaning · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
        DEEP: 'Deep cleaning · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
        MOVE_IN_OUT: 'Move in / move out · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
        POST_CONSTRUCTION:
          'Post-construction · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
        AIRBNB_TURNOVER: 'Airbnb turnover · {{bedrooms}} bd / {{bathrooms}} ba · {{squareFeet}} sq ft',
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
    q1: { q: 'Do I pay sales tax?', a: 'No. Cleaning services are exempt from sales tax in Georgia, so the price you see is the price you pay.' },
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
