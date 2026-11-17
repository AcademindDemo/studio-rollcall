# Payment timing and waitlist promotion

Research for the two open questions in VISION.md. No recommendation. Sources are vendor help centers and product pages, October 2026. Marketing-only or fuzzy claims are marked unverified.

Already fixed around these choices: packs of 5 or 10 and a monthly membership, a two-hour cancel cutoff, a waitlist, emails for a confirmed booking, a waitlist spot, and a day-before reminder, and check-in at the door. One to three rooms, a few hundred members, today a spreadsheet, a group chat, and a card reader.

## 1. When the money moves

**Credit or payment before the spot is confirmed.** The pack or membership is the payment. Booking checks an active membership or spends one credit. No credit means no spot. The door is check-in.

**Name on the roster, pay at the door.** The reader takes the money on arrival. A pack is a balance the desk settles at check-in.

Hybrids that ship:

- Card on file, charged before class. Arketa's October 2024 blog describes a resolver that, 24 hours out, charges the card or cancels. Momence has unpaid-booking auto-settlement and a desk Pay Later button for a class-only sale; when that job runs is unverified. Mindbody can allow unpaid online signups and still store a card for a late-cancel fee.
- Glofox Pay Later: the client books, staff see a charge flag for arrival, and the option can be limited to staff.
- Mindbody checks for a credit when someone joins the waitlist and spends it only on promotion, so one credit can sit behind several rows.
- Momence packs spend the credit when the class is booked, including weeks ahead. A limited subscription spends from the billing period the class falls in.

**Fit with the vision.** "Credits left" and "membership runs out soon" are gates if a booking spends a credit and a cancel before two hours returns it. Pay-at-the-door makes that cutoff a courtesy, unless a stored card also funds a fee. The waitlist email says the spot was given, which matches a member who can pay. Mindbody skips a waitlisted client with no valid pricing option and texts them, unless staff turn the check off and reconcile by hand. Check-in is a toggle when the class is prepaid and a doorway sale when it is not. Pay-at-the-door needs one of the three emails to say money is due at the desk. A pack sale needs its own receipt.

**What the apps do.** Confidence is high except where noted. Mindbody requires payment to book online unless unpaid signups are on (everyone, members, or autopay clients), and deducts the waitlist credit at promotion. Momence packs and subscriptions are prepaid; pack credits leave at booking. Arketa, medium: checkout pre-selects an active pack or subscription, via Stripe; the 24-hour resolver is a blog. Walla books on a plan, a credit bundle, or a paid drop-in, refunds a waitlist drop-in that never gets in about 15 minutes after the start (cards back to the card), and blocks new bookings after a failed membership payment while leaving existing ones. A pay-at-the-studio hold was not found. bsport, medium: promotion checks the pass. New-visitor one-click booking takes payment details, needs a welcome pass, and cannot join a waitlist. TeamUp holds a spot for 10 minutes once a membership is in the cart, and auto-promotion needs credits or a free event. Vagaro, medium: the class waitlist goes Book, then Checkout. Deposits and a card on file appear in its video. A staff reply says a visit cap alone does not stop over-booking; a deposit does, and consumes a visit.

**Risks for this studio.** Prepaid credits stop the no-show who would not have paid, and the mat can still be empty. Pay-at-the-door matches the reader and gives up the prepay a pack is for. One room turning over cannot run a card for every name. Walk-ins are easy at the reader and clumsy if the software refuses them. Edge cases: one credit behind two waitlists, a membership that ends between booking and class, and a late cancel that keeps the credit. Pay-at-the-door is the smaller build and the heavier day, because credits are then a warning. A card-on-file charge adds failed payments and a job that drops the booking. The vision does not mention online cards.

## 2. The next person is booked, or asked

**Automatic.** The first person waiting is booked and emailed. Their cancel uses the two-hour rule.

**Offer, then wait.** They are emailed. The spot stays open until they accept, decline, or a timer ends, then the next person is asked. A broadcast gives the spot to the first yes and fills faster. The vision gives it to the first person waiting, so a broadcast is a third option.

Hybrids the apps ship:

- Mindbody's default auto-adds only outside the cancel window. Inside it, the studio can leave the spot, keep auto-adding, or text everyone and take the first reply.
- Momence double opt-in texts the first person, waits 10 minutes by default, then moves on. Silence from the list ends the round until the next cancellation.
- TeamUp auto-adds more than one day out, for people who already have credits, and holds a 30-minute claim inside that. Both timers are settings.
- Glofox stops auto-assign at a chosen time, default 30 minutes, maximum 10 hours. Walla stops at its lock, and staff can still add someone. Momence has a per-class cutoff of the same kind.

An automatic booking inside two hours cannot be dropped for free. An email offer on a cancellation three hours out can fall inside the cutoff before anyone has answered.

**What the apps do.** Confidence is high except where noted. Mindbody books the first client with a valid pricing option and emails them; no yes is required, a text can drop them off, and a lock stops adds. Older help text also shows a staff "waitlist confirmed" checkbox. Momence's broadcast hides queue position, and no phone number falls back to email. Glofox auto-book needs Pay Later on; staff can also move someone by hand. Email and push. Arketa, low-to-medium: marketing says class waitlists refill themselves, while the documented appointment waitlist emails a booking link. A class yes/no step is unverified. Walla charges a late fee if someone added inside the penalty window then cancels, waiveable for 24 hours, refunds a waitlist exit, allows overlapping waitlists, and has no offer-and-wait mode in the docs. bsport, medium: the next eligible member is booked after a pass check. A confirmation-request setting is discussed as advice and is unverified on Smart Waitlist. TeamUp's push says added or must claim, and claiming can mean buying a membership. Vagaro, medium: the class article is notify, then the customer books and checks out. A line about leaving "so you aren't automatically registered" hints at an auto path; unverified. Its appointment waitlist is separate: staff picks, highest price, first in line, or everyone at once, all notify-and-accept.

**Risks for this studio.** Automatic promotion is the smallest build and matches the spot email. It no-shows people who miss the message, and it is harsh inside two hours. An offer cuts those surprises and leaves more empty mats on email alone: a 10-minute timer mostly expires. The group chat reaches whoever is on their phone, so an email offer is slower and an automatic booking is blunter. Auto-add is reliable when the cancel is the day before, in time for the reminder. Chasing a yes by hand is the spreadsheet again. Still needs rules for one credit on two waitlists, two classes at once, a promotion after the reminder, and someone at the desk who is not first. Glofox can block the overlap. Walla allows it.

## Facts to decide on, and questions for the owner

- Whether packs are already how people pay, or the reader charges each class. If packs are real today, booking already spends something and the door is check-in.
- Whether empty spots are people who never paid, or people who paid and did not come.
- How close to class the chat usually hears of a cancellation. The day before favors auto-add. Inside three hours, auto-add meets the two-hour rule, and an email offer will not clear in time.
- Whether a text is acceptable. The vision lists three emails. The fast offer-and-wait designs found here use SMS.
- Whether one member may sit on several waitlists, on a single credit.
- Whether the reader remains the way a pack is sold.

1. When a spot opens in the chat today, who is offered it, and how long do they take to answer?
2. If a waitlisted member never sees the email, should their name be on the roster?
3. Should a cancel inside two hours, or a no-show, cost a pack credit?
4. Are walk-ups who pay on the reader a normal part of class, or a rare case the desk types in?
5. May staff put someone on a roster with no credit, or should the software refuse?
