---
id: endpoints-groups
title: Groups
---

# Group Endpoint

## POST `/groups/messages/send`

Kirim text ke group WhatsApp.

```json
{
  "groupId": "120363xxxx@g.us",
  "text": "Halo group"
}
```

## POST `/groups/messages/send-media-url`

Kirim media URL ke group.

```json
{
  "groupId": "120363xxxx@g.us",
  "mediaUrl": "https://example.com/banner.jpg",
  "caption": "Info promo group"
}
```

## GET `/groups`

List group yang tersedia.

## GET `/groups/:groupId/members`

List member dari 1 group.
