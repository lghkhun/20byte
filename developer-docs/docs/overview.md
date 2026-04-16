---
id: overview
title: Overview
description: Dokumentasi publik 20byte WhatsApp Public API v1
slug: /
---

# 20byte WhatsApp Public API v1

Dokumentasi ini bersifat publik dan bisa dipakai platform eksternal untuk integrasi ke 20byte.

## Base URL

```txt
https://20byte.com/api/public/v1/whatsapp
```

## Response Format

Semua endpoint memakai format konsisten:

```json
{
  "data": {},
  "meta": {}
}
```

Jika gagal:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Field to is required."
  }
}
```

## Alur Singkat

1. Owner generate API key di **Settings -> Business -> WhatsApp**.
2. Platform eksternal kirim request dengan `Authorization: Bearer twapi_xxx_xxx`.
3. (Opsional) Set webhook untuk event inbound, outbound status, dan device connection.

## OpenAPI Spec

File OpenAPI tersedia di:

```txt
/openapi/whatsapp-public-v1.yaml
```
