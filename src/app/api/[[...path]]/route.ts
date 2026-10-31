import { runNodeHandler } from "@/src/server/nodeBridge";
import { app } from "@/src/server/app";

// The Express API (src/server/app.ts) is served through this catch-all route handler.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handle = (request: Request) => runNodeHandler(app as any, request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
