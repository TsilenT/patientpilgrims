# push-sender

Sends a Web Push notification to the next player when the game turn advances.
Runs on your desktop; pushes only go out while this process is running.

## Setup

1. `cd tools/push-sender && npm install`
2. Firebase console → Project settings → Service accounts → **Generate new private key**.
   Save it as `tools/push-sender/service-account.json`.
3. Generate VAPID keys: `npx web-push generate-vapid-keys`
4. `cp .env.example .env` and fill in `DATABASE_URL` and the VAPID keys.
5. Put the **public** VAPID key in the web app's env as `VITE_VAPID_PUBLIC_KEY` and redeploy.

## Run

```
npm start
```

## Limitations

- Notifications only send while this process runs (laptop closed → no pings; the
  game turn still advances normally).
- iPhone recipients must install the PWA via **Add to Home Screen** (iOS 16.4+);
  Web Push never works in a plain iOS Safari tab.
- Delivery is best-effort; a sleeping/offline device may delay a notification.
