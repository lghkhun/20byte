---
id: endpoints-webhook
title: Webhook
---

# Webhook Endpoint

## PUT `/webhook`

Set/update konfigurasi webhook.

```json
{
  "url": "https://platform-kamu.com/hooks/20byte",
  "enabled": true,
  "eventFilters": [
    "message.inbound",
    "message.outbound.status",
    "device.connection"
  ],
  "regenerateSecret": false
}
```

## GET `/webhook`

Ambil konfigurasi webhook aktif.

## DELETE `/webhook`

Matikan webhook.
