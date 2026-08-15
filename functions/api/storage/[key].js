// Cloudflare Pages Function: /api/storage/:key
// Requiere un KV namespace enlazado con el nombre "STORAGE_KV" en el proyecto Pages.
//
// GET    /api/storage/:key           -> { value: "..." }  o 404 si no existe
// PUT    /api/storage/:key           -> body: { value: "..." }  guarda el valor
// DELETE /api/storage/:key           -> borra la clave
//
// Parametro opcional ?shared=1 para namespacing (compartido vs por defecto).
// Como esta app no tiene login, "shared" y el modo por defecto usan el mismo
// espacio global: todo el personal del hotel comparte los mismos datos.

function kvKey(rawKey, shared) {
  const prefix = shared ? 'shared:' : 'shared:'; // sin auth: todo es compartido
  return prefix + rawKey;
}

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const url = new URL(request.url);
  const shared = url.searchParams.get('shared') === '1';
  const key = decodeURIComponent(params.key);

  const value = await env.STORAGE_KV.get(kvKey(key, shared));
  if (value === null) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(JSON.stringify({ value }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const url = new URL(request.url);
  const shared = url.searchParams.get('shared') === '1';
  const key = decodeURIComponent(params.key);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response('Invalid JSON body', { status: 400 });
  }
  if (typeof body.value !== 'string') {
    return new Response('Body must be { "value": "<string>" }', { status: 400 });
  }

  await env.STORAGE_KV.put(kvKey(key, shared), body.value);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestDelete(context) {
  const { env, params, request } = context;
  const url = new URL(request.url);
  const shared = url.searchParams.get('shared') === '1';
  const key = decodeURIComponent(params.key);

  await env.STORAGE_KV.delete(kvKey(key, shared));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
