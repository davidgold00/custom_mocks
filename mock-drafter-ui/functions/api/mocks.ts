/// <reference types="@cloudflare/workers-types/latest" />

/**
 * Cloudflare Pages Functions (modules syntax)
 * KV binding name: MOCKS_KV
 */

type Env = {
  MOCKS_KV: KVNamespace;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const data = await env.MOCKS_KV.get(`mock:${id}`);
  return new Response(data ?? "{}", {
    headers: { "Content-Type": "application/json" }
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json()) as { id?: string; data?: unknown };

    if (!body?.id || typeof body.data === "undefined") {
      return new Response(JSON.stringify({ error: "missing id or data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await env.MOCKS_KV.put(`mock:${body.id}`, JSON.stringify(body.data));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : typeof e === "string" ? e : "bad request";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
};
