import { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";
import { Readable } from "stream";

type NodeHandler = (req: any, res: any) => unknown;

/**
 * Runs a Node-style (Express) handler against a Fetch API Request and returns a
 * streaming Response, so the existing Express API can be served from a Next.js
 * Route Handler (including the long-lived SSE endpoint).
 */
export async function runNodeHandler(handler: NodeHandler, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const body = request.body && !["GET", "HEAD"].includes(request.method)
    ? Buffer.from(await request.arrayBuffer())
    : null;

  const req = new IncomingMessage(new Socket()) as IncomingMessage & { body?: unknown };
  req.method = request.method;
  req.url = url.pathname + url.search;
  request.headers.forEach((value, key) => {
    req.headers[key.toLowerCase()] = value;
  });
  if (body) req.headers["content-length"] = String(body.length);
  // Feed the body into the request stream
  const source = Readable.from(body ? [body] : []);
  source.on("data", (chunk) => req.push(chunk));
  source.on("end", () => req.push(null));
  source.on("error", (err) => req.destroy(err));

  return new Promise<Response>((resolve) => {
    const res = new ServerResponse(req);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    let resolved = false;
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
      cancel() {
        closed = true;
        req.emit("close");
        res.emit("close");
      },
    });

    const toBytes = (chunk: any, enc?: any): Uint8Array =>
      typeof chunk === "string" ? Buffer.from(chunk, typeof enc === "string" ? (enc as BufferEncoding) : "utf8") : chunk;

    const flushHead = () => {
      if (resolved) return;
      resolved = true;
      const headers = new Headers();
      for (const [key, value] of Object.entries(res.getHeaders())) {
        if (value === undefined) continue;
        if (Array.isArray(value)) value.forEach((v) => headers.append(key, String(v)));
        else headers.set(key, String(value));
      }
      const status = res.statusCode || 200;
      const nullBody = status === 204 || status === 205 || status === 304 || request.method === "HEAD";
      resolve(new Response(nullBody ? null : stream, { status, headers }));
    };

    res.writeHead = function (this: ServerResponse, status: number, ...rest: any[]) {
      this.statusCode = status;
      const hdrs = rest.find((r) => r && typeof r === "object" && !Array.isArray(r)) ?? rest.find(Array.isArray);
      if (hdrs) {
        if (Array.isArray(hdrs)) {
          for (let i = 0; i < hdrs.length; i += 2) this.setHeader(hdrs[i], hdrs[i + 1]);
        } else {
          for (const [k, v] of Object.entries(hdrs)) this.setHeader(k, v as any);
        }
      }
      (this as any).headersSent_ = true;
      flushHead();
      return this;
    } as any;

    res.write = function (chunk: any, enc?: any, cb?: any) {
      flushHead();
      if (!closed && chunk != null && chunk.length !== 0) {
        try {
          controller.enqueue(toBytes(chunk, enc));
        } catch {
          closed = true;
        }
      }
      const callback = typeof enc === "function" ? enc : cb;
      if (typeof callback === "function") callback();
      return !closed;
    } as any;

    res.end = function (this: ServerResponse, chunk?: any, enc?: any, cb?: any) {
      if (typeof chunk === "function") {
        cb = chunk;
        chunk = undefined;
      }
      if (chunk != null && typeof chunk !== "function") (res.write as any)(chunk, enc);
      flushHead();
      if (!closed) {
        closed = true;
        try {
          controller.close();
        } catch {}
      }
      (this as any).finished = true;
      this.emit("finish");
      this.emit("close");
      const callback = typeof enc === "function" ? enc : cb;
      if (typeof callback === "function") callback();
      return this;
    } as any;

    Object.defineProperty(res, "writableEnded", { get: () => closed });
    Object.defineProperty(res, "headersSent", { get: () => resolved });

    try {
      const result = handler(req, res);
      Promise.resolve(result).catch((err) => {
        console.error("[API bridge] handler error:", err);
        if (!resolved) {
          resolved = true;
          resolve(new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          }));
        }
      });
    } catch (err) {
      console.error("[API bridge] handler error:", err);
      resolve(new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }));
    }
  });
}
