---
id: error-codes
title: Error Codes
---

# Error Codes

| Code | Penjelasan |
| --- | --- |
| `INVALID_REQUEST` | Payload tidak valid / field wajib kosong |
| `UNAUTHORIZED` | Header Authorization tidak ada/invalid |
| `INVALID_API_KEY` | API key tidak ditemukan, revoked, atau salah |
| `FORBIDDEN` | Role tidak diizinkan |
| `WHATSAPP_NOT_CONNECTED` | Device WhatsApp belum connect |
| `RATE_LIMITED` | Melebihi batas request |
| `INTERNAL_ERROR` | Error internal server |

## Contoh Error

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please retry later."
  }
}
```
