const pdfParse = require('pdf-parse');
const fs = require('fs');

const MESES = {
  'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3,
  'abril': 4, 'maio': 5, 'junho': 6, 'julho': 7,
  'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
};

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

  // Data da audiencia (data rescisao)
  const dataMatch = text.match(/Em\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (dataMatch) {
    const dia = dataMatch[1].padStart(2, '0');
    const mes = MESES[dataMatch[2].toLowerCase()];
    const ano = dataMatch[3];
    if (mes) result.data_rescisao = `${dia}/${String(mes).padStart(2, '0')}/${ano}`;
  }

  // Reclamante
  const reclamanteMatch = text.match(/RECLAMANTE[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s]+?)(?:\n|CPF|RG|$)/i);
  if (reclamanteMatch) result.nome_reclamante = reclamanteMatch[1].trim();

  // Reclamado
  const reclamadoMatch = text.match(/RECLAMAD[OA][:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s]+?)(?:\n|CNPJ|CPF|$)/i);
  if (reclamadoMatch) result.nome_reclamada = reclamadoMatch[1].trim();

  // Data admissao (na secao FGTS)
  const admissaoMatch = text.match(/[Aa]dmiss[ãa]o[:\s]+(\d{2}\/\d{2}\/\d{4})/);
  if (admissaoMatch) result.data_admissao = admissaoMatch[1];

  // Valor da causa
  const valorMatch = text.match(/Valor\s+da\s+causa[:\s]+R\$\s*([\d.,]+)/i);
  if (valorMatch) result.valor_causa = parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.'));

  return result;
}

function parseHistoricoMovimentacoes(text) {
  const result = {};

  // Nome
  const nomeMatch = text.match(/NOME[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ\s]+?)(?:\n|$)/i);
  if (nomeMatch) result.nome = nomeMatch[1].trim();

  // Data admissao
  const admissaoMatch = text.match(/DATA\s+ADMISS[ÃA]O[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
  if (admissaoMatch) result.data_admissao = admissaoMatch[1];

  // Cargo
  const cargoMatch = text.match(/CARGO[:\s]+([^\n]+)/i);
  if (cargoMatch) result.cargo = cargoMatch[1].trim();

  // Ultimo salario - pegar ultimo valor na tabela HISTORICO DE MUDANCA DE SALARIO
  const salarioSection = text.match(/HIST[OÓ]RICO DE MUDAN[CÇ]A DE SAL[ÁA]RIO([\s\S]*?)(?:HIST[OÓ]RICO|$)/i);
  if (salarioSection) {
    const salarioMatches = salarioSection[1].matchAll(/(\d{2}\/\d{2}\/\d{4})\s+([\d.,]+)/g);
    let lastSalario = null;
    for (const match of salarioMatches) {
      lastSalario = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
    }
    if (lastSalario) result.salario = lastSalario;
  }

  // Afastamentos
  const afastamentos = [];
  const afastSection = text.match(/HIST[OÓ]RICO DE AFASTAMENTOS([\s\S]*?)(?:HIST[OÓ]RICO|$)/i);
  if (afastSection) {
    const auxMatches = afastSection[1].matchAll(/AUX\.DOEN[CÇ]A\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/gi);
    for (const match of auxMatches) {
      afastamentos.push({ tipo: 'beneficio_comum', inicio: match[1], fim: match[2] });
    }
    const matMatches = afastSection[1].matchAll(/LIC\.MATERNIDADE\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/gi);
    for (const match of matMatches) {
      afastamentos.push({ tipo: 'licenca_maternidade', inicio: match[1], fim: match[2] });
    }
  }
  result.afastamentos = afastamentos;

  return result;
}

function parseCartaoPonto(text) {
  const result = {};

  const linhas = text.split('\n');
  let ultimoDiaTrabalhado = null;

  const ignorar = ['ATESTADO MEDICO', 'AUX.DOENCA', 'LIC.MATERNIDADE', 'PEDIDO DE RESCISAO', 'PEDIDO DE RESCISÃO'];

  for (const linha of linhas) {
    const linhaUpper = linha.toUpperCase();
    if (ignorar.some(ig => linhaUpper.includes(ig))) continue;

    // Linha com horarios reais: HH:MM HH:MM HH:MM HH:MM + data
    const horariosMatch = linha.match(/(\d{2}:\d{2})\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})/);
    const dataMatch = linha.match(/(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2}\/\d{2})/);

    if (horariosMatch && dataMatch) {
      ultimoDiaTrabalhado = dataMatch[1];
    }
  }

  if (ultimoDiaTrabalhado) result.ultimo_dia_trabalhado = ultimoDiaTrabalhado;

  return result;
}

function parseFichaFinanceira(text) {
  const result = {};

  // Encontrar mes mais recente com valores
  // Procurar por PERIODO 1 (adiantamento - cod 017)
  // Procurar por PERIODO 2 (fechamento - cod 001 SALARIO BASE)

  const adiantamentoMatch = text.match(/017[^\n]*\s+([\d.,]+)/);
  if (adiantamentoMatch) {
    result.adiantamento = parseFloat(adiantamentoMatch[1].replace(/\./g, '').replace(',', '.'));
  }

  // Salario base do fechamento
  const salarioMatch = text.match(/001[^\n]*SAL[AÁ]RIO[^\n]*\s+([\d.,]+)/i);
  if (salarioMatch) {
    result.salario_base = parseFloat(salarioMatch[1].replace(/\./g, '').replace(',', '.'));
  }

  return result;
}

function parseHistoricoFerias(text) {
  const result = {};

  // Periodos aquisitivos sem data de gozo = ferias vencidas
  let periodos_vencidos = 0;

  // Procurar por periodos sem data de gozo
  const linhas = text.split('\n');
  for (const linha of linhas) {
    const periodoMatch = linha.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (periodoMatch) {
      // Verificar se tem data de gozo na mesma linha
      const dataGozoMatch = linha.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4}).*(\d{2}\/\d{2}\/\d{4})/);
      if (!dataGozoMatch) {
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
