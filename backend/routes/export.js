const express = require('express');
const router = express.Router();
const { generateDocx } = require('../services/docxGenerator');

router.post('/docx', async (req, res) => {
  try {
    const { dados, resultado } = req.body;
    const buffer = await generateDocx(dados, resultado);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=calculo_trabalhista_${Date.now()}.docx`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
