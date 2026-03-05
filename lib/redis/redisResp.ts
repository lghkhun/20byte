import { Socket } from "net";

type RedisPrimitive = string | number | null;
type RedisValue = RedisPrimitive | RedisValue[];

type ParsedValue = {
  value: RedisValue;
  nextIndex: number;
};

type RedisConnectionConfig = {
  host: string;
  port: number;
  password: string | null;
  database: number;
};

const DEFAULT_PORT = 6379;
const SOCKET_TIMEOUT_MS = 15_000;

function parseRedisUrl(redisUrl: string): RedisConnectionConfig {
  const url = new URL(redisUrl);
  if (url.protocol !== "redis:") {
    throw new Error("Only redis:// URLs are supported.");
  }

  return {
    host: url.hostname || "127.0.0.1",
    port: url.port ? Number(url.port) : DEFAULT_PORT,
    password: url.password || null,
    database: url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) || 0 : 0
  };
}

function encodeCommand(parts: string[]): string {
  const encodedParts = parts
    .map((part) => {
      const value = String(part);
      return `$${Buffer.byteLength(value, "utf8")}\r\n${value}\r\n`;
    })
    .join("");

  return `*${parts.length}\r\n${encodedParts}`;
}

function parseBulkString(buffer: string, startIndex: number): ParsedValue {
  const endOfLen = buffer.indexOf("\r\n", startIndex);
  if (endOfLen < 0) {
    throw new Error("Incomplete bulk string length.");
  }

  const length = Number(buffer.slice(startIndex + 1, endOfLen));
  if (length < 0) {
    return { value: null, nextIndex: endOfLen + 2 };
  }

  const contentStart = endOfLen + 2;
  const contentEnd = contentStart + length;
  const closing = buffer.slice(contentEnd, contentEnd + 2);
  if (closing !== "\r\n") {
    throw new Error("Incomplete bulk string payload.");
  }

  return {
    value: buffer.slice(contentStart, contentEnd),
    nextIndex: contentEnd + 2
  };
}

function parseSimple(buffer: string, startIndex: number): ParsedValue {
  const end = buffer.indexOf("\r\n", startIndex);
  if (end < 0) {
    throw new Error("Incomplete simple redis response.");
  }

  const raw = buffer.slice(startIndex + 1, end);
  return {
    value: raw,
    nextIndex: end + 2
  };
}

function parseInteger(buffer: string, startIndex: number): ParsedValue {
  const parsed = parseSimple(buffer, startIndex);
  return {
    value: Number(parsed.value),
    nextIndex: parsed.nextIndex
  };
}

function parseArray(buffer: string, startIndex: number): ParsedValue {
  const endOfLen = buffer.indexOf("\r\n", startIndex);
  if (endOfLen < 0) {
    throw new Error("Incomplete redis array length.");
  }

  const length = Number(buffer.slice(startIndex + 1, endOfLen));
  if (length < 0) {
    return { value: null, nextIndex: endOfLen + 2 };
  }

  let cursor = endOfLen + 2;
  const values: RedisValue[] = [];
  for (let i = 0; i < length; i += 1) {
    const parsed = parseRedisValue(buffer, cursor);
    values.push(parsed.value);
    cursor = parsed.nextIndex;
  }

  return {
    value: values,
    nextIndex: cursor
  };
}

function parseRedisValue(buffer: string, startIndex: number): ParsedValue {
  const prefix = buffer[startIndex];
  if (!prefix) {
    throw new Error("Incomplete redis response.");
  }

  switch (prefix) {
    case "+":
      return parseSimple(buffer, startIndex);
    case ":":
      return parseInteger(buffer, startIndex);
    case "$":
      return parseBulkString(buffer, startIndex);
    case "*":
      return parseArray(buffer, startIndex);
    case "-": {
      const parsed = parseSimple(buffer, startIndex);
      throw new Error(`Redis error reply: ${String(parsed.value)}`);
    }
    default:
      throw new Error(`Unsupported redis response prefix: ${prefix}`);
  }
}

export async function sendRedisCommand(redisUrl: string, commandParts: string[]): Promise<RedisValue> {
  const config = parseRedisUrl(redisUrl);
  const commandStack: string[][] = [];
  if (config.password) {
    commandStack.push(["AUTH", config.password]);
  }
  if (config.database > 0) {
    commandStack.push(["SELECT", String(config.database)]);
  }
  commandStack.push(commandParts);

  const payload = commandStack.map((command) => encodeCommand(command)).join("");
  const expectedReplyCount = commandStack.length;

  return new Promise<RedisValue>((resolve, reject) => {
    const socket = new Socket();
    socket.setTimeout(SOCKET_TIMEOUT_MS);

    let responseBuffer = "";
    let cursor = 0;
    const replies: RedisValue[] = [];
    let settled = false;

    const finalize = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      handler();
    };

    const tryParseReplies = () => {
      try {
        while (replies.length < expectedReplyCount) {
          const parsed = parseRedisValue(responseBuffer, cursor);
          replies.push(parsed.value);
          cursor = parsed.nextIndex;
        }

        finalize(() => {
          resolve(replies[replies.length - 1] ?? null);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown redis parse error.";
        if (
          message.includes("Incomplete redis response.") ||
          message.includes("Incomplete bulk string") ||
          message.includes("Incomplete simple redis response.") ||
          message.includes("Incomplete redis array length.")
        ) {
          return;
        }

        finalize(() => {
          reject(new Error(message));
        });
      }
    };

    socket.on("data", (chunk) => {
      responseBuffer += chunk.toString("utf8");
      tryParseReplies();
    });

    socket.on("timeout", () => {
      finalize(() => {
        reject(new Error("Redis command timed out."));
      });
    });

    socket.on("error", (error) => {
      finalize(() => {
        reject(error);
      });
    });

    socket.connect(config.port, config.host, () => {
      socket.write(payload);
    });
  });
}
