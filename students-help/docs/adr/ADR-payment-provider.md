# Payment Provider Decision

## Context

Students-Help is a European student marketplace. A Help Seeker funds a booking; a Student is paid only after the task is completed and signed off. Sprint 1 already prices a booking as integer euro cents (`estimated hours × base rate + platform fee`). Sprint 2 needs a payment foundation that can:

1. Reserve funds after a Student **accepts** a booking (pre-authorization / delayed capture).
2. Later capture those funds and split a **platform fee** from the Help Seeker’s payment.
3. Later pay the Student (payout), independently of capture.
4. Support refunds if work does not complete as agreed.
5. Keep payment state **separate** from `BookingStatus`.

This record evaluates Stripe Connect, PayPal, and Adyen against those requirements. It does **not** claim that authorization is a legal escrow account.

Member 1 implements the authorization **foundation** only: domain model, provider abstraction, sandbox-ready adapter, mock gateway, and `ACCEPTED → prepare authorization`. Capture, confirmation, and payout are out of scope.

## Requirements

Must support now or without a later provider rewrite:

1. **Authorization / reservation** — hold funds without capturing them.
2. **Delayed capture** — capture after completion/sign-off, not at authorization time.
3. **Marketplace split** — deduct a platform fee from the Help Seeker charge.
4. **Student payouts** — pay the Student after capture, on a separate ledger event.
5. **Refunds** — reverse a capture (and ideally release an uncaptured authorization).
6. **Webhooks** — asynchronous authorization/capture/dispute updates with signature verification.
7. **Idempotency** — provider-supported idempotency keys plus application-level retry safety.
8. **Sandbox** — test mode that never touches live money.
9. **EU fitness** — SCA/PSD2, euro charges, German/EU student users.
10. **Operational simplicity** — one team can operate Connect-style onboarding later.
11. **Security** — no card PAN/CVV in our database; secrets only in env.

Current constraints:

- No payment-provider credentials are configured in this repository.
- Amounts are already integer minor units in EUR from `PricingService`.
- Help Seekers store only a **preference** (`CARD` / `PAYPAL` / `BANK_TRANSFER`), not processor tokens.

## Options Considered

### Stripe Connect

Stripe PaymentIntents support `capture_method=manual`: the charge is authorized (`requires_capture`) and captured later. Uncaptured authorizations expire on Stripe’s schedule (typically ~7 days; must be documented when capture work lands).

Connect destination charges or separate charges/transfers support:

- `application_fee_amount` for the platform fee already calculated by `PricingService`
- connected accounts for Students (Express/Standard) for later payouts
- refunds on the PaymentIntent
- signed webhooks (`payment_intent.amount_capturable_updated`, `payment_intent.payment_failed`, etc.)
- idempotency keys on every mutating request
- test-mode keys (`sk_test_…`, `pk_test_…`)

EU: Stripe supports SCA (3-D Secure) via PaymentIntents. Cards and other EU methods can be added later without changing the domain “authorization” model.

Complexity: moderate. The domain must still not import Stripe types. Card collection belongs in a later Stripe.js/Elements task, not in this foundation.

Limitation: a manual-capture authorization is a **card hold**, not an escrow account. Funds are reserved on the payer’s card and captured by Stripe; they are not held in a Students-Help escrow ledger.

### PayPal

PayPal supports order `AUTHORIZE` then `CAPTURE`. Marketplace splitting requires PayPal Commerce Platform / partner referrals, not a simple REST order. Delayed disbursement exists but is product- and region-specific. Webhooks exist; idempotency is weaker and more manual than Stripe’s key header.

EU: PayPal is widely used, but SCA and marketplace KYC onboarding are heavier. The Help Seeker preference enum already includes `PAYPAL`, which is a **user preference**, not an integration.

Complexity: high for Connect-equivalent splits and Student payouts. Poor fit for a first adapter when the pricing model is a platform fee on a card-like authorization.

### Adyen

Adyen for Platforms (balance accounts, split `paymentFee` / `PaymentSplit`) is a strong marketplace product: authorization, delayed capture, split to platform and seller, payouts, and webhooks are first-class.

Complexity: high. Contracting, KYC, and balance-account setup are not available to this project. No Adyen credentials exist. Overkill for Sprint 2 Member 1, and it would still need the same domain abstraction.

## Comparison

