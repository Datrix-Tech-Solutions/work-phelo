# WorkPhelo Marketing Service

The Marketing Service owns tenant-scoped CRM configuration, prospecting and
pipeline workflows for WorkPhelo.

The service is deployed in the current development environment but is not
deployed in the current production Compose file.

Current environment URLs are listed in the root repository README.

## Local Development

```bash
npm install
npm run db:generate --workspace=apps/marketing-service
npm run dev --workspace=apps/marketing-service
```

Default port: `4006`

Health check: `GET http://localhost:4006/api/health`

Local Swagger: `http://localhost:4006/api/docs`

## Deployment Status

| Environment | Swagger                                               |
| ----------- | ----------------------------------------------------- |
| Dev         | `https://dev-api.workphelo.com/api/v1/marketing/docs` |
| Prod        | Not deployed in current prod compose                  |

## Notes

- The health endpoint remains public at `GET /api/health`.
- Protected CRM endpoints use the gateway-forwarded JWT/auth context already
  used by other WorkPhelo services.
- Tenant identity is always derived from the authenticated user. Request bodies
  must not accept tenant IDs.

## CRM Settings Scope

The approved CRM Settings foundation is limited to configuration used by the
existing Marketing frontend settings screens:

| Capability              | Storage model               | Feature entitlement  |
| ----------------------- | --------------------------- | -------------------- |
| Sales Pipeline stages   | `MarketingPipelineStage`    | `marketing.pipeline` |
| Products / Services     | `MarketingCrmSettingOption` | `marketing.leads`    |
| Decision Makers         | `MarketingCrmSettingOption` | `marketing.leads`    |
| Source Types            | `MarketingCrmSettingOption` | `marketing.leads`    |
| Interaction Media       | `MarketingCrmSettingOption` | `marketing.leads`    |
| Prospect Business Types | `MarketingCrmSettingOption` | `marketing.leads`    |

The current UI does not define separate account-related CRM settings beyond
Prospect Business Types. Do not add tenant/company identity settings, Auth user
settings, HR-owned employee metadata, or Accounting customer/vendor settings to
Marketing without a product decision.

## API Contract Status

CRM Settings APIs are committed by user story. Some acceptance criteria depend
on future Prospect persistence and cannot be enforced until Prospect entities
exist, including reference-based delete restrictions and reporting calculations.

All routes are served through the gateway at `/api/v1/marketing/*` and directly
by the service under `/api/*`.

Delete operations should soft-archive records by setting `archivedAt` and should
not physically delete rows. This preserves future prospect and pipeline history.

## Permissions

Marketing permissions are registered in Auth as resource/action pairs. They are
not automatically granted to existing users or permission templates.

| Resource                      | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `marketing.crm-settings`      | Broad CRM settings access for navigation/support |
| `marketing.pipeline-stages`   | Sales pipeline stage configuration               |
| `marketing.products`          | Product/service option configuration             |
| `marketing.decision-makers`   | Decision maker/role-title option configuration   |
| `marketing.source-types`      | Prospect source type option configuration        |
| `marketing.interaction-media` | Interaction medium option configuration          |
| `marketing.business-types`    | Prospect business type option configuration      |

Use `VIEW` for read endpoints and `CREATE`, `EDIT`, `DELETE` for management
endpoints. `DELETE` represents soft-archive behavior in Marketing CRM settings.

## Sales Pipeline Settings API

Implemented configuration behavior:

```text
GET    /crm-settings/pipeline-stages
POST   /crm-settings/pipeline-stages
GET    /crm-settings/pipeline-stages/:id
PATCH  /crm-settings/pipeline-stages/:id
DELETE /crm-settings/pipeline-stages/:id
```

Sales stage settings support tenant isolation, authorization, normalized unique
names, probability validation from 0 to 100, display ordering and soft archive.
Prospect linkage, default stage provisioning and reporting calculations remain
future Prospect workflow work.

## Products / Services Settings API

Implemented configuration behavior:

```text
GET    /crm-settings/products
POST   /crm-settings/products
GET    /crm-settings/products/:id
PATCH  /crm-settings/products/:id
DELETE /crm-settings/products/:id
```

Product and service settings support tenant isolation, authorization, normalized
unique names, deterministic ordering and soft archive. Prospect-product
associations, reference-based delete restrictions and reporting calculations
remain future Prospect workflow work.


## Decision Maker Type Settings API

Implemented configuration behavior:

```text
GET    /crm-settings/decision-makers
POST   /crm-settings/decision-makers
GET    /crm-settings/decision-makers/:id
PATCH  /crm-settings/decision-makers/:id
DELETE /crm-settings/decision-makers/:id
```

Decision maker settings support tenant isolation, authorization, normalized
unique names, deterministic ordering and soft archive. Prospect references,
reference-based delete restrictions and reporting/filtering behavior remain
future Prospect workflow work.


## Prospect Source Type Settings API

Implemented configuration behavior:

```text
GET    /crm-settings/source-types
POST   /crm-settings/source-types
GET    /crm-settings/source-types/:id
PATCH  /crm-settings/source-types/:id
DELETE /crm-settings/source-types/:id
```

Source type settings support tenant isolation, authorization, normalized unique
names, deterministic ordering and soft archive. Prospect references,
reference-based delete restrictions and source-based reporting/filtering remain
future Prospect workflow work.


## Interaction Medium Settings API

Implemented configuration behavior:

```text
GET    /crm-settings/interaction-media
POST   /crm-settings/interaction-media
GET    /crm-settings/interaction-media/:id
PATCH  /crm-settings/interaction-media/:id
DELETE /crm-settings/interaction-media/:id
```

Interaction medium settings support tenant isolation, authorization, normalized
unique names, deterministic ordering and soft archive. Prospect references,
reference-based delete restrictions and interaction reporting/filtering remain
future Prospect workflow work.
