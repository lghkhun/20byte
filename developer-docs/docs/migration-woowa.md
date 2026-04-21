---
id: migration-woowa
title: Migrasi dari Woo-WA
---

# Mapping Woo-WA ke 20byte API

Tujuan mapping ini adalah mempermudah migrasi kapabilitas lama ke endpoint modern 20byte.

| Woo-WA Concept | 20byte Endpoint |
| --- | --- |
| Send text message | `POST /messages/send` |
| Send media URL | `POST /messages/send-media-url` |
| Group message | `POST /groups/messages/send` |
| Check device/session | `GET /device/info` |
| Generate QR | `POST /device/generate-qr` |
| Schedule message | `POST /schedules` |
| Webhook setting | `PUT /webhook` |

## Perbedaan Utama

- 20byte memakai `Authorization: Bearer <api_key>`.
- Response format standar `{ data, meta }` / `{ error }`.
- API key dikelola per business (owner dari dashboard 20byte).
