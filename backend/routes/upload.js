const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractTextFromPDF, parseAtaAudiencia, parseHistoricoMovimentacoes, parseCartaoPonto, parseFichaFinanceira, parseHistoricoFerias } = require('../services/pdfParser');

const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/:tipo', upload.single('file'), async (req, res) => {
  try {
    const { tipo } = req.params;
    const filePath = req.file.path;

    const text = await extractTextFromPDF(filePath);

    let dados = {};
    switch (tipo) {
      case 'ata': dados = parseAtaAudiencia(text); break;
      case 'movimentacoes': dados = parseHistoricoMovimentacoes(text); break;
      case 'ponto': dados = parseCartaoPonto(text); break;
      case 'ficha': dados = parseFichaFinanceira(text); break;
      case 'ferias': dados = parseHistoricoFerias(text); break;
      default: return res.status(400).json({ error: 'Tipo inválido' });
    }

    // Cleanup
    fs.unlinkSync(filePath);

    // Retorna texto completo para debug (primeiros 3000 chars)
    res.json({ success: true, dados, texto_extraido: text.substring(0, 3000) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
