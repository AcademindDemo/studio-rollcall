# Studio Rollcall: payment and waitlist research

Researched 28 October 2026 against VISION.md and public vendor documentation. Neither open question is decided here. Vendor features demonstrate available approaches, not how frequently studios select them. **High confidence** means explicit vendor documentation; **medium** means broader or incomplete vendor evidence. Unverified details are identified below. Risk assessments are analysis for this studio, not measured outcomes.

## 1. Pay before booking, or book first and pay at the door?

### Options and fit with the vision

**Require paid entitlement before confirming.** A member buys a 5/10-class pack or monthly membership, then books against it. This need not mean a card transaction for every reservation: packs supply credits; memberships supply access. Reserving a credit at booking prevents the same last credit funding several future classes. Cancellation before the two-hour cutoff could restore that credit; cash refunds are a separate policy. Membership validity needs a defined reference date, particularly when booking next week across an expiry or renewal.

This gives staff a mostly settled roster and makes check-in quick. It requires payment failure handling and consistent credit restoration. A waitlistee may spend their last credit elsewhere while waiting, so eligibility must either be reserved on joining or checked again on promotion. Confirmation and reminder emails should distinguish booking confirmation from payment receipts.

**Confirm first; collect at arrival.** Reserve capacity immediately, then redeem an existing pack/membership or sell the needed product at the desk. This matches the current card reader workflow and helps members uncomfortable paying online. However, a person can occupy a scarce place without paying or attending. The roster must distinguish attendance, payment owed, and entitlement used; a check-in tick alone cannot mean all three. Emails should clearly state what remains due.

The vision names packs and memberships, not standalone drop-in sales. “Pay at the door” therefore needs clarification: buying a pack/month there is different from paying for just that class. Charging no-shows later would require an agreed debt or card-on-file policy; the two-hour cutoff alone supplies no collection mechanism.

**Hybrids worth considering:** prepaid entitlement for ordinary bookings with staff-authorized unpaid exceptions; a temporary reservation that expires unless paid; or a deposit/card guarantee with settlement at attendance. Packs could also be purchased at the desk before later bookings. These accommodate existing habits, but each extra payment state increases reconciliation and support work. Deposits, automated penalties and card guarantees are possibilities to discuss, not requirements already in VISION.md.

### Small-studio risks

Prepayment improves cash timing and can put a credit at stake for no-shows, but does not guarantee attendance. An unlimited monthly member has no additional per-class payment to lose. Door payment reduces checkout friction but moves work into the busiest few minutes, especially if one instructor handles arrivals across rooms. Unpaid no-shows mean both missing revenue and blocked capacity; chasing debts can consume more time than a class is worth.

Both models need decisions about timely cancellations, studio cancellations, duplicate payments, expired packs, failed membership renewals, and staff corrections. Online payment introduces asynchronous failures: payment succeeding after the final seat disappears must not produce an unexplained charge. Door settlement needs protection against duplicate credit deductions and forgotten card-reader entries. Relative complexity is lowest with one entitlement rule; supporting multiple settlement paths adds states and exceptions.

## 2. Automatically promote, or offer and wait for yes?

### Options and fit with the vision

**Automatic promotion in queue order.** Joining expresses commitment to attend if promoted. On cancellation, the next eligible member receives a confirmed booking and the specified email. This fills reservations quickly and avoids staff chasing replies. It can also create no-shows when plans change or email is missed, especially overnight or close to class. For prepaid members, promotion must coordinate capacity and credit use; unpaid promotion creates a new collection obligation.

**Exclusive timed offer in queue order.** Hold the opening for the first member, email an acceptance link and deadline, then advance on refusal or expiry. Only acceptance creates the booking and consumes entitlement. This respects changed plans, but a slow email response can leave the room empty while a place cycles through the queue. Offer length must fit travel time and time remaining before class. It adds held-capacity accounting, expiry processing, secure acceptance, stale-link handling and races between expiry and acceptance. Staff need to see offers separately from confirmed attendees.

**Hybrids:** auto-promote well before class, switch to offers near the start; let members explicitly opt into automatic promotion; or stop automation and let staff handle arrivals. A broadcast inviting everyone to claim a place can fill it quickly, but rewards whoever reads first and conflicts with VISION.md's promise that the first person waiting gets the spot. It would require a human-approved change to that promise.

**The two-hour interaction is decisive.** For an 18:00 class, automatic promotion at 16:30 creates a booking after cancellation has closed. A human must define whether such promotions stop, require acceptance, or allow a grace period. VISION.md does not establish late-cancel fees or credit forfeiture. If late cancellation is prohibited entirely, staff removals, no-shows and capacity changes still need an explicit policy; do not assume a normal cancellation feed exists inside that window.

