---
id: endpoints-schedules
title: Schedules
---

# Schedule Endpoint

## POST `/schedules`

Buat jadwal kirim pesan.

```json
{
  "to": "+628123456789",
  "text": "Follow up H+1",
  "dueAt": "2026-12-01T10:00:00.000Z"
}
```

## GET `/schedules/:scheduleId`

Ambil detail schedule.

## DELETE `/schedules/:scheduleId`

Batalkan schedule.
