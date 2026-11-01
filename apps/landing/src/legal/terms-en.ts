import type { Documento } from './documento';

/**
 * Los Terminos y Condiciones en ingles: LA VERSION QUE GOBIERNA.
 *
 * El servicio se presta en Georgia, el contrato se rige por la ley de Georgia
 * y un tribunal de Georgia trabaja en ingles. La version espanola existe
 * porque nadie deberia tener que aceptar un contrato que no puede leer.
 *
 * ESTE ARCHIVO ES EL ORIGINAL. No hay copia en Markdown: lo que el cliente
 * acepta es lo que esta pagina ensena, asi que esta pagina es el documento.
 * Ver `apps/landing/src/legal/documento.ts`.
 *
 * AL CAMBIAR EL FONDO HAY QUE SUBIR LA VERSION en
 * `packages/types/src/legal.ts`. Si se edita sin subirla, lo guardado en cada
 * reserva apunta a un texto que ya no es el que esa persona acepto.
 */
export const TERMS_EN: Documento = {
  titulo: 'Terms of Service',
  bloques: [
    {
      t: 'h2',
      texto: '1. What this is, and how you accept it',
    },
    {
      t: 'p',
      texto:
        'These Terms are the agreement between you and {{company}}, doing business as Freshness Touch ("we", "us"), when you book a cleaning through our website.',
    },
    {
      t: 'p',
      texto:
        'When you book, you tick a box confirming that you have read and accept these Terms and our Privacy Policy. **That tick is how the agreement is formed.** We record which version you accepted and when, and we will send you that exact version if you ask.',
    },
    {
      t: 'p',
      texto:
        "You must be at least 18 years old and legally able to enter into a contract. You must also be the owner of the property we are cleaning or have the owner's permission for us to be there and do the work.",
    },
    {
      t: 'h2',
      texto: '2. The price we quote you',
    },
    {
      t: 'p',
      texto:
        '**The price our calculator shows you is a quote, not an invoice.** It is calculated from what you tell us: the type of service, the frequency, the number of bedrooms and bathrooms, the square footage, the add-ons you choose, and how far your home is from our base.',
    },
    {
      t: 'ul',
      items: [
        'A quote is **valid for 7 days**. After that, prices may have changed.',
        '**Cleaning services are exempt from Georgia sales tax** (O.C.G.A. §§ 48-8-2(31) and 48-8-30(f)(1)), so the price you see is the price you pay. No tax is added.',
        'Some homes are too large, too far or too unusual for an automatic price. In those cases we tell you so and give you a quote by hand instead.',
        '**If what we find does not match what you told us** — considerably more square footage, a property that has not been cleaned in a very long time, construction dust, hoarding conditions — we will stop, tell you what it actually requires and what it would cost, and **wait for you to agree before doing any extra work**. We will not surprise you with a larger bill.',
      ],
    },
    {
      t: 'h2',
      texto: '3. The travel deposit',
    },
    {
      t: 'p',
      texto:
        'When you book, we place a **hold of $35.00** on your card. A hold is not a charge: the money is reserved by your bank but does not leave your account.',
    },
    {
      t: 'ul',
      items: [
        'It is **credited in full against your final invoice**. It is not an extra cost.',
        'If you cancel in time (section 5), it is **released**. Depending on your bank, it can take a few business days to disappear from your statement.',
        'A hold **expires on its own after 7 days at the latest**, which is the maximum the card networks allow. If it expires, the money returns to you without anyone doing anything.',
        '**We only ever charge it in one situation: you cancel after our team is already travelling to you.** At that point the drive is already paid for in fuel and wages.',
      ],
    },
    {
      t: 'p',
      texto:
        'Your booking is not confirmed until the hold is authorised. If your card is declined, the appointment slot is not reserved and we will tell you so.',
    },
    {
      t: 'h2',
      texto: '4. Paying the balance',
    },
    {
      t: 'p',
      texto:
        'The rest of the price — the total minus the deposit — is due on the day of the service. We charge the card you booked with, and the receipt is emailed to you.',
    },
    {
      t: 'p',
      texto:
        'Tips are **never required and never added automatically**. If you want to tip, it is entirely up to you.',
    },
    {
      t: 'h2',
      texto: '5. Changing or cancelling an appointment',
    },
    {
      t: 'tabla',
      cabecera: ['When you tell us', 'What happens'],
      filas: [
        [
          '**More than 24 hours before** the appointment',
          'We move or cancel it **at no cost**, and the deposit hold is released',
        ],
        [
          '**Less than 24 hours before**',
          'We charge the $35.00 deposit. The appointment is cancelled and nothing further is owed',
        ],
        [
          '**After our team has set out** for your home',
          'We charge the $35.00 deposit. Nothing more',
        ],
        [
          '**We cannot get in** when we arrive, and nobody answers',
          'Treated as a cancellation after the team set out: the $35.00 deposit is charged',
        ],
      ],
    },
    {
      t: 'p',
      texto:
        'To change or cancel, call {{phone}} or write to {{email}}. Please do not rely on a message sent in the last hour before the appointment; if the team has already left, we may not see it in time.',
    },
    {
      t: 'p',
      texto:
        '**If we have to cancel or move your appointment** — illness, a vehicle breakdown, severe weather, or anything that makes the drive unsafe — we will tell you as soon as we know, release the deposit hold, and offer you the earliest alternative slot. You are never charged for an appointment we could not keep.',
    },
    {
      t: 'h2',
      texto: '6. Getting into your home',
    },
    {
      t: 'p',
      texto:
        'You can be there or not; many of our customers are not. Whichever you choose, you are responsible for making sure we can get in.',
    },
    {
      t: 'ul',
      items: [
        'If you give us a door code, the location of a key, or alarm instructions, we treat them as confidential and only the team assigned to your job and our administration can see them.',
        '**Please disarm your alarm or give us the code.** We are not responsible for false-alarm fees caused by instructions that were wrong, out of date or missing.',
        'Our team will not force entry, climb through a window, or accept a key from a neighbour we have not been told about.',
        'If you set a point on the map marking your entrance, we use it to find the door. **We delete it 24 hours after the job ends.**',
      ],
    },
    {
      t: 'h2',
      texto: '7. Pets, children and other people at the property',
    },
    {
      t: 'ul',
      items: [
        '**Tell us about your pets when you book.** We are happy to work around them, but we need to know. Please secure any animal that may bite, escape or be frightened by a vacuum cleaner.',
        'If a situation at the property is unsafe for our team — an aggressive animal, a person behaving threateningly, a hazard they cannot work around — they will leave and call us. We will contact you, and the appointment is treated as a cancellation after the team set out.',
        'Our team does not supervise children or pets.',
      ],
    },
    {
      t: 'h2',
      texto: '8. What the cleaning includes',
    },
    {
      t: 'p',
      texto:
        'Our website publishes the task list our team actually carries, and a list of what we do **not** clean, which currently includes patios and porches, exterior windows and window tracks, dishes and the dishwasher, walls, the inside of refrigerators and cabinets that still have items in them, and small appliances such as mini ovens and air fryers. We state these up front rather than afterwards, and if you need something on that list we will point you to someone who does it.',
    },
    {
      t: 'p',
      texto: 'Add-ons are quoted and billed separately. They are not part of a regular cleaning.',
    },
    {
      t: 'p',
      texto:
        'We bring our own professional equipment and products. If you would rather we use yours, tell us when you book.',
    },
    {
      t: 'h2',
      texto: '9. Recurring service',
    },
    {
      t: 'p',
      texto:
        'Choosing a frequency — weekly, every two weeks, monthly — gives you a discounted rate for that frequency.',
    },
    {
      t: 'p',
      texto:
        '**We do not set up an automatic subscription and we do not charge your card on a recurring basis.** Every appointment is booked, quoted and charged one at a time, and you confirm each one. There is nothing to cancel other than an appointment you have already booked.',
    },
    {
      t: 'p',
      texto:
        '[RECURRING RATE RULE — see docs/40 §6: the owner must decide what happens to the discounted rate if a customer stops the recurring schedule after only one or two visits.]',
    },
    {
      t: 'h2',
      texto: '10. Our re-clean guarantee',
    },
    {
      t: 'p',
      texto:
        'If you are not happy with something, **tell us within 24 hours of the service and we come back and fix it at no charge**. That is the guarantee as it is published on our website and it is part of this agreement.',
    },
    {
      t: 'p',
      texto:
        'To make it work we need to hear from you quickly and we need to know what specifically was wrong. After 24 hours we will still want to hear from you, and we will do what we reasonably can, but the free re-clean is tied to that window.',
    },
    {
      t: 'h2',
      texto: '11. Damage, breakage and loss',
    },
    {
      t: 'p',
      texto:
        'We carry **general liability insurance**. If we damage something, we want to put it right.',
    },
    {
      t: 'ul',
      items: [
        '**Tell us within 24 hours of the service.** Damage reported later is very hard to attribute to a cleaning, and our insurer will say so.',
        'Put away anything **irreplaceable, highly valuable or sentimental** — jewellery, cash, collectibles, heirlooms, important documents — before we arrive. We ask our team not to move such items, but the safest place for them is away.',
        'Some things break because of how they already were, not because of cleaning: loose fixtures, failing grout, items already cracked or glued, blinds and curtain rods at the end of their life, surfaces with worn finishes. We are not responsible for pre-existing conditions, and we will tell you if we see one.',
        'We do not accept responsibility for damage caused by cleaning products you asked us to use.',
        '**We never claim to be bonded**, because we are not. Our website says "insured", and that is exactly what we are.',
      ],
    },
    {
      t: 'h2',
      texto: '12. Your part of the deal',
    },
    {
      t: 'p',
      texto: 'To get the cleaning you are paying for, please:',
    },
    {
      t: 'ul',
      items: [
        'Tell us the truth about the property — size, condition, pets, access.',
        'Pick up personal items and clutter from the surfaces you want cleaned. Our team cleans; they do not organise your belongings unless you booked that.',
        'Make sure there is running water and electricity.',
        'Tell us where to park if parking is difficult.',
        'Tell us in advance about anything on the property that needs special care or is dangerous.',
      ],
    },
    {
      t: 'p',
      texto:
        'We may decline or stop a job — and charge the $35.00 deposit if our team has already travelled — if the property turns out to present a health or safety hazard our team is not equipped for, such as sewage, mould, infestation, drug residue, biological waste, or conditions requiring protective equipment we do not carry.',
    },
    {
      t: 'h2',
      texto: '13. Photos and video of your home',
    },
    {
      t: 'p',
      texto:
        'We sometimes take before-and-after photos or short videos. **Booking is not permission to publish them.** We ask for that separately, in writing, in its own form, and we explain there what we may photograph and where we may publish it.',
    },
    {
      t: 'p',
      texto:
        'You can withdraw that permission at any time and we take the material down within **5 days**. Our Privacy Policy, section 7, explains the whole thing, including that we strip the GPS coordinates out of every image before storing it and that we never publish your name or address alongside the pictures.',
    },
    {
      t: 'h2',
      texto: '14. Our employees',
    },
    {
      t: 'p',
      texto:
        'Our cleaners are our employees. They pass a criminal background check and identity verification before their first job.',
    },
    {
      t: 'p',
      texto:
        '[NON-SOLICITATION — see docs/40 §6: the owner must decide whether to include a clause about hiring our staff directly. It is common in this industry and it is also the kind of clause a court looks at closely. Left out until the owner and an attorney decide.]',
    },
    {
      t: 'h2',
      texto: '15. Limits on what we are responsible for',
    },
    {
      t: 'p',
      texto: 'To the fullest extent Georgia law allows:',
    },
    {
      t: 'ul',
      items: [
        'Our total liability arising out of any one cleaning is limited to the amount you paid for that cleaning, **except** for property damage covered by our general liability insurance, which is handled through that policy and is not capped by this paragraph.',
        'We are not liable for indirect or consequential losses — time off work, a missed appointment of your own, loss of rental income — arising from a cleaning that was late, rescheduled or cancelled.',
        '**Nothing in these Terms limits our responsibility for gross negligence, willful misconduct, personal injury caused by us, or anything else that cannot be limited or excluded under Georgia law.**',
      ],
    },
    {
      t: 'p',
      texto:
        'Our website, the price calculator and the booking system are provided as they are. We work to keep them accurate and available, but we do not guarantee that they will be free of errors or always online. If a system error quotes you a price that is obviously wrong, we will tell you before any work begins and you are free to walk away.',
    },
    {
      t: 'h2',
      texto: '16. If something goes wrong between us',
    },
    {
      t: 'p',
      texto:
        '**Talk to us first.** Call {{phone}} or write to {{email}}. Almost everything is fixable in a phone call, and we would rather fix it than argue about it.',
    },
    {
      t: 'p',
      texto:
        'These Terms are governed by the laws of the State of Georgia, without regard to its conflict-of-laws rules. Any dispute that cannot be resolved between us will be brought in the state or federal courts located in {{county}}, Georgia, and we both agree to that venue.',
    },
    {
      t: 'p',
      texto:
        '[ARBITRATION — see docs/40 §6: no mandatory arbitration or class-action waiver is included in this draft, deliberately. The owner and an attorney should decide whether to add one.]',
    },
    {
      t: 'p',
      texto: 'Nothing here prevents either of us from bringing a claim in small claims court.',
    },
    {
      t: 'h2',
      texto: '17. Changes to these Terms',
    },
    {
      t: 'p',
      texto:
        'We may update these Terms. The current version is always on our website with its effective date and version number.',
    },
    {
      t: 'p',
      texto:
        '**A change never applies backwards to a booking you already made.** The Terms that govern your appointment are the ones you accepted when you booked it, and we keep a record of which version that was.',
    },
    {
      t: 'h2',
      texto: '18. The rest of the legal wiring',
    },
    {
      t: 'ul',
      items: [
        '**Entire agreement.** These Terms, our Privacy Policy, your photo permission if you gave one, and the booking confirmation we sent you are the whole agreement between us. Nothing anyone said informally changes them.',
        '**If one part fails.** If any provision turns out to be unenforceable, the rest stays in force and that provision is limited only as much as necessary.',
        '**No waiver.** If we do not enforce something once, that does not mean we have given it up.',
        '**Assignment.** You may not transfer this agreement to someone else without our agreement. We may transfer it if the business is sold, and these Terms go with it.',
        '**Independent business.** We are a cleaning company, not your employee or your agent. Our cleaners are our employees, not yours.',
      ],
    },
    {
      t: 'h2',
      texto: '19. Language',
    },
    {
      t: 'p',
      texto:
        'These Terms are published in English and Spanish. **The English version is the one that governs**; the Spanish version is provided for convenience, because many of our customers read Spanish and nobody should have to accept a contract they cannot read. If the two ever disagree, the English text controls.',
    },
    {
      t: 'h2',
      texto: '20. How to reach us',
    },
    {
      t: 'contacto',
    },
  ],
};
