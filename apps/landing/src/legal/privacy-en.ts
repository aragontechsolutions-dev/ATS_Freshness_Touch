import type { Documento } from './documento';

/**
 * La Politica de Privacidad en ingles: LA VERSION QUE GOBIERNA.
 *
 * No se redacto desde una plantilla: cada afirmacion salio de leer el esquema
 * campo por campo y los proveedores uno por uno. Ver `docs/40`.
 *
 * ESTE ARCHIVO ES EL ORIGINAL. No hay copia en Markdown: lo que el cliente
 * acepta es lo que esta pagina ensena, asi que esta pagina es el documento.
 * Ver `apps/landing/src/legal/documento.ts`.
 *
 * AL CAMBIAR EL FONDO HAY QUE SUBIR LA VERSION en
 * `packages/types/src/legal.ts`. Si se edita sin subirla, lo guardado en cada
 * reserva apunta a un texto que ya no es el que esa persona acepto.
 */
export const PRIVACY_EN: Documento = {
  titulo: 'Privacy Policy',
  bloques: [
    {
      t: 'h2',
      texto: '1. Who we are and what this covers',
    },
    {
      t: 'p',
      texto:
        'Freshness Touch is a residential and commercial cleaning company operating in the State of Georgia, United States. This policy explains what personal information we collect when you use our website, request a quote or book a cleaning; why we collect it; who we share it with; how long we keep it; and what you can ask us to do with it.',
    },
    {
      t: 'contacto',
    },
    {
      t: 'p',
      texto:
        "This policy covers our website and our booking system. It does not cover anything you send us through a third-party messaging service such as WhatsApp, which is governed by that service's own privacy policy in addition to this one.",
    },
    {
      t: 'h2',
      texto: '2. Plain-language summary',
    },
    {
      t: 'p',
      texto:
        'We only collect what we need to quote a price, get to your home and clean it, charge you correctly, and tell you what is happening.',
    },
    {
      t: 'ul',
      items: [
        '**We do not sell your personal information.** We never have and we have no plans to.',
        '**We do not share your information with advertisers or data brokers.**',
        '**We do not use advertising or analytics cookies**, and we do not track you across other websites. Our site stores two things in your browser — your language and whether you chose light or dark mode — and nothing else.',
        '**We never see or store your full card number.** Our payment processor handles the card; we only ever see the brand and the last four digits.',
        '**Photos of your home are never published without your separate, written permission**, and you can have them taken down at any time.',
      ],
    },
    {
      t: 'h2',
      texto: '3. What we collect, and why',
    },
    {
      t: 'h3',
      texto: '3.1 When you use the price calculator',
    },
    {
      t: 'p',
      texto:
        'To give you a price we ask for your **ZIP code** and the details of the job: service type, how often you want it, number of bedrooms and bathrooms, square footage and any add-ons. We keep this quote so we can reproduce the exact price we quoted you if you ask about it later.',
    },
    {
      t: 'p',
      texto: 'You do **not** have to give us your name, email or phone number to see a price.',
    },
    {
      t: 'h3',
      texto: '3.2 When you book',
    },
    {
      t: 'tabla',
      cabecera: ['What we collect', 'Why'],
      filas: [
        ['First and last name', 'To identify your booking and address you properly'],
        ['Email address', 'To send your confirmation, receipt and reminders'],
        ['Phone number', 'So the team can reach you on the day of service'],
        [
          'Service address (street, unit, city, state, ZIP)',
          'To get there, and to calculate travel distance',
        ],
        [
          'Access instructions, if you choose to give them',
          'So the team can get in when you are not home',
        ],
        [
          'A point on a map marking your entrance, if you choose to set one',
          'Because automated address lookup can place rural Georgia homes hundreds of metres off',
        ],
        ['Notes you write for the team', 'So we clean what you actually want cleaned'],
        ['Preferred language', 'To write to you in English or Spanish'],
        [
          'The IP address the booking came from',
          'Security: to detect abuse and fraudulent bookings',
        ],
        [
          'Whether you opted in to marketing email',
          'So we only send offers to people who asked for them',
        ],
      ],
    },
    {
      t: 'p',
      texto:
        'Giving us access instructions and the map point is **optional**. You can book without either and simply let the team in yourself.',
    },
    {
      t: 'h3',
      texto: '3.3 Payment information',
    },
    {
      t: 'p',
      texto:
        "Card payments are handled by **Stripe, Inc.** You enter your card details into Stripe's own secure form. **We never receive, see or store your full card number, expiry date or security code.**",
    },
    {
      t: 'p',
      texto:
        'What we do keep, because we need it to run your booking and answer billing questions, is: the card brand (Visa, Mastercard…), the **last four digits**, the amounts authorised, charged and refunded, the status of each payment, the references Stripe gives us to identify the transaction, and the reason code if a payment is declined.',
    },
    {
      t: 'h3',
      texto: '3.4 Photos and video of your home',
    },
    {
      t: 'p',
      texto:
        'We sometimes take before-and-after photos or short videos. **These are never published anywhere without your separate written permission**, which we ask for in its own form — not buried in these terms. Section 7 explains this in full.',
    },
    {
      t: 'h3',
      texto: '3.5 What we do NOT collect',
    },
    {
      t: 'ul',
      items: [
        "We do not collect your Social Security number, driver's licence number, date of birth or financial account numbers.",
        'We do not collect health information, biometric data, or information about your race, religion, politics, union membership, sexual orientation or immigration status.',
        'We do not use cameras, audio recording or any kind of monitoring device in your home.',
        'We do not run advertising or analytics scripts on our website, so we do not build a profile of your browsing.',
        'We do not knowingly collect information from children (see section 11).',
      ],
    },
    {
      t: 'h2',
      texto: '4. Who we share it with',
    },
    {
      t: 'p',
      texto:
        'We share personal information only with the companies that run parts of our service for us, and only with what each one needs. Each is bound by its own contract and privacy policy. We do not sell or rent your information to anyone.',
    },
    {
      t: 'tabla',
      cabecera: ['Who', 'What they get', 'What they do with it'],
      filas: [
        [
          '**Stripe, Inc.**',
          'Your card details (direct from you), your email, the amounts',
          'Processes the deposit hold, the final charge and any refund; sends you the card receipt',
        ],
        [
          '**Supabase**',
          'Everything in our database, hosted in the United States',
          'Stores our database and files',
        ],
        ['**Render**', 'The data our system processes while it runs', 'Runs our booking system'],
        ['**Vercel**', 'The requests your browser makes to our website', 'Serves our website'],
        [
          '**Resend**',
          'Your name, email, booking reference, appointment time and address',
          'Delivers our confirmation, reminder and receipt emails',
        ],
        [
          '**Google Maps Platform** (Google LLC)',
          'Your ZIP code and state when you get a quote; your street and city as well once you book',
          'Calculates the driving distance from our base, which is part of your price',
        ],
        [
          '**U.S. Census Bureau geocoder**',
          'Your service address',
          'Converts the address to map coordinates. A free U.S. government service',
        ],
        [
          '**Telegram**',
          'Internal work alerts, which include your name, appointment time and street address',
          'Notifies our own team of new and changed jobs',
        ],
      ],
    },
    {
      t: 'p',
      texto:
        'We may also disclose information when the law requires it — a subpoena, a court order, a lawful request from a government agency — to our insurer or lawyers in connection with a claim, to our accountant for tax purposes, or to a buyer if the business is ever sold, in which case this policy continues to apply to information collected before the sale.',
    },
    {
      t: 'p',
      texto:
        'Our employees see only what their job needs: the cleaning team assigned to your job sees your address, your access instructions and your notes, but **never any payment amounts**. Every time a member of staff looks at or changes sensitive information, our system records who did it and when.',
    },
    {
      t: 'h2',
      texto: '5. Where your information is held',
    },
    {
      t: 'p',
      texto:
        'In the United States. Our website, booking system, database and file storage are all hosted with U.S. providers.',
    },
    {
      t: 'h2',
      texto: '6. How long we keep it',
    },
    {
      t: 'tabla',
      cabecera: ['What', 'How long'],
      filas: [
        [
          'The map point marking your entrance',
          '**Deleted 24 hours after the job ends**, automatically',
        ],
        [
          "An unpaid booking's card hold",
          'Released automatically; card holds expire after 7 days at the latest',
        ],
        [
          'A quote',
          'Its price is valid for 7 days; we keep the record so we can reproduce what we quoted',
        ],
        [
          'Your photo and video permission, and the proof of it',
          'For as long as we may use the material, plus the period our insurer and the law require us to be able to prove you gave it',
        ],
        [
          'Photos or video we agreed to take down',
          'Removed from everywhere we published them within **5 days** of your request',
        ],
        [
          'Booking, payment and service records',
          'While you are our customer, and afterwards for as long as we need them for tax, accounting, insurance and legal-claim purposes',
        ],
        [
          'Our internal record of who did what in the system',
          '**One year**, then deleted automatically. It deliberately contains **no** card data, passwords, door codes, names or addresses',
        ],
      ],
    },
    {
      t: 'p',
      texto:
        'When a retention period ends we delete the information or remove what identifies you from it.',
    },
    {
      t: 'h2',
      texto: '7. Photos and video of your home',
    },
    {
      t: 'p',
      texto:
        'This is the part of our service that touches your privacy the most, so we treat it separately.',
    },
    {
      t: 'ol',
      items: [
        '**We ask for permission in its own form**, which states what we may photograph (inside, outside, before-and-after), where we may publish it (our website, social media) and for how long. We do not treat a booking as permission to publish.',
        '**The permission is written down.** We keep a record of how you gave it — a signed form, a web form, an email or a message — and keep a copy of that proof. The proof is stored in a **private** file store that is not reachable from the internet, by design.',
        '**If someone else lives at the property**, we also need their permission before we publish anything.',
        "**We remove location data from every photo before storing it.** Phones record GPS coordinates inside image files; our system strips that out server-side so your home's coordinates cannot travel with the picture.",
        '**You can change your mind at any time.** Tell us by any means and we take the material down, everywhere we published it, within 5 days. With your permission record we also send you a one-time link so you can request the takedown yourself without having to reach a person. That link is personal — treat it like a password, and do not forward it.',
        '**We never publish your name or your address with the pictures.**',
      ],
    },
    {
      t: 'h2',
      texto: '8. Marketing email and text messages',
    },
    {
      t: 'p',
      texto:
        '**Email.** We send you transactional email because you booked with us — your confirmation, your receipt, a reminder before the appointment. That is part of the service and you cannot be a customer without it, although you can ask us to use the phone instead.',
    },
    {
      t: 'p',
      texto:
        'Marketing email is separate. We only send it if you ticked the box asking for it, every one has an unsubscribe link, and unsubscribing takes effect immediately and does not affect your service.',
    },
    {
      t: 'p',
      texto:
        '**Text messages / SMS.** We do **not** currently send marketing text messages. If we ever do, we will ask for your express written consent separately first, we will tell you that consent is not a condition of buying anything, and you will be able to stop them by replying STOP.',
    },
    {
      t: 'p',
      texto:
        '**Phone calls.** We may call you about a booking you made. We do not make marketing robocalls.',
    },
    {
      t: 'h2',
      texto: '9. How we protect it',
    },
    {
      t: 'ul',
      items: [
        'Everything travels over an encrypted connection (HTTPS).',
        'Card numbers are never stored on our systems; our payment processor holds them.',
        'Access to our admin panel requires an individual account, and each role sees only what it needs.',
        'The database rejects access that does not come through our system.',
        'Photos are served through short-lived links, not permanent public URLs.',
        'Documents proving photo permission live in a private store with no public address at all.',
        'Our system keeps a record of who read or changed sensitive information.',
        'Every cleaner passes a criminal background check and identity verification before their first job.',
      ],
    },
    {
      t: 'p',
      texto:
        "No system is perfect, and we do not claim ours is. If a breach affects your personal information, we will notify you as required by Georgia's breach notification law, O.C.G.A. § 10-1-910 et seq.",
    },
    {
      t: 'h2',
      texto: '10. Your choices and your rights',
    },
    {
      t: 'p',
      texto:
        'Georgia does not currently have a general consumer data privacy statute. We nonetheless offer the following to everyone, as a matter of policy, and we do not charge for it:',
    },
    {
      t: 'ul',
      items: [
        '**Ask what we hold about you**, and get a copy.',
        '**Correct** anything that is wrong.',
        '**Delete** your information. We remove your name, email, phone, street address, access instructions, the map pin, your notes, and your name from any photo permission — and we take those photos down at the same time. We keep what the law requires: the booking references and amounts, the city and ZIP code, and the card brand and last four digits. We will tell you exactly that.',
        '**Withdraw your permission** for photos and video (section 7).',
        '**Unsubscribe** from marketing email at any time.',
        '**Ask us not to call or write to you** at all, in which case we can no longer provide service, and we will say so plainly.',
      ],
    },
    {
      t: 'p',
      texto:
        'Write to {{email}} or call {{phone}}. We will answer within 30 days, and we may need to verify who you are first — we are not going to hand your address to someone who merely knows your email.',
    },
    {
      t: 'p',
      texto:
        'If you live in a state with its own consumer privacy law, you may have additional statutory rights. Ask us and we will honour them.',
    },
    {
      t: 'h2',
      texto: '11. Children',
    },
    {
      t: 'p',
      texto:
        'Our services are for adults. We do not direct our website to children, we do not knowingly collect personal information from anyone under 13, and if we learn we have, we delete it. If you believe a child has given us information, write to {{email}}.',
    },
    {
      t: 'h2',
      texto: '12. Changes to this policy',
    },
    {
      t: 'p',
      texto:
        'If we change this policy we will post the new version here with a new effective date and version number. If a change materially affects how we use information we already hold, we will tell you before it takes effect — by email if you are a customer.',
    },
    {
      t: 'p',
      texto:
        'When you book, we record which version of this policy and of our Terms of Service you accepted, and when. If you want to know what you agreed to, ask and we will send you that exact version.',
    },
    {
      t: 'h2',
      texto: '13. Language',
    },
    {
      t: 'p',
      texto:
        'This policy is published in English and Spanish. The English version is the one that governs; the Spanish version is provided for convenience. If the two ever disagree, the English text controls.',
    },
    {
      t: 'h2',
      texto: '14. How to reach us',
    },
    {
      t: 'contacto',
    },
  ],
};
