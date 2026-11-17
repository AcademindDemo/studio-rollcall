# Open questions: joined research

Sources: `codex.md`, `grok.md`, `codex-critique.md` (Codex on Grok) and `grok-critique.md` (Grok on Codex). This file only joins them. It does not decide either question, and I did not check the vendor claims myself. Where the two disagree, the reasons below come from their own files.

## 1. Pay before booking, or book first and pay at the door?

### Where they agree

- **The options are the same.** (a) A pack credit or an active membership is needed to confirm a booking, and check-in is just a tick. (b) The member books now and pays at the desk. (c) Hybrids: a card on file charged before class, a Pay Later option limited to staff, a temporary hold that expires unless paid, a deposit or card guarantee.
- **"Pay before" doesn't mean a card payment per booking.** Under a prepaid model, the pack or membership is the payment and a booking draws on it.
- **The 2-hour cutoff only has teeth under prepayment** (or a stored card). If members pay at the door, an unpaid no-show or late cancel costs them nothing, and the studio has no way to collect.
- **Prepaying doesn't make people turn up.** It removes the no-show who never meant to pay, but a paid mat can still be empty.
- **Door payment fits today's card reader and puts more work on the desk** in the minutes before class.
- **Shared edge cases:** one credit sitting behind several waitlists, a membership that expires between booking and class, a late cancel that keeps or loses the credit, failed renewals.
- **What the vendors show:** most documented setups book against a pack or membership. Pay-later exists (Glofox Pay Later, Momence POS Pay Later, Mindbody unpaid signups), usually as a setting or a staff-side option. Neither file claims to know what share of studios use which.

### Where they disagree, and why

| Point | Codex | Grok | Why they differ |
|---|---|---|---|
| Which is the smaller build | Not established. Door payment still needs entitlement checks, attendance/payment/entitlement as separate states, and protection against double deductions. Prepay needs payment-failure handling. | Pay at the door is "the smaller build and the heavier day," because credits become only a warning. | Codex counts reconciliation as part of the door model. Grok counts mainly the gating logic. Codex's critique calls Grok's claim unsupported. |
| What "pay at the door" means | Has to be clarified: buying a pack or month at the desk is different from paying for one class. VISION.md lists no single-class drop-in product. | Treats it mainly as the reader charging each class, and says door payment "gives up the prepay a pack is for." | Codex reads VISION.md's product list strictly. Grok reasons from today's desk habits. Codex says Grok mixes the two cases together. |
| Monthly members | An unlimited monthly member has no per-class payment to lose, so prepaying doesn't deter their no-shows. | Treats membership mostly alongside "credits left" as a gate. | Grok's critique concedes this point to Codex. |
| Desk capacity | "One room turning over cannot run a card for every name" needs evidence on arrival volume, because many arrivals already hold packs. | States it as a risk. | Neither has data from the studio. |
| Mindbody unpaid online booking | Notes a channel limit: Mindbody's own web app doesn't allow unpaid online signups. | Says unpaid signups can be turned on (for everyone, members, or autopay clients). | Both may be right for different channels. Codex says Grok's wording is too broad. |

## 2. Automatic promotion, or offer and wait for a yes?

### Where they agree

