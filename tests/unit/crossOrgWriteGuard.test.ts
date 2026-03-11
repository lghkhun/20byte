import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type ServiceGuardCase = {
  label: string;
  file: string;
  expectUpdateMany?: boolean;
  expectDeleteMany?: boolean;
  strictNoDirectWrite?: boolean;
  requiredPatterns?: RegExp[];
};

const ROOT = process.cwd();

const CASES: ServiceGuardCase[] = [
  {
    label: "catalogService write-path",
    file: "server/services/catalogService.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true,
    expectDeleteMany: true
  },
  {
    label: "conversationService write-path",
    file: "server/services/conversation/assignment.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true
  },
  {
    label: "conversation create write-path",
    file: "server/services/conversation/create.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true
  },
  {
    label: "conversation status write-path",
    file: "server/services/conversation/status.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true
  },
  {
    label: "shortlinkService write-path",
    file: "server/services/shortlinkService.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true
  },
  {
    label: "whatsappService write-path",
    file: "server/services/whatsappService.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true
  },
  {
    label: "org bank account write-path",
    file: "server/services/orgBankAccountService.ts",
    strictNoDirectWrite: true,
    expectDeleteMany: true
  },
  {
    label: "message inbound tx-path",
    file: "server/services/message/inboundInfra/persistence.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true
  },
  {
    label: "message inbound customer/conversation tx-path",
    file: "server/services/message/inboundInfra/customerConversation.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true
  },
  {
    label: "message outbound tx-path",
    file: "server/services/message/outboundInfra/persistence.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true
  },
  {
    label: "invoice draft tx-path",
    file: "server/services/invoice/draft.ts",
    requiredPatterns: [
      /invoiceInTx\s*=\s*await\s+tx\.invoice\.findFirst\(\{[\s\S]*?orgId[\s\S]*?\}\)/,
      /await\s+tx\.invoice\.update\(\{[\s\S]*?where:\s*\{\s*id:\s*invoiceInTx\.id[\s\S]*?\}\)/
    ],
    expectDeleteMany: true
  },
  {
    label: "invoice draft create tx-path",
    file: "server/services/invoice/draftInternals.ts",
    expectUpdateMany: true
  },
  {
    label: "invoice payment tx-path",
    file: "server/services/invoice/paymentInternals.ts",
    expectUpdateMany: true
  },
  {
    label: "invoice outbound tx-path",
    file: "server/services/invoice/outbound.ts",
    expectUpdateMany: true
  },
  {
    label: "storageService tx-path",
    file: "server/services/storageService.ts",
    strictNoDirectWrite: true,
    expectUpdateMany: true,
    expectDeleteMany: true
  }
];

function readSource(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function assertWriteWhereHasOrgId(source: string, method: "updateMany" | "deleteMany", label: string): void {
  const callRegex = new RegExp(`${method}\\(\\{[\\s\\S]*?where:\\s*\\{[\\s\\S]*?\\}\\s*,?[\\s\\S]*?\\}\\)`, "g");
  const matches = source.match(callRegex) ?? [];
  assert.ok(matches.length > 0, `${label}: expected at least one ${method} call`);

  for (const match of matches) {
    assert.match(match, /\borgId\b/, `${label}: ${method} write must include orgId in where clause`);
  }
}

for (const entry of CASES) {
  test(`${entry.label} enforces org-scoped writes`, () => {
    const source = readSource(entry.file);

    if (entry.strictNoDirectWrite) {
      assert.equal(source.includes(".update({"), false, `${entry.label}: disallow direct update() in write path`);
      assert.equal(source.includes(".delete({"), false, `${entry.label}: disallow direct delete() in write path`);
    }

    if (entry.expectUpdateMany) {
      assertWriteWhereHasOrgId(source, "updateMany", entry.label);
    }

    if (entry.expectDeleteMany) {
      assertWriteWhereHasOrgId(source, "deleteMany", entry.label);
    }

    for (const requiredPattern of entry.requiredPatterns ?? []) {
      assert.match(source, requiredPattern, `${entry.label}: missing required tenant-guard pattern`);
    }
  });
}
