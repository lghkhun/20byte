import { NextRequest, NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

type LoginRequest = {
  email?: unknown;
  password?: unknown;
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
  let body: LoginRequest;
  try {
    body = (await request.json()) as LoginRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!isValidEmail(email)) {
    return errorResponse(400, "INVALID_EMAIL", "Email format is invalid.");
  }

  if (!password) {
    return errorResponse(400, "INVALID_PASSWORD", "Password is required.");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true
      }
    });

    if (!user) {
      return errorResponse(401, "INVALID_CREDENTIALS", "Email or password is invalid.");
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse(401, "INVALID_CREDENTIALS", "Email or password is invalid.");
    }

    const sessionToken = createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name
    });

    const response = NextResponse.json(
      {
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name
          }
        },
        meta: {}
      },
      { status: 200 }
    );

    setSessionCookie(response, sessionToken);
    return response;
  } catch {
    return errorResponse(500, "LOGIN_FAILED", "Failed to authenticate user.");
  }
}
