const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Lazy-load tesseract to avoid startup issues
let Tesseract = null;

async function getTesseract() {
  if (!Tesseract) {
    Tesseract = require('tesseract.js');
  }
  return Tesseract;
}

/**
 * Extract text from PDF using pdf-parse, fallback to OCR with tesseract
 */
async function extractText(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    const text = data.text || '';
    console.log(`PDF text extracted: ${text.length} characters`);

    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length < 100) {
      console.log('Text too short, attempting OCR...');
      return await extractWithOCR(filePath);
    }

    return text;
  } catch (error) {
    console.error('pdf-parse error:', error.message);
    console.log('Falling back to OCR...');
    try {
      return await extractWithOCR(filePath);
    } catch (ocrError) {
      console.error('OCR also failed:', ocrError.message);
      return '';
    }
  }
}

/**
 * Extract text using Tesseract OCR
 */
async function extractWithOCR(filePath) {
  try {
    const tesseract = await getTesseract();
    console.log('Running OCR on:', filePath);

    const { data: { text } } = await tesseract.recognize(filePath, 'por+eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`OCR progress: ${Math.round(m.progress * 100)}%\r`);
        }
      }
    });

    console.log(`\nOCR completed: ${text.length} characters`);
    return text;
  } catch (error) {
    console.error('OCR error:', error.message);
    return '';
  }
}

/**
 * Parse Brazilian date formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, or "DD de Mês de YYYY"
 */
