# DOC 17 — Storage Strategy
File: DOC_17_STORAGE_STRATEGY.md

Product: 20byte  
Storage Provider: Cloudflare R2

Purpose: Define how files are stored and organized.

---

# 1. Storage Philosophy

Storage must be:

organized  
predictable  
secure

Files should never be stored randomly.

---

# 2. File Categories

Storage must support:

chat attachments  
invoice PDFs  
payment proofs  
catalog attachments

---

# 3. File Structure

Files must follow this path format.

Chat media:

```
media/{orgId}/{conversationId}/{messageId}.{ext}
```

Invoice PDF:

```
invoice/{orgId}/{invoiceId}.pdf
```

Payment proof:

```
proof/{orgId}/{invoiceId}/{proofId}.{ext}
```

Catalog attachments:

```
catalog/{orgId}/{itemId}.{ext}
```

---

# 4. File Size Limits

Image / PDF

10MB

Video

50MB

---

# 5. Access Control

Files must be accessed via:

signed URLs

Public files:

invoice PDFs

---

# 6. Retention Rules

Chat attachments follow chat retention.

Invoice proofs follow invoice retention.

Example retention:

90 days chat retention for basic plan.

---

# 7. Storage Quota

Each organization has a storage quota.

Example:

Starter → 2GB  
Growth → 10GB  
Enterprise → unlimited

---

# 8. Cleanup Jobs

Worker must periodically delete expired files.

Example job:

cleanupRetentionJob

---

# 9. Storage Summary

Cloudflare R2 stores all media.

File structure must remain consistent to simplify maintenance.