(function () {
  var C = window.DP || {};

  var PERGUNTAS = [
    {
      id: "chegada",
      q: "A carta da multa chegou quanto tempo depois do dia da infração?",
      ajuda: "Compare a data da infração com o dia em que a carta chegou (ou a data de postagem, se aparecer).",
      op: [
        ["mais30", "Mais de 30 dias depois"],
        ["menos30", "Menos de 30 dias depois"],
        ["naorecebi", "Não recebi carta, vi no app ou no Detran"],
        ["naosei", "Não sei"],
      ],
    },
    {
      id: "cnh",
      q: "Sua CNH é provisória?",
      ajuda: "A provisória (permissão para dirigir) vale no primeiro ano depois de tirar a carteira.",
      op: [["sim", "Sim, é provisória"], ["nao", "Não, é definitiva"]],
    },
    {
      id: "trabalho",
      q: "Você trabalha dirigindo?",
      ajuda: "Aplicativo, entrega, táxi, caminhão, van...",
      op: [
        ["carro", "Sim, de carro"],
        ["moto", "Sim, de moto"],
        ["nao", "Não"],
      ],
    },
    {
      id: "infracao",
      q: "Qual foi a infração?",
      ajuda: "Se não souber, escolha \"Outra\". A gente confere na foto.",
      op: [
        ["radar", "Velocidade (radar)"],
        ["sinal", "Avanço de sinal vermelho"],
        ["leiseca", "Lei Seca (bafômetro ou recusa)"],
        ["celular", "Celular ao volante"],
        ["estacionar", "Estacionamento"],
        ["cinto", "Cinto ou capacete"],
        ["outra", "Outra"],
      ],
    },
    {
      id: "prazo",
      q: "E o prazo para defesa que aparece na notificação?",
      ajuda: "Procure por \"data limite\" ou \"prazo para apresentação de defesa\".",
      op: [
        ["folga", "Tenho mais de 7 dias"],
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
    h += '<p class="ajuda">' + esc(p.ajuda) + "</p>";
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

  // Pré-análise automática, só com as respostas. Nunca promete cancelamento.
  function pontos() {
    var r = [];
    if (resp.chegada === "mais30") r.push({ forte: true, t: "A carta pode ter saído fora do prazo", d: "O órgão tem 30 dias, contados da infração, para expedir a notificação. Se passou disso, o auto deve ser arquivado (art. 281 do CTB). Conferimos as datas na sua foto." });
    if (resp.chegada === "naorecebi") r.push({ forte: true, t: "Possível falha na notificação", d: "Toda multa precisa de notificação de autuação antes da penalidade. Se ela não foi enviada ao seu endereço, isso pode ser contestado." });
    if (resp.chegada === "naosei") r.push({ forte: false, t: "Conferir o prazo de 30 dias", d: "Na foto, comparamos a data da infração com a data de expedição da carta (art. 281 do CTB)." });
    r.push({ forte: false, t: "Conferir os dados obrigatórios do auto", d: "Placa, marca, modelo, local, data, hora, artigo da infração e identificação do agente precisam estar certos (art. 280 do CTB). Qualquer divergência é ponto de defesa." });
    if (resp.infracao === "radar") r.push({ forte: false, t: "Conferir o radar", d: "O equipamento precisa ser regulamentado e estar com a verificação do Inmetro em dia. A notificação deve trazer a velocidade medida e a considerada." });
    if (resp.infracao === "sinal") r.push({ forte: false, t: "Conferir equipamento e sinalização", d: "Avanço de sinal costuma ser registrado por equipamento eletrônico, que também precisa estar regular." });
    if (resp.infracao === "leiseca") r.push({ forte: true, t: "Infração gravíssima com suspensão", d: "Na Lei Seca, a multa vem junto com processo de suspensão. Vale defender em todas as fases e conferir cada formalidade do auto." });
    if (resp.infracao === "estacionar") r.push({ forte: false, t: "Conferir a sinalização do local", d: "Sem sinalização suficiente e legível, a infração não deve ser aplicada (art. 90 do CTB)." });
    if (resp.infracao === "celular" || resp.infracao === "cinto") r.push({ forte: false, t: "Conferir a descrição do agente", d: "Em infrações flagradas por agente, a descrição precisa ser clara e coerente com o local, a hora e o veículo." });
    return r;
  }

  function analisar() {
    var ps = pontos();
    var prot = protocolo();
    barra.style.width = "100%";
    contador.textContent = "Pré-análise pronta · nº " + prot;

    var h = '<div class="resultado">';
    h += "<h2>Encontramos " + ps.length + " ponto" + (ps.length > 1 ? "s" : "") + " para conferir na sua multa</h2>";
    if (resp.cnh === "sim" || resp.trabalho !== "nao") {
      h += '<p class="ajuda">' + (resp.cnh === "sim"
        ? "Com CNH provisória, uma infração grave ou gravíssima pode impedir a carteira definitiva. Vale defender."
        : "Para quem trabalha dirigindo, cada ponto conta. Vale defender.") + "</p>";
    }
    if (resp.prazo === "curto") h += '<div class="urgente">⏰ Seu prazo está acabando. Mande a foto hoje para dar tempo.</div>';
    if (resp.prazo === "venceu") h += '<div class="urgente">O prazo da defesa prévia venceu, mas ainda dá para recorrer quando chegar a notificação da penalidade (a multa com valor). Mande a foto que a gente confere em qual fase você está.</div>';

    ps.forEach(function (p) {
      h += '<div class="ponto' + (p.forte ? " forte" : "") + '"><b>' + esc(p.t) + "</b><span>" + esc(p.d) + "</span></div>";
    });

    h += '<div class="cartao" style="margin-top:16px">';
    h += "<b>Agora, a análise completa e grátis</b>";
    h += '<p class="ajuda" style="margin:6px 0 14px">A sua notificação é conferida pela nossa equipe, ponto por ponto. A resposta chega no seu WhatsApp.</p>';
    h += '<ol class="passos" style="margin-bottom:14px">';
    h += "<li>Toque no botão verde (a mensagem já vai pronta)</li>";
    h += "<li>No WhatsApp, toque no 📎 e mande a <b>foto da notificação</b> (frente e verso)</li>";
    h += "</ol>";
    h += '<a class="btn btn-verde" target="_blank" rel="noopener" href="' + esc(whats(mensagemAnalise(prot))) + '">Enviar minha notificação →</a>';
    h += '<p class="mini">Análise nº ' + prot + " · grátis · sem compromisso</p>";
    h += "</div>";

    h += '<div class="cartao" style="margin-top:12px">';
    h += "<b>Já quer a defesa pronta?</b>";
    h += '<p class="ajuda" style="margin:6px 0 12px">Defesa em PDF para a sua notificação + passo a passo de protocolo.</p>';
    h += '<div class="preco">R$ ' + esc(C.preco || "37,90") + "</div>";
    h += '<a class="btn btn-amarelo" style="margin-top:12px" target="_blank" rel="noopener" href="' + esc(linkCompra(prot)) + '">Quero a defesa pronta</a>';
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
      "• Carta chegou: " + rotulo("chegada", resp.chegada),
      "• CNH: " + rotulo("cnh", resp.cnh),
      "• Trabalha dirigindo: " + rotulo("trabalho", resp.trabalho),
      "• Infração: " + rotulo("infracao", resp.infracao),
      "• Prazo: " + rotulo("prazo", resp.prazo),
    ].join("\n");
  }

  function mensagemAnalise(prot) {
    return "Olá! Quero a análise grátis da minha multa.\nAnálise nº " + prot + "\n\n" + resumo() + "\n\nVou mandar a foto da notificação agora 👇";
  }

  function linkCompra(prot) {
    if (C.checkout) return C.checkout;
    return whats("Olá! Quero a defesa pronta de R$" + (C.preco || "37,90") + ".\nAnálise nº " + prot + "\n\n" + resumo() + "\n\nVou mandar a foto da notificação 👇");
  }

  document.querySelectorAll("[data-comecar]").forEach(function (b) { b.onclick = comecar; });
  document.querySelectorAll("[data-preco]").forEach(function (s) { s.textContent = C.preco || "37,90"; });
  document.querySelectorAll("[data-whats-link]").forEach(function (a) {
    a.href = whats("Olá! Tenho uma dúvida sobre a Defesa Pronta.");
    a.target = "_blank";
  });
})();
