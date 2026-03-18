const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, HeadingLevel } = require('docx');

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

async function generateDocx(dados, resultado) {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: 'CÁLCULO DE VERBAS RESCISÓRIAS',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Processo: ', bold: true }),
            new TextRun(dados.numero_processo || 'N/A'),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Reclamante: ', bold: true }),
            new TextRun(dados.nome_reclamante || 'N/A'),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Reclamada: ', bold: true }),
            new TextRun(dados.nome_reclamada || 'N/A'),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Data de Admissão: ', bold: true }),
            new TextRun(dados.data_admissao || 'N/A'),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Data de Rescisão: ', bold: true }),
            new TextRun(dados.data_rescisao || 'N/A'),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Salário: ', bold: true }),
            new TextRun(formatCurrency(dados.salario || 0)),
          ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'RESULTADO DO CÁLCULO',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: '' }),
        createTable(resultado),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [
            new TextRun({ text: 'TOTAL GERAL: ', bold: true, size: 28 }),
            new TextRun({ text: formatCurrency(resultado.total), bold: true, size: 28 }),
          ]
        }),
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

function createTable(resultado) {
  const rows = [
    createHeaderRow(),
    createDataRow('Saldo de Salário',
      `${resultado.saldo_salario.diasTrabalhados} dias`,
      formatCurrency(resultado.saldo_salario.valorBruto),
      resultado.saldo_salario.adiantamento > 0 ? `- ${formatCurrency(resultado.saldo_salario.adiantamento)} (adiantamento)` : '',
      formatCurrency(resultado.saldo_salario.valorLiquido)
    ),
    createDataRow('13º Salário Proporcional',
      `${resultado.decimo_terceiro.avos}/12 avos`,
      '',
      '',
      formatCurrency(resultado.decimo_terceiro.valor)
    ),
    createDataRow('Férias Vencidas',
      `${resultado.ferias_vencidas.periodos} período(s)`,
      '',
      '',
      formatCurrency(resultado.ferias_vencidas.valor)
    ),
    createDataRow('Férias Proporcionais',
      `${resultado.ferias_proporcionais.avos}/12 avos`,
      '',
      '',
      formatCurrency(resultado.ferias_proporcionais.valor)
    ),
  ];

  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function createHeaderRow() {
  return new TableRow({
    children: ['Verba', 'Base de Cálculo', 'Valor Bruto', 'Deduções', 'Valor Líquido'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
      })
    )
  });
}

function createDataRow(verba, base, bruto, deducoes, liquido) {
  return new TableRow({
    children: [verba, base, bruto, deducoes, liquido].map(text =>
      new TableCell({ children: [new Paragraph({ text: text || '' })] })
    )
  });
}

module.exports = { generateDocx };
