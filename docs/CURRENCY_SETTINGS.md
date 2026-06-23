# Currency Settings — Backend Integration Guide

## Overview

This document describes the Currency Settings backend for the WorkPhelo Reinsurance service. Currencies are a dedicated tenant-owned resource, not a BusinessClassField. They are required because placements must snapshot the exchange rate at creation time so that old placements are never retroactively affected by future rate changes.

## Swagger / OpenAPI

After starting the service (`npm run dev:reinsurance`), the interactive docs are at:

```
http://localhost:4007/api/docs
```

Through the gateway in development:

```
https://dev-api.workphelo.com/api/v1/operations/reinsurance/docs
```

All currency endpoints are grouped under the **Reinsurance - Currency Settings**
tag. See `docs/platform/current-environments.md` for current environment URLs.

---

## Data Model

### `Currency`

| Field               | Type           | Notes |
|---------------------|----------------|-------|
| `id`                | UUID           | Primary key |
| `tenantId`          | string         | Tenant scope — never cross-tenant |
| `isoCode`           | string(3)      | ISO 4217 code e.g. `GHS`, `USD`. Immutable after creation. |
| `name`              | string(100)    | Human-readable name |
| `symbol`            | string(10)?    | Optional display symbol e.g. `₵` |
| `exchangeRateToBase`| Decimal(18,6)? | Rate relative to tenant base currency. Always `1.000000` for base currency. |
| `isBaseCurrency`    | boolean        | One per tenant. Placements with this currency have rate `1`. |
| `isActive`          | boolean        | Inactive currencies are hidden from dropdowns but still serve historical placements. |
| `displayOrder`      | int            | Sort order in UI dropdowns. |
| `archivedAt`        | DateTime?      | Soft-delete. Non-null = archived. |

### `Placement` (new field)

| Field               | Type           | Notes |
|---------------------|----------------|-------|
| `exchangeRateToBase`| Decimal(18,6)? | Rate snapshotted from `Currency.exchangeRateToBase` at placement creation or when `currency` was last changed. Null if no matching `Currency` record exists. **Never updated retroactively.** |

---

## Endpoints

### `GET /settings/currencies`

Returns all non-archived currencies for the tenant, ordered base-first then by `displayOrder`.

**Query parameters:**

| Param    | Type    | Default | Description |
|----------|---------|---------|-------------|
| `page`   | int     | 1       | Page number |
| `limit`  | int     | 20      | Page size (max 100) |
| `isActive` | boolean | — | Filter by active status |

**Response:** `PaginatedCurrenciesResponseDto`

```json
{
  "items": [
    {
      "id": "uuid",
      "isoCode": "USD",
      "name": "US Dollar",
      "symbol": "$",
      "exchangeRateToBase": "1.000000",
      "isBaseCurrency": true,
      "isActive": true,
      "displayOrder": 0,
      ...
    },
    {
      "id": "uuid",
      "isoCode": "GHS",
      "name": "Ghana Cedi",
      "symbol": "₵",
      "exchangeRateToBase": "16.500000",
      "isBaseCurrency": false,
      "isActive": true,
      "displayOrder": 1,
      ...
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 }
}
```

---

### `POST /settings/currencies`

Creates a currency for the tenant.

**Rules:**
- `isoCode` must be exactly 3 uppercase letters (e.g. `GHS`).
- Non-base currencies require `exchangeRateToBase > 0`.
- Setting `isBaseCurrency: true` automatically sets `exchangeRateToBase` to `1.000000`.
- Only one base currency per tenant is allowed. A 409 is returned if one already exists.

**Request body:**

```json
{
  "isoCode": "GHS",
  "name": "Ghana Cedi",
  "symbol": "₵",
  "exchangeRateToBase": 16.5,
  "isBaseCurrency": false,
  "isActive": true,
  "displayOrder": 1
}
```

**Error responses:**
- `400` — Missing `exchangeRateToBase` for non-base currency, or invalid payload.
- `409` — ISO code already exists, or base currency already exists for tenant.

---

### `PATCH /settings/currencies/:id`

Updates a currency. All fields are optional. `isoCode` is immutable.

**Promotion rule:** Setting `isBaseCurrency: true` on a non-base currency:
1. Demotes the existing base currency to `isBaseCurrency: false`.
2. Sets `exchangeRateToBase` to `1.000000` on the promoted currency, regardless of `exchangeRateToBase` in the request.

**Error responses:**
- `400` — Empty payload, or removing rate from a non-base currency.
- `404` — Currency not found or archived.

---

### `DELETE /settings/currencies/:id`

Soft-archives the currency. Returns `400` if any active (non-archived) placements reference the currency's `isoCode`.

**Error responses:**
- `400` — Active placements reference this currency.
- `404` — Currency not found or already archived.

---

## Frontend Integration Contract

### Hook URLs

All currency hooks should call the `settings/` prefixed paths via the API gateway:

```
GET    /operations/reinsurance/settings/currencies
POST   /operations/reinsurance/settings/currencies
PATCH  /operations/reinsurance/settings/currencies/:id
DELETE /operations/reinsurance/settings/currencies/:id
```

### TypeScript types to align

```typescript
export interface Currency {
  id: string;
  tenantId: string;
  isoCode: string;
  name: string;
  symbol: string | null;
  exchangeRateToBase: string | null;  // Prisma Decimal → serialized as string
  isBaseCurrency: boolean;
  isActive: boolean;
  displayOrder: number;
  createdByUserId: string;
  updatedByUserId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Currency selector dropdown

To populate a currency selector in the placement form, call `GET /settings/currencies?isActive=true` and map:

```typescript
currencies.map((c) => ({
  value: c.isoCode,        // store the ISO code on Placement.currency
  label: `${c.isoCode} – ${c.name}`,
}))
```

Store the **ISO code** (e.g. `"GHS"`), not the `id`, in `Placement.currency`. The service will resolve and snapshot the rate automatically.

---

## Exchange Rate Snapshotting

When a placement is created or updated with a `currency` value:

1. The service looks up `Currency` by `{ tenantId, isoCode, archivedAt: null }`.
2. If found, `Placement.exchangeRateToBase` is set from `Currency.exchangeRateToBase`.
3. If no matching `Currency` record exists, `exchangeRateToBase` is stored as `null`.
4. **On update**, `exchangeRateToBase` is only re-snapshotted if the `currency` field is explicitly included in the payload and the ISO code differs from the existing value.

Old placements are **never** retroactively affected when admin updates a currency rate.

---

## Permissions

Currency endpoints use the same reinsurance settings permission set:

| Action   | Required permission                          |
|----------|----------------------------------------------|
| List     | `operations.reinsurance.settings:VIEW`       |
| Create   | `operations.reinsurance.settings:CREATE`     |
| Update   | `operations.reinsurance.settings:EDIT`       |
| Archive  | `operations.reinsurance.settings:DELETE`     |

---

## Migration

The migration `20260529140000_add_currency_settings` adds:
- `reinsurance.Currency` table with all fields and indexes.
- `exchangeRateToBase DECIMAL(18,6)` column to `reinsurance.Placement`.

Run on deploy:

```bash
npx prisma migrate deploy --schema apps/reinsurance-service/prisma/schema.prisma
```