function parseBrazilianDate(dateStr) {
  if (!dateStr) return null;

  const months = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  // "DD de Mês de YYYY"
  const namedMatch = dateStr.match(/(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})/i);
  if (namedMatch) {
    const month = months[namedMatch[2].toLowerCase()];
    if (month) {
      return `${namedMatch[3]}-${month}-${namedMatch[1].padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const numericMatch = dateStr.match(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/);
  if (numericMatch) {
    return `${numericMatch[3]}-${numericMatch[2]}-${numericMatch[1]}`;
  }

  return null;
}

/**
 * Parse Brazilian currency: R$ 1.234,56
 */
function parseBrazilianCurrency(valueStr) {
  if (!valueStr) return null;

  const clean = valueStr
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// ============================================================
// 1. Termo de Audiência (PJe/TRT format)
// ============================================================
function extractAtaAudiencia(text) {
  const fields = {};

  // Número do processo (CNJ format: 0000000-00.0000.0.00.0000)
  const numProcessoMatch = text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  if (numProcessoMatch) {
    fields.numero_processo = numProcessoMatch[0];
  }

  // Data da audiência → data_rescisao
  // Pattern: "Em 13 de março de 2026" or similar (handles accented months like março, fevereiro)
  // Normalize text to collapse multiple spaces/newlines
  const normalizedText = text.replace(/\s+/g, ' ');
  const dataAudienciaMatch = normalizedText.match(/Em\s+(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})/i);
  if (dataAudienciaMatch) {
    const months = {
      'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
      'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
      'agosto': '08', 'setembro': '09', 'outubro': '10',
      'novembro': '11', 'dezembro': '12'
    };
    const month = months[dataAudienciaMatch[2].toLowerCase()];
    if (month) {
      fields.data_rescisao = `${dataAudienciaMatch[3]}-${month}-${dataAudienciaMatch[1].padStart(2, '0')}`;
    }
  }

  // Fallback: look for explicit date patterns if no "Em X de Mês de YYYY" found
  if (!fields.data_rescisao) {
    const rescisaoPatterns = [
      /data\s+(?:da\s+)?(?:audi[eê]ncia|sess[aã]o)[:\s]+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
      /rescis[aã]o[:\s]+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
      /data\s+de\s+rescis[aã]o[:\s]+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
      /realizada\s+(?:em|no dia)\s+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i
    ];
    for (const pattern of rescisaoPatterns) {
      const match = text.match(pattern);
      if (match) {
        const parsed = parseBrazilianDate(match[1]);
        if (parsed) { fields.data_rescisao = parsed; break; }
      }
    }
  }

  // Reclamante
  const reclamanteMatch = text.match(/RECLAMANTE:\s*(.+)/i);
  if (reclamanteMatch) {
    fields.nome_reclamante = reclamanteMatch[1].trim().split('\n')[0].trim();
  }

  // Reclamado(a)
  const reclamadoMatch = text.match(/RECLAMAD[OA]\(?A?\)?:\s*(.+)/i);
  if (reclamadoMatch) {
    fields.nome_reclamado = reclamadoMatch[1].trim().split('\n')[0].trim();
  }

  // Data de admissão (from FGTS section)
  const admissaoMatch = text.match(/Admiss[aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (admissaoMatch) {
    const parsed = parseBrazilianDate(admissaoMatch[1]);
    if (parsed) fields.data_admissao = parsed;
  }

  // Valor da causa
  const valorCausaMatch = text.match(/Valor\s+da\s+causa:\s*R\$\s*([\d\.,]+)/i);
  if (valorCausaMatch) {
    const val = parseBrazilianCurrency(valorCausaMatch[1]);
    if (val) fields.valor_causa = val;
  }

  return fields;
}

// ============================================================
// 2. Histórico de Movimentações (Relatório 11.003)
// ============================================================
function extractHistoricoMovimentacoes(text) {
  const fields = {};
  const lines = text.split('\n');

  // Nome
  const nomeMatch = text.match(/NOME:\s*(.+)/i);
  if (nomeMatch) {
    fields.nome_reclamante = nomeMatch[1].trim().split('\n')[0].trim();
  }

  // Data de admissão
  const admissaoMatch = text.match(/DATA\s+ADMISS[AÃ]O[\s:]+(\d{2}\/\d{2}\/\d{4})/i);
  if (admissaoMatch) {
    const parsed = parseBrazilianDate(admissaoMatch[1]);
    if (parsed) fields.data_admissao = parsed;
  }

  // Cargo/Função
  const cargoMatch = text.match(/CARGO:\s*(.+)/i);
  if (cargoMatch) {
    fields.funcao = cargoMatch[1].trim().split('\n')[0].trim();
  }

  // Salário: find "HISTORICO DE MUDANCA DE SALARIO" section, get LAST monetary value
  const salarioSectionIdx = text.search(/HISTORICO\s+DE\s+MUDANCA\s+DE\s+SALARIO/i);
  if (salarioSectionIdx !== -1) {
    // Find next section header or end of text
    const afterSection = text.slice(salarioSectionIdx);
    const nextSectionMatch = afterSection.slice(50).search(/HISTORICO\s+DE\s+/i);
    const sectionText = nextSectionMatch !== -1
      ? afterSection.slice(0, nextSectionMatch + 50)
      : afterSection;

    // Find all currency values in this section
    const currencyMatches = [...sectionText.matchAll(/R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g)];
    if (currencyMatches.length > 0) {
      // Take the LAST value (most recent salary)
      const lastMatch = currencyMatches[currencyMatches.length - 1];
      const salary = parseBrazilianCurrency(lastMatch[1]);
      if (salary && salary > 0) {
        fields.salario = salary;
      }
    }
  }

  // Afastamentos: find "HISTORICO DE AFASTAMENTOS" section
  const afastamentoSectionIdx = text.search(/HISTORICO\s+DE\s+AFASTAMENTOS/i);
  if (afastamentoSectionIdx !== -1) {
    const sectionText = text.slice(afastamentoSectionIdx);
    const sectionLines = sectionText.split('\n').slice(1); // skip header line
    const afastamentos = [];

    // Buffer to accumulate tokens when dates span across lines
    let dateBuffer = [];
    let motivoBuffer = '';

    const classifyMotivo = (str) => {
      const up = str.toUpperCase();
      if (up.includes('AUX.DOENCA') || up.includes('AUX. DOENCA') ||
          up.includes('AUX.DOENÇA') || up.includes('AUXILIO DOENCA') ||
          up.includes('AUXÍLIO DOENÇA') || up.includes('AUXILIO-DOENCA')) {
        return { motivo: 'AUX.DOENCA', tipo: 'beneficio_comum' };
      }
      if (up.includes('MATERNIDADE')) {
        return { motivo: up.includes('LIC') ? 'LIC.MATERNIDADE' : 'MATERNIDADE', tipo: 'licenca_maternidade' };
      }
      if (up.includes('ACIDENTE')) {
        return { motivo: 'ACIDENTE DE TRABALHO', tipo: 'beneficio_comum' };
      }
      return { motivo: str.trim(), tipo: 'outros' };
    };

    const flushBuffer = () => {
      if (dateBuffer.length >= 2) {
        const dataInicio = parseBrazilianDate(dateBuffer[0]);
        const dataFim = parseBrazilianDate(dateBuffer[1]);
        if (dataInicio && dataFim) {
          const { motivo, tipo } = classifyMotivo(motivoBuffer);
          afastamentos.push({ data_inicio: dataInicio, data_fim: dataFim, motivo, tipo });
        }
      }
      dateBuffer = [];
      motivoBuffer = '';
    };

    for (const line of sectionLines) {
      if (!line.trim()) continue;
      // Stop at next major section (but not AFASTAMENTOS itself)
      if (/HISTORICO\s+DE\s+/i.test(line) && !/AFASTAMENTO/i.test(line)) break;
      // Skip header lines (INICIO, FIM, MOTIVO, etc.)
      if (/^(INICIO|IN[IÍ]CIO|FIM|DATA|MOTIVO|TIPO|DIAS)\s/i.test(line.trim())) continue;

      const datesInLine = [...line.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)];

      if (datesInLine.length >= 2) {
        // Flush previous buffer if any
        flushBuffer();
        // Extract both dates and optional motivo from this line
        const dataInicio = parseBrazilianDate(datesInLine[0][1]);
        const dataFim = parseBrazilianDate(datesInLine[1][1]);
        if (dataInicio && dataFim) {
          // Motivo: everything after the second date
          const afterSecondDate = line.slice(line.indexOf(datesInLine[1][1]) + 10).trim();
          const { motivo, tipo } = classifyMotivo(afterSecondDate || line);
          afastamentos.push({ data_inicio: dataInicio, data_fim: dataFim, motivo, tipo });
        }
      } else if (datesInLine.length === 1) {
        // One date per line — accumulate
        if (dateBuffer.length === 0) {
          dateBuffer.push(datesInLine[0][1]);
          // Capture any text that might be the motivo
          const afterDate = line.slice(line.indexOf(datesInLine[0][1]) + 10).trim();
          if (afterDate) motivoBuffer = afterDate;
        } else if (dateBuffer.length === 1) {
          dateBuffer.push(datesInLine[0][1]);
          const afterDate = line.slice(line.indexOf(datesInLine[0][1]) + 10).trim();
          if (afterDate) motivoBuffer += ' ' + afterDate;
          // Try to get motivo from the whole line too
          const fullLineMotivo = line.trim();
          if (!motivoBuffer) motivoBuffer = fullLineMotivo;
          flushBuffer();
        }
      } else if (dateBuffer.length > 0) {
        // No dates in this line but we have a buffer — might be a motivo continuation
        motivoBuffer += ' ' + line.trim();
      }
    }
    // Flush any remaining
    flushBuffer();

    if (afastamentos.length > 0) {
      fields.afastamentos = JSON.stringify(afastamentos);
    }
  }

  return fields;
}

// ============================================================
// 3. Cartão de Ponto
// ============================================================
function extractCartaoPonto(text) {
  const fields = {};
  const lines = text.split('\n');

  const IGNORE_KEYWORDS = [
    'ATESTADO MEDICO', 'AUX.DOENCA', 'AUX. DOENCA', 'LIC.MATERNIDADE',
    'LIC. MATERNIDADE', 'LICENCA MATERNIDADE', 'LICENÇA MATERNIDADE',
    'PEDIDO DE RESCISAO', 'PEDIDO DE RESCISÃO'
  ];

  const monthNames = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  let currentMonth = null;
  let currentYear = null;
  let lastValidDate = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();

    // Detect month headers (e.g., "FEVEREIRO/2025", "02/2025", "FEVEREIRO DE 2025")
    const namedMonthHeader = trimmed.match(
      /(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[^\d]*(\d{4})/i
    );
    if (namedMonthHeader) {
      currentMonth = monthNames[namedMonthHeader[1].toLowerCase()];
      currentYear = namedMonthHeader[2];
      continue;
    }
    const numericMonthHeader = trimmed.match(/^(\d{2})[\/\-](\d{4})$/);
    if (numericMonthHeader) {
      currentMonth = numericMonthHeader[1];
      currentYear = numericMonthHeader[2];
      continue;
    }

    // Skip lines with ignore keywords
    if (IGNORE_KEYWORDS.some(kw => upper.includes(kw))) continue;

    // Check for ≥2 time patterns (HH:MM)
    const times = trimmed.match(/\d{2}:\d{2}/g);
    if (!times || times.length < 2) continue;

    // Try full date in line
    const fullDateMatch = trimmed.match(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/);
    if (fullDateMatch) {
      lastValidDate = `${fullDateMatch[3]}-${fullDateMatch[2]}-${fullDateMatch[1]}`;
      continue;
    }

    // Try day-only at start of line (e.g., "07 08:00 12:00 ...")
    const dayOnlyMatch = trimmed.match(/^(\d{1,2})\s/);
    if (dayOnlyMatch && currentMonth && currentYear) {
      const day = dayOnlyMatch[1].padStart(2, '0');
      lastValidDate = `${currentYear}-${currentMonth}-${day}`;
    }
  }

  if (lastValidDate) {
    fields.ultimo_dia_trabalhado = lastValidDate;
  }

  return fields;
}

// ============================================================
// 4. Ficha Financeira (Relatório 11.013)
// ============================================================
function extractFichaFinanceira(text) {
  const fields = {};
  const lines = text.split('\n');

  // Structure: group lines by month/period
  // Look for month markers and collect codes 001, 017, 125
  // Format: <month> <year> PERIODO 1 / PERIODO 2
  // Line format: <cod> <description> <value>

  const months = {};
  let currentKey = null; // "YYYY-MM"
  let currentPeriod = null; // 1 or 2

  const monthNames = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect month header
    const monthNameMatch = trimmed.match(
      /(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[^\d]*(\d{4})/i
    );
    if (monthNameMatch) {
      const m = monthNames[monthNameMatch[1].toLowerCase()];
      currentKey = `${monthNameMatch[2]}-${m}`;
      currentPeriod = null;
      if (!months[currentKey]) months[currentKey] = { p1: {}, p2: {} };
      continue;
    }

    // Detect PERIODO 1 / PERIODO 2
    if (/PERIODO\s*1/i.test(trimmed)) { currentPeriod = 1; continue; }
    if (/PERIODO\s*2/i.test(trimmed)) { currentPeriod = 2; continue; }

    if (!currentKey || !currentPeriod) continue;

    // Parse line: starts with 3-digit code
    const codeMatch = trimmed.match(/^(\d{3})\s+(.+?)\s+([\d\.,]+)\s*$/);
    if (codeMatch) {
      const code = codeMatch[1];
      const value = parseBrazilianCurrency(codeMatch[3]);
      if (value === null || value === 0) continue;

      const period = currentPeriod === 1 ? 'p1' : 'p2';
      if (!months[currentKey][period][code]) {
        months[currentKey][period][code] = 0;
      }
      months[currentKey][period][code] += value;
    }
  }

  // Find the most recent month with values
  const sortedKeys = Object.keys(months).sort().reverse();
  let targetKey = null;
  for (const key of sortedKeys) {
    const m = months[key];
    const hasValues = Object.values(m.p1).some(v => v > 0) || Object.values(m.p2).some(v => v > 0);
    if (hasValues) { targetKey = key; break; }
  }

  // Always store all months for later use by calculator
  fields.ficha_meses_json = JSON.stringify(months);

  if (targetKey) {
    const m = months[targetKey];

    // Salary: code 001 from PERIODO 2
    if (m.p2['001']) {
      fields.salario = m.p2['001'];
    } else if (m.p1['001']) {
      fields.salario = m.p1['001'];
    }

    // Adiantamento salarial: code 017 from PERIODO 1 (already received by employee)
    const adiantamento = (m.p1['017'] || 0);
    if (adiantamento > 0) {
      fields.adiantamento_quinzena = adiantamento;
    }

    // Fechamento: code 001 from PERIODO 2 (salary payment for second half if already paid)
    const fechamento = (m.p2['001'] || 0);
    if (fechamento > 0) {
      fields.fechamento_salario = fechamento;
    }

    // Build deductions list:
    // - Adiantamento (017 period 1): already paid to employee → deduct from saldo
    // - Fechamento (001 period 2): if already paid → deduct from saldo
    // - Other period 2 deductions (125, etc.)
    const deducoes = [];
    if (adiantamento > 0) {
      deducoes.push({ codigo: '017', periodo: 1, descricao: 'Adiantamento Salarial', valor: adiantamento });
    }
    if (fechamento > 0) {
      deducoes.push({ codigo: '001', periodo: 2, descricao: 'Fechamento Salarial', valor: fechamento });
    }
    // Additional period 2 deductions (125, etc. — excluding 001 and 017 already handled)
    const extraDeductionCodes = ['125'];
    for (const code of extraDeductionCodes) {
      if (m.p2[code]) {
        deducoes.push({ codigo: code, periodo: 2, descricao: `Desconto cód.${code}`, valor: m.p2[code] });
      }
    }

    if (deducoes.length > 0) {
      fields.deducoes_ficha = JSON.stringify(deducoes);
      fields.total_deducoes_mes_rescisao = deducoes.reduce((sum, d) => sum + d.valor, 0);
    }
  }

  return fields;
}

// ============================================================
// 5. Histórico de Férias (Relatório 11.004)
// ============================================================
function extractHistoricoFerias(text) {
  const fields = {};
  const lines = text.split('\n');

  // Look for aquisitive period table
  // Typical format: columns with aquisitive start/end and gozo start/end
  // If gozo columns are empty → férias vencidas

  const periodos = [];
  const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;

  // Find the section with aquisitive periods
  let inPeriodSection = false;
  for (const line of lines) {
    const upper = line.toUpperCase();

    // Detect section header
    if (/PER[IÍ]ODO\s+AQUISITIVO/i.test(line) || /FERIAS/i.test(line)) {
      inPeriodSection = true;
    }

    if (!inPeriodSection) continue;

    const datesInLine = [...line.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)];
    if (datesInLine.length < 2) continue;

    const dates = datesInLine.map(m => parseBrazilianDate(m[1]));

    // Expect at least [aquisitivo_inicio, aquisitivo_fim]
    if (!dates[0] || !dates[1]) continue;

    const periodo = {
      aquisitivo_inicio: dates[0],
      aquisitivo_fim: dates[1],
      gozo_inicio: dates[2] || null,
      gozo_fim: dates[3] || null,
      gozada: !!(dates[2])
    };
    periodos.push(periodo);
  }

  if (periodos.length > 0) {
    fields.periodos_ferias_raw = JSON.stringify(periodos);

    const vencidas = periodos.filter(p => !p.gozada);
    fields.ferias_vencidas_count = vencidas.length;
    if (vencidas.length > 0) {
      fields.ferias_vencidas_periodos = JSON.stringify(vencidas);
    }
  }

  return fields;
}

/**
 * Main extraction function
 */
async function extractFromDocument(filePath, documentType) {
  const text = await extractText(filePath);

  let extractedFields = {};

  switch (documentType) {
    case 'termo_audiencia':
      extractedFields = extractAtaAudiencia(text);
      break;
    case 'cartao_ponto':
      extractedFields = extractCartaoPonto(text);
      break;
    case 'ficha_financeira':
      extractedFields = extractFichaFinanceira(text);
      break;
    case 'historico_movimentacoes':
      extractedFields = extractHistoricoMovimentacoes(text);
      break;
    case 'historico_ferias':
      extractedFields = extractHistoricoFerias(text);
      break;
    default:
      extractedFields = {
        ...extractAtaAudiencia(text),
        ...extractCartaoPonto(text),
        ...extractFichaFinanceira(text)
      };
  }

  return {
    raw_text: text.substring(0, 5000),
    fields: extractedFields,
    extraction_method: text.length > 100 ? 'pdf-parse' : 'ocr',
    document_type: documentType
  };
}

module.exports = {
  extractFromDocument,
  extractText,
  parseBrazilianDate,
  parseBrazilianCurrency
};
