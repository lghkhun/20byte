import { NextResponse } from "next/server";

export function errorResponse(status: number, code: string, message: string) {
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

export function successResponse<TData>(data: TData, status = 200, meta: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      data,
      meta
    },
    { status }
  );
}
