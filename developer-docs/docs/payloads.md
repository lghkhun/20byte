---
id: payloads
title: Payload Reference
---

# Payload Reference

## Send Text

```json
{
  "to": "+628123456789",
  "text": "Halo dari integrasi"
}
```

## Send Media URL

```json
{
  "to": "+628123456789",
  "mediaUrl": "https://example.com/file.jpg",
  "caption": "Promo"
}
```

## Check Number

```json
{
  "number": "+628123456789"
}
```

## Schedule

```json
{
  "to": "+628123456789",
  "text": "Reminder invoice",
  "dueAt": "2026-12-01T10:00:00.000Z"
}
```

## Group Send

```json
{
  "groupId": "120363xxxx@g.us",
  "text": "Update weekly"
}
```
