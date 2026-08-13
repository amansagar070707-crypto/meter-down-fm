import { getVisitTotal, recordVisit } from "@/lib/cloud/upstash";

const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ visits: await getVisitTotal() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ visits: null, degraded: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({ error: "JSON body required." }, { status: 415 });
    }
    const body = (await request.json()) as { sessionId?: unknown };
    if (typeof body.sessionId !== "string" || !SESSION_PATTERN.test(body.sessionId)) {
      return Response.json({ error: "Invalid visit session." }, { status: 400 });
    }
    return Response.json(
      { visits: await recordVisit(body.sessionId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ visits: null, degraded: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