| Criterion | Stripe Connect | PayPal | Adyen |
|---|---|---|---|
| Auth + delayed capture | PaymentIntent `capture_method=manual` | Order AUTHORIZE/CAPTURE | Auth/capture on platforms |
| Platform fee split | `application_fee_amount` / destination charge | Commerce Platform only | Native payment splits |
| Student payout | Connect transfers / Express | Payouts product, partner setup | Balance account payouts |
| Refunds | PaymentIntent refunds | Capture refunds | Refunds API |
| Webhooks | Signed, well-documented | Signed, more event noise | Signed, HMAC |
| Idempotency | `Idempotency-Key` header | Limited / custom | Standard request IDs |
| Sandbox | Test keys, no live money | Sandbox accounts | Test company |
| EU / SCA | PaymentIntents + 3DS | Supported, more ceremony | Strong, enterprise |
| Complexity for this repo | Moderate, maps cleanly to current pricing | High for fee split + payout | Highest, contract-gated |
| Credentials in repo | None | None | None |

## Decision

**Selected provider: Stripe Connect** (test/sandbox mode only when keys are present).

Reasons specific to this codebase:

- Sprint 1 already computes `subtotal` + `platformFee` + `total` in EUR cents. That maps directly to PaymentIntent `amount` and Connect `application_fee_amount`.
- The required lifecycle is authorize now, capture later, payout even later. Stripe’s `requires_capture` state matches `PaymentStatus.AUTHORIZED` without implying the booking is `CONFIRMED`.
- Idempotency keys and webhook signatures are the most straightforward to add when later members implement async confirmation.
- Adyen is a better raw marketplace platform but is not operable here (no contract, no credentials, higher integration cost).
- PayPal is a stored Help Seeker **preference**, not a reason to make PayPal the processor. Commerce Platform splitting is a larger product change than this foundation.

The rest of the application **must not** import Stripe types. `PaymentService` talks only to `PaymentGateway`.

## Consequences

- Authorization in this system means “provider reports funds are capturable”, not “Students-Help holds escrow”.
- Manual-capture holds expire. Capture/payout members must handle expiry (`FAILED` / `CANCELLED`) without silently confirming bookings.
- Students are not Connect accounts yet. The Stripe adapter records `application_fee_amount` for later destination charges; it does **not** create connected accounts or payouts in Member 1.
- Without `PAYMENT_SECRET_KEY`, the process uses `MockPaymentGateway`. Mock success is **not** a bank reservation.
- Card collection UI (Stripe.js) is deferred. The mock path authorizes from a test payment-method reference so the API can be exercised.

## Implementation Strategy

1. Persist a `Payment` row per attempt, keyed to `Booking`, with integer `amountMinor`, `platformFeeMinor`, and explicit `currency`.
2. Amounts always come from `PricingService.estimateFromDurationMinutes(task.estimatedDurationMinutes)`.
3. `PaymentGateway.createAuthorization` / `retrieveAuthorization` / `cancelAuthorization` are the only provider operations in this sprint.
4. Default gateway: `MockPaymentGateway` (`pm_test_success` / omitted ref → authorized; `pm_test_declined` → declined; `pm_test_error` → provider error).
5. `StripePaymentGateway` is implemented against a narrow Intent client (`capture_method=manual`). It is selected only when `PAYMENT_PROVIDER=stripe` and a test secret is configured. Production secrets are forbidden in this repo.
6. `POST /bookings/:bookingId/payment/authorization` is Help Seeker–owned and only valid for `ACCEPTED` bookings. It does not set `BookingStatus.CONFIRMED`.
7. Idempotency: unique `idempotencyKey` per attempt plus a partial unique index so a booking has at most one in-flight or authorized payment. Duplicate POSTs return the existing row.
8. Provider calls happen **outside** the Prisma transaction that inserts `AUTHORIZATION_PENDING`. Success/failure is written afterwards. A unique-constraint collision on insert loads the winner instead of creating a second authorization.
9. Webhooks, capture, refund, and payout are explicitly not implemented here.

## Security considerations

- Never persist PAN, CVV, bank passwords, or raw provider payloads.
- Never send `PAYMENT_SECRET_KEY` or `PAYMENT_WEBHOOK_SECRET` to the frontend.
- API responses expose payment status, amounts, currency, and failure code only. No client secret is returned from the mock success path (there is none). A later Stripe.js member may add a client-safe field when `REQUIRES_PAYMENT_METHOD` is used with real Elements.
- Logs must not include secrets, card data, or full provider bodies.

## Known limitations

- No live or sandbox Stripe call is made until test keys exist.
- Mock `AUTHORIZED` does not reserve money at a card network.
- Connect account onboarding for Students is not started.
- Authorization expiry, disputes, and SCA challenges are not handled in Member 1.
- PayPal remains a Help Seeker preference label only.