- **Three shapes, not two:** automatic promotion in queue order, an exclusive timed offer that moves down the queue, and a broadcast where the first to claim wins. The broadcast breaks VISION.md's "first person waiting gets the spot," so choosing it would mean changing the vision, not just picking an option.
- **Automatic promotion** is the simpler build, fills spots, and matches the "the waitlist gave you a spot" email. Its risk is booking someone who never saw the email.
- **An offer** respects plans that have changed. Its risks are empty mats while the spot moves down the queue, and more machinery: holding capacity, an expiry job, secure accept links, a race between accept and expiry, and offers shown separately on the roster.
- **The 2-hour cutoff is the crux.** A promotion close to class (Codex's example is an 18:00 class promoted at 16:30) creates a booking the member can no longer cancel. An offer made 3 hours out can run past the cutoff before anyone answers.
- **The common vendor hybrid is time-based:** auto-promote far from class, then switch to an offer, a broadcast, or staff-only inside a cutoff (Mindbody's window split, TeamUp's 1-day / 30-minute defaults, Glofox's auto-assign stop, Momence's per-class cutoff).
- **The day-before reminder misses late promotions**, so the promotion or offer email has to carry the class details itself.
- **Email-only offers are slow.** The fast offer flows found (Momence double opt-in, Mindbody First to Claim) use SMS, which VISION.md doesn't include.

### Where they disagree, and why

| Point | Codex | Grok | Why they differ |
|---|---|---|---|
| A late promotion "cannot be dropped for free" | VISION.md sets no late fee and no credit forfeiture, so that has to be a human-defined rule. | Says an automatic booking inside two hours can't be dropped for free. | Both critiques say Grok assumed a penalty that doesn't exist yet. Grok's own owner question 3 treats the penalty as open. |
| How fast email offers fail | Delay is a risk, but response rates are unknown. | "A 10-minute timer mostly expires." An email offer within 3 hours "will not clear in time." | Codex says these are predictions without measurements. Grok draws on vendor defaults and the speed of today's group chat. |
| Weight given to the studio's real setup | Treats delay as a generic link-expiry and overnight problem. | Today the group chat clears cancellations, so email delay is an operational change. Quiet hours (Momence uptime, TeamUp nightly blackout) matter. | Grok's critique says Codex underweights the chat, desk and reader. Codex's critique gives Grok credit for this. |
| Idle-seat risk after a silent round | Missed it. | Momence's double opt-in stops if everyone stays silent and waits for the next cancellation. | Codex's critique concedes this. |
| States and races | Clearly separates reserving from consuming a credit, held capacity, walk-ins against an open offer, duplicate payments, studio cancellations, and concurrent offers. | "The spot stays open" leaves it unclear whether a walk-in can take it. | Grok's critique concedes Codex is stronger here. |
| Member opt-in to auto-promotion | Lists it as a hybrid. | Not mentioned. | Grok's critique calls it "a real third setting." |

## Disputed vendor facts

Each critique challenges the other's sourcing. Where one side conceded, the table says so.

| Vendor | Dispute | Status after critiques |
|---|---|---|
| Mindbody | Codex marked a sequential/late-window flow unverified. Grok cites the window split (off / Continue Auto-add / First to Claim via two-way SMS) and that a credit is checked on join but deducted on promotion. | Codex concedes Grok's description, with package and SMS conditions. |
| Glofox | Codex cites an API flow page that now redirects. Grok cites a July 2026 help article: auto-book requires Pay Later, plus a cutoff (default 30 min, max 10 h) and a broadcast mode. | Codex admits its source is dead. It still says Grok hasn't shown that credit-based promotion needs Pay Later. Unresolved. |
| Arketa | Grok rated class auto-promotion low-to-medium from an appointment-style link. Codex cites a January 2026 class doc: auto-waitlisting needs a package or subscription, otherwise members are notified and claim the spot themselves. | Grok concedes Codex is stronger. |
| Walla | Codex marked waitlist rules unverified. Grok cites auto-add outside the close window, a lock, a refund 15 min after start, overlapping waitlists, and a late fee waivable for 24 h. | Codex says Grok's details lack citations it can inspect, and keeps them unverified. Unresolved. |
| Vagaro | Codex took first-in-line / first-to-book / revenue-based selection from a marketing page. Grok says those are appointment modes, and that classes notify the member, who then books and checks out. | Uncontested by Codex. Vagaro class evidence is weak on both sides. |
| bsport | Codex called promotion "staff-controlled," based on a bulk staff tool. Grok cites feature copy: the next eligible member is booked after a pass check. | Grok calls its own line marketing-strength. Neither found a settings page. |
| Momence | Both agree: three modes, 10-minute default for double opt-in, email fallback, POS Pay Later. | Agreed. Grok's silent-round detail is accepted. |

Both files agree on a meta-point: a documented feature isn't an adoption rate. Neither source says what most small studios actually choose.

## Facts the owner would need to supply

Both files ask for these, in their own words:

- **How people pay today:** packs, monthly, or per class on the reader. Is monthly unlimited? Are walk-ups who pay on the reader normal or rare?
- **Who the empty spots are:** people who never paid, or people who paid and didn't come.
- **How a freed spot gets filled today:** how close to class people cancel in the chat, who gets offered the spot, and how fast they answer.
- **Whether SMS is acceptable,** or whether it stays email only as in VISION.md.
- **Policy gaps VISION.md leaves open:** a cost for a late cancel or no-show, promotion inside the 2-hour window, one credit on several waitlists, overlapping classes, staff adding someone with no credit, and walk-ins while an offer is pending.
- **When a credit is reserved, consumed and restored,** and whether a membership has to be valid on the class date.
