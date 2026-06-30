# Spec: browse-catalog

## Problem
Visitors need a fast way to see what ducks are available before deciding to buy. The system must expose a catalog on the home entry point and handle empty inventory explicitly.

## Users
- Visitor/customer (primary)
- Curator/admin maintaining catalog data (secondary)

## Scope (in)
- JSON API-first contract for catalog retrieval.
- Home API entry returns the duck catalog collection.
- Each duck exposes at least: name, category, price, tagline.
- Catalog persistence is local storage (JSON file for MVP).
- Seed data includes at least 10 ducks across at least 3 categories.
- Explicit empty-state response when catalog has no entries.

## Scope (out)
- Pagination.
- Images.
- Sorting controls.
- Checkout/cart behavior.
- Authentication/authorization.

## Functional requirements
1. The system shall provide a catalog endpoint for the home experience (JSON response).
2. The endpoint shall return all ducks currently in storage.
3. Each duck record in responses shall include these fields:
   - id: string
   - name: string
   - category: string
   - priceCents: integer >= 0
   - tagline: string
   - inStock: boolean
4. The system shall load catalog data from a local JSON file in MVP.
5. If catalog data exists, the endpoint shall return an array of duck objects.
6. If the catalog is empty, the endpoint shall return an explicit empty-state payload, not a blank response.
7. Seed data shall contain at least 10 ducks and at least 3 distinct categories.

## Non-functional requirements
- Runtime: Node.js 20+.
- Response format: JSON UTF-8.
- Data load for the catalog endpoint should complete under 200 ms in local development with seeded data.
- Validation: malformed catalog rows are rejected with clear error reporting.
- Testability: repository and endpoint behavior covered by automated tests.

## Acceptance criteria
- Calling the home catalog API returns a list of ducks.
- Each listed duck includes name, category, price, and one-line tagline.
- Local JSON storage is the source of truth for catalog reads.
- Seed file contains >= 10 ducks spanning >= 3 categories.
- Empty storage returns an explicit empty-state message payload.

## Open questions
- Should the home entry path be / or /api/ducks in MVP? Current assumption for implementation planning: /api/ducks.
