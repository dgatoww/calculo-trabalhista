const pdfParse = require('pdf-parse');
const fs = require('fs');

const MESES = {
  'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3,
  'abril': 4, 'maio': 5, 'junho': 6, 'julho': 7,
  'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
};

// Converte valor BR "1.780,00" ou "1780,00" para float
function parseBRCurrency(str) {
  if (!str) return null;
  str = str.trim();
  if (str.includes(',')) {
    // Formato BR: "1.780,00" → remover pontos de milhar, trocar vírgula por ponto
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }
  // Formato US ou sem decimais: "1780.00" ou "1780"
  return parseFloat(str.replace(/,/g, ''));
}

// Regex para capturar valor monetário BR: obriga vírgula + 2 decimais exatos
// Isso evita capturar taxas como "0,00481" (5 decimais)
const BRL_VALUE = /[\d.]+,\d{2}(?!\d)/;

async function extractTextFromPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

function parseAtaAudiencia(text) {
  const result = {};

  // Numero do processo
  const processoMatch = text.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
  if (processoMatch) result.numero_processo = processoMatch[1];

  // Data da audiencia (data rescisao) - múltiplos padrões PJe
  const dataPatterns = [
    /Em\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    /Aos\s+(\d{1,2})\s+(?:\(\w+\)\s+)?dias?\s+do\s+m[eê]s\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    /Aos\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    /realizada\s+(?:em\s+)?(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    /data[:\s]+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
  ];
  for (const pattern of dataPatterns) {
    const m = text.match(pattern);
    if (m) {
      const dia = m[1].padStart(2, '0');
      const mesStr = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const mes = MESES[m[2].toLowerCase()] || MESES[mesStr];
      const ano = m[3];
      if (mes) {
        result.data_rescisao = `${dia}/${String(mes).padStart(2, '0')}/${ano}`;
        break;
      }
    }
  }

  // Reclamante — nome em maiúsculas após o marcador
  const reclamanteMatch = text.match(/RECLAMANTE[:\s]+([^\n\r,;]+)/i);
  if (reclamanteMatch) result.nome_reclamante = reclamanteMatch[1].replace(/CPF.*/i, '').trim();

  // Reclamada — permite letras, números, /,. (LTDA, S/A, CNPJ na mesma linha)
  const reclamadoPatterns = [
    /RECLAMAD[OA][:\s]+([^\n\r]+)/i,
    /EMPRESA[:\s]+([^\n\r]+)/i,
    /EMPREGADOR[A]?[:\s]+([^\n\r]+)/i,
  ];
  for (const pattern of reclamadoPatterns) {
    const m = text.match(pattern);
    if (m) {
      result.nome_reclamada = m[1].replace(/CNPJ.*/i, '').replace(/CPF.*/i, '').trim();
      break;
    }
  }

  // Data admissao (na secao FGTS)
  const admissaoPatterns = [
    /[Aa]dmiss[ãa]o[:\s]+(\d{2}\/\d{2}\/\d{4})/,
    /DATA\s+DE\s+ADMISS[ÃA]O[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /admitid[ao]\s+em[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
  ];
  for (const pattern of admissaoPatterns) {
    const m = text.match(pattern);
    if (m) { result.data_admissao = m[1]; break; }
  }

  // Valor da causa
  const valorMatch = text.match(/Valor\s+da\s+causa[:\s]+R\$\s*([\d.]+,\d{2})/i);
  if (valorMatch) result.valor_causa = parseBRCurrency(valorMatch[1]);

  return result;
}

function parseHistoricoMovimentacoes(text) {
  const result = {};

  // Nome
  const nomeMatch = text.match(/NOME[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s]+?)(?:\n|\r|$)/i);
  if (nomeMatch) result.nome = nomeMatch[1].trim();

  // Data admissao
  const admissaoPatterns = [
    /DATA\s+ADMISS[ÃA]O[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /ADMISS[ÃA]O[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
    /DT\s*ADM[:\s]+(\d{2}\/\d{2}\/\d{4})/i,
  ];
  for (const pattern of admissaoPatterns) {
    const m = text.match(pattern);
    if (m) { result.data_admissao = m[1]; break; }
  }

  // Cargo
  const cargoMatch = text.match(/CARGO[:\s]+([^\n\r]+)/i);
  if (cargoMatch) result.cargo = cargoMatch[1].trim();

  // Ultimo salario — exige formato BRL (vírgula + 2 casas exatas)
  // Tenta extrair a seção de mudança de salário primeiro
  const salarioSection = text.match(/HIST[OÓ]RICO DE MUDAN[CÇ]A DE SAL[ÁA]RIO([\s\S]*?)(?:HIST[OÓ]RICO|AFASTAMENTO|$)/i);
  if (salarioSection) {
    const salarioMatches = [...salarioSection[1].matchAll(/(\d{2}\/\d{2}\/\d{4})[^\n]*([\d.]+,\d{2})(?!\d)/g)];
    if (salarioMatches.length > 0) {
      const last = salarioMatches[salarioMatches.length - 1];
      result.salario = parseBRCurrency(last[2]);
    }
  }
  // Fallback: procurar salário sem seção específica
  if (!result.salario) {
    const salFallback = [...text.matchAll(/SAL[ÁA]RIO[^\n]*([\d.]+,\d{2})(?!\d)/gi)];
    if (salFallback.length > 0) {
      result.salario = parseBRCurrency(salFallback[salFallback.length - 1][1]);
    }
  }

  // Afastamentos — busca seção específica, depois full-text
  const afastamentos = [];
  const afastText = (() => {
    const sec = text.match(/HIST[OÓ]RICO DE AFASTAMENTOS([\s\S]*?)(?:HIST[OÓ]RICO|$)/i);
    return sec ? sec[1] : text;
  })();

  // AUX.DOENÇA — data início e fim na mesma linha ou linhas próximas
  const auxPattern = /AUX[.\s]*DOEN[CÇ]A\D{0,30}(\d{2}\/\d{2}\/\d{4})\D{1,20}(\d{2}\/\d{2}\/\d{4})/gi;
  for (const m of afastText.matchAll(auxPattern)) {
    afastamentos.push({ tipo: 'beneficio_comum', inicio: m[1], fim: m[2] });
  }

  const matPattern = /LIC[.\s]*MATERNIDADE\D{0,30}(\d{2}\/\d{2}\/\d{4})\D{1,20}(\d{2}\/\d{2}\/\d{4})/gi;
  for (const m of afastText.matchAll(matPattern)) {
    afastamentos.push({ tipo: 'licenca_maternidade', inicio: m[1], fim: m[2] });
  }

  result.afastamentos = afastamentos;

  return result;
}

function parseCartaoPonto(text) {
  const result = {};

  const linhas = text.split(/\r?\n/);
  let ultimoDiaTrabalhado = null;

  const ignorar = [
    'ATESTADO', 'AUX.DOENCA', 'AUX. DOENCA', 'AUX DOENCA',
    'LIC.MATERNIDADE', 'LIC. MATERNIDADE', 'LIC MATERNIDADE',
    'PEDIDO DE RESCISAO', 'PEDIDO DE RESCISÃO', 'FERIADO', 'FOLGA'
  ];

  for (const linha of linhas) {
    const linhaUpper = linha.toUpperCase();
    if (ignorar.some(ig => linhaUpper.includes(ig))) continue;

    // Data na linha: DD/MM/AAAA ou DD/MM/AA
    const dataMatch = linha.match(/(\d{2}\/\d{2}\/\d{2,4})/);
    if (!dataMatch) continue;

    // Precisa ter pelo menos 2 horários no formato HH:MM
    const horarios = linha.match(/\d{2}:\d{2}/g);
    if (horarios && horarios.length >= 2) {
      let dataStr = dataMatch[1];
      // Normalizar ano de 2 dígitos para 4 dígitos
      const partes = dataStr.split('/');
      if (partes[2] && partes[2].length === 2) {
        partes[2] = '20' + partes[2];
        dataStr = partes.join('/');
      }
      ultimoDiaTrabalhado = dataStr;
    }
  }

  if (ultimoDiaTrabalhado) result.ultimo_dia_trabalhado = ultimoDiaTrabalhado;

  return result;
}

function parseFichaFinanceira(text) {
  const result = {};

  // Tentar encontrar o bloco do mês mais recente
  // Estrutura: PERIODO 1 (adiantamento) e PERIODO 2 (fechamento)
  // Cod 017 = adiantamento, Cod 001 = salário base

  // Adiantamento (cod 017) — exige BRL format
  const adiantPatterns = [
    /\b017\b[^\n]*([\d.]+,\d{2})(?!\d)/,
    /ADIANTAMENTO[^\n]*([\d.]+,\d{2})(?!\d)/i,
    /ADT\s+SAL[^\n]*([\d.]+,\d{2})(?!\d)/i,
  ];
  for (const pattern of adiantPatterns) {
    const m = text.match(pattern);
    if (m) {
      const val = parseBRCurrency(m[1]);
      if (val && val > 1) { // ignorar valores insignificantes
        result.adiantamento = val;
        break;
      }
    }
  }

  // Salário base (cod 001) — exige BRL format
  const salarioPatterns = [
    /\b001\b[^\n]*SAL[ÁA]RIO[^\n]*([\d.]+,\d{2})(?!\d)/i,
    /SAL[ÁA]RIO\s+BASE[^\n]*([\d.]+,\d{2})(?!\d)/i,
    /\b001\b[^\n]*([\d.]+,\d{2})(?!\d)/,
  ];
  for (const pattern of salarioPatterns) {
    const m = text.match(pattern);
    if (m) {
      const val = parseBRCurrency(m[1]);
      if (val && val > 1) {
        result.salario_base = val;
        break;
      }
    }
  }

  return result;
}

function parseHistoricoFerias(text) {
  const result = {};

  let periodos_vencidos = 0;
  const linhas = text.split(/\r?\n/);

  for (const linha of linhas) {
    // Linha com período aquisitivo: DD/MM/AAAA a DD/MM/AAAA
    const periodoMatch = linha.match(/(\d{2}\/\d{2}\/\d{4})\s+[aA]\s+(\d{2}\/\d{2}\/\d{4})/);
    if (!periodoMatch) continue;

    // Contar datas na linha — se tiver 3 ou mais datas = tem data de gozo = não é vencida
    const todasDatas = linha.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    if (todasDatas.length < 3) {
      // Verificar também se a linha contém "GOZO" ou "INICIO" de férias
      const temGozo = /GOZO|INICIO|INÍCIO|FRUIÇÃO|FRUICAO/i.test(linha);
      if (!temGozo) {
        periodos_vencidos++;
      }
    }
  }

  result.ferias_vencidas_periodos = periodos_vencidos;
  return result;
}

module.exports = {
  extractTextFromPDF,
  parseAtaAudiencia,
  parseHistoricoMovimentacoes,
  parseCartaoPonto,
  parseFichaFinanceira,
  parseHistoricoFerias
};
