const pdfParse = require('pdf-parse');
const fs = require('fs');

const MESES = {
  'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'março': 3,
  'abril': 4, 'maio': 5, 'junho': 6, 'julho': 7,
  'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
};

function normStr(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function parseBRCurrency(str) {
  if (!str) return null;
  str = str.trim().replace(/\s/g, '');
  if (str.includes(',')) {
    const val = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    return isNaN(val) ? null : val;
  }
  const val = parseFloat(str.replace(/,/g, ''));
  return isNaN(val) ? null : val;
}

// Match Brazilian currency: digit(s) optionally with . thousands separator, comma, exactly 2 decimal digits
// NOT followed by more digits (avoids matching 1.780,0048)
const BRL = /\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/;
const BRL_G = /\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/g;

async function extractTextFromPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

// ─── AUTO DETECT ──────────────────────────────────────────────────────────────
function detectDocumentType(text) {
  const t = normStr(text);

  // Histórico de Férias 11.004
  if (t.includes('11.004') || t.includes('historico de ferias') ||
      (t.includes('periodo aquisitivo') && t.includes('ferias'))) {
    return 'ferias';
  }

  // Ficha Financeira 11.013
  if (t.includes('11.013') ||
      (t.includes('periodo 1') && t.includes('periodo 2') && (t.includes('017') || t.includes('adiantamento'))) ||
      (t.includes('ficha financeira') && t.includes('salario'))) {
    return 'ficha';
  }

  // Histórico de Movimentações 11.003
  if (t.includes('11.003') || t.includes('historico de mudanca de salario') ||
      t.includes('historico de afastamentos') ||
      (t.includes('mudanca de salario') && t.includes('admissao'))) {
    return 'movimentacoes';
  }

  // Cartão de Ponto - has time entries
  if (t.includes('cartao de ponto') || t.includes('cartão de ponto') ||
      (t.includes('entrada') && t.includes('saida') && /\d{2}:\d{2}/.test(t)) ||
      (text.match(/\d{2}:\d{2}\s+\d{2}:\d{2}/) && text.match(/\d{2}\/\d{2}\/\d{2,4}/))) {
    return 'ponto';
  }

  // Ata de Audiência PJe
  if (t.includes('reclamante') && (t.includes('reclamado') || t.includes('reclamada')) &&
      (t.includes('audiencia') || t.includes('pje') || t.includes('trt') || t.includes('processo'))) {
    return 'ata';
  }

  // Fallback - try to detect by content
  if (t.includes('reclamante') || t.includes('reclamado')) return 'ata';
  if (t.includes('ferias') && t.includes('periodo')) return 'ferias';
  if (t.includes('salario') && (t.includes('017') || t.includes('001'))) return 'ficha';
  if (t.includes('salario') && t.includes('afastamento')) return 'movimentacoes';

  return null;
}

// ─── ATA DE AUDIÊNCIA ─────────────────────────────────────────────────────────
function parseAtaAudiencia(text) {
  const result = {};
  const debug = { matches: {} };

  // Número do processo
  const proc = text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  if (proc) { result.numero_processo = proc[0]; debug.matches.processo = proc[0]; }

  // Data da rescisão — múltiplos padrões
  const dataPatterns = [
    { p: /Em\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i, label: 'Em DD de mês de AAAA' },
    { p: /Aos\s+(\d{1,2})\s*(?:\([^)]+\))?\s*(?:dias?\s+)?(?:do\s+mes\s+de\s+|de\s+)?(\w+)\s+de\s+(\d{4})/i, label: 'Aos DD de mês de AAAA' },
    { p: /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i, label: 'DD de mês de AAAA' },
    { p: /DATA\s+DA\s+AUDI[EÊ]NCIA[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i, label: 'DATA DA AUDIÊNCIA' },
    { p: /AUDI[EÊ]NCIA[^:]*:\s*(\d{2})\/(\d{2})\/(\d{4})/i, label: 'AUDIÊNCIA DD/MM/AAAA' },
  ];
  for (const { p, label } of dataPatterns) {
    const m = text.match(p);
    if (m) {
      let dia, mesStr, ano;
      // Check if it's DD/MM/YYYY format (groups are dia, mes, ano as numbers)
      if (/^\d{2}$/.test(m[2])) {
        // DD/MM/YYYY format
        dia = m[1].padStart(2, '0');
        const mesNum = m[2];
        ano = m[3];
        result.data_rescisao = `${dia}/${mesNum}/${ano}`;
        debug.matches.data_rescisao = `[${label}] ${m[0]}`;
        break;
      } else {
        // DD de mês de AAAA format
        dia = m[1].padStart(2, '0');
        mesStr = normStr(m[2]);
        ano = m[3];
        const mes = MESES[mesStr];
        if (mes) {
          result.data_rescisao = `${dia}/${String(mes).padStart(2, '0')}/${ano}`;
          debug.matches.data_rescisao = `[${label}] ${m[0]}`;
          break;
        }
      }
    }
  }

  // Reclamante
  const recPatterns = [
    /RECLAMANTE[:\s]+([^\n\r]+)/i,
    /AUTOR[:\s]+([^\n\r]+)/i,
  ];
  for (const p of recPatterns) {
    const m = text.match(p);
    if (m) {
      result.nome_reclamante = m[1].replace(/\s*(CPF|RG|,).*/i, '').trim();
      debug.matches.reclamante = m[0];
      break;
    }
  }

  // Reclamada
  const recadPatterns = [
    /RECLAMAD[OA][:\s]+([^\n\r]+)/i,
    /R[EÉ]U[:\s]+([^\n\r]+)/i,
    /EMPRESA[:\s]+([^\n\r]+)/i,
  ];
  for (const p of recadPatterns) {
    const m = text.match(p);
    if (m) {
      result.nome_reclamada = m[1].replace(/\s*(CNPJ|CPF|,).*/i, '').trim();
      debug.matches.reclamada = m[0];
      break;
    }
  }

  // Data admissão
  const admPatterns = [
    /[Aa]dmiss[ãa]o[:\s]+(\d{2}\/\d{2}\/\d{4})/,
    /DATA\s+(?:DE\s+)?ADMISS[ÃA]O[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /admitid[ao][^\d]+(\d{2}\/\d{2}\/\d{4})/i,
  ];
  for (const p of admPatterns) {
    const m = text.match(p);
    if (m) { result.data_admissao = m[1]; debug.matches.admissao = m[0]; break; }
  }

  // Valor da causa
  const vc = text.match(/[Vv]alor\s+da\s+causa[:\s]+R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (vc) { result.valor_causa = parseBRCurrency(vc[1]); debug.matches.valor_causa = vc[0]; }

  result._debug = debug;
  return result;
}

// ─── HISTÓRICO DE MOVIMENTAÇÕES ───────────────────────────────────────────────
function parseHistoricoMovimentacoes(text) {
  const result = {};
  const debug = { matches: {} };

  // Nome
  const nomeP = [
    /^NOME[:\s]+(.+)$/im,
    /NOME\s+DO\s+EMPREGADO[:\s]+(.+)$/im,
    /FUNCIONARIO[:\s]+(.+)$/im,
  ];
  for (const p of nomeP) {
    const m = text.match(p);
    if (m) { result.nome = m[1].trim(); debug.matches.nome = m[0]; break; }
  }

  // Data admissão
  const admP = [
    /DATA\s+ADMISS[ÃA]O[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /ADMISS[ÃA]O[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /DT\.?\s*ADM\.?[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /ADMITIDO\s+EM[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
  ];
  for (const p of admP) {
    const m = text.match(p);
    if (m) { result.data_admissao = m[1]; debug.matches.admissao = m[0]; break; }
  }

  // Cargo
  const cg = text.match(/CARGO[:\s]+([^\n\r]+)/i);
  if (cg) { result.cargo = cg[1].trim(); debug.matches.cargo = cg[0]; }

  // Último salário — pega o último valor BRL na seção de mudança de salário
  // Primeiro tenta encontrar a seção específica
  const secSal = text.match(/(?:HIST[OÓ]RICO\s+DE\s+)?MUDAN[CÇ]A\s+DE\s+SAL[ÁA]RIO([\s\S]*?)(?:HIST[OÓ]RICO|AFASTAMENTO|CARGO|RESCIS|$)/i);
  if (secSal) {
    debug.matches.secao_salario = secSal[0].substring(0, 200);
    // Pega todos os valores BRL na seção e usa o último
    const vals = [...secSal[1].matchAll(BRL_G)];
    if (vals.length > 0) {
      const last = vals[vals.length - 1][0];
      result.salario = parseBRCurrency(last);
      debug.matches.salario = `último BRL na seção: ${last}`;
    }
  }
  // Fallback: procura linha com data seguida de valor BRL
  if (!result.salario) {
    const linhas = text.split('\n');
    let lastSal = null;
    for (const linha of linhas) {
      if (/\d{2}\/\d{2}\/\d{4}/.test(linha)) {
        const brl = [...linha.matchAll(BRL_G)];
        if (brl.length > 0) {
          lastSal = brl[brl.length - 1][0];
        }
      }
    }
    if (lastSal) {
      result.salario = parseBRCurrency(lastSal);
      debug.matches.salario_fallback = lastSal;
    }
  }

  // Afastamentos
  const afastamentos = [];

  // Tentar extrair seção de afastamentos
  const secAfst = text.match(/(?:HIST[OÓ]RICO\s+DE\s+)?AFASTAMENTOS?([\s\S]*?)(?:HIST[OÓ]RICO|MUDAN[CÇ]A|CARGO|RESCIS|$)/i);
  const afstText = secAfst ? secAfst[1] : text;
  debug.matches.secao_afastamentos = (secAfst ? secAfst[0] : 'seção não encontrada, buscando no texto completo').substring(0, 300);

  // Padrões para AUX.DOENÇA
  const auxPatterns = [
    /AUX\.?\s*DOEN[CÇ]A\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/gi,
    /AUX\.?\s*DOEN[CÇ]A[^\n\d]*(\d{2}\/\d{2}\/\d{4})[^\n\d]*(\d{2}\/\d{2}\/\d{4})/gi,
    /B31[^\n]*(\d{2}\/\d{2}\/\d{4})[^\n]*(\d{2}\/\d{2}\/\d{4})/gi, // código INSS
    /BENEFICIO[^\n]*(\d{2}\/\d{2}\/\d{4})[^\n]*(\d{2}\/\d{2}\/\d{4})/gi,
  ];
  for (const p of auxPatterns) {
    const matches = [...afstText.matchAll(p)];
    if (matches.length > 0) {
      for (const m of matches) afastamentos.push({ tipo: 'beneficio_comum', inicio: m[1], fim: m[2] });
      debug.matches.aux_doenca = matches.map(m => m[0]).join(' | ');
      break;
    }
  }

  // Padrões para LIC.MATERNIDADE
  const matPatterns = [
    /LIC\.?\s*MATERNIDADE\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/gi,
    /LIC\.?\s*MATERNIDADE[^\n\d]*(\d{2}\/\d{2}\/\d{4})[^\n\d]*(\d{2}\/\d{2}\/\d{4})/gi,
    /MATERNIDADE[^\n]*(\d{2}\/\d{2}\/\d{4})[^\n]*(\d{2}\/\d{2}\/\d{4})/gi,
    /B91[^\n]*(\d{2}\/\d{2}\/\d{4})[^\n]*(\d{2}\/\d{2}\/\d{4})/gi,
  ];
  for (const p of matPatterns) {
    const matches = [...afstText.matchAll(p)];
    if (matches.length > 0) {
      for (const m of matches) afastamentos.push({ tipo: 'licenca_maternidade', inicio: m[1], fim: m[2] });
      debug.matches.maternidade = matches.map(m => m[0]).join(' | ');
      break;
    }
  }

  result.afastamentos = afastamentos;
  result._debug = debug;
  return result;
}

// ─── CARTÃO DE PONTO ──────────────────────────────────────────────────────────
function parseCartaoPonto(text) {
  const result = {};
  const debug = { matches: {}, sample_lines: [] };

  const ignorar = [
    'ATESTADO', 'AUX.DOENCA', 'AUX. DOENCA', 'AUXDOENCA',
    'LIC.MATERNIDADE', 'LIC. MATERNIDADE', 'LICMATERNIDADE',
    'PEDIDO DE RESCISAO', 'RESCISAO', 'FERIADO', 'FOLGA',
    'FALTA', 'DSR', 'COMPENSACAO'
  ];

  const linhas = text.split(/\r?\n/);
  let ultimoDiaTrabalhado = null;
  let ultimaData = null;

  for (const linha of linhas) {
    const linhaUpper = linha.toUpperCase();
    if (ignorar.some(ig => linhaUpper.includes(ig))) continue;

    // Extrair data da linha (DD/MM/AAAA ou DD/MM/AA)
    const dataM = linha.match(/(\d{2}\/\d{2}\/(?:\d{4}|\d{2}))/);
    // Contar horários HH:MM na linha
    const horarios = linha.match(/\b\d{2}:\d{2}\b/g);

    if (dataM && horarios && horarios.length >= 2) {
      let dataStr = dataM[1];
      const partes = dataStr.split('/');
      if (partes[2] && partes[2].length === 2) partes[2] = '20' + partes[2];
      dataStr = partes.join('/');
      ultimoDiaTrabalhado = dataStr;
      debug.sample_lines.push(`${linha.trim().substring(0, 80)}`);
    } else if (dataM && !horarios) {
      // Linha só com data — próxima linha pode ter horários
      ultimaData = dataM[1];
    } else if (!dataM && horarios && horarios.length >= 2 && ultimaData) {
      // Linha só com horários, usa a data da linha anterior
      let dataStr = ultimaData;
      const partes = dataStr.split('/');
      if (partes[2] && partes[2].length === 2) partes[2] = '20' + partes[2];
      dataStr = partes.join('/');
      ultimoDiaTrabalhado = dataStr;
      debug.sample_lines.push(`DATA: ${ultimaData} | ${linha.trim().substring(0, 60)}`);
    }
  }

  // Limitar debug a últimas 5 linhas válidas
  debug.sample_lines = debug.sample_lines.slice(-5);

  if (ultimoDiaTrabalhado) {
    result.ultimo_dia_trabalhado = ultimoDiaTrabalhado;
    debug.matches.ultimo_dia = ultimoDiaTrabalhado;
  }

  result._debug = debug;
  return result;
}

// ─── FICHA FINANCEIRA ─────────────────────────────────────────────────────────
function parseFichaFinanceira(text) {
  const result = {};
  const debug = { matches: {} };

  // Estratégia: encontrar o mês mais recente e extrair valores do PERÍODO 1 e PERÍODO 2
  // Primeiro, mostra as primeiras linhas para debug
  debug.primeiras_linhas = text.split('\n').slice(0, 30).join('\n');

  // Adiantamento (cod 017 ou "ADIANTAMENTO")
  // Procura em linhas que contenham "017" ou variantes de "ADIANTAMENTO"
  const linhas = text.split('\n');

  for (const linha of linhas) {
    const lnorm = normStr(linha);
    const temCod017 = /\b017\b/.test(linha);
    const temAdiant = lnorm.includes('adiantamento') || lnorm.includes('adt sal') || lnorm.includes('adt. sal');

    if ((temCod017 || temAdiant) && !result.adiantamento) {
      const vals = [...linha.matchAll(BRL_G)];
      if (vals.length > 0) {
        // Pegar o maior valor na linha (evita pegar horas/referência)
        const parsed = vals.map(v => ({ str: v[0], val: parseBRCurrency(v[0]) })).filter(v => v.val > 1);
        if (parsed.length > 0) {
          const maior = parsed.reduce((a, b) => b.val > a.val ? b : a);
          result.adiantamento = maior.val;
          debug.matches.adiantamento = `[linha: ${linha.trim().substring(0, 80)}] → ${maior.str}`;
        }
      }
    }
  }

  // Salário base (cod 001 + SALARIO ou só "SALARIO BASE")
  for (const linha of linhas) {
    const lnorm = normStr(linha);
    const tem001 = /\b001\b/.test(linha);
    const temSalBase = lnorm.includes('salario base') || lnorm.includes('sal. base') || lnorm.includes('sal base');

    if ((tem001 || temSalBase) && !result.salario_base) {
      const vals = [...linha.matchAll(BRL_G)];
      if (vals.length > 0) {
        const parsed = vals.map(v => ({ str: v[0], val: parseBRCurrency(v[0]) })).filter(v => v.val > 100);
        if (parsed.length > 0) {
          // Pegar o maior valor (salário costuma ser o maior)
          const maior = parsed.reduce((a, b) => b.val > a.val ? b : a);
          result.salario_base = maior.val;
          debug.matches.salario_base = `[linha: ${linha.trim().substring(0, 80)}] → ${maior.str}`;
        }
      }
    }
  }

  // Fallback para adiantamento: qualquer linha com PERÍODO 1 que tenha valor BRL
  if (!result.adiantamento) {
    const per1 = text.match(/PER[IÍ]ODO\s*1[\s\S]{0,500}?(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/i);
    if (per1) {
      result.adiantamento = parseBRCurrency(per1[1]);
      debug.matches.adiantamento_fallback = per1[0].substring(0, 100);
    }
  }

  result._debug = debug;
  return result;
}

// ─── HISTÓRICO DE FÉRIAS ──────────────────────────────────────────────────────
function parseHistoricoFerias(text) {
  const result = {};
  const debug = { matches: [], linhas_periodos: [] };

  const linhas = text.split(/\r?\n/);
  let periodos_vencidos = 0;

  for (const linha of linhas) {
    // Detectar linha de período aquisitivo
    // Formato típico: "04/06/2024 a 03/06/2025" ou "04/06/2024  03/06/2025"
    const datas = linha.match(/\d{2}\/\d{2}\/\d{4}/g) || [];

    if (datas.length < 2) continue;

    const lnorm = normStr(linha);

    // Ignorar linhas de cabeçalho
    if (lnorm.includes('periodo') && lnorm.includes('inicio') && !datas.length) continue;
    if (lnorm.includes('aquisitivo') && !datas.length) continue;

    debug.linhas_periodos.push(linha.trim().substring(0, 100));

    // Se a linha tem exatamente 2 datas = sem data de gozo = VENCIDA
    // Se tem 3 ou mais datas = tem data de início de gozo = NÃO é vencida
    // Verificar também se tem "GOZO" ou "INICIO" na linha
    const temGozo = /GOZO|IN[IÍ]CIO\s+GOZO|FRUIC/i.test(linha);

    if (datas.length === 2 && !temGozo) {
      periodos_vencidos++;
      debug.matches.push(`VENCIDA: ${linha.trim().substring(0, 80)}`);
    } else if (datas.length >= 3) {
      debug.matches.push(`GOZADA: ${linha.trim().substring(0, 80)}`);
    } else if (datas.length === 2 && temGozo) {
      debug.matches.push(`COM GOZO (2 datas + keyword): ${linha.trim().substring(0, 80)}`);
    }
  }

  result.ferias_vencidas_periodos = periodos_vencidos;
  result._debug = debug;
  return result;
}

module.exports = {
  extractTextFromPDF,
  detectDocumentType,
  parseAtaAudiencia,
  parseHistoricoMovimentacoes,
  parseCartaoPonto,
  parseFichaFinanceira,
  parseHistoricoFerias
};
