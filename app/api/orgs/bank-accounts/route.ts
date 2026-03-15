import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/middleware";
import { resolvePrimaryOrganizationIdForUser } from "@/server/services/organizationService";
import {
  createOrgBankAccount,
  deleteOrgBankAccount,
  listOrgBankAccounts
} from "@/server/services/orgBankAccountService";
import { ServiceError } from "@/server/services/serviceError";

type CreateRequest = {
  orgId?: unknown;
  bankName?: unknown;
  accountNumber?: unknown;
  accountHolder?: unknown;
};

type DeleteRequest = {
  orgId?: unknown;
  bankAccountId?: unknown;
};

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      request.nextUrl.searchParams.get("orgId")?.trim() ?? ""
    );
    const accounts = await listOrgBankAccounts({
      actorUserId: auth.session.userId,
      orgId
    });

    return NextResponse.json(
      {
        data: {
          accounts
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BANK_ACCOUNT_LIST_FAILED", "Failed to fetch bank accounts.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: CreateRequest;
  try {
    body = (await request.json()) as CreateRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const account = await createOrgBankAccount({
      actorUserId: auth.session.userId,
      orgId,
      bankName: typeof body.bankName === "string" ? body.bankName : "",
      accountNumber: typeof body.accountNumber === "string" ? body.accountNumber : "",
      accountHolder: typeof body.accountHolder === "string" ? body.accountHolder : ""
    });

    return NextResponse.json(
      {
        data: {
          account
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BANK_ACCOUNT_CREATE_FAILED", "Failed to create bank account.");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  let body: DeleteRequest;
  try {
    body = (await request.json()) as DeleteRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    const orgId = await resolvePrimaryOrganizationIdForUser(
      auth.session.userId,
      typeof body.orgId === "string" ? body.orgId : ""
    );
    const deleted = await deleteOrgBankAccount({
      actorUserId: auth.session.userId,
      orgId,
      bankAccountId: typeof body.bankAccountId === "string" ? body.bankAccountId : ""
    });

    return NextResponse.json(
      {
        data: {
          deleted
        },
        meta: {}
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(500, "BANK_ACCOUNT_DELETE_FAILED", "Failed to delete bank account.");
  }
}
