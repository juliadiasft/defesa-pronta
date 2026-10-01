// Leitura da foto da notificação, toda no aparelho (Tesseract.js, grátis).
// A foto nunca sai do navegador. O resultado só PREENCHE o painel; quem confere é você.
(function (raiz) {
  var MESES = "(\\d{1,2})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{2,4})";

  function iso(d, m, a) {
    a = String(a).length === 2 ? "20" + a : String(a);
    d = +d; m = +m;
    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    return a + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }

  // Placa lida com erro ("GAO8SB37", "GA08B37"): pega o 1º código da linha abaixo de "Placa",
  // troca as confusões comuns e, se sobrar 1 caractere, testa tirar cada um.
  function placaTolerante(linhas) {
    var i = linhas.findIndex(function (l) { return /\bplaca\b/i.test(l); });
    if (i < 0) return "";
    var cand = (linhas[i].replace(/.*\bplaca\b\s*:?\s*/i, "") + " " + (linhas[i + 1] || "")).toUpperCase()
      .split(/\s+/).filter(function (t) { return /^[A-Z0-9\-]{7,9}$/.test(t); });
    var ok = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;
    function corrige(t) {
      var L = { "0": "O", "1": "I", "8": "B", "5": "S", "2": "Z" }, D = { O: "0", I: "1", L: "1", B: "8", S: "5", Z: "2", G: "6" };
      var a = t.split("");
      [0, 1, 2].forEach(function (k) { if (L[a[k]]) a[k] = L[a[k]]; });
      [3, 5, 6].forEach(function (k) { if (D[a[k]]) a[k] = D[a[k]]; });
      return a.join("");
    }
    function trocas(a, b) { var n = 0; for (var k = 0; k < a.length; k++) if (a[k] !== b[k]) n++; return n; }
    for (var c = 0; c < cand.length; c++) {
      var t = cand[c].replace(/-/g, "");
      var opcoes = t.length === 7 ? [t] : t.length === 8 ? t.split("").map(function (_, k) { return t.slice(0, k) + t.slice(k + 1); }) : [];
      var melhor = null, menos = 99;
      opcoes.forEach(function (op) { var p = corrige(op); if (ok.test(p) && trocas(op, p) < menos) { melhor = p; menos = trocas(op, p); } });
      if (melhor) return melhor;
    }
    return "";
  }

  // A linha só conta se a palavra vier ANTES da data (evita "até 20%" de outra linha).
  function classificar(l) {
    var antes = l.toLowerCase().split(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/)[0];
    if (/limite|prazo|apresenta|vencimento|interposi/.test(antes)) return "prazo";
    if (/expedid|expedi[çc]/.test(antes)) return "expedicao";
    if (/postag|emiss|envio|remessa/.test(antes)) return "postagem";
    if (/infra|cometimento|ocorr|data\/hora|data e hora|data\s+hora/.test(antes)) return "infracao";
    return "";
  }

  // Extrai os dados de um texto de notificação. Função pura (testável no Node).
  function extrair(texto) {
    var linhas = texto.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var r = { datas: [], faltando: [] };

    // Datas, classificadas pela palavra que aparece perto (na linha ou na de cima).
    linhas.forEach(function (l, i) {
      var re = new RegExp(MESES, "g"), m;
      var tipo = classificar(l) || classificar(linhas[i - 1] || "");
      while ((m = re.exec(l))) {
        var data = iso(m[1], m[2], m[3]);
        if (!data) continue;
        r.datas.push({ data: data, tipo: tipo, linha: l });
      }
    });
    // Descarta datas impossíveis (leitura ruim vira "2097").
    var anoAtual = new Date().getFullYear();
    r.datas = r.datas.filter(function (x) { var a = +x.data.slice(0, 4); return a >= anoAtual - 6 && a <= anoAtual + 1; });

    function primeira(tipo) { var d = r.datas.filter(function (x) { return x.tipo === tipo; })[0]; return d ? d.data : ""; }
    var tudoMin = texto.toLowerCase();
    // 2ª carta (penalidade): a "postagem" é desta carta, não da autuação. Fase = recurso à JARI.
    r.penalidade = /imposi[çc][ãa]o\s+da\s+penalidade|penalidade de multa/.test(tudoMin);
    r.fase = r.penalidade ? "jari" : "previa";
    r.semAbordagem = /280\s*(§|par[áa]grafo)?\s*3|sem abordagem|n[ãa]o abordad/.test(tudoMin);

    r.dataInfracao = primeira("infracao");
    r.dataExpedicao = primeira("expedicao") || (r.penalidade ? "" : primeira("postagem"));
    r.prazo = primeira("prazo");

    // Sem rótulo legível: pela ordem, a mais antiga é a infração e a mais nova é o prazo.
    // A data do meio só vira "emissão" na 1ª carta — e palpite nunca marca o art. 281 sozinho.
    r.palpites = [];
    var usadas = [r.dataInfracao, r.dataExpedicao, r.prazo].concat(r.penalidade ? r.datas.filter(function (x) { return x.tipo === "postagem"; }).map(function (x) { return x.data; }) : []);
    var soltas = r.datas.map(function (x) { return x.data; })
      .filter(function (d, i, a) { return a.indexOf(d) === i && usadas.indexOf(d) < 0; }).sort();
    if (!r.dataInfracao && soltas.length && (!r.dataExpedicao || soltas[0] < r.dataExpedicao)) { r.dataInfracao = soltas.shift(); r.palpites.push("data da infração"); }
    if (!r.prazo && soltas.length) { r.prazo = soltas.pop(); r.palpites.push("prazo"); }
    if (!r.dataExpedicao && soltas.length && !r.penalidade) { r.dataExpedicao = soltas[soltas.length - 1]; r.palpites.push("data de emissão"); }

    var tudo = linhas.join("\n");
    var maius = tudo.toUpperCase();

    var hora = (linhas.filter(function (l) { return /infra|hora/i.test(l); }).join(" ").match(/\b([01]\d|2[0-3])[:h]([0-5]\d)\b/) || tudo.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/));
    r.hora = hora ? hora[1] + ":" + hora[2] : "";

    var placa = maius.match(/\b([A-Z]{3})[\s\-]?(\d)([A-Z0-9])(\d{2})\b/);
    r.placa = placa ? placa[1] + placa[2] + placa[3] + placa[4] : placaTolerante(linhas);

    var ren = tudo.match(/renavam\D{0,20}(\d{9,11})/i) || tudo.match(/\b(\d{11})\b/);
    r.renavam = ren ? ren[1] : "";

    var auto = tudo.match(/auto\s*(?:de\s*infra[çc][ãa]o)?\s*(?:n[º°o.]*|:)?\s*([A-Z]{0,3}\s?\d[\dA-Z]{5,14})/i);
    r.auto = auto ? auto[1].replace(/\s/g, "") : "";

    // Código da infração: 3 ou 4 dígitos, hífen, 1 ou 2 dígitos (não confunde com CEP 00000-000).
    var cod = null;
    linhas.some(function (l) {
      var m = l.match(/(?:^|[^\d])(\d{3,4})\s?-\s?(\d{1,2})(?![\d\/])/);
      if (m && !/cep/i.test(l)) { cod = { c: m[1] + "-" + m[2], l: l }; return true; }
      return false;
    });
    // DER-SP: "Código da Infração" na linha de cima e "676 9" (sem hífen) na de baixo.
    if (!cod) linhas.some(function (l, i) {
      if (!/c[óo]digo\s+da\s+infra/i.test(l)) return false;
      // Na linha de baixo, o 1º número de 3-4 dígitos seguido de 1 dígito: "676 9".
      var m = (linhas[i + 1] || "").match(/(?:^|[^\d])(\d{3,4})\s?-?\s?(\d)(?!\d)/);
      if (m) { cod = { c: m[1] + "-" + m[2], l: "" }; return true; }
      return false;
    });
    var descLinha = linhas.findIndex(function (l) { return /descri[çc][ãa]o\s+da\s+infra/i.test(l); });
    if (cod && !cod.l && descLinha >= 0) {
      var dl = linhas[descLinha].replace(/.*descri[çc][ãa]o\s+da\s+infra[çc][ãa]o\s*:?\s*/i, "");
      cod.l = cod.c + " " + (dl.length > 3 ? dl : (linhas[descLinha + 1] || ""));
    }
    if (cod) {
      var desc = cod.l.slice(cod.l.indexOf(cod.c.split("-")[0])).replace(/^\d{3,4}\s?-?\s?\d{1,2}\s*[-–:]?\s*/, "");
      r.infracao = cod.c + (desc ? " – " + desc : "");
    } else r.infracao = "";

    // Nº do auto: rótulo na mesma linha ou formato típico ("1DL550079-2").
    if (!/\d{5}/.test(auto ? auto[1] : "")) {
      var a2 = maius.match(/\b(\d?[A-Z]{1,3}\d{6,9}-?\d?)\b/);
      r.auto = a2 ? a2[1] : "";
    }

    var orgRe = /^(DEPARTAMENTO|DETRAN|DER\b|PREFEITURA|POL[IÍ]CIA|DNIT|AG[ÊE]NCIA|SECRETARIA|EMDEC|CET\b|SETRAN|DEMUTRAN)/i;
    var org = linhas.filter(function (l) { return orgRe.test(l); })[0] ||
      linhas.filter(function (l) { return /\b(DER|DETRAN|PRF|DNIT|PREFEITURA|EMDEC|CET|SETRAN|DEMUTRAN)\b/.test(l) && l.length < 70; })[0];
    r.orgao = org ? org.replace(/\s+\d[\d.]*\s.*$/, "").trim() : "";

    function depois(re) {
      for (var i = 0; i < linhas.length; i++) {
        var m = linhas[i].match(re);
        if (m) {
          var resto = linhas[i].slice(m.index + m[0].length).replace(/^[\s:.\-]+/, "");
          // Linha de rótulos (tabela): o valor está na linha de baixo.
          var soRotulo = /rodovia|\bkm\b|sentido|munic[íi]pio|esp[ée]cie|\buf\b/i.test(resto);
          return resto.length > 3 && !soRotulo ? resto : (linhas[i + 1] || "");
        }
      }
      return "";
    }
    r.local = depois(/local\s*(da\s*infra[çc][ãa]o)?/i);
    r.modelo = depois(/marca\s*(\/|e)?\s*modelo|marca/i);
    r.nome = "";

    r.radar = /velocidade|radar|medidor|km\/h/i.test(tudo) || /^74[5-7]/.test(r.infracao);

    if (!r.placa) r.faltando.push("placa");
    if (!r.dataInfracao) r.faltando.push("data da infração");
    if (!r.hora) r.faltando.push("hora");
    if (!r.local) r.faltando.push("local");
    if (!r.infracao) r.faltando.push("código da infração");
    if (!r.orgao) r.faltando.push("órgão autuador");
    return r;
  }

  function dias(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
  function br(isoData) { var p = isoData.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }

  raiz.DPLeitura = { extrair: extrair, dias: dias };
  if (typeof document === "undefined") return;

  // ---------- Navegador ----------
  var input = document.getElementById("foto");
  var status = document.getElementById("leituraStatus");
  var saida = document.getElementById("leituraResultado");
  var f = document.getElementById("f");
  if (!input) return;

  function setCampo(nome, valor) {
    if (!valor) return false;
    var el = f.elements[nome];
    if (!el) return false;
    if (el.type === "checkbox") el.checked = true; else el.value = valor;
    return true;
  }
  function avisar() { f.dispatchEvent(new Event("input")); }

  // Reduz e deixa em tons de cinza: lê mais rápido e melhor.
  function preparar(arquivo) {
    return new Promise(function (ok, erro) {
      var img = new Image();
      img.onload = function () {
        var max = 2800, k = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var g = c.getContext("2d");
        g.filter = "grayscale(1) contrast(1.3)";
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        ok(c);
      };
      img.onerror = erro;
      img.src = URL.createObjectURL(arquivo);
    });
  }

  input.addEventListener("change", async function () {
    var arq = input.files && input.files[0];
    if (!arq) return;
    saida.innerHTML = "";
    if (!window.Tesseract) { status.textContent = "O leitor ainda está carregando. Tente de novo em alguns segundos."; return; }
    status.textContent = "Preparando a foto…";
    try {
      var canvas = await preparar(arq);
      var res = await Tesseract.recognize(canvas, "por", {
        logger: function (m) {
          if (m.status === "recognizing text") status.textContent = "Lendo a notificação… " + Math.round(m.progress * 100) + "%";
          else if (/load|initializ/.test(m.status)) status.textContent = "Carregando o leitor (só demora na 1ª vez)…";
        },
      });
      input.value = ""; // descarta a foto
      mostrar(extrair(res.data.text), res.data.text);
    } catch (e) {
      status.textContent = "Não consegui ler esta foto. Tente uma foto mais reta, com boa luz e sem sombra.";
    }
  });

  function mostrar(r, textoBruto) {
    var preenchidos = [];
    [["placa", "placa"], ["renavam", "RENAVAM"], ["auto", "nº do auto"], ["orgao", "órgão"], ["dataInfracao", "data da infração"],
     ["hora", "hora"], ["dataExpedicao", "data de expedição"], ["prazo", "prazo"], ["local", "local"], ["infracao", "infração"], ["modelo", "marca/modelo"]]
      .forEach(function (p) { if (setCampo(p[0], r[p[0]])) preenchidos.push(p[1]); });

    var achados = [];
    if (r.dataInfracao && r.dataExpedicao) {
      var d = dias(r.dataInfracao, r.dataExpedicao);
      if (d > 30 && r.palpites.indexOf("data de emissão") >= 0) achados.push("As datas sugerem " + d + " dias entre infração e emissão, mas foi dedução minha. Confira na carta antes de marcar o art. 281.");
      else if (d > 30) { setCampo("a_prazo30", true); achados.push("⚠️ Notificação expedida " + d + " dias depois da infração (art. 281): ponto forte de defesa."); }
      else achados.push("Prazo de 30 dias respeitado (" + d + " dias).");
    } else if (!r.dataInfracao) achados.push("Não achei a data da infração: toque nela na lista de datas abaixo.");
    else achados.push("Não achei a data de emissão/postagem: toque nela na lista de datas abaixo.");
    if (r.palpites.length) achados.push("Pela ordem das datas, deduzi: " + r.palpites.join(", ") + ". Confira — se estiver trocado, toque no botão certo abaixo.");
    if (r.penalidade) {
      f.elements.fase.value = "jari";
      achados.push("Esta é a 2ª carta (imposição da penalidade): escolhi a fase “Recurso à JARI”. A data de expedição que vale é a da notificação de AUTUAÇÃO (a 1ª carta), não a da postagem desta.");
    }
    if (r.semAbordagem) { setCampo("a_semAbordagem", true); achados.push("Autuação sem abordagem (art. 280, §3º): marquei o argumento."); }
    achados.push("Pergunte ao cliente: teve outra multa nos últimos 12 meses? Se NÃO e a infração for leve ou média, marque a advertência por escrito (art. 267) — costuma ser o ponto mais forte.");
    if (r.radar) { setCampo("a_radar", true); achados.push("Infração de radar: marquei o pedido de prova da aferição do Inmetro."); }
    if (r.faltando.length) {
      achados.push("Não encontrei: " + r.faltando.join(", ") + ". Confira na foto. Se faltar de verdade na notificação, marque “Falta ou erro em dado obrigatório” (art. 280).");
    }
    avisar();

    var h = "<div class='cartao' style='margin-top:10px'>";
    h += "<b>Análise automática</b><ul style='margin:8px 0 0;padding-left:18px'>";
    achados.forEach(function (a) { h += "<li style='margin-bottom:6px'>" + a + "</li>"; });
    h += "</ul>";
    if (preenchidos.length) h += "<p class='mini' style='text-align:left'>Preenchi: " + preenchidos.join(", ") + ". <b>Confira cada campo antes de enviar.</b></p>";

    if (r.datas.length) {
      h += "<p class='mini' style='text-align:left;margin-top:10px'>Datas encontradas (toque para usar):</p>";
      r.datas.forEach(function (x, i) {
        h += "<div style='margin:4px 0;font-size:14px'><b>" + br(x.data) + "</b> ";
        [["dataInfracao", "infração"], ["dataExpedicao", "expedição"], ["prazo", "prazo"]].forEach(function (c) {
          h += "<button type='button' data-data='" + x.data + "' data-campo='" + c[0] + "' style='font-size:12px;margin:2px;padding:4px 8px;border-radius:6px;border:1px solid #ccc;background:#fff'>" + c[1] + "</button>";
        });
        h += "</div>";
      });
    }
    h += "<details style='margin-top:10px'><summary class='mini' style='text-align:left'>Ver o texto lido</summary><pre style='white-space:pre-wrap;font-size:12px'>" +
      textoBruto.replace(/[<>&]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]; }) + "</pre></details>";
    h += "</div>";
    saida.innerHTML = h;
    status.textContent = "Pronto. A foto foi descartada.";

    saida.querySelectorAll("button[data-data]").forEach(function (b) {
      b.onclick = function () {
        f.elements[b.dataset.campo].value = b.dataset.data;
        var a = f.elements.dataInfracao.value, e = f.elements.dataExpedicao.value;
        if (a && e) f.elements.a_prazo30.checked = dias(a, e) > 30;
        avisar();
        b.textContent = "✓ " + b.textContent;
      };
    });
  }

  // Limpar cliente também apaga a leitura.
  var limpar = document.getElementById("limpar");
  if (limpar) limpar.addEventListener("click", function () { setTimeout(function () { if (!f.elements.placa.value) { saida.innerHTML = ""; status.textContent = ""; } }, 50); });
})(typeof window !== "undefined" ? window : globalThis);
