// Serves Vercel Blob product photos through our own domain with a long cache lifetime.
// Vercel's edge keeps the file after the first request, so repeat visits no longer download it from Blob
// again (Blob data transfer is limited to 10 GB/month on the free plan).
export const runtime = "nodejs";

const ALLOWED_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("u") || "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOST.test(target.hostname)) {
    return new Response("Forbidden host", { status: 403 });
  }

  const upstream = await fetch(target.toString());
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: upstream.status === 404 ? 404 : 502 });
  }
  const type = upstream.headers.get("content-type") || "image/webp";
  if (!type.startsWith("image/")) return new Response("Not an image", { status: 415 });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": type,
      // Uploaded file names are unique (timestamp + random), so a file never changes at the same URL.
      "Cache-Control": `public, max-age=${ONE_YEAR}, s-maxage=${ONE_YEAR}, immutable`,
    },
  });
}
