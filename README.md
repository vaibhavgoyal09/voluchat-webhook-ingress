# VoluChat Webhook Ingress

TypeScript Express service for Meta webhook ingress. It verifies Meta webhook setup requests, validates POST delivery signatures, and enqueues the exact raw webhook payload into one BullMQ queue for downstream workers.

## Environment

Copy `.env.example` and provide real values:

- `META_VERIFY_TOKEN`: verify token configured in Meta webhook setup.
- `META_APP_SECRET`: app secret for Facebook, Messenger, and WhatsApp.
- `META_INSTAGRAM_APP_SECRET`: Instagram app secret.
- `REDIS_URL`: Redis connection URL.
- `WEBHOOK_QUEUE_NAME`: single BullMQ queue for all Meta webhook deliveries. Defaults to `meta-webhooks`.
- `PORT`: HTTP port. Defaults to `3000`.

## Routes

- `GET /:channel/webhook`: Meta webhook subscription verification.
- `POST /:channel/webhook`: validates `x-hub-signature-256`, stores the raw body as base64, and enqueues one job.
- `GET /healthz`: health check.

All Meta POST deliveries go to one BullMQ queue. The `channel` path segment and parsed `object` are metadata only; a valid signature against any configured app secret is what authorizes enqueueing.

## Commands

```bash
npm test
npm run build
npm run dev
npm start
```
