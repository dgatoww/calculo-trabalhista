const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  extractTextFromPDF,
  detectDocumentType,
  parseAtaAudiencia,
  parseHistoricoMovimentacoes,
  parseCartaoPonto,
  parseFichaFinanceira,
  parseHistoricoFerias
} = require('../services/pdfParser');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const TIPO_LABELS = {
  ata: 'Ata de Audiência',
  movimentacoes: 'Histórico de Movimentações',
  ponto: 'Cartão de Ponto',
  ficha: 'Ficha Financeira',
  ferias: 'Histórico de Férias',
};

function parseByTipo(tipo, text) {
  switch (tipo) {
    case 'ata': return parseAtaAudiencia(text);
    case 'movimentacoes': return parseHistoricoMovimentacoes(text);
    case 'ponto': return parseCartaoPonto(text);
    case 'ficha': return parseFichaFinanceira(text);
    case 'ferias': return parseHistoricoFerias(text);
    default: return {};
  }
}

// POST /api/upload/auto — múltiplos arquivos, detecção automática
router.post('/auto', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  const results = [];
  const mergedData = {};

  for (const file of req.files) {
    let text = '';
    let tipo = null;
    let dados = {};
    let error = null;

    try {
      text = await extractTextFromPDF(file.path);
      tipo = detectDocumentType(text);
      if (tipo) {
        dados = parseByTipo(tipo, text);
      }

      // Merge data (sem sobrescrever valores já preenchidos, exceto se estiver vazio)
      for (const [key, val] of Object.entries(dados)) {
        if (key === '_debug') continue;
        if (key === 'afastamentos' && Array.isArray(val)) {
          mergedData.afastamentos = [...(mergedData.afastamentos || []), ...val];
        } else if (val !== null && val !== undefined && val !== '' && !mergedData[key]) {
          mergedData[key] = val;
        }
      }
    } catch (err) {
      error = err.message;
    } finally {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }

    results.push({
      filename: file.originalname,
      tipo,
      tipo_label: tipo ? TIPO_LABELS[tipo] : 'Não identificado',
      dados: { ...dados, _debug: undefined },
      debug: dados._debug || {},
      raw_text: text.substring(0, 2000),
      error
    });
  }

  res.json({ results, mergedData });
});

// POST /api/upload/:tipo — upload individual (mantido para compatibilidade)
router.post('/:tipo', upload.single('file'), async (req, res) => {
  try {
    const { tipo } = req.params;
    const filePath = req.file.path;
    const text = await extractTextFromPDF(filePath);

    let dados = {};
    if (tipo === 'auto') {
      const detectedTipo = detectDocumentType(text);
      dados = detectedTipo ? parseByTipo(detectedTipo, text) : {};
    } else {
      dados = parseByTipo(tipo, text);
    }

    try { fs.unlinkSync(filePath); } catch (_) {}

    const debug = dados._debug || {};
    delete dados._debug;

    res.json({ success: true, dados, debug, raw_text: text.substring(0, 2000) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
