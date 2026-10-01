// Servidor local só para testar: node defesa-pronta/serve.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const tipos = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
const porta = Number(process.env.PORT || 4321);
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(join(dir, p.replace(/\.\./g, "")));
    res.writeHead(200, { "content-type": tipos[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("404"); }
}).listen(porta, () => console.log("http://localhost:" + porta));
