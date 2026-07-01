# Story 4 — Check out with a mocked payment

**ID:** `checkout`
**Persona:** Quincy Quacker (customer)
**Priority:** MVP
**Depends on:** `add-to-cart`

## Story

> **As** a customer who has finally chosen their ducks,
> **I want** to complete a checkout and receive an order confirmation,
> **so that** I know my flock is on the way.

## Acceptance criteria

- Checkout collects a shipping name, email and address, plus mocked card details (any string accepted — this is a workshop, not a payment processor).
- Payment with card must be possible as part of checkout (mocked card flow only).
- On submit, the system:
  - Validates required fields (rejects empty/invalid email).
  - Re-validates stock for every line item (rejects checkout if any line item is now out of stock).
  - Decrements stock atomically for all line items.
  - Creates an order record with a unique order ID, line items, total, and timestamp.
  - Clears the cart.
  - Returns an order confirmation containing the order ID and summary.
- Orders are persisted (file or DB), even if the server restarts.

## Out of scope

- Real payment provider integration. **Do not** add Stripe/PayPal/etc.
- Emails / notifications.
- Order history / order lookup by customer (this can come later).
