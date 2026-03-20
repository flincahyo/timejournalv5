import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/push
 * Proxies push notification calls from the browser to the backend server-side.
 * This avoids CORS issues and ensures NEXT_PUBLIC_BACKEND_URL doesn't matter client-side.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { endpoint, ...payload } = body; // endpoint = 'test-push' | 'fire-push'

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return NextResponse.json({ ok: false, reason: "No auth token" }, { status: 401 });
        }

        // Server-side we can use full backend URL safely
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:8000";
        const url = `${backendUrl}/api/alerts/${endpoint}`;

        console.log(`[PUSH PROXY] Forwarding to ${url}, payload:`, JSON.stringify(payload));

        const backendRes = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader,
            },
            body: JSON.stringify(payload),
        });

        const data = await backendRes.json();
        console.log(`[PUSH PROXY] Backend response:`, JSON.stringify(data));
        return NextResponse.json(data, { status: backendRes.status });
    } catch (e: any) {
        console.error("[PUSH PROXY] Error:", e?.message);
        return NextResponse.json({ ok: false, reason: e?.message }, { status: 500 });
    }
}
