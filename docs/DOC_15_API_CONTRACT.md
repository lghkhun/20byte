# DOC 15 — API Contract & Response Standard
File: DOC_15_API_CONTRACT.md

Product: 20byte  
Purpose: Define consistent API request/response patterns across the platform.

This document ensures:

- consistent API responses
- predictable error handling
- stable frontend integration
- Codex-generated endpoints remain uniform

All API routes must follow these standards.

---

# 1. API Philosophy

API design principles:

Consistency  
Predictability  
Simplicity

Every API must return responses using a standard structure.

---

# 2. Success Response Format

All successful responses must follow this format:

```
{
  "data": {},
  "meta": {}
}
```

Example:

```
{
  "data": {
    "customer": {
      "id": "cus_123",
      "name": "John"
    }
  },
  "meta": {}
}
```

---

# 3. Error Response Format

Errors must use a standardized format.

```
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Example:

```
{
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Customer does not exist"
  }
}
```

---

# 4. Pagination Format

Paginated responses must include metadata.

```
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 200
  }
}
```

---

# 5. HTTP Status Codes

Standard codes:

200 OK  
201 Created  
400 Bad Request  
401 Unauthorized  
403 Forbidden  
404 Not Found  
500 Internal Error

---

# 6. API Naming Convention

Endpoints should follow resource structure.

Examples:

```
/api/customers
/api/conversations
/api/messages
/api/invoices
/api/shortlinks
```

Avoid nested complexity.

---

# 7. Idempotency

Webhook processing APIs must support idempotency.

Example:

If message already exists, return success without duplicating.

---

# 8. API Versioning

Future versions should follow:

```
/api/v1/
/api/v2/
```

MVP may omit version prefix.

---

# 9. Authentication

Authenticated endpoints require session token.

Unauthenticated endpoints:

- public invoice page
- shortlink redirect
- webhook endpoints

Current public routes:

- `/i/{publicToken}` public invoice page
- `/r/{code}` canonical shortlink redirect
- `/s/{code}` legacy shortlink redirect compatibility

---

# 10. API Contract Summary

All APIs must guarantee:

consistent response structure  
clear error codes  
predictable pagination
