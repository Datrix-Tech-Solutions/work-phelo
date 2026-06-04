# WorkPhelo Notification Service

The notification-service owns outbound notification delivery for WorkPhelo. It handles email, SMS, in-app notification support, delivery logging, and provider integrations behind RabbitMQ events published by platform services.

## SMS Providers

SMS delivery is routed through the public `SmsService` API:

```ts
sendMessage(to, message);
sendOtp(to, otp, context);
```

The implementation uses a provider abstraction so callers do not depend on a vendor directly. Configure the active provider with:

```env
SMS_PROVIDER=termii
```

Supported values:

- `termii`
- `pilosms`

If `SMS_PROVIDER` is omitted, the service defaults to `termii` for backward compatibility.

## Environment

Common notification-service variables:

```env
DATABASE_URL=
RABBITMQ_URL=
JWT_SECRET=
FRONTEND_BASE_URL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

Termii provider:

```env
SMS_PROVIDER=termii
TERMII_API_KEY=
TERMII_SENDER_ID=WorkPhelo
```

PiloSMS provider:

```env
SMS_PROVIDER=pilosms
PILOSMS_API_KEY=
PILOSMS_SENDER_ID=WorkPhelo
```

Runtime validation requires credentials only for the selected SMS provider. Unsupported provider values fail fast during startup.

## PiloSMS Notes

PiloSMS expects recipients in international format without the leading plus sign. WorkPhelo keeps internal phone numbers in E.164 format, for example `+233244000001`, and the PiloSMS adapter converts that value to `233244000001` at the provider boundary.

The PiloSMS adapter intentionally rejects local numbers such as `0244000001`; it does not infer country codes.

PiloSMS response mapping:

- `1001`: `SENT`
- `1002`: `FAILED`
- `1003`: `FAILED`
- `1004`: `FAILED`
- `1005`: `FAILED`
- `1006`: `SKIPPED`
- `1007`: `FAILED`

Provider status/detail metadata is stored in `NotificationLog.metadata` for SMS deliveries.

## Validation

Useful local checks:

```bash
npm run lint --workspace=apps/notification-service
npm run check-types --workspace=apps/notification-service
npm run test --workspace=apps/notification-service
npm run build --workspace=apps/notification-service
```
