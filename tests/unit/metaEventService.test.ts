import assert from "node:assert/strict";
import test from "node:test";

import type { MetaEventJobPayload } from "@/server/queues/metaEventQueue";
import { buildMetaEventData, resolveMetaEventDedupeKey } from "@/server/services/metaEventService";

test("resolveMetaEventDedupeKey uses deterministic funnel keys", () => {
  const lead: MetaEventJobPayload = {
    orgId: "org_1",
    kind: "LEAD",
    customerId: "cust_1",
    customerPhoneE164: "+628123456789"
  };
  const checkout: MetaEventJobPayload = {
    orgId: "org_1",
    kind: "INITIATE_CHECKOUT",
    customerId: "cust_1",
    invoiceNo: "INV-0001",
    customerPhoneE164: "+628123456789"
  };

  assert.equal(resolveMetaEventDedupeKey(lead), "lead:cust_1");
  assert.equal(resolveMetaEventDedupeKey(checkout), "initiate_checkout:INV-0001");
});

test("buildMetaEventData defaults to offline physical_store payload", () => {
  const payload: MetaEventJobPayload = {
    orgId: "org_1",
    kind: "PURCHASE",
    customerId: "cust_1",
    invoiceId: "inv_1",
    invoiceNo: "INV-0001",
    customerPhoneE164: "+628123456789",
    currency: "IDR",
    value: 250000
  };

  const event = buildMetaEventData(payload, "hashed_phone", "purchase:INV-0001");
  assert.ok(event);
  assert.equal(event?.action_source, "physical_store");
  assert.equal(event?.messaging_channel, undefined);
  assert.deepEqual(event?.user_data.ph, ["hashed_phone"]);
  assert.equal(event?.custom_data?.order_id, "INV-0001");
});

test("buildMetaEventData switches to business_messaging when ctwa is available", () => {
  const payload: MetaEventJobPayload = {
    orgId: "org_1",
    kind: "LEAD",
    customerId: "cust_1",
    customerPhoneE164: "+628123456789",
    ctwaClid: "ctwa-123",
    wabaId: "1234567890"
  };

  const event = buildMetaEventData(payload, "hashed_phone", "lead:cust_1");
  assert.ok(event);
  assert.equal(event?.action_source, "business_messaging");
  assert.equal(event?.messaging_channel, "whatsapp");
  assert.equal(event?.user_data.ctwa_clid, "ctwa-123");
  assert.equal(event?.user_data.whatsapp_business_account_id, "1234567890");
});

test("buildMetaEventData falls back to physical_store when wabaId is invalid", () => {
  const payload: MetaEventJobPayload = {
    orgId: "org_1",
    kind: "LEAD",
    customerId: "cust_1",
    customerPhoneE164: "+628123456789",
    ctwaClid: "ctwa-123",
    wabaId: "baileys"
  };

  const event = buildMetaEventData(payload, "hashed_phone", "lead:cust_1");
  assert.ok(event);
  assert.equal(event?.action_source, "physical_store");
  assert.equal(event?.messaging_channel, undefined);
});
