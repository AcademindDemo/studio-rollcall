import { Schema } from "effect"
import { BookingId } from "./Booking.ts"
import { ClassId } from "./ClassSession.ts"
import { MemberId } from "./Member.ts"

export class ClassNotFound extends Schema.TaggedError<ClassNotFound>()(
  "ClassNotFound",
  { classId: ClassId },
  { httpApiStatus: 404 }
) {}

export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()(
  "MemberNotFound",
  { memberId: MemberId },
  { httpApiStatus: 404 }
) {}

export class ClassFull extends Schema.TaggedError<ClassFull>()(
  "ClassFull",
  { classId: ClassId },
  { httpApiStatus: 409 }
) {}

export class AlreadyBooked extends Schema.TaggedError<AlreadyBooked>()(
  "AlreadyBooked",
  { classId: ClassId, memberId: MemberId },
  { httpApiStatus: 409 }
) {}

// The member has no pack credit or membership that covers the class.
export class NoCredit extends Schema.TaggedError<NoCredit>()(
  "NoCredit",
  { memberId: MemberId, classId: ClassId },
  { httpApiStatus: 402 }
) {}

export class BookingNotFound extends Schema.TaggedError<BookingNotFound>()(
  "BookingNotFound",
  { bookingId: BookingId },
  { httpApiStatus: 404 }
) {}

export class NotYourBooking extends Schema.TaggedError<NotYourBooking>()(
  "NotYourBooking",
  { bookingId: BookingId, memberId: MemberId },
  { httpApiStatus: 403 }
) {}

// Cancelling or checking in a booking that is already cancelled.
export class BookingNotActive extends Schema.TaggedError<BookingNotActive>()(
  "BookingNotActive",
  { bookingId: BookingId },
  { httpApiStatus: 409 }
) {}

export class ClassStarted extends Schema.TaggedError<ClassStarted>()(
  "ClassStarted",
  { classId: ClassId },
  { httpApiStatus: 409 }
) {}

// Waitlist promotion stops 2 hours before class (decisions/0002). Only promotion sees it.
export class PromotionClosed extends Schema.TaggedError<PromotionClosed>()(
  "PromotionClosed",
  { classId: ClassId },
  { httpApiStatus: 409 }
) {}

export class AlreadyCheckedIn extends Schema.TaggedError<AlreadyCheckedIn>()(
  "AlreadyCheckedIn",
  { bookingId: BookingId },
  { httpApiStatus: 409 }
) {}

export class AlreadyWaitlisted extends Schema.TaggedError<AlreadyWaitlisted>()(
  "AlreadyWaitlisted",
  { classId: ClassId, memberId: MemberId },
  { httpApiStatus: 409 }
) {}

export class ClassNotFull extends Schema.TaggedError<ClassNotFull>()(
  "ClassNotFull",
  { classId: ClassId },
  { httpApiStatus: 409 }
) {}

export class NotOnWaitlist extends Schema.TaggedError<NotOnWaitlist>()(
  "NotOnWaitlist",
  { classId: ClassId, memberId: MemberId },
  { httpApiStatus: 404 }
) {}

export class PaymentDeclined extends Schema.TaggedError<PaymentDeclined>()(
  "PaymentDeclined",
  { reason: Schema.String },
  { httpApiStatus: 402 }
) {}

export class ProductNotFound extends Schema.TaggedError<ProductNotFound>()(
  "ProductNotFound",
  { productId: Schema.String },
  { httpApiStatus: 404 }
) {}

// A weekly class that decodes but can't be scheduled, e.g. a room the studio doesn't have.
export class InvalidWeeklyClass extends Schema.TaggedError<InvalidWeeklyClass>()(
  "InvalidWeeklyClass",
  { reason: Schema.String },
  { httpApiStatus: 400 }
) {}

// Buying a monthly membership while one is active.
export class AlreadyMember extends Schema.TaggedError<AlreadyMember>()(
  "AlreadyMember",
  { memberId: MemberId },
  { httpApiStatus: 409 }
) {}
