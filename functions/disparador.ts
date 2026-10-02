/**
 * Neon Function "disparador": acionada por um Function Trigger (cron em UTC) no projeto Neon.
 * Só repassa a chamada para /api/coletar na Vercel, onde o coletor roda.
 * Variáveis (definidas no deploy da função): COLETOR_URL, CRON_SECRET.
 * O Neon remove cabeçalhos X-Neon-* enviados por clientes; a presença de
 * x-neon-trigger-invocation-id indica que a chamada veio do agendador.
 */
export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST" || !req.headers.get("x-neon-trigger-invocation-id"))
      return new Response("somente o agendador", { status: 403 });
    const r = await fetch(`${process.env.COLETOR_URL}/api/coletar`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: AbortSignal.timeout(90_000),
    });
    const corpo = await r.text();
    console.log(r.status, corpo.slice(0, 500));
    return new Response(corpo, { status: r.status, headers: { "content-type": "application/json" } });
  },
};
