const CODE_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
const BIT_ZERO = "\u200b";
const BIT_ONE = "\u200c";
const MARKER_BOUNDARY = "\u2063";
const BITS_PER_CHAR = 6;

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

function encodeCodeToBits(code: string): string | null {
  const normalized = normalizeCode(code);
  if (!normalized) {
    return null;
  }

  let output = "";
  for (const char of normalized) {
    const index = CODE_CHARSET.indexOf(char);
    if (index < 0) {
      return null;
    }

    output += index.toString(2).padStart(BITS_PER_CHAR, "0");
  }

  return output;
}

function decodeBitsToCode(bits: string): string | null {
  if (!bits || bits.length % BITS_PER_CHAR !== 0) {
    return null;
  }

  let output = "";
  for (let index = 0; index < bits.length; index += BITS_PER_CHAR) {
    const chunk = bits.slice(index, index + BITS_PER_CHAR);
    const value = Number.parseInt(chunk, 2);
    if (Number.isNaN(value) || value < 0 || value >= CODE_CHARSET.length) {
      return null;
    }

    output += CODE_CHARSET[value];
  }

  return output;
}

function bitsToInvisible(bits: string): string {
  return bits
    .split("")
    .map((bit) => (bit === "1" ? BIT_ONE : BIT_ZERO))
    .join("");
}

function invisibleToBits(value: string): string {
  let bits = "";
  for (const char of value) {
    if (char === BIT_ZERO) {
      bits += "0";
      continue;
    }

    if (char === BIT_ONE) {
      bits += "1";
      continue;
    }

    return "";
  }

  return bits;
}

function encodeMarker(code: string): string | null {
  const bits = encodeCodeToBits(code);
  if (!bits) {
    return null;
  }

  return `${MARKER_BOUNDARY}${bitsToInvisible(bits)}${MARKER_BOUNDARY}`;
}

export function appendInvisibleAttributionMarker(text: string | undefined, code: string): string {
  const marker = encodeMarker(code);
  if (!marker) {
    return text ?? "";
  }

  return `${text ?? ""}${marker}`;
}

export function extractInvisibleAttributionMarker(text: string | undefined): {
  cleanText: string | undefined;
  shortlinkCode: string | undefined;
} {
  if (!text) {
    return {
      cleanText: undefined,
      shortlinkCode: undefined
    };
  }

  const firstBoundary = text.indexOf(MARKER_BOUNDARY);
  const secondBoundary = firstBoundary >= 0 ? text.indexOf(MARKER_BOUNDARY, firstBoundary + 1) : -1;

  if (firstBoundary < 0 || secondBoundary < 0) {
    return {
      cleanText: text,
      shortlinkCode: undefined
    };
  }

  const encodedPart = text.slice(firstBoundary + 1, secondBoundary);
  const bits = invisibleToBits(encodedPart);
  const shortlinkCode = bits ? decodeBitsToCode(bits) ?? undefined : undefined;

  const cleanTextRaw = `${text.slice(0, firstBoundary)}${text.slice(secondBoundary + 1)}`;
  const cleanText = cleanTextRaw.trim();

  return {
    cleanText: cleanText || undefined,
    shortlinkCode
  };
}
