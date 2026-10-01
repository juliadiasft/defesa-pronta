// Lista de pedidos do site, para a Julia. A senha (token) fica só neste aparelho.
(function () {
  var C = window.DP || {}, API = (C.api || "").replace(/\/$/, "");
  var lista = document.getElementById("pedidosLista"), btn = document.getElementById("pedidosAtualizar");
  if (!lista) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function br(iso) { if (!iso) return "—"; var p = String(iso).slice(0, 10).split("-"); return p[2] + "/" + p[1]; }
  function token() {
    var t = null;
    try { t = localStorage.getItem("dp_admin"); } catch (e) {}
    if (!t) { t = prompt("Senha do painel (a que você criou no servidor):"); if (t) try { localStorage.setItem("dp_admin", t); } catch (e) {} }
    return t;
  }
  var ROT = { aguardando: "⏳ aguardando pagamento", pago: "✅ pago", estornado: "↩️ estornado" };

  async function atualizar() {
    if (!API) { lista.textContent = "O servidor ainda não foi configurado (config.js → api)."; return; }
    var t = token(); if (!t) return;
    lista.textContent = "Carregando…";
    try {
      var r = await fetch(API + "/api/admin/pedidos", { headers: { authorization: "Bearer " + t } });
      if (r.status === 401) { try { localStorage.removeItem("dp_admin"); } catch (e) {} lista.textContent = "Senha errada. Toque em atualizar e digite de novo."; return; }
      var j = await r.json();
      var h = "";
      if (!j.pedidos.length) h = "Nenhum pedido ainda.";
      j.pedidos.forEach(function (p) {
        var zap = (p.whatsapp || "").replace(/\D/g, "");
        if (zap && zap.length <= 11) zap = "55" + zap;
        h += "<div class='cartao' style='margin:8px 0;padding:12px'><b>" + esc(p.nome) + "</b> · " + (ROT[p.status] || esc(p.status)) +
          "<br>Placa " + esc(p.placa || "—") + " · prazo " + br(p.prazo) + " · pedido " + br(p.criadoEm) +
          "<br><span style='color:#5b6573'>" + esc(p.email) + "</span><div style='margin-top:8px;display:flex;gap:6px;flex-wrap:wrap'>" +
          (zap ? "<a class='btn btn-verde' style='padding:8px 12px;font-size:14px;width:auto' target='_blank' href='https://wa.me/" + zap + "'>WhatsApp</a>" : "") +
          "<a class='btn btn-claro' style='padding:8px 12px;font-size:14px;width:auto' target='_blank' href='analise.html?id=" + p.id + "&k=" + p.chave + "'>Ver defesa</a>" +
          (p.status === "aguardando" ? "<button class='btn btn-claro' style='padding:8px 12px;font-size:14px;width:auto' data-liberar='" + p.id + "'>Liberar (recebi Pix)</button>" : "") +
          "</div></div>";
      });
      if (j.orfaos && j.orfaos.length) {
        h += "<p><b>Pagamentos sem pedido</b> (pagou com outro e-mail ou sem fazer a análise):</p>";
        j.orfaos.forEach(function (o) { h += "<div>" + esc(o.email) + " · " + br(o.em) + "</div>"; });
      }
      lista.innerHTML = h;
      lista.querySelectorAll("[data-liberar]").forEach(function (b) {
        b.onclick = async function () {
          if (!confirm("Liberar a defesa deste pedido? Faça isso só se você recebeu o pagamento.")) return;
          await fetch(API + "/api/admin/liberar", { method: "POST", headers: { authorization: "Bearer " + token(), "content-type": "application/json" }, body: JSON.stringify({ id: b.dataset.liberar }) });
          atualizar();
        };
      });
    } catch (e) { lista.textContent = "Não consegui carregar os pedidos."; }
  }
  btn.onclick = atualizar;
})();
