import { NextRequest, NextResponse } from "next/server";

import { hashPassword, validatePasswordPolicy } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

type RegisterRequest = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
};

function errorResponse(status: number, code: string, message: string) {
  const payload: ErrorResponse = {
    error: {
      code,
      message
    }
  };

  return NextResponse.json(payload, { status });
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  let body: RegisterRequest;
  try {
    body = (await request.json()) as RegisterRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : undefined;

  if (!isValidEmail(email)) {
    return errorResponse(400, "INVALID_EMAIL", "Email format is invalid.");
  }

  const passwordPolicyError = validatePasswordPolicy(password);
  if (passwordPolicyError) {
    return errorResponse(400, "INVALID_PASSWORD", passwordPolicyError);
  }

  if (name && name.length > 120) {
    return errorResponse(400, "INVALID_NAME", "Name must be 120 characters or fewer.");
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      return errorResponse(400, "EMAIL_ALREADY_REGISTERED", "Email is already registered.");
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    return NextResponse.json(
      {
        data: {
          user
        },
        meta: {}
      },
      { status: 201 }
    );
  } catch {
    return errorResponse(500, "REGISTER_FAILED", "Failed to register user.");
  }
}
