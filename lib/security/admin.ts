import "server-only";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

async function digest(value: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

function equalDigest(left: ArrayBuffer, right: ArrayBuffer) {
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function isAuthorizedAdmin(request: Request) {
  const configuredToken = process.env.ADMIN_API_TOKEN;
  const suppliedToken = getBearerToken(request);
  if (!configuredToken || configuredToken.length < 32 || !suppliedToken) return false;
  return equalDigest(await digest(configuredToken), await digest(suppliedToken));
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

