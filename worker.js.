const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function scopeKey(key, shared) {
  return (shared ? "shared" : "personal") + ":" + key;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const match = url.pathname.match(/^\/api\/storage\/([^/]+)$/);

    if (match) {
      const key = decodeURIComponent(match[1]);
      const shared = url.searchParams.get("shared") === "1";
      const kvKey = scopeKey(key, shared);

      try {
        if (request.method === "GET") {
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

        if (request.method === "PUT") {
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

        if (request.method === "DELETE") {
          await env.STORAGE.delete(kvKey);
          return new Response(JSON.stringify({ key, deleted: true, shared }), {
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        return new Response(JSON.stringify({ error: "method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    // Cualquier otra ruta: servir los archivos estaticos (index.html, etc.)
    return env.ASSETS.fetch(request);
  },
};
