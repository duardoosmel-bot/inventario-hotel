const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function scopeKey(key, shared) {
  return (shared ? "shared" : "personal") + ":" + key;
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet(context) {
  const { params, request, env } = context;
  const key = decodeURIComponent(params.key);
  const url = new URL(request.url);
  const shared = url.searchParams.get("shared") === "1";
  const kvKey = scopeKey(key, shared);

  const value = await env.STORAGE.get(kvKey);
  if (value === null) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  return new Response(JSON.stringify({ key, value, shared }), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export async function onRequestPut(context) {
  const { params, request, env } = context;
  const key = decodeURIComponent(params.key);
  const url = new URL(request.url);
  const shared = url.searchParams.get("shared") === "1";
  const kvKey = scopeKey(key, shared);

  const body = await request.text();
  let value = body;
  try {
    const parsed = JSON.parse(body);
    value = typeof parsed === "string" ? parsed : (parsed.value ?? body);
  } catch (e) {
    // el cuerpo no es JSON envuelto, se guarda tal cual
  }

  await env.STORAGE.put(kvKey, value);
  return new Response(JSON.stringify({ key, value, shared }), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export async function onRequestDelete(context) {
  const { params, request, env } = context;
  const key = decodeURIComponent(params.key);
  const url = new URL(request.url);
  const shared = url.searchParams.get("shared") === "1";
  const kvKey = scopeKey(key, shared);

  await env.STORAGE.delete(kvKey);
  return new Response(JSON.stringify({ key, deleted: true, shared }), {
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
