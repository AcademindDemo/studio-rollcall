# 0002: Waitlist promotes automatically until 2 hours before class

Status: decided, 2026-10-28
Answers the VISION.md open question "Does the waitlist promote the next member automatically, or offer the spot and wait for a yes?"
Depends on [0001](0001-pay-before-booking.md).

## Decision

- When a spot opens, the first eligible member on the waitlist is booked automatically and emailed.
- Automatic promotion stops 2 hours before class. After that, a freed spot stays open for walk-ins.
- A member can be on several waitlists at once. No credit is taken when they join; one is used only when they are promoted.
- A member who can't book at promotion time (no pack credit left and no active monthly membership) is skipped, and the next member gets the spot.
- Email only, no SMS.

## Options considered

1. **Automatic promotion in queue order.** **Chosen**, with a 2-hour stop.
2. **Exclusive timed offer:** hold the spot, email the next member, and move on if they decline or the offer expires.
3. **Broadcast:** the first to claim wins. This breaks VISION.md's "first person waiting gets the spot".
4. **Hybrids:** auto-promote far from class and offer or broadcast near it; members opt in to auto-promotion; staff only near class.

## Why

- It is the simplest build: no held capacity, no expiry job, no accept links, no race between accept and expiry. It also matches the "the waitlist gave you a spot" email already in VISION.md.
- With email only, an offer-and-wait flow risks empty mats while the spot moves down the queue. The fast offer flows the research found all used SMS.
- The stop at 2 hours limits the main risk of auto-promotion, booking someone who never sees the email close to class. Many apps ship a time-based cutoff like this (Mindbody, TeamUp, Glofox, Momence, Walla).
- Taking the credit only at promotion lets one credit sit behind several waitlists, the way Mindbody does it. Skipping members who can't book means a promotion never creates an unpaid booking.

Intended: a member promoted between 12 and 2 hours before class is already past the free-cancel cutoff from 0001, so the credit is spent if they can't come. Confirmed as the rule on 2026-10-28.

## Research

- [Joined research](../research/joined.md), question 2
- [Codex](../research/codex.md), [Grok](../research/grok.md), [Codex critique](../research/codex-critique.md), [Grok critique](../research/grok-critique.md)
