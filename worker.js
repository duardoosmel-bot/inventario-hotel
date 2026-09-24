// ===================== Durable Object: una instancia por cada clave =====================
// Cada clave (p. ej. "shared:hotel_inventory_state") tiene su propio Durable Object.
// Cloudflare garantiza que las peticiones a UN MISMO Durable Object se procesan de
// una en una, en orden -- por eso "leer version actual -> comparar -> escribir" ya
// no puede chocar entre dos dispositivos, a diferencia de KV normal.
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
      // Escritura dentro del propio Durable Object: no hace falta "comparar version"
      // aqui, porque Cloudflare ya garantiza que ninguna otra peticion a esta misma
      // clave se procesa al mismo tiempo. Simplemente se guarda.
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

// ===================== Worker principal: mismo contrato de siempre =====================
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
        // Cada clave -> su propio Durable Object (siempre el mismo, dado el mismo nombre)
        const id = env.STORAGE_DO.idFromName(kvKey);
        const stub = env.STORAGE_DO.get(id);

        if (request.method === "GET") {
          const doResp = await stub.fetch("https://do/", { method: "GET" });
          if (doResp.status === 404) {
            return new Response(JSON.stringify({ error: "not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
          const data = await doResp.json();
          return new Response(JSON.stringify({ key, value: data.value, shared }), {
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
            // el cuerpo no es JSON envuelto, se guarda tal cual (igual que antes)
          }
          await stub.fetch("https://do/", { method: "PUT", body: value });
          return new Response(JSON.stringify({ key, value, shared }), {
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        if (request.method === "DELETE") {
          await stub.fetch("https://do/", { method: "DELETE" });
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
