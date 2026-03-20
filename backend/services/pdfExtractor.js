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
    let nome = reclamanteMatch[1].trim().split('\n')[0].trim();
    // Remove trailing date (DD/MM/YYYY or DD.MM.YYYY) and anything after it
    nome = nome.replace(/\s*\d{2}[\/\.\-]\d{2}[\/\.\-]\d{4}.*$/, '').trim();
    fields.nome_reclamante = nome;
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

  // Nome — strip trailing date that pdf-parse concatenates: "SAMARA ROCHA DE AVIZ04/06/2024"
  // Also capture that date as data_admissao since the PDF merges both into one line
  const nomeMatch = text.match(/NOME:\s*(.+)/i);
  if (nomeMatch) {
    const nomeLine = nomeMatch[1].trim().split('\n')[0].trim();
    const dateInNome = nomeLine.match(/(\d{2}\/\d{2}\/\d{4})/);
    fields.nome_reclamante = nomeLine.replace(/\s*\d{2}\/\d{2}\/\d{4}.*$/, '').trim();
    if (dateInNome && !fields.data_admissao) {
      const parsed = parseBrazilianDate(dateInNome[1]);
      if (parsed) fields.data_admissao = parsed;
    }
  }

  // Data de admissão
  // DATA ADMISSÃO regex — use lookahead for date anywhere after the keyword
  if (!fields.data_admissao) {
    const admissaoMatch = text.match(/DATA\s+ADMISS[AÃ]O[^0-9]*(\d{2}\/\d{2}\/\d{4})/i);
    if (admissaoMatch) {
      const parsed = parseBrazilianDate(admissaoMatch[1]);
      if (parsed) fields.data_admissao = parsed;
    }
  }

  // Cargo/Função
  const cargoMatch = text.match(/CARGO:\s*(.+)/i);
  if (cargoMatch) {
    fields.funcao = cargoMatch[1].trim().split('\n')[0].trim();
  }

  // Salário: find "HISTÓRICO DE MUDANÇA DE SALÁRIO" section, get LAST monetary value
  const salarioSectionIdx = text.search(/HIST[OÓ]RICO\s+DE\s+MUDAN[CÇ]A\s+DE\s+SAL[AÁ]RIO/i);
  if (salarioSectionIdx !== -1) {
    // Find next section header or end of text
    const afterSection = text.slice(salarioSectionIdx);
    const nextSectionMatch = afterSection.slice(50).search(/HIST[OÓ]RICO\s+DE\s+/i);
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

  // Bug fix: PDF has accented "HISTÓRICO DE AFASTAMENTOS"
  const afastamentoSectionIdx = text.search(/HIST[OÓ]RICO\s+DE\s+AFASTAMENTOS/i);
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
        // PDF text order is [DATA_FIM, DATA_INICIO] — swap to get correct order
        const dataInicio = parseBrazilianDate(dateBuffer[1]);
        const dataFim = parseBrazilianDate(dateBuffer[0]);
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
      if (/HIST[OÓ]RICO\s+DE\s+/i.test(line) && !/AFASTAMENTO/i.test(line)) break;
      // Skip header lines (INICIO, FIM, MOTIVO, etc.)
      if (/^(INICIO|IN[IÍ]CIO|FIM|DATA|MOTIVO|TIPO|DIAS)\s/i.test(line.trim())) continue;

      const datesInLine = [...line.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)];

      if (datesInLine.length >= 2) {
        // Flush previous buffer if any
        flushBuffer();
        // PDF text order is [DATA_FIM, DATA_INICIO] — swap to get correct order
        const dataInicio = parseBrazilianDate(datesInLine[1][1]);
        const dataFim = parseBrazilianDate(datesInLine[0][1]);
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
  let pendingDate = null; // date found on a line without times — check next line for times

  // Pre-scan: find any 4-digit year as hint for day-only lines when no month header found
  const yearHintMatch = text.match(/\b(20\d{2})\b/);
  const globalYearHint = yearHintMatch ? yearHintMatch[1] : null;

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
      pendingDate = null;
      continue;
    }
    const numericMonthHeader = trimmed.match(/^(\d{2})[\/\-](\d{4})$/);
    if (numericMonthHeader) {
      currentMonth = numericMonthHeader[1];
      currentYear = numericMonthHeader[2];
      pendingDate = null;
      continue;
    }

    // Skip lines with ignore keywords
    if (IGNORE_KEYWORDS.some(kw => upper.includes(kw))) continue;

    // Check for ≥2 time patterns (HH:MM), or 1 time + a recognisable date
    const times = trimmed.match(/\d{2}:\d{2}/g);
    const hasFullDate = /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/.test(trimmed);
    const hasDDMM = /^\d{1,2}[\/\-]\d{2}\b/.test(trimmed);

    if ((!times || times.length < 1) && !hasFullDate) continue;
    if (times && times.length < 2 && !hasFullDate && !hasDDMM) continue;

    const fullDateMatch = trimmed.match(/(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})/);

    if (fullDateMatch) {
      const dateStr = `${fullDateMatch[3]}-${fullDateMatch[2]}-${fullDateMatch[1]}`;
      if (times && times.length >= 2) {
        // Date and times on the same line → confirmed worked day
        lastValidDate = dateStr;
        pendingDate = null;
      } else {
        // Date alone — times may be on the next line
        pendingDate = dateStr;
      }
      continue;
    }

    // Try DD/MM at start (espelho de ponto format "07/01 08:00 ...")
    const ddmmMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{2})\b/);
    if (ddmmMatch && (currentYear || globalYearHint)) {
      const year = currentYear || globalYearHint;
      lastValidDate = `${year}-${ddmmMatch[2]}-${ddmmMatch[1].padStart(2, '0')}`;
      continue;
    }

    if (times && times.length >= 2) {
      if (pendingDate) {
        // Times on the line immediately after a date-only line
        lastValidDate = pendingDate;
        pendingDate = null;
      } else {
        // Day-only at start of line (e.g., "07 08:00 12:00 ...")
        const dayOnlyMatch = trimmed.match(/^(\d{1,2})\s/);
        if (dayOnlyMatch && currentMonth && currentYear) {
          const day = dayOnlyMatch[1].padStart(2, '0');
          lastValidDate = `${currentYear}-${currentMonth}-${day}`;
        }
      }
    } else {
      // Line with no times and no full date — reset pending
      if (!fullDateMatch) pendingDate = null;
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

  // The actual PDF format does NOT have month-name headers or PERIODO 1/2 labels.
  // Instead it uses "PERÍODO : /" + "MÊS e ANO :" (blank values) as block separators.
  // Lines with entries end with a 3-digit code: e.g. "01.514,0030,00SALARIO BASE001"
  // Line format (proventos): <hours><valor><ref><DESCRIPTION><CODE>
  // Line format (descontos): <valor><ref><DESCRIPTION><CODE>
  // The first currency value on the line is always the amount.

  // Helper: first currency value found in a text string
  const firstCurrency = (str) => {
    const m = str.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
    return m ? parseBrazilianCurrency(m[1]) : null;
  };

  // Split into period blocks on "PERÍODO" or "MÊS e ANO" markers
  const blocks = [];
  let curBlock = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/PER[IÍ]ODO\s*:/i.test(t) || /M[EÊ]S\s+[Ee]\s*ANO\s*:/i.test(t)) {
      if (curBlock.length > 0) { blocks.push(curBlock); curBlock = []; }
      continue;
    }
    curBlock.push(t);
  }
  if (curBlock.length > 0) blocks.push(curBlock);

  // Classify each block and collect entries keyed by 3-digit code
  const extractBlock = (blockLines) => {
    const entries = {};
    for (const l of blockLines) {
      // Line must end with a 3-digit code not preceded by comma (not decimal)
      const m = l.match(/^(.*[A-ZÀ-Ÿa-zà-ÿ\.\sº\/])\s*(\d{3})$/);
      if (!m) continue;
      const code = m[2];
      const val = firstCurrency(l);
      if (val && val > 0) entries[code] = val;
    }
    return entries;
  };

  // Primary extraction: targeted code searches across all lines (most reliable)
  // P2 blocks have SALARIO BASE (001); P1 blocks have ADIANTAMENTO SALARIAL (017)
  let lastSalario = null;
  let lastAdiantamento = null;
  let lastDescAdiant = null;
  let lastAdiant13 = null;

  for (const l of lines) {
    const t = l.trim();
    if (/SALAR[IÍ]O\s+BASE.*001$/i.test(t)) {
      const v = firstCurrency(t);
      if (v) lastSalario = v;
    }
    if (/ADIANTAMENTO\s+SALARIAL.*017$/i.test(t)) {
      const v = firstCurrency(t);
      if (v) lastAdiantamento = v;
    }
    if (/DESC[^\d]*ADIANT[^\d]*SALAR.*125$/i.test(t)) {
      const v = firstCurrency(t);
      if (v) lastDescAdiant = v;
    }
    // 1ª parcela 13º — code 035
    if (/1[aª][\.\s]*PARC.*13[oº].*035$/i.test(t)) {
      const v = firstCurrency(t);
      if (v) lastAdiant13 = v;
    }
  }

  // Fallback: SALÁRIO ATUAL header line (e.g. "SALÁRIO ATUAL.: 1.914,00")
  if (!lastSalario) {
    const salAtualMatch = text.match(/SAL[AÁ]RIO\s+ATUAL[.:\s]+(\d{1,3}(?:\.\d{3})*,\d{2})/i);
    if (salAtualMatch) lastSalario = parseBrazilianCurrency(salAtualMatch[1]);
  }

  if (lastSalario) fields.salario = lastSalario;
  if (lastAdiantamento) fields.adiantamento_quinzena = lastAdiantamento;
  if (lastAdiant13) fields.adiantamento_decimo_terceiro = lastAdiant13;

  // Build deductions
  const deducoes = [];
  if (lastAdiantamento) {
    deducoes.push({ codigo: '017', periodo: 1, descricao: 'Adiantamento Salarial', valor: lastAdiantamento });
  }
  if (lastDescAdiant) {
    deducoes.push({ codigo: '125', periodo: 2, descricao: 'Desc. Adiantamento Salarial', valor: lastDescAdiant });
  }
  if (deducoes.length > 0) {
    fields.deducoes_ficha = JSON.stringify(deducoes);
    const totalDeducoes = deducoes.reduce((s, d) => s + d.valor, 0);
    fields.total_deducoes_mes_rescisao = totalDeducoes;
    fields.total_deducoes = totalDeducoes; // alias expected by DataReview
  }

  // Also store block-based data for calculator compatibility
  const allBlocks = {};
  blocks.forEach((b, i) => { allBlocks[i] = extractBlock(b); });
  fields.ficha_meses_json = JSON.stringify(allBlocks);

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
    // Activate section on explicit férias/period headers (remote version is more specific, avoids false positives)
    if (/PER[IÍ]ODO\s+AQUISITIVO/i.test(line) ||
        /HIST[OÓ]RICO\s+DE\s+F[EÉ]RIAS/i.test(line) ||
        /REL.*11\.004/i.test(line)) {
      inPeriodSection = true;
      continue;
    }

    if (!inPeriodSection) continue;

    // Skip column-header lines (no real dates, just labels)
    if (/\b(IN[IÍ]CIO|FIM|AQUISITIVO|GOZO|DIAS|COD|PER[IÍ]ODO)\b/i.test(line) &&
        !(/\d{2}\/\d{2}\/\d{4}/.test(line))) continue;

    const datesInLine = [...line.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)];
    if (datesInLine.length < 2) continue;

    const dates = datesInLine.map(m => parseBrazilianDate(m[1]));

    if (!dates[0] || !dates[1]) continue;

    // PDF text column order (verified from actual extractions):
    //   4 dates: [gozo_fim, gozo_inicio, aquisitivo_fim, aquisitivo_inicio]
    //   2 dates: [aquisitivo_fim, aquisitivo_inicio]
    let periodo;
    if (dates.length >= 4 && dates[2] && dates[3]) {
      periodo = {
        aquisitivo_inicio: dates[3],
        aquisitivo_fim: dates[2],
        gozo_inicio: dates[1],
        gozo_fim: dates[0],
        gozada: true
      };
    } else {
      // 2-date line = férias vencidas (not yet taken)
      periodo = {
        aquisitivo_inicio: dates[1],
        aquisitivo_fim: dates[0],
        gozo_inicio: null,
        gozo_fim: null,
        gozada: false
      };
    }
    periodos.push(periodo);
  }

  if (periodos.length > 0) {
    fields.periodos_ferias_raw = JSON.stringify(periodos);

    const vencidas = periodos.filter(p => !p.gozada);
    fields.ferias_vencidas_count = vencidas.length;
    fields.dias_ferias_vencidas = vencidas.length * 30; // alias expected by DataReview
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
