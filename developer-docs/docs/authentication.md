---
id: authentication
title: Authentication
---

# Authentication

Gunakan API key dengan header Bearer:

```http
Authorization: Bearer twapi_xxx_xxx
```

## Generate API Key

1. Masuk dashboard 20byte.
2. Buka **Settings -> WhatsApp**.
3. Di panel **API Integration**, klik **Generate** atau **Rotate**.
4. Simpan secret key (hanya tampil sekali).

## cURL Example

```bash
curl -X GET 'https://20byte.com/api/public/v1/whatsapp/device/info' \
  -H 'Authorization: Bearer twapi_xxx_xxx'
```

## Error Auth

- `UNAUTHORIZED`: header tidak ada atau format salah.
- `INVALID_API_KEY`: key tidak valid/revoked.
- `WHATSAPP_NOT_CONNECTED`: device WhatsApp business belum tersambung.
