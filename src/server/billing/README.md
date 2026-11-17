# Fake billing

This module moves no real money and makes no network calls. `PaymentProvider.ts`
exports `layerFake`: the exact card token `decline` returns `PaymentDeclined`;
every other nonempty token succeeds and receives a process-local fake reference.
Only opaque fake card tokens are accepted, never real card details.

`StateLive` is shared by billing and entitlements within one app. Purchase writes
update packs/memberships and the purchase ledger in one Ref update under
`StudioLock`. Charges run outside that lock. Monthly eligibility is checked
before charging and rechecked at commit. Billing payment operations share a
separate semaphore, so a concurrent monthly request observes `AlreadyMember`
before charging, and a renewal cannot race with a replacement membership.
Booking operations remain free to acquire `StudioLock` during a payment.

Renewal passes serialize with each other, charge outside `StudioLock`, and
recheck the membership period under the studio lock before committing. A pass
extends each due membership by one 30-day period; later passes catch up missed
periods. A new monthly purchase supersedes expired memberships' renewal.
The layer starts a scoped minute schedule; tests call `renewDue` directly.

`AppLive` supports a supplied PaymentProvider, defaulting to a fresh in-process
fake when omitted for compatibility with independently assembled booking test
servers. The handler group supplies the same memoized billing layer so those
servers can build the shared API without adding billing wiring. The renewal-decline test supplies a provider that accepts the initial
purchase then declines the stored token. The ordinary fake always declines
`decline`, so it cannot create that scenario from a successful initial purchase.
