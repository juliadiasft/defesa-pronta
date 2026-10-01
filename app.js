(function () {
  var C = window.DP || {};

  var PERGUNTAS = [
    {
      id: "infracao",
      q: "Sua multa foi de quê?",
      ajuda: "Não sabe? Escolha \"Outra\".",
      op: [
        ["radar", "Velocidade (radar)"],
        ["sinal", "Sinal vermelho"],
        ["estacionar", "Estacionamento"],
        ["celular", "Celular ao volante"],
        ["cinto", "Cinto ou capacete"],
        ["leiseca", "Lei Seca"],
        ["outra", "Outra"],
      ],
    },
    {
      id: "pontos",
      q: "Quantos pontos a multa dá?",
      ajuda: "Está escrito na carta, perto do código da infração.",
      op: [
        ["leve", "3 pontos (leve)"],
        ["media", "4 pontos (média)"],
        ["grave", "5 pontos (grave)"],
        ["gravissima", "7 pontos (gravíssima)"],
        ["naosei", "Não sei"],
      ],
    },
    {
      id: "outras",
      q: "Você levou outra multa nos últimos 12 meses?",
      ajuda: "",
      op: [
        ["nao", "Não, é a única"],
        ["sim", "Sim"],
        ["naosei", "Não sei"],
      ],
    },
    {
      id: "cnh",
      q: "Sua CNH é provisória?",
      ajuda: "A provisória vale no 1º ano depois de tirar a carteira.",
      op: [["sim", "Sim"], ["nao", "Não"]],
    },
    {
      id: "prazo",
      q: "Quanto tempo falta para o prazo da defesa?",
      ajuda: "A data limite está escrita na notificação.",
      op: [
        ["folga", "Mais de 7 dias"],
        ["curto", "Menos de 7 dias"],
        ["venceu", "Já venceu"],
        ["naosei", "Não sei"],
      ],
    },
  ];

  var resp = {};
  var i = 0;
  var pagina = document.getElementById("pagina");
  var quiz = document.getElementById("quiz");
  var tela = document.getElementById("tela");
  var barra = document.getElementById("barra");
  var contador = document.getElementById("contador");

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function whats(texto) {
    var base = C.whatsapp ? "https://wa.me/" + C.whatsapp : "https://wa.me/";
    return base + "?text=" + encodeURIComponent(texto);
  }

  function protocolo() {
    var p = null;
    try { p = sessionStorage.getItem("dp_protocolo"); } catch (e) {}
    if (!p) {
      p = "DP-" + String(Math.floor(1000 + Math.random() * 9000));
      try { sessionStorage.setItem("dp_protocolo", p); } catch (e) {}
    }
    return p;
  }

  function rotulo(id, valor) {
    var p = PERGUNTAS.filter(function (x) { return x.id === id; })[0];
    var o = p.op.filter(function (x) { return x[0] === valor; })[0];
    return o ? o[1] : "";
  }

  function comecar() {
    resp = {};
    i = 0;
    pagina.hidden = true;
    quiz.hidden = false;
    window.scrollTo(0, 0);
    mostrar();
  }

  function mostrar() {
    var p = PERGUNTAS[i];
    barra.style.width = ((i + 1) / PERGUNTAS.length) * 100 + "%";
    contador.textContent = "Pergunta " + (i + 1) + " de " + PERGUNTAS.length;
    var h = '<div class="pergunta">' + esc(p.q) + "</div>";
    if (p.ajuda) h += '<p class="ajuda">' + esc(p.ajuda) + "</p>";
    p.op.forEach(function (o) {
      h += '<button class="opcao" data-v="' + o[0] + '">' + esc(o[1]) + "</button>";
    });
    h += '<button class="voltar" data-voltar>← Voltar</button>';
    tela.innerHTML = h;
  }

  tela.addEventListener("click", function (ev) {
    var b = ev.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-voltar")) {
      if (i === 0) { quiz.hidden = true; pagina.hidden = false; return; }
      i--; mostrar(); return;
    }
    if (b.hasAttribute("data-v")) {
      resp[PERGUNTAS[i].id] = b.getAttribute("data-v");
      i++;
      if (i < PERGUNTAS.length) mostrar();
      else analisar();
    }
  });

  // Gravidade típica quando a pessoa não sabe os pontos.
  var GRAV_TIPICA = { estacionar: "leve ou média", radar: "média (até 20% acima)", cinto: "grave", celular: "gravíssima", sinal: "gravíssima", leiseca: "gravíssima" };
  function advertencia() {
    var leveMedia = resp.pontos === "leve" || resp.pontos === "media";
    if (resp.outras === "sim") return "nao";
    if (resp.outras === "naosei") return leveMedia || (resp.pontos === "naosei" && ["estacionar", "radar", "outra"].indexOf(resp.infracao) >= 0) ? "talvez" : "nao";
    if (leveMedia) return "sim";
    if (resp.pontos === "naosei") return ["estacionar", "radar", "outra"].indexOf(resp.infracao) >= 0 ? "talvez" : "nao";
    return "nao";
  }

  // Pré-análise automática, só com as respostas. Nunca promete cancelamento.
  function pontos() {
    var r = [];
    var adv = advertencia();
    if (adv === "sim") r.push({ forte: true, t: "Sua multa pode virar advertência", d: "Infração leve ou média e nenhuma outra multa em 12 meses: o art. 267 do CTB manda aplicar advertência por escrito no lugar da multa. A defesa pede isso com o artigo da lei." });
    if (adv === "talvez") r.push({ forte: false, t: "Pode virar advertência", d: resp.outras === "naosei" ? "Se você não levou outra multa em 12 meses (confira na Carteira Digital de Trânsito), a lei manda trocar esta multa por advertência por escrito (art. 267)." : "Se a infração for leve ou média (veja os pontos na carta), a lei manda trocar a multa por advertência por escrito (art. 267). Este tipo de infração costuma ser " + (GRAV_TIPICA[resp.infracao] || "leve ou média") + "." });
    if (resp.infracao === "radar") r.push({ forte: false, t: "Conferir o radar", d: "O equipamento precisa estar regulamentado e com a verificação do Inmetro em dia, e a carta deve trazer a velocidade medida e a considerada. Faltou? É ponto de defesa." });
    if (resp.infracao === "leiseca") r.push({ forte: true, t: "Multa alta e suspensão da CNH", d: "Na Lei Seca, a multa vem com processo de suspensão. Vale defender em todas as fases e conferir cada formalidade do auto." });
    if (resp.infracao === "estacionar") r.push({ forte: false, t: "Conferir a sinalização do local", d: "Sem sinalização suficiente e legível, a infração não deve ser aplicada (art. 90 do CTB)." });
    if (resp.infracao === "sinal") r.push({ forte: false, t: "Conferir o equipamento", d: "Avanço de sinal costuma ser registrado por equipamento eletrônico, que também precisa estar regular." });
    if (resp.infracao === "celular" || resp.infracao === "cinto") r.push({ forte: false, t: "Conferir a descrição do agente", d: "Em infrações flagradas por agente, a descrição precisa ser clara e coerente com o local, a hora e o veículo." });
    r.push({ forte: false, t: "Conferir os dados obrigatórios do auto", d: "Placa, veículo, local, data, hora, infração e identificação do agente precisam estar certos (art. 280 do CTB). Faltou ou errou? É ponto de defesa." });
    return r;
  }

  function analisar() {
    var ps = pontos();
    var prot = protocolo();
    barra.style.width = "100%";
    contador.textContent = "Pré-análise pronta · nº " + prot;

    var h = '<div class="resultado">';
    var adv = advertencia();
    h += adv === "sim" ? "<h2>✅ Sua multa pode virar advertência</h2>" : adv === "talvez" ? "<h2>Sua multa pode virar advertência — falta confirmar 1 coisa</h2>" : "<h2>Encontramos " + ps.length + " ponto" + (ps.length > 1 ? "s" : "") + " para conferir na sua multa</h2>";
    if (resp.cnh === "sim") h += '<p class="ajuda">Com CNH provisória, uma infração grave ou gravíssima pode impedir a carteira definitiva. Vale defender.</p>';
    else if (resp.outras === "sim") h += '<p class="ajuda">Somando multas, a CNH pode ser suspensa (de 20 a 40 pontos em 12 meses). Vale defender cada uma.</p>';
    if (resp.prazo === "curto") h += '<div class="urgente">⏰ Seu prazo está acabando. Mande a foto hoje para dar tempo.</div>';
    if (resp.prazo === "venceu") h += '<div class="urgente">O prazo da defesa prévia venceu, mas ainda dá para recorrer quando chegar a notificação da penalidade (a multa com valor). Mande a foto que a gente confere em qual fase você está.</div>';

    ps.forEach(function (p) {
      h += '<div class="ponto' + (p.forte ? " forte" : "") + '"><b>' + esc(p.t) + "</b><span>" + esc(p.d) + "</span></div>";
    });

    h += '<div class="cartao" style="margin-top:16px">';
    h += "<b>Agora, a análise completa e grátis</b>";
    if (C.api) h += '<p class="ajuda" style="margin:6px 0 14px">Mande a foto da carta: em 1 minuto o site lê tudo e mostra a análise completa, inclusive se não valer a pena defender.</p>';
    else {
      h += '<p class="ajuda" style="margin:6px 0 14px">A sua notificação é conferida pela nossa equipe, ponto por ponto. A resposta chega no seu WhatsApp.</p>';
      h += '<ol class="passos" style="margin-bottom:14px">';
      h += "<li>Toque no botão verde (a mensagem já vai pronta)</li>";
      h += "<li>No WhatsApp, toque no 📎 e mande a <b>foto da notificação</b> (frente e verso)</li>";
      h += "</ol>";
    }
    h += C.api
      ? '<a class="btn btn-verde" href="analise.html">Mandar a foto e ver a análise agora →</a>'
      : '<a class="btn btn-verde" target="_blank" rel="noopener" href="' + esc(whats(mensagemAnalise(prot))) + '">Enviar minha notificação →</a>';
    h += '<p class="mini">Análise nº ' + prot + " · grátis · sem compromisso</p>";
    h += "</div>";

    h += '<div class="cartao" style="margin-top:12px">';
    h += "<b>Já quer a defesa pronta?</b>";
    h += '<p class="ajuda" style="margin:6px 0 12px">Defesa em PDF para a sua notificação + passo a passo de protocolo.</p>';
    h += '<div class="preco">R$ ' + esc(C.preco || "37,90") + "</div>";
    h += '<a class="btn btn-amarelo" style="margin-top:12px"' + (C.api ? "" : ' target="_blank" rel="noopener"') + ' href="' + esc(linkCompra(prot)) + '">Quero a defesa pronta</a>';
    h += '<p class="mini">Não garantimos cancelamento: quem decide é o órgão de trânsito.</p>';
    h += "</div>";

    h += '<button class="voltar" data-refazer>↺ Refazer o quiz</button>';
    h += "</div>";
    tela.innerHTML = h;
    window.scrollTo(0, 0);
    tela.querySelector("[data-refazer]").onclick = comecar;
  }

  function resumo() {
    return [
      "• Multa de: " + rotulo("infracao", resp.infracao),
      "• Pontos: " + rotulo("pontos", resp.pontos),
      "• Outra multa em 12 meses: " + rotulo("outras", resp.outras),
      "• CNH provisória: " + rotulo("cnh", resp.cnh),
      "• Prazo: " + rotulo("prazo", resp.prazo),
    ].join("\n");
  }

  function mensagemAnalise(prot) {
    return "Olá! Quero a análise grátis da minha multa.\nAnálise nº " + prot + "\n\n" + resumo() + "\n\nVou mandar a foto da notificação agora 👇";
  }

  function linkCompra(prot) {
    if (C.api) return "analise.html";
    if (C.checkout) return C.checkout;
    return whats("Olá! Quero a defesa pronta de R$" + (C.preco || "37,90") + ".\nAnálise nº " + prot + "\n\n" + resumo() + "\n\nVou mandar a foto da notificação 👇");
  }

  document.querySelectorAll("[data-so-api]").forEach(function (a) { if (!C.api) a.remove(); });
  document.querySelectorAll("[data-comecar]").forEach(function (b) { b.onclick = comecar; });
  document.querySelectorAll("[data-preco]").forEach(function (s) { s.textContent = C.preco || "37,90"; });
  document.querySelectorAll("[data-whats-link]").forEach(function (a) {
    a.href = whats("Olá! Tenho uma dúvida sobre a Defesa Pronta.");
    a.target = "_blank";
  });
})();
