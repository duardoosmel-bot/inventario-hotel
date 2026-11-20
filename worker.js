// Durable Object: una instancia por clave (peticiones en orden, sin retraso de propagacion)
export class StorageDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const method = request.method;

    if (method === "GET") {
      const value = await this.state.storage.get("value");
      if (value === undefined) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ value }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "PUT") {
      const value = await request.text();
      await this.state.storage.put("value", value);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE") {
      await this.state.storage.delete("value");
      return new Response(JSON.stringify({ deleted: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function scopeKey(key, shared) {
  return (shared ? "shared" : "personal") + ":" + key;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
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
        const id = env.STORAGE_DO.idFromName(kvKey);
        const stub = env.STORAGE_DO.get(id);

        if (request.method === "GET") {
          const doResp = await stub.fetch("https://do/", { method: "GET" });
          if (doResp.status !== 404) {
            const data = await doResp.json();
            return json({ key, value: data.value, shared });
          }
          // Durable Object vacio: buscar el dato antiguo en KV y migrarlo
          const kvValue = await env.STORAGE.get(kvKey);
          if (kvValue === null) {
            return json({ error: "not found" }, 404);
          }
          await stub.fetch("https://do/", { method: "PUT", body: kvValue });
          return json({ key, value: kvValue, shared });
        }

        if (request.method === "PUT") {
          const body = await request.text();
          let value = body;
          try {
            const parsed = JSON.parse(body);
            value = typeof parsed === "string" ? parsed : (parsed.value ?? body);
          } catch (e) {
            // cuerpo no envuelto: se guarda tal cual
          }
          await stub.fetch("https://do/", { method: "PUT", body: value });
          // Copia de respaldo en KV (si falla por limite de escrituras, no rompe nada)
          try { await env.STORAGE.put(kvKey, value); } catch (e) {}
          return json({ key, value, shared });
        }

        if (request.method === "DELETE") {
          await stub.fetch("https://do/", { method: "DELETE" });
          try { await env.STORAGE.delete(kvKey); } catch (e) {}
          return json({ key, deleted: true, shared });
        }

        return json({ error: "method not allowed" }, 405);
      } catch (err) {
        return json({ error: String(err) }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
