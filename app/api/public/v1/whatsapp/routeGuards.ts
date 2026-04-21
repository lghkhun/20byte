export function isSendEndpointPath(method: string, path: string): boolean {
  if (method !== "POST") {
    return false;
  }

  return [
    "messages/send",
    "messages/send-async",
    "messages/send-media-url",
    "messages/send-media-url-async",
    "groups/messages/send",
    "groups/messages/send-media-url"
  ].includes(path);
}
