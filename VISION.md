# Studio Rollcall

Booking and memberships for small fitness and dance studios: one to three rooms, a handful of instructors, a few hundred members. Today they run on a spreadsheet, a group chat and a card reader at the desk.

## Members

- See the week's classes: time, room, instructor, spots left.
- Pay for a class pack (5 or 10 classes) or a monthly membership before booking. A booking uses one pack credit; a monthly membership is unlimited.
- Book a spot. Cancel 12 hours or more before class and the credit comes back; later, it is used.
- When a class is full, join its waitlist (several at once is fine). When a spot opens, the first person waiting who can book is booked automatically and emailed; their credit is used then. Anyone without a credit or membership is skipped. Promotion stops 2 hours before class; after that the spot stays open for walk-ins.
- Get an email (email only, no SMS) when a booking is confirmed, when the waitlist gives them a spot, and a reminder the day before.

## Staff

- Handle walk-ins at the desk as today; the app takes no payment at the door.
- Set up classes: weekly times, room, instructor, capacity.
- See each class's roster and waitlist, and check members in at the door.
- See who has credits left and whose membership runs out soon.

## Not now

- Mobile apps, more than one studio per account, payroll, marketing tools.

## Decided

- Pay before booking: [decisions/0001](decisions/0001-pay-before-booking.md).
- Waitlist promotes automatically until 2 hours before class: [decisions/0002](decisions/0002-waitlist-auto-promotion.md).

## Stack

TypeScript with Effect. The team knows it; agents get strong guardrails from it.
