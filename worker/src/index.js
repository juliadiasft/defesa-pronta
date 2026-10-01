// Servidor da Defesa Pronta (Cloudflare Worker, plano grátis).
// - /api/analisar : manda a(s) foto(s) para o Gemini e devolve só os FATOS lidos. A foto não é guardada.
// - /api/pedido   : guarda o pedido (dados para a defesa) até o pagamento.
// - /api/cakto    : webhook da Cakto: marca o pedido como pago.
// - /api/admin/*  : lista de pedidos para a Julia (token).

const ORIGENS = ["https://juliadiasft.github.io", "http://localhost:4321"];
const DIA = 86400;

function cors(req) {
  const o = req.headers.get("origin") || "";
  return {
    "access-control-allow-origin": ORIGENS.includes(o) ? o : ORIGENS[0],
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    vary: "origin",
  };
}
function json(req, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...cors(req) } });
}
function rid(n = 12) {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => a[x % a.length]).join("");
}
function iguais(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------- Leitura pela IA: só transcrever, nunca opinar ----------
const PROMPT = `Você recebe a(s) foto(s) de uma notificação de multa de trânsito do Brasil.
TRANSCREVA apenas o que está escrito. Não deduza, não opine, não invente. Campo que não aparece ou não dá para ler: string vazia "" (ou false).
Datas no formato AAAA-MM-DD. Hora HH:MM.
- tipoCarta: "autuacao" se for a 1ª carta (Notificação de Autuação, com prazo para defesa prévia/indicação de condutor); "penalidade" se for a Notificação de Imposição de Penalidade (multa com valor e prazo para recurso à JARI); "outro" se não for nenhuma das duas.
- dataExpedicaoAutuacao: a data em que a NOTIFICAÇÃO DE AUTUAÇÃO foi expedida. Na carta de autuação, é a data de expedição/emissão/postagem dessa carta. Na carta de penalidade, preencha SOMENTE se estiver escrito explicitamente "Notificação de Autuação ... expedida em DATA"; a data de postagem da carta de penalidade NÃO é esta data.
- prazo: a data limite para defesa prévia (na autuação) ou para recurso/interposição de recurso (na penalidade).
- valor: valor integral da multa como está escrito (ex.: "130,16").
- semAbordagem: true se o texto disser que o condutor/veículo não foi abordado, ou citar o art. 280 § 3º (ou "280 3"). justificativaSemAbordagem: o motivo escrito para não abordar, se houver.
- radar: true se a infração foi registrada por equipamento medidor de velocidade. velocidadePermitida, velocidadeMedida, velocidadeConsiderada: como escritas.
- camposObrigatoriosAusentes: liste APENAS itens desta lista que estão em branco/ausentes no auto: "placa", "marca/modelo do veículo", "local da infração", "data da infração", "hora da infração", "código ou descrição da infração", "órgão autuador", "identificação do agente ou do equipamento". Nunca liste dados do condutor (nome, CNH, CPF), pois não são obrigatórios. Se estiver tudo presente, lista vazia.
- legivel: false se a foto estiver ilegível demais para ler os campos principais.`;

const SCHEMA = {
  type: "OBJECT",
  properties: Object.fromEntries(
    ["tipoCarta", "orgao", "uf", "auto", "placa", "marcaModelo", "renavam", "dataInfracao", "hora", "local", "municipio",
      "codigoInfracao", "descricaoInfracao", "artigoCTB", "valor", "dataExpedicaoAutuacao", "dataPostagem", "prazo",
      "justificativaSemAbordagem", "velocidadePermitida", "velocidadeMedida", "velocidadeConsiderada", "observacoes"]
      .map((k) => [k, { type: "STRING" }])
      .concat([["semAbordagem", { type: "BOOLEAN" }], ["radar", { type: "BOOLEAN" }], ["legivel", { type: "BOOLEAN" }],
        ["camposObrigatoriosAusentes", { type: "ARRAY", items: { type: "STRING" } }]]),
  ),
  required: ["tipoCarta", "legivel", "camposObrigatoriosAusentes"],
};

async function analisar(req, env) {
  // Limite simples por IP para proteger a cota grátis.
  const ip = req.headers.get("cf-connecting-ip") || "x";
  const chaveIp = "ip:" + ip + ":" + new Date().toISOString().slice(0, 10);
  const usos = parseInt((await env.PEDIDOS.get(chaveIp)) || "0", 10);
  if (usos >= 15) return json(req, { erro: "Limite de análises de hoje atingido. Tente amanhã ou chame no WhatsApp." }, 429);

  const corpo = await req.json().catch(() => null);
  const fotos = (corpo && corpo.fotos) || [];
  if (!fotos.length || fotos.length > 3) return json(req, { erro: "Envie de 1 a 3 fotos." }, 400);
  const parts = [];
  for (const f of fotos) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(f || "");
    if (!m || m[2].length > 6_000_000) return json(req, { erro: "Foto inválida ou grande demais." }, 400);
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  parts.push({ text: PROMPT });

  // Camada grátis às vezes fica cheia (503/429): tenta o próximo modelo da lista.
  const modelos = (env.MODELO || "gemini-3.6-flash").split(",").map((m) => m.trim()).filter(Boolean);
  const base = env.GEMINI_URL || "https://generativelanguage.googleapis.com/v1beta/models/";
  const corpoIA = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
  });
  let r = null;
  for (const modelo of modelos) {
    r = await fetch(`${base}${modelo}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": (env.GEMINI_KEY || "").trim() },
      body: corpoIA,
    });
    if (r.ok) break;
    console.error("gemini " + modelo + " " + r.status + " " + (await r.text()).slice(0, 300));
    if (r.status !== 503 && r.status !== 429 && r.status !== 500 && r.status !== 404) break;
  }
  await env.PEDIDOS.put(chaveIp, String(usos + 1), { expirationTtl: 2 * DIA });
  if (!r || !r.ok) return json(req, { erro: "A leitura está congestionada agora. Tente de novo em 1 minuto." }, 502);
  const g = await r.json();
  const txt = g?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  let fatos;
  try { fatos = JSON.parse(txt); } catch { return json(req, { erro: "Não consegui ler a carta. Tente uma foto mais nítida." }, 502); }
  return json(req, { fatos });
}

// ---------- Pedidos ----------
async function criarPedido(req, env) {
  const c = await req.json().catch(() => null);
  if (!c || !c.fatos || !c.cliente) return json(req, { erro: "Pedido incompleto." }, 400);
  const cli = c.cliente;
  const email = String(cli.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(req, { erro: "E-mail inválido." }, 400);
  for (const k of ["nome", "cpf", "endereco"]) if (!String(cli[k] || "").trim()) return json(req, { erro: "Preencha nome, CPF e endereço." }, 400);
  const id = rid(10), chave = rid(16);
  const pedido = {
    id, chave, status: "aguardando", criadoEm: new Date().toISOString(),
    fatos: c.fatos, respostas: c.respostas || {}, pontos: (c.pontos || []).slice(0, 12),
    cliente: { nome: cli.nome, cpf: cli.cpf, cnh: cli.cnh || "", endereco: cli.endereco, cidade: cli.cidade || "", email, whatsapp: cli.whatsapp || "", qualidade: cli.qualidade || "" },
  };
  // Dados pessoais ficam no máximo 60 dias (LGPD).
  await env.PEDIDOS.put("p:" + id, JSON.stringify(pedido), { expirationTtl: 60 * DIA });
  await env.PEDIDOS.put("e:" + email, id, { expirationTtl: 60 * DIA });
  return json(req, { id, chave });
}

async function verPedido(req, env, url) {
  const id = url.searchParams.get("id") || "", k = url.searchParams.get("k") || "";
  const raw = await env.PEDIDOS.get("p:" + id);
  if (!raw) return json(req, { erro: "Pedido não encontrado." }, 404);
  const p = JSON.parse(raw);
  if (!iguais(p.chave, k)) return json(req, { erro: "Link inválido." }, 403);
  if (p.status !== "pago") return json(req, { status: p.status });
  const { chave, ...resto } = p;
  return json(req, { status: "pago", pedido: resto });
}

// ---------- Webhook da Cakto ----------
async function cakto(req, env) {
  const body = await req.text();
  if (body.length > 1_000_000) return new Response("grande", { status: 413 });
  let payload;
  try { payload = JSON.parse(body); } catch { return new Response("json", { status: 400 }); }
  if (!env.CAKTO_SECRET || !iguais(String(payload.secret || ""), env.CAKTO_SECRET)) return new Response("unauthorized", { status: 401 });
  const ev = String(payload.event || "");
  const data = payload.data || {};
  const email = String((data.customer && data.customer.email) || "").trim().toLowerCase();
  // Só o produto da defesa (o acompanhamento de R$97 é tratado à mão).
  if (env.PRODUTO_ID && !body.includes(env.PRODUTO_ID)) return new Response("outro produto");
  const novo = ev === "purchase_approved" ? "pago" : ev === "refund" || ev === "chargeback" ? "estornado" : null;
  if (!novo || !email) return new Response("ignorado");
  const id = await env.PEDIDOS.get("e:" + email);
  if (!id) {
    // Pagou sem pedido (ou com outro e-mail): registra para a Julia resolver no painel.
    await env.PEDIDOS.put("orfao:" + Date.now(), JSON.stringify({ email, ev, em: new Date().toISOString() }), { expirationTtl: 60 * DIA });
    return new Response("sem pedido");
  }
  const raw = await env.PEDIDOS.get("p:" + id);
  if (!raw) return new Response("expirado");
  const p = JSON.parse(raw);
  p.status = novo; p[novo + "Em"] = new Date().toISOString();
  await env.PEDIDOS.put("p:" + id, JSON.stringify(p), { expirationTtl: 60 * DIA });
  return new Response("ok");
}

// ---------- Admin ----------
function admin(req, env) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return env.ADMIN_TOKEN && iguais(t, env.ADMIN_TOKEN);
}
async function listar(req, env) {
  if (!admin(req, env)) return json(req, { erro: "não autorizado" }, 401);
  const lista = await env.PEDIDOS.list({ prefix: "p:", limit: 200 });
  const pedidos = [];
  for (const k of lista.keys) {
    const raw = await env.PEDIDOS.get(k.name);
    if (!raw) continue;
    const p = JSON.parse(raw);
    pedidos.push({ id: p.id, chave: p.chave, status: p.status, criadoEm: p.criadoEm, nome: p.cliente.nome, email: p.cliente.email, whatsapp: p.cliente.whatsapp,
      placa: p.fatos.placa, prazo: p.fatos.prazo, pontos: p.pontos.map((x) => x.id) });
  }
  const orf = await env.PEDIDOS.list({ prefix: "orfao:", limit: 50 });
  const orfaos = [];
  for (const k of orf.keys) { const raw = await env.PEDIDOS.get(k.name); if (raw) orfaos.push(JSON.parse(raw)); }
  pedidos.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
  return json(req, { pedidos, orfaos });
}
async function liberar(req, env) {
  if (!admin(req, env)) return json(req, { erro: "não autorizado" }, 401);
  const { id } = (await req.json().catch(() => ({}))) || {};
  const raw = await env.PEDIDOS.get("p:" + id);
  if (!raw) return json(req, { erro: "não achei" }, 404);
  const p = JSON.parse(raw);
  p.status = "pago"; p.pagoEm = new Date().toISOString(); p.liberadoManual = true;
  await env.PEDIDOS.put("p:" + id, JSON.stringify(p), { expirationTtl: 60 * DIA });
  return json(req, { ok: true });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
    try {
      if (url.pathname === "/api/analisar" && req.method === "POST") return await analisar(req, env);
      if (url.pathname === "/api/pedido" && req.method === "POST") return await criarPedido(req, env);
      if (url.pathname === "/api/pedido" && req.method === "GET") return await verPedido(req, env, url);
      if (url.pathname === "/api/cakto" && req.method === "POST") return await cakto(req, env);
      if (url.pathname === "/api/admin/pedidos" && req.method === "GET") return await listar(req, env);
      if (url.pathname === "/api/admin/liberar" && req.method === "POST") return await liberar(req, env);
      if (url.pathname === "/api/saude") return json(req, { ok: true, ia: !!env.GEMINI_KEY, cakto: !!env.CAKTO_SECRET, admin: !!env.ADMIN_TOKEN });
      return json(req, { erro: "não encontrado" }, 404);
    } catch (e) {
      console.error(e);
      return json(req, { erro: "Erro interno." }, 500);
    }
  },
};
