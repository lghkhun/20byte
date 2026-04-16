---
id: endpoints-messages
title: Messages
---

# Messages Endpoint

## POST `/messages/send`

Kirim text message (sync).

```json
{
  "to": "+628123456789",
  "text": "Halo dari 20byte API"
}
```

## POST `/messages/send-async`

Kirim text message async.

```json
{
  "to": "+628123456789",
  "text": "Pesan async"
}
```

## POST `/messages/send-media-url`

Kirim media dengan URL (sync).

```json
{
  "to": "+628123456789",
  "mediaUrl": "https://example.com/files/invoice.pdf",
  "caption": "Invoice April"
}
```

## POST `/messages/send-media-url-async`

Kirim media async.

```json
{
  "to": "+628123456789",
  "mediaUrl": "https://example.com/files/brochure.jpg",
  "caption": "Promo terbaru"
}
```

## GET `/messages/:messageId/status`

Cek status message outbound.

Contoh response:

```json
{
  "data": {
    "messageId": "msg_xxx",
    "status": "SENT"
  },
  "meta": {}
}
```
