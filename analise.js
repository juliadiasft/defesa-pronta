(function () {
  var C = window.DP || {}, D = window.DPDefesa;
  var API = (C.api || "").replace(/\/$/, "");
  var estado = { fotos: [], fatos: null, respostas: {}, resultado: null };
  var $ = function (id) { return document.getElementById(id); };
  var esc = D.esc, br = D.br;

  function ir(etapa) {
    document.querySelectorAll(".etapa").forEach(function (s) { s.hidden = s.id !== "e-" + etapa; });
    window.scrollTo(0, 0);
  }
  function whats(t) { return "https://wa.me/" + (C.whatsapp || "") + "?text=" + encodeURIComponent(t); }
  document.querySelectorAll("[data-whats]").forEach(function (a) { a.href = whats("Olá! Preciso de ajuda com a minha análise da Defesa Pronta."); a.target = "_blank"; });
  document.querySelectorAll("[data-preco]").forEach(function (s) { s.textContent = C.preco || "37,90"; });
  $("precoA").textContent = C.precoAcompanhamento || "97";
  $("btnAcomp").href = C.checkoutAcompanhamento || whats("Quero o acompanhamento até a 2ª instância.");

  // ---------- 1. Fotos (reduzidas no aparelho) ----------
  function reduzir(arq) {
    return new Promise(function (ok, erro) {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1800 / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        ok(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = function () { erro(new Error("foto")); };
      img.src = URL.createObjectURL(arq);
    });
  }
  $("fotoIn").addEventListener("change", async function (e) {
    $("erroFoto").textContent = "";
    var arqs = Array.prototype.slice.call(e.target.files || []);
    for (var i = 0; i < arqs.length && estado.fotos.length < 3; i++) {
      try { estado.fotos.push(await reduzir(arqs[i])); } catch (x) { $("erroFoto").textContent = "Não consegui abrir uma das fotos."; }
    }
    e.target.value = "";
    $("miniaturas").innerHTML = estado.fotos.map(function (f) { return '<img src="' + f + '" alt="">'; }).join("");
    $("btnAnalisar").hidden = !estado.fotos.length;
  });

  // ---------- 2. Leitura ----------
  $("btnAnalisar").onclick = async function () {
    if (!API) { $("erroFoto").innerHTML = 'A análise automática está em manutenção. <a href="' + whats("Olá! Quero a análise grátis da minha multa. Vou mandar a foto 👇") + '" target="_blank">Mande a foto no WhatsApp</a>.'; return; }
    ir("lendo");
    try {
      var r = await fetch(API + "/api/analisar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fotos: estado.fotos }) });
      var j = await r.json();
      if (!r.ok || !j.fatos) throw new Error(j.erro || "falha");
      estado.fatos = j.fatos;
      estado.fotos = []; // descarta as fotos
      if (j.fatos.legivel === false) { ir("foto"); $("miniaturas").innerHTML = ""; $("btnAnalisar").hidden = true; $("erroFoto").textContent = "A foto ficou difícil de ler. Tire outra, com a carta reta, inteira e com boa luz."; return; }
      if (j.fatos.tipoCarta === "outro") { ir("foto"); $("erroFoto").textContent = "Esta foto não parece uma notificação de multa. Confira e tente de novo."; return; }
      mostrarLidos(false);
      $("perguntaCondutor").hidden = j.fatos.tipoCarta !== "autuacao";
      ir("confira");
    } catch (e) {
      ir("foto");
      $("erroFoto").textContent = e.message && e.message !== "falha" ? e.message : "Não consegui analisar agora. Tente de novo em instantes.";
    }
  };

  // ---------- 3. Confira ----------
  var CAMPOS = [
    ["tipoCarta", "Tipo de carta"], ["codigoInfracao", "Código"], ["descricaoInfracao", "Infração"], ["dataInfracao", "Data da infração", "data"],
    ["hora", "Hora"], ["placa", "Placa"], ["orgao", "Órgão"], ["dataExpedicaoAutuacao", "Notificação da autuação expedida em", "data"],
    ["prazo", "Prazo", "data"], ["valor", "Valor (R$)"],
  ];
  function rotTipo(v) { return v === "penalidade" ? "Multa aplicada (recurso à JARI)" : v === "autuacao" ? "1ª notificação (defesa prévia)" : v; }
  function mostrarLidos(editar) {
    var f = estado.fatos;
    $("lidos").innerHTML = CAMPOS.map(function (c) {
      var v = f[c[0]] || "";
      if (c[0] === "tipoCarta") return '<div class="lido"><span>' + c[1] + "</span><b>" + esc(rotTipo(v)) + "</b></div>";
      if (editar) return '<div class="lido"><span>' + c[1] + '</span><input data-campo="' + c[0] + '" type="' + (c[2] === "data" ? "date" : "text") + '" value="' + esc(v) + '"></div>';
      return '<div class="lido"><span>' + c[1] + "</span><b>" + (v ? esc(c[2] === "data" ? br(v) : v) : "<span style='color:#999'>não consta</span>") + "</b></div>";
    }).join("");
    $("btnCorrigir").textContent = editar ? "✔️ salvar correções" : "✏️ corrigir";
  }
  var editando = false;
  $("btnCorrigir").onclick = function () {
    if (editando) $("lidos").querySelectorAll("input[data-campo]").forEach(function (i) { estado.fatos[i.dataset.campo] = i.value.trim(); });
    editando = !editando; mostrarLidos(editando);
  };
  document.querySelectorAll(".opcoes").forEach(function (g) {
    g.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      g.querySelectorAll("button").forEach(function (x) { x.classList.toggle("sel", x === b); });
      estado.respostas[g.dataset.resp] = b.dataset.v;
    });
  });

  // ---------- 4. Resultado ----------
  $("btnResultado").onclick = function () {
    if (editando) $("btnCorrigir").click();
    if (!estado.respostas.outraMulta12m) { $("erroConfira").textContent = "Responda se teve outra multa nos últimos 12 meses."; return; }
    if (estado.fatos.tipoCarta === "autuacao" && !estado.respostas.outroCondutor) { $("erroConfira").textContent = "Responda quem estava dirigindo."; return; }
    $("erroConfira").textContent = "";
    var r = D.regras(estado.fatos, estado.respostas);
    estado.resultado = r;
    var h = '<div class="veredito ' + r.veredito.nivel + '"><h2>' + esc(r.veredito.titulo) + "</h2>" + esc(r.veredito.texto) + "</div>";
    r.avisos.forEach(function (a) { h += '<p class="aviso">' + esc(a) + "</p>"; });
    if (r.pontos.length) {
      h += "<h2 style='font-size:20px;margin-top:18px'>Os pontos da sua defesa</h2>";
      r.pontos.forEach(function (p) {
        var a = D.POR_ID[p.id];
        h += '<div class="ponto' + (p.forca === "forte" ? " forte" : "") + '"><b>' + (p.forca === "forte" ? "Ponto forte" : "Ponto moderado") + "</b><span>" + esc(a.curto(r.dados, p.x || "")) + "</span></div>";
      });
    }
    r.extras.forEach(function (x) { h += '<p class="ajuda">' + esc(x) + "</p>"; });
    if (r.vale) {
      h += '<div class="cartao" style="margin-top:14px"><b>O que você recebe por R$ ' + esc(C.preco || "37,90") + "</b>";
      h += '<ul class="lista" style="margin-top:8px"><li>' + (r.dados.fase === "jari" ? "Recurso à JARI" : "Defesa prévia") + " escrito com os pontos acima e os artigos do Código de Trânsito</li><li>Já com os dados da sua carta e os seus, pronto para assinar</li><li>Em PDF, na hora, nesta tela</li><li>Passo a passo para protocolar até " + (r.dados.prazo ? br(r.dados.prazo) : "o prazo") + "</li></ul>";
      h += '<button class="btn btn-verde" id="btnQuero" style="margin-top:12px">Quero minha defesa pronta</button>';
      h += '<p class="mini">Ninguém pode garantir o cancelamento: quem decide é o órgão de trânsito.</p></div>';
    } else {
      h += '<a class="btn btn-claro" style="margin-top:14px" target="_blank" rel="noopener" href="' + whats("Olá! Fiz a análise da minha multa e fiquei com uma dúvida.") + '">Tirar uma dúvida no WhatsApp</a>';
    }
    h += '<button class="voltar" id="btnOutra">↺ Analisar outra multa</button>';
    $("resultado").innerHTML = h;
    ir("resultado");
    $("btnOutra").onclick = function () { location.href = "analise.html"; };
    if ($("btnQuero")) $("btnQuero").onclick = function () { ir("dados"); };
  };

  // ---------- 5. Dados + pedido ----------
  $("fDados").addEventListener("submit", async function (e) {
    e.preventDefault();
    var fd = new FormData(e.target), cli = {};
    fd.forEach(function (v, k) { cli[k] = String(v).trim(); });
    $("erroDados").textContent = "";
    var btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      var r = await fetch(API + "/api/pedido", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fatos: estado.fatos, respostas: estado.respostas, pontos: estado.resultado.pontos, cliente: cli }) });
      var j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Não consegui registrar o pedido.");
      var ped = { id: j.id, chave: j.chave };
      try { localStorage.setItem("dp_pedido", JSON.stringify(ped)); } catch (x) {}
      history.replaceState(null, "", "analise.html?id=" + ped.id + "&k=" + ped.chave);
      var pag = C.checkout + (C.checkout.indexOf("?") < 0 ? "?" : "&") + "email=" + encodeURIComponent(cli.email);
      $("btnAbrirPagamento").href = pag;
      window.open(pag, "_blank");
      aguardar(ped);
    } catch (x) {
      $("erroDados").textContent = x.message;
    } finally { btn.disabled = false; }
  });

  // ---------- 6. Aguardando / 7. Defesa ----------
  var timer = null;
  function aguardar(ped) {
    ir("aguardando");
    clearInterval(timer);
    var checar = async function () {
      try {
        var r = await fetch(API + "/api/pedido?id=" + encodeURIComponent(ped.id) + "&k=" + encodeURIComponent(ped.chave));
        var j = await r.json();
        if (j.status === "pago" && j.pedido) { clearInterval(timer); mostrarDefesa(j.pedido); }
        else if (!r.ok) { clearInterval(timer); ir("foto"); $("erroFoto").textContent = j.erro || "Pedido não encontrado."; }
      } catch (x) {}
    };
    checar(); timer = setInterval(checar, 5000);
  }
  function mostrarDefesa(p) {
    var d = D.paraDados(p.fatos), cli = p.cliente;
    ["nome", "cpf", "cnh", "endereco", "cidade", "qualidade"].forEach(function (k) { d[k] = cli[k]; });
    var marcados = p.pontos.map(function (x) { return { a: D.POR_ID[x.id], x: x.x || "" }; }).filter(function (m) { return m.a; });
    $("documento").innerHTML = D.documento(d, marcados);
    document.title = "Defesa " + D.up(d.placa) + " " + (cli.nome || "").split(" ")[0];
    ir("defesa");
  }
  $("btnPdf").onclick = function () { window.print(); };

  // Link salvo (?id=&k=) ou volta da página de obrigado.
  var q = new URLSearchParams(location.search);
  if (q.get("id") && q.get("k") && API) aguardar({ id: q.get("id"), chave: q.get("k") });
})();