The day-before reminder cannot notify someone promoted that afternoon. Immediate promotion or offer email must carry the class details and any obligation. Email-only communication makes very short offers risky; adding SMS or mobile apps is not an assumed solution. At the door, staff need a definitive roster and clear authority over expired offers, walk-ins and absent booked members, while respecting room capacity. Overlapping bookings across rooms and simultaneous openings complicate eligibility under either model.

## What established apps support

These are capabilities verified to the extent stated, not universal defaults or adoption statistics. Payment and waitlist policies often depend on configuration and booking channel.

| App | Payment evidence | Waitlist evidence and confidence |
| --- | --- | --- |
| **Mindbody** | **High:** paid pricing options and configurable unpaid class reservations; its marketplace web channel has additional restrictions. [Channel documentation](https://support.mindbodyonline.com/s/article/MINDBODY-consumer-website?language=en_US). | **High:** automatic roster movement can depend on valid pricing or permission to book unpaid; staff can add manually. A sequential acceptance workflow was **unverified** here. [Class waitlists](https://mindbody.my.site.com/customerservice/s/article/203253503-Waitlists?language=en_US). |
| **Momence** | **High:** staff POS supports Pay Later for classes and later collection, including configurable automatic settlement. Universal member self-service pay-later availability is **unverified**. [Payment FAQs](https://help.momence.com/en/articles/12028713-selling-stuff-taking-payments-faq-s). | **High:** classes support automatic queue promotion, sequential text offers with configurable timeout, and broadcast competition. Default sequential timeout is documented as ten minutes. [Class waitlist FAQs](https://help.momence.com/en/articles/12028307-waitlist-faqs-classes). |
| **Glofox** | **High:** booking redeems membership/credits or collects a class fee; payment settings also support staff-only cash/pay-later options. [Payment settings](https://support.glofox.com/hc/en-us/articles/46479895224852-Adjusting-Your-Business-Settings). | **High:** developer documentation describes automatic promotion of the first waiter, automatic payment with credits/card, and staff intervention otherwise. Sequential offer timing is **unverified**. [Booking flow](https://apidocs-plat.aws.glofox.com/flows/book/). |
| **Arketa** | **High:** documented automatic waitlisting requires package/subscription configuration; ordinary paid drop-in configuration is excluded. [Payment restrictions](https://help.sutrapro.com/en/articles/13379888-automatic-waitlisting-for-drop-in-classes). | **High:** automatic promotion or email notification followed by manual claiming; the latter is not an exclusive sequential offer. [Overview](https://help.arketa.com/schedule/waitlist/overview). |
| **TeamUp** | **High:** auto-registration requires applicable membership and credits; offline pending membership payments are supported. [Payment settings](https://support.goteamup.com/en/articles/9327705-customer-settings). | **High:** configurable automatic-registration cutoff, then reserved offers that expire to the next waiter. Documented defaults: one day and thirty minutes. [Waitlist settings](https://support.goteamup.com/en/articles/10471958-waitlist-overview). |
| **bsport** | **High:** back-office bookings require a pass and can show an outstanding balance. This does not verify member self-service unpaid booking. [Booking guide](https://intercom.help/bsport-helpcenter/en/articles/16098044-book-a-client-into-a-class). | **High** for staff-controlled promotion with pass checks; automatic-versus-offer configuration **unverified** in the vendor sources examined. [Waitlist management](https://intercom.help/bsport-helpcenter/en/articles/8523226-bulk-selection-of-members-in-the-waiting-list). |
| **Walla** | **High:** checkout supports drop-ins and plan purchases; ACH purchases can be usable while payment processes. General pay-at-door booking policy **unverified**. [Payment guide](https://support.hellowalla.com/ach-payments-client-guide). | **High** for staff permission to add waitlisted clients; automatic-versus-offer rules **unverified**. [Staff permissions](https://support.hellowalla.com/staff-permissions-walla-support-center). |
| **Vagaro** | **Medium:** vendor booking page advertises prepayment, deposits and card guarantees; exact group-class settlement rules **unverified**. | **Medium:** same page advertises first-in-line, first-to-book and revenue-based selection. Exact class-specific acceptance deadlines **unverified**. [Booking features](https://www.vagaro.com/pro/online-booking). |

## Facts and owner questions needed for a decision

- How many classes fill, how often do members cancel or miss them, and how many openings actually get refilled? Gather counts and cancellation lead times from the spreadsheet/chat.
- What share of customers use packs, monthly access or door payments? Is monthly access unlimited? Does “door payment” mean purchasing a pack/month or a single class?
- How much unpaid revenue and arrival-time administration exist today? Who handles payment when several rooms start together?
- Do members reliably read email, and how much travel notice do they need? Would they consent to automatic booking and credit use?
- What should happen after the two-hour cutoff, on no-show, or when promotion finds no valid credit/membership? Who may grant exceptions?
- When are credits reserved, consumed and restored, and must membership be valid on the class date? Should an unanswered offer block a walk-in waiting at the desk?
