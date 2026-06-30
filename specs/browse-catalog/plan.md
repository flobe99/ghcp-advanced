# Plan: browse-catalog

## Inputs
- Source spec: specs/browse-catalog/spec.md

## Data model
- Duck
  - id: string
  - name: string
  - category: string
  - priceCents: number (integer >= 0)
  - tagline: string
  - inStock: boolean

## Module/file layout
- duck-emporium/src/catalog/types.ts
  - Duck type declarations.
- duck-emporium/src/catalog/catalog-repository.ts
  - Read catalog from local JSON storage.
  - Validate row shape and normalize to Duck.
- duck-emporium/src/catalog/catalog-service.ts
  - Business-level read behavior and empty-state construction.
- duck-emporium/src/data/ducks.json
  - Seed data (>=10 entries, >=3 categories).
- duck-emporium/src/server.ts
  - HTTP surface exposing catalog route.
- duck-emporium/src/catalog/*.test.ts
  - Unit tests for repository/service.
- duck-emporium/src/server.test.ts
  - API behavior tests.

## Public interfaces
- CatalogRepository
  - getAll(): Promise<Duck[]>
- CatalogService
  - getCatalog(): Promise<{ ducks: Duck[]; emptyState?: { message: string } }>
- HTTP
  - GET /api/ducks -> 200 with { ducks: Duck[] } or { ducks: [], emptyState: { message } }

## External dependencies
- Existing Node runtime and TypeScript toolchain.
- Vitest for tests.
- No database dependency for MVP (JSON file only).

## Testing strategy
- Unit tests
  - Valid JSON rows are returned as Duck[]
  - Invalid JSON rows throw validation errors
  - Empty catalog produces explicit empty-state payload
- API tests
  - GET /api/ducks returns expected shape
  - Seed data count/category constraints are validated

## Risks
- Ambiguity in final home route path (/ vs /api/ducks).
- JSON schema drift as later stories add fields.
- Tight coupling to local file path across environments.

## Mitigations
- Keep route configurable in one place.
- Centralize Duck validation in repository module.
- Use path resolution relative to module root and add tests.
