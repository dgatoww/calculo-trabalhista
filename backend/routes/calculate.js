const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const calculator = require('../services/calculator');
const docxGenerator = require('../services/docxGenerator');

// POST /api/cases/:id/calculate - Run calculations
router.post('/:id/calculate', async (req, res) => {
  try {
    const { id } = req.params;

    const caseData = await db.getCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    // Get all case data fields
    const fields = await db.getCaseData(id);
    const dataObj = {};
    fields.forEach(f => {
      dataObj[f.field] = f.value;
    });

    // Validate required fields
    const missingFields = [];
    const requiredFields = ['salario', 'data_admissao', 'data_rescisao'];
    requiredFields.forEach(field => {
      if (!dataObj[field]) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Campos obrigatórios faltando',
        missing_fields: missingFields,
        message: `Os seguintes campos são necessários para o cálculo: ${missingFields.join(', ')}`
      });
    }

    // Run calculations
    const result = calculator.calculate(dataObj);

    // Save calculation result
    const calcId = uuidv4();
    await db.saveCalculation(calcId, id, JSON.stringify(result));

    // Update case status
    await db.updateCaseStatus('calculated', id);

    res.json({
      success: true,
      calculation: result
    });

  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({ error: 'Erro no cálculo', message: error.message });
  }
});

// POST /api/cases/:id/generate-docx - Generate Word document
router.post('/:id/generate-docx', async (req, res) => {
  try {
    const { id } = req.params;

    const caseData = await db.getCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    // Get latest calculation
    const latestCalc = await db.getLatestCalculation(id);
    if (!latestCalc) {
      return res.status(400).json({
        error: 'Nenhum cálculo encontrado',
        message: 'Execute o cálculo antes de gerar o documento'
      });
    }

    const calculationResult = JSON.parse(latestCalc.result_data);

    // Get all case data
    const fields = await db.getCaseData(id);
    const dataObj = {};
    fields.forEach(f => {
      dataObj[f.field] = f.value;
    });

    // Generate docx
    const docxBuffer = await docxGenerator.generate(caseData, dataObj, calculationResult);

    // Set response headers for file download
    const fileName = `calculo_${caseData.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', docxBuffer.length);

    res.send(docxBuffer);

  } catch (error) {
    console.error('Docx generation error:', error);
    res.status(500).json({ error: 'Erro ao gerar documento', message: error.message });
  }
});

// GET /api/cases/:id/calculation - Get latest calculation result
router.get('/:id/calculation', async (req, res) => {
  try {
    const { id } = req.params;

    const caseData = await db.getCaseById(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const latestCalc = await db.getLatestCalculation(id);
    if (!latestCalc) {
      return res.status(404).json({ error: 'Nenhum cálculo encontrado para este processo' });
    }

    res.json({
      calculation: JSON.parse(latestCalc.result_data),
      created_at: latestCalc.created_at
    });

  } catch (error) {
    console.error('Error getting calculation:', error);
    res.status(500).json({ error: 'Erro ao obter cálculo', message: error.message });
  }
});

module.exports = router;
