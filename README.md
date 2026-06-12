# VoluChat Webhook Ingress

TypeScript Express service for Meta webhook ingress. It verifies Meta webhook setup requests, validates POST delivery signatures, and enqueues the exact raw webhook payload into one BullMQ queue for downstream workers.

## Environment

Copy `.env.example` and provide real values:

- `META_VERIFY_TOKEN`: verify token configured in Meta webhook setup.
- `META_APP_SECRET`: app secret for Facebook, Messenger, and WhatsApp.
- `META_INSTAGRAM_APP_SECRET`: Instagram app secret.
- `REDIS_HOST`: Redis host. Defaults to `127.0.0.1`.
- `REDIS_PORT`: Redis port. Defaults to `6379`.
- `REDIS_USERNAME`: Redis username, if required.
- `REDIS_PASSWORD`: Redis password, if required.
- `REDIS_SSL`: set to `true` for TLS Redis connections.
- `WEBHOOK_QUEUE_NAME`: single BullMQ queue for all Meta webhook deliveries. Defaults to `meta-webhooks`.
- `PORT`: HTTP port. Defaults to `3000`.

Lowercase aliases are also accepted for Redis settings: `redis_host`, `redis_port`, `redis_username`, `redis_password`, and `redis_ssl`.

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

## PM2

Create `.env` from `.env.example`, fill in the real values, then run the compiled server with PM2:

```bash
npm install
npm run build
pm2 start dist/server.js --name voluchat-webhook-ingress
pm2 save
```

The server loads `.env` on startup through `dotenv`, so an ecosystem file is not required. After changing `.env`, restart the process:

```bash
pm2 restart voluchat-webhook-ingress
```

Useful commands:

```bash
pm2 logs voluchat-webhook-ingress
pm2 status
pm2 stop voluchat-webhook-ingress
```
