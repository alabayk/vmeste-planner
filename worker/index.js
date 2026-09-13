import webpush from "web-push";

const allowedOrigin = "https://alabayk.github.io";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body, status = 200) => Response.json(body, { status, headers: cors });

async function currentUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization, apikey: env.SUPABASE_PUBLISHABLE_KEY },
  });
  return response.ok ? response.json() : null;
}

async function db(request, env, path, init = {}) {
  const authorization = request.headers.get("Authorization") || "";
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      const user = await currentUser(request, env);
      if (!user?.id) return json({ error: "Unauthorized" }, 401);
      const body = await request.json();

      if (body.action === "subscribe") {
        const subscription = body.subscription;
        if (!subscription?.endpoint) return json({ error: "Invalid subscription" }, 400);
        const response = await db(request, env, "push_subscriptions?on_conflict=endpoint", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            user_id: user.id,
            subscription,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!response.ok) throw new Error(await response.text());
        return json({ ok: true });
      }

      if (body.action === "notify") {
        const response = await db(request, env, "rpc/get_other_push_subscriptions", { method: "POST", body: "{}" });
        if (!response.ok) throw new Error(await response.text());
        const rows = await response.json();
        webpush.setVapidDetails("mailto:ivan.dremach07@yandex.ru", env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
        const payload = JSON.stringify({ title: "Новый общий план", body: body.title, url: "/vmeste-planner/" });
        const results = await Promise.allSettled(rows.map(({ subscription }) => webpush.sendNotification(subscription, payload)));
        return json({ ok: true, sent: results.filter((result) => result.status === "fulfilled").length });
      }

      return json({ error: "Bad request" }, 400);
    } catch (error) {
      return json({ error: String(error?.message || error) }, 500);
    }
  },
};
