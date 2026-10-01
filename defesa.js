// Núcleo da Defesa Pronta: as REGRAS que decidem os argumentos e o TEXTO da defesa.
// A IA só lê a carta (fatos). Quem decide o que entra na defesa é este arquivo,
// com base no Código de Trânsito — nunca a IA.
(function (raiz) {
  function br(iso) { if (!iso) return "___/___/____"; var p = String(iso).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function diasEntre(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
  function dias(d) { return d.dataInfracao && d.dataExpedicao ? diasEntre(d.dataInfracao, d.dataExpedicao) : "___"; }
  function up(s) { return (s || "").toUpperCase(); }
  function ou(s, padrao) { return s || padrao; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // Valores base do art. 258 do CTB (sem fator multiplicador).
  function gravidadePorValor(v) {
    var n = parseFloat(String(v || "").replace(/\./g, "").replace(",", "."));
    if (!n) return "";
    var base = [["leve", 88.38], ["media", 130.16], ["grave", 195.23], ["gravissima", 293.47]];
    for (var i = 0; i < base.length; i++) if (Math.abs(n - base[i][1]) < 0.02) return base[i][0];
    // Gravíssima com multiplicador (x2, x3, x5, x10...).
    for (var k = 2; k <= 60; k++) if (Math.abs(n - 293.47 * k) < 0.05) return "gravissima";
    return "";
  }
  var PONTOS = { leve: 3, media: 4, grave: 5, gravissima: 7 };
  function gravidadePorPontos(p) { var n = parseInt(String(p || "").replace(/D/g, ""), 10); return { 3: "leve", 4: "media", 5: "grave", 7: "gravissima" }[n] || ""; }
  var NOME_GRAV = { leve: "leve", media: "média", grave: "grave", gravissima: "gravíssima" };

  // Cada argumento: texto curto (análise) e parágrafo (defesa).
  var ARGS = [
    { id: "prazo30", t: "Notificação expedida depois de 30 dias", h: "Preencha a data da infração e a de expedição.",
      curto: function (d) { return "A notificação da autuação foi expedida " + dias(d) + " dias depois da infração. A lei dá no máximo 30 dias (art. 281 do CTB)."; },
      titulo: "DA NOTIFICAÇÃO EXPEDIDA FORA DO PRAZO LEGAL",
      texto: function (d) { return "A infração teria ocorrido em " + br(d.dataInfracao) + ", e a notificação da autuação somente foi expedida em " + br(d.dataExpedicao) + ", ou seja, " + dias(d) + " dias depois. O art. 281, parágrafo único, inciso II, do Código de Trânsito Brasileiro determina que o auto de infração será arquivado e seu registro julgado insubsistente se, no prazo máximo de 30 (trinta) dias, não for expedida a notificação da autuação. Ultrapassado o prazo legal, impõe-se o arquivamento do auto de infração."; } },
    { id: "naoNotificado", t: "Não recebeu a notificação da autuação", h: "",
      curto: function () { return "Você não recebeu a notificação da autuação, que é obrigatória antes da multa."; },
      titulo: "DA AUSÊNCIA DE NOTIFICAÇÃO DA AUTUAÇÃO",
      texto: function () { return "O(A) requerente não recebeu a notificação da autuação, etapa obrigatória que garante o direito de defesa antes da aplicação da penalidade (arts. 280, inciso VI, 281 e 282 do CTB, e art. 5º, inciso LV, da Constituição Federal). Requer-se que o órgão autuador comprove a expedição e a entrega da notificação no endereço do(a) requerente, sob pena de nulidade do procedimento."; } },
    { id: "dados", t: "Falta ou erro em dado obrigatório do auto", h: "Descreva o que falta ou está errado.", extra: "Ex.: o auto não traz a identificação do agente autuador",
      curto: function (d, x) { return "Dado obrigatório com problema: " + x + " (art. 280 do CTB)."; },
      titulo: "DA IRREGULARIDADE DE REQUISITO OBRIGATÓRIO DO AUTO",
      texto: function (d, x) { return "O art. 280 do CTB estabelece os elementos que obrigatoriamente devem constar do auto de infração, entre eles a tipificação da infração, o local, a data e a hora do cometimento, os caracteres da placa, a marca e a espécie do veículo, e a identificação do órgão ou entidade e do agente autuador. No presente caso, verifica-se a seguinte irregularidade: " + x + ". A ausência ou o erro de requisito obrigatório torna o auto inconsistente, devendo ser arquivado, nos termos do art. 281, parágrafo único, inciso I, do CTB."; } },
    { id: "veiculo", t: "Veículo descrito diferente do real", h: "Diga o que diverge.", extra: "Ex.: o auto diz Fiat Palio prata; o veículo é um Onix branco",
      curto: function (d, x) { return "O veículo do auto não confere com o seu: " + x + "."; },
      titulo: "DA DIVERGÊNCIA ENTRE O VEÍCULO AUTUADO E O VEÍCULO DO REQUERENTE",
      texto: function (d, x) { return "Os dados do veículo constantes do auto de infração não correspondem ao veículo de placa " + up(d.placa) + " (" + ou(d.modelo, "") + "), pertencente ao(à) requerente: " + x + ". A divergência indica erro na identificação do veículo, o que torna o auto inconsistente (arts. 280, inciso IV, e 281, parágrafo único, inciso I, do CTB), conforme documento do veículo (CRLV) anexo."; } },
    { id: "radar", t: "Radar: pedir prova de aferição do Inmetro", h: "",
      curto: function () { return "Multa de radar: a lei exige equipamento regulamentado e com verificação do Inmetro em dia. A defesa exige essa prova do órgão."; },
      titulo: "DA REGULARIDADE DO EQUIPAMENTO MEDIDOR",
      texto: function () { return "Nos termos do art. 280, § 2º, do CTB, a infração comprovada por equipamento eletrônico exige que o instrumento seja previamente regulamentado pelo CONTRAN, o que inclui a verificação metrológica periódica pelo Inmetro ou entidade por ele acreditada. A notificação não traz prova de que o equipamento estava com a verificação válida na data da infração. Requer-se a apresentação do certificado de verificação vigente e dos dados de identificação do equipamento; não sendo comprovada a regularidade, o auto deve ser arquivado."; } },
    { id: "radarDados", t: "Radar sem velocidade medida/considerada na notificação", h: "",
      curto: function () { return "A notificação de radar não traz a velocidade medida e a considerada, que são obrigatórias."; },
      titulo: "DA AUSÊNCIA DOS DADOS DA MEDIÇÃO",
      texto: function () { return "Em infração de velocidade comprovada por equipamento, a notificação deve informar a velocidade permitida, a velocidade medida e a velocidade considerada para fins de autuação, além da identificação do equipamento. Tais dados não constam da notificação recebida, o que impede o(a) requerente de verificar a correção da medição e de exercer plenamente seu direito de defesa (art. 5º, inciso LV, da Constituição Federal; art. 280 do CTB). Requer-se, por isso, o arquivamento do auto."; } },
    { id: "sinalizacao", t: "Sinalização ausente ou ruim no local", h: "Descreva (de preferência com foto do local).", extra: "Ex.: placa de proibido estacionar coberta por árvore",
      curto: function (d, x) { return "A sinalização do local era insuficiente: " + x + " (art. 90 do CTB)."; },
      titulo: "DA SINALIZAÇÃO INSUFICIENTE",
      texto: function (d, x) { return "O art. 90 do CTB dispõe que não serão aplicadas as sanções previstas no Código por inobservância à sinalização quando esta for insuficiente ou incorreta. No local da suposta infração, verifica-se: " + x + ". Sem sinalização suficiente e legível, não se pode exigir do condutor a conduta tida por violada, devendo o auto ser arquivado."; } },
    { id: "tipificacao", t: "Enquadramento errado da infração", h: "Explique o erro.", extra: "Ex.: autuado por estacionar em local proibido, mas era parada para embarque",
      curto: function (d, x) { return "O enquadramento da infração parece errado: " + x + "."; },
      titulo: "DO ENQUADRAMENTO INCORRETO",
      texto: function (d, x) { return "A conduta descrita não corresponde ao enquadramento atribuído no auto de infração: " + x + ". A tipificação correta é requisito obrigatório do auto (art. 280, inciso I, do CTB), e o erro de enquadramento o torna inconsistente, devendo ser arquivado."; } },
    { id: "semAbordagem", t: "Autuação sem abordagem, sem motivo descrito (art. 280, §3º)", h: "Quando o auto diz que o veículo não foi parado e não explica por quê.",
      curto: function () { return "O agente não parou o veículo e não explicou por que a abordagem não foi possível (art. 280, §3º, do CTB)."; },
      titulo: "DA AUTUAÇÃO SEM ABORDAGEM E SEM JUSTIFICATIVA",
      texto: function () { return "O auto de infração foi lavrado sem a abordagem do condutor, com fundamento no art. 280, § 3º, do CTB. Esse dispositivo, porém, só admite a autuação sem flagrante quando ela não for possível, e exige que o agente relate o fato à autoridade. No caso, o auto não descreve nenhuma circunstância concreta que impedisse a abordagem, limitando-se a citar o dispositivo. A ausência de abordagem e de justificativa retirou do condutor a possibilidade de constatar e esclarecer, no momento, a suposta irregularidade, o que compromete a comprovação da infração e o direito de defesa (art. 5º, inciso LV, da Constituição Federal). Requer-se, por isso, o arquivamento do auto."; } },
    { id: "advertencia", t: "Advertência por escrito no lugar da multa (leve/média, sem multa em 12 meses — art. 267)", h: "Pergunte ao cliente se ele teve outra multa nos últimos 12 meses.",
      curto: function () { return "A infração é leve ou média e você não teve outra multa em 12 meses: a lei manda aplicar advertência por escrito no lugar da multa (art. 267 do CTB)."; },
      titulo: "DA APLICAÇÃO OBRIGATÓRIA DA ADVERTÊNCIA POR ESCRITO",
      texto: function () { return "A infração imputada é de natureza leve ou média, e o(a) requerente não cometeu nenhuma outra infração nos últimos 12 (doze) meses. Nessa hipótese, o art. 267 do CTB, com a redação dada pela Lei nº 14.071/2020, determina que deverá ser imposta a penalidade de advertência por escrito, e não a de multa. Trata-se de comando legal, e não de faculdade da autoridade, de modo que, mantida a autuação, a penalidade de multa deve ser convertida em advertência por escrito."; } },
  ];
  var POR_ID = {}; ARGS.forEach(function (a) { POR_ID[a.id] = a; });

  // ---------- REGRAS: fatos lidos da carta + respostas do motorista -> pontos e veredito ----------
  // fatos: o que a IA leu (só o que está escrito). respostas: { outraMulta12m: "sim"|"nao"|"naosei", outroCondutor: "sim"|"nao" }
  function regras(fatos, respostas, hojeIso) {
    fatos = fatos || {}; respostas = respostas || {};
    var hoje = hojeIso || new Date().toISOString().slice(0, 10);
    var d = paraDados(fatos);
    var pontos = [], avisos = [], extras = [];
    var grav = fatos.gravidade || gravidadePorValor(fatos.valor) || gravidadePorPontos(fatos.pontos);

    // Prazo.
    var prazoVencido = d.prazo && d.prazo < hoje;
    if (d.prazo && !prazoVencido) {
      var faltam = diasEntre(hoje, d.prazo);
      if (faltam <= 7) avisos.push("⏰ Faltam só " + faltam + " dia" + (faltam === 1 ? "" : "s") + " para o prazo (" + br(d.prazo) + "). Protocole o quanto antes.");
    }

    // Art. 281: só com as DUAS datas lidas com rótulo explícito.
    if (d.dataInfracao && d.dataExpedicao) {
      var n = diasEntre(d.dataInfracao, d.dataExpedicao);
      if (n > 30) pontos.push({ id: "prazo30", forca: "forte" });
    }
    // Dados obrigatórios ausentes (art. 280).
    var faltando = (fatos.camposObrigatoriosAusentes || []).filter(Boolean);
    if (faltando.length) pontos.push({ id: "dados", forca: "forte", x: "não consta(m) " + faltando.join(", ") });
    // Radar.
    if (fatos.radar) {
      if (!fatos.velocidadeMedida || !fatos.velocidadeConsiderada) pontos.push({ id: "radarDados", forca: "forte" });
      pontos.push({ id: "radar", forca: "media" });
    }
    // Sem abordagem e sem justificativa.
    if (fatos.semAbordagem && !fatos.justificativaSemAbordagem) pontos.push({ id: "semAbordagem", forca: "media" });
    // Advertência (art. 267).
    if ((grav === "leve" || grav === "media") && respostas.outraMulta12m === "nao") pontos.push({ id: "advertencia", forca: "forte" });
    if ((grav === "leve" || grav === "media") && respostas.outraMulta12m === "naosei")
      avisos.push("Se você não teve outra multa nos últimos 12 meses, esta multa " + NOME_GRAV[grav] + " pode virar só advertência (art. 267). Confira no app Carteira Digital de Trânsito → Infrações e responda de novo.");

    // Indicação de condutor (só na 1ª carta, quando outra pessoa dirigia).
    if (respostas.outroCondutor === "sim") {
      if (fatos.tipoCarta === "autuacao") extras.push("Indicação do condutor: como outra pessoa dirigia, os pontos podem ir para a CNH dela. Use o formulário de identificação do condutor que vem junto com a notificação, dentro do prazo — o passo a passo vai no seu PDF.");
      else avisos.push("Como esta já é a carta da multa, o prazo para indicar outro condutor costuma ter passado. Os pontos ficam com o dono do veículo.");
    }
    if (grav) extras.push("Esta infração é " + NOME_GRAV[grav] + " (" + PONTOS[grav] + " pontos na CNH).");

    var fortes = pontos.filter(function (p) { return p.forca === "forte"; }).length;
    var veredito;
    if (prazoVencido) veredito = { nivel: "vencido", titulo: "O prazo desta carta já venceu", texto: fatos.tipoCarta === "autuacao" ? "Não dá mais para a defesa prévia, mas você ainda poderá recorrer quando chegar a carta da multa (notificação de penalidade). Guarde esta carta e faça a análise de novo quando a próxima chegar." : "O prazo para recorrer desta multa terminou em " + br(d.prazo) + ". Uma defesa agora seria rejeitada por estar fora do prazo, por isso não recomendamos pagar por ela." };
    else if (fortes) veredito = { nivel: "forte", titulo: "Vale a pena defender", texto: "Encontramos " + (fortes > 1 ? fortes + " pontos fortes" : "um ponto forte") + " na sua multa." };
    else if (pontos.length) veredito = { nivel: "media", titulo: "Dá para defender, com chance moderada", texto: "Encontramos ponto(s) de defesa, mas nenhum decisivo. Vale se esta multa pesa para você (pontos na CNH, CNH provisória, trabalho)." };
    else veredito = { nivel: "nenhum", titulo: "Não encontramos erro que valha uma defesa", texto: "Com sinceridade: não recomendamos pagar por uma defesa desta multa. Pague com desconto (até 20% pagando até o vencimento, ou 40% pelo app SNE se o órgão aderir) e economize." };

    return { dados: d, pontos: pontos, avisos: avisos, extras: extras, veredito: veredito, gravidade: grav, vale: !prazoVencido && pontos.length > 0 };
  }

  // Fatos da IA -> campos usados pelo documento.
  function paraDados(f) {
    return {
      fase: f.tipoCarta === "penalidade" ? "jari" : "previa",
      orgao: f.orgao || "", uf: f.uf || "", auto: f.auto || "", placa: f.placa || "", modelo: f.marcaModelo || "", renavam: f.renavam || "",
      dataInfracao: f.dataInfracao || "", hora: f.hora || "", local: [f.local, f.municipio].filter(Boolean).join(", "),
      dataExpedicao: f.dataExpedicaoAutuacao || "", prazo: f.prazo || "",
      infracao: [f.codigoInfracao, f.descricaoInfracao].filter(Boolean).join(" – "),
    };
  }

  // ---------- Documento ----------
  function enderecamento(d) {
    var org = up(ou(d.orgao, "[ÓRGÃO AUTUADOR]"));
    if (d.fase === "jari") return "ILUSTRÍSSIMO(A) SENHOR(A) PRESIDENTE DA JUNTA ADMINISTRATIVA DE RECURSOS DE INFRAÇÕES (JARI) DO " + org;
    if (d.fase === "cetran") return "ILUSTRÍSSIMO(A) SENHOR(A) PRESIDENTE DO CONSELHO ESTADUAL DE TRÂNSITO (CETRAN/" + up(ou(d.uf, "UF")) + ")";
    return "ILUSTRÍSSIMO(A) SENHOR(A) DIRIGENTE DA AUTORIDADE DE TRÂNSITO DO " + org;
  }
  function nomePeca(d) { return d.fase === "jari" ? "RECURSO" : d.fase === "cetran" ? "RECURSO EM 2ª INSTÂNCIA" : "DEFESA PRÉVIA"; }
  function hoje() { return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }); }

  // marcados: [{ a: ARG, x: texto extra }]
  function documento(d, marcados) {
    var fund = marcados.filter(function (p) { return p.a.titulo; });
    var adv = marcados.some(function (p) { return p.a.id === "advertencia"; });
    var h = "<h1>" + esc(enderecamento(d)) + "</h1>";
    h += "<p><b>Auto de infração nº " + esc(ou(d.auto, "________")) + "</b><br>Placa: " + esc(up(ou(d.placa, "________"))) + "</p>";
    h += "<p><b>" + esc(ou(d.nome, "[NOME]").toUpperCase()) + "</b>, inscrito(a) no CPF sob o nº " + esc(ou(d.cpf, "________")) + ", habilitado(a) sob o registro nº " + esc(ou(d.cnh, "________")) + ", residente em " + esc(ou(d.endereco, "________")) + ", na qualidade de " + esc(ou(d.qualidade, "proprietário(a) e condutor(a)")) + " do veículo " + esc(ou(d.modelo, "________")) + ", placa " + esc(up(ou(d.placa, "________"))) + ", RENAVAM " + esc(ou(d.renavam, "________")) + ", vem, respeitosamente, apresentar <b>" + nomePeca(d) + "</b> referente ao auto de infração acima, pelos fatos e fundamentos a seguir.</p>";
    h += "<h2>I – DOS FATOS</h2>";
    h += "<p>O(A) requerente foi autuado(a) pela suposta infração “" + esc(ou(d.infracao, "________")) + "”, que teria ocorrido em " + br(d.dataInfracao) + (d.hora ? ", às " + esc(d.hora) : "") + ", no local " + esc(ou(d.local, "________")) + ". Como se demonstrará, o auto de infração não pode subsistir.</p>";
    if (d.fatos) h += "<p>" + esc(d.fatos) + "</p>";
    h += "<h2>II – DO DIREITO</h2>";
    if (!fund.length) h += "<p>[Marque pelo menos um ponto de defesa.]</p>";
    fund.forEach(function (p, i) { h += "<p><b>" + (i + 1) + ". " + p.a.titulo + "</b></p><p>" + esc(p.a.texto(d, p.x)) + "</p>"; });
    h += "<h2>III – DO PEDIDO</h2><p>Diante do exposto, requer:</p>";
    h += "<p>a) o acolhimento da presente " + (d.fase === "previa" ? "defesa" : "peça") + ", com o arquivamento do auto de infração nº " + esc(ou(d.auto, "________")) + " e o cancelamento de todos os seus efeitos, inclusive da pontuação no prontuário do(a) requerente;</p>";
    var letra = "b";
    if (adv) { h += "<p>" + letra + ") subsidiariamente, a aplicação de advertência por escrito em lugar da multa, nos termos do art. 267 do CTB;</p>"; letra = "c"; }
    h += "<p>" + letra + ") a juntada dos documentos anexos: cópia da notificação, da CNH e do documento do veículo (CRLV).</p>";
    h += "<p>Nestes termos, pede deferimento.</p>";
    h += "<p>" + esc(ou(d.cidade, "_______________")) + ", " + hoje() + ".</p>";
    h += '<div class="assin">_______________________________________<br>' + esc(ou(d.nome, "[NOME]")) + "<br>CPF " + esc(ou(d.cpf, "")) + "</div>";
    h += '<div class="quebra"></div><h1>PASSO A PASSO PARA PROTOCOLAR</h1>';
    h += passo(d).map(function (t, i) { return "<p><b>" + (i + 1) + ".</b> " + t + "</p>"; }).join("");
    return h;
  }

  function passo(d) {
    var prazo = d.prazo ? "<b>até " + br(d.prazo) + "</b>" : "<b>dentro do prazo que está na notificação</b>";
    return [
      "Preencha a cidade e a data no fim da defesa e <b>assine</b>. Pode ser à mão (imprimindo) ou com a assinatura digital gratuita do gov.br, que muitos órgãos aceitam.",
      "Separe as cópias: <b>notificação</b> (frente e verso), <b>CNH</b> e <b>documento do veículo (CRLV)</b>. Se quem assina não é o dono do veículo, junte também o documento do dono.",
      "Protocole " + prazo + " por um destes caminhos: <b>(a)</b> pelo site ou aplicativo do órgão autuador (" + esc(ou(d.orgao, "veja o nome na notificação")) + "), na área de defesa ou recurso de multa; <b>(b)</b> pela Carteira Digital de Trânsito, se o órgão aceitar defesa por lá; <b>(c)</b> pelos Correios, com aviso de recebimento (AR), para o endereço que está na notificação; ou <b>(d)</b> no atendimento presencial do órgão.",
      "<b>Guarde o comprovante</b> (número do protocolo ou o AR dos Correios). Ele prova que você defendeu no prazo.",
      "Acompanhe a resposta pela carta ou pela Carteira Digital de Trânsito. Se a defesa prévia for negada, ainda dá para recorrer à JARI quando chegar a notificação da multa. Se a JARI negar, cabe recurso ao CETRAN em até 30 dias (art. 288 do CTB).",
      "Dúvida em qualquer passo? Chame a gente no WhatsApp.",
    ];
  }

  raiz.DPDefesa = { ARGS: ARGS, POR_ID: POR_ID, regras: regras, paraDados: paraDados, documento: documento, passo: passo, gravidadePorValor: gravidadePorValor,
    br: br, dias: dias, diasEntre: diasEntre, up: up, ou: ou, esc: esc };
})(typeof window !== "undefined" ? window : globalThis);
