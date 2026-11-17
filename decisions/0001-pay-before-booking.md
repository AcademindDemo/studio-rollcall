# 0001: Pay before booking

Status: decided, 2026-10-28
Answers the VISION.md open question "Pay before booking, or book first and pay at the door?"

## Decision

- Members buy a class pack (5 or 10) or a monthly membership before they can book.
- A booking on a pack uses one credit. A monthly membership is unlimited and uses no credits.
- If a member cancels 12 hours or more before class, the credit comes back. If they cancel later, or don't come, the credit is used.
- The app has no pay-at-the-door option. Staff handle walk-ins as they do today, outside the app.

This changes VISION.md: the cancel cutoff moves from 2 hours to 12 hours.

## Options considered

1. **Pay first:** a pack credit or an active membership is needed to confirm the booking, and check-in is just a tick. **Chosen.**
2. **Book first, pay at the door:** the member reserves a spot and pays or redeems at the desk on arrival.
3. **Hybrids:** a card on file charged before class, Pay Later limited to staff, a temporary hold that expires unless paid, a deposit or card guarantee.

## Why

- With prepayment, the cancel cutoff costs something: a late cancel or no-show uses the credit. Under pay at the door, the studio would have had no way to collect.
- One rule for entitlement keeps the states simple. The roster doesn't have to track attendance, money owed and credit used separately.
- It is the setup most of the documented booking apps use by default (Momence, Glofox, TeamUp, Arketa).
- Leaving walk-ins to staff keeps today's card reader flow without adding a payment state to the app.

Accepted trade-off: prepaying doesn't make people turn up, and an unlimited monthly member loses nothing by not showing.

## Research

- [Joined research](../research/joined.md), question 1
- [Codex](../research/codex.md), [Grok](../research/grok.md), [Codex critique](../research/codex-critique.md), [Grok critique](../research/grok-critique.md)
