export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const match = url.pathname.match(/^\/api\/storage\/([^/]+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const key = decodeURIComponent(match[1]);
    const shared = url.searchParams.get("shared") === "1";
    const scope = shared ? "shared" : "personal";
    const kvKey = `${scope}:${key}`;

    try {
      if (request.method === "GET") {
        const value = await env.STORAGE.get(kvKey);
        if (value === null) {
          return new Response(JSON.stringify({ error: "not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...cors },
          });
        }
        return new Response(JSON.stringify({ key, value, shared }), {
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      if (request.method === "PUT") {
        const body = await request.text();
        let value = body;
        try {
          const parsed = JSON.parse(body);
          value = typeof parsed === "string" ? parsed : (parsed.value ?? body);
        } catch (e) {
          // body isn't JSON-wrapped, store raw text
        }
        await env.STORAGE.put(kvKey, value);
        return new Response(JSON.stringify({ key, value, shared }), {
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      if (request.method === "DELETE") {
        await env.STORAGE.delete(kvKey);
        return new Response(JSON.stringify({ key, deleted: true, shared }), {
          headers: { "Content-Type": "application/json", ...cors },
        });
      }

      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...cors },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
  },
};
