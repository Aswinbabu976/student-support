-- Help Seeker confirmation (Sprint 2 Member 5).
-- Booking.completedAt is the Help Seeker sign-off timestamp.
-- Payment.CAPTURED / capturedAt is delayed capture of an existing authorization.
-- Student payout remains a separate later ledger event.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "completedAt" DATETIME;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "capturedAt" DATETIME;
