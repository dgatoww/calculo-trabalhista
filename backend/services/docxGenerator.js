const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  Header,
  Footer,
  PageNumber,
  NumberFormat
} = require('docx');

/**
 * Format number as Brazilian currency
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

/**
 * Format date from YYYY-MM-DD to DD/MM/YYYY
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Create a bold text run
 */
function boldText(text, size = 22) {
  return new TextRun({ text, bold: true, size });
}

/**
 * Create a regular text run
 */
function normalText(text, size = 22) {
  return new TextRun({ text, size });
}

/**
 * Create a section title paragraph
 */
function sectionTitle(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 26,
        color: '1F4E79'
      })
    ],
    spacing: { before: 400, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E74B5' }
    }
  });
}

/**
 * Create a data row paragraph
 */
function dataRow(label, value) {
  return new Paragraph({
    children: [
      boldText(`${label}: `),
      normalText(value || 'N/A')
    ],
    spacing: { before: 60, after: 60 }
  });
}

/**
 * Create a table cell with styling
 */
function createCell(text, options = {}) {
  const { bold = false, isHeader = false, alignment = AlignmentType.LEFT, width } = options;

  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || '',
            bold: bold || isHeader,
            size: isHeader ? 20 : 20,
            color: isHeader ? 'FFFFFF' : '000000'
          })
        ],
        alignment
      })
    ],
    shading: isHeader ? {
      fill: '2E74B5',
      type: ShadingType.CLEAR,
      color: '2E74B5'
    } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    margins: {
      top: 100,
      bottom: 100,
      left: 150,
      right: 150
    }
  });
}

/**
 * Create the calculation breakdown table
 */
function createCalculationTable(calculations, summary) {
  const rows = [];

  // Header row
  rows.push(
    new TableRow({
      children: [
        createCell('VERBA RESCISÓRIA', { isHeader: true, width: 5000 }),
        createCell('REFERÊNCIA', { isHeader: true, width: 3000 }),
        createCell('VALOR', { isHeader: true, width: 2000, alignment: AlignmentType.RIGHT })
      ],
      tableHeader: true
    })
  );

  // Saldo de salário
  const saldo = calculations.saldo_salario;
  if (saldo) {
    rows.push(
      new TableRow({
        children: [
          createCell('Saldo de Salário', { width: 5000 }),
          createCell(`${saldo.days_worked} dias × R$ ${(saldo.daily_rate || 0).toFixed(2)}/dia`, { width: 3000 }),
          createCell(formatCurrency(saldo.net_value), { width: 2000, alignment: AlignmentType.RIGHT })
        ]
      })
    );
    if (saldo.deductions > 0) {
      rows.push(
        new TableRow({
          children: [
            createCell('  (–) Deduções (Ficha Financeira)', { width: 5000 }),
            createCell('Valores a deduzir', { width: 3000 }),
            createCell(`(${formatCurrency(saldo.deductions)})`, { width: 2000, alignment: AlignmentType.RIGHT })
          ]
        })
      );
    }
  }

  // 13º salário
  const decimo = calculations.decimo_terceiro;
  if (decimo) {
    rows.push(
      new TableRow({
        children: [
          createCell('13º Salário Proporcional', { width: 5000 }),
          createCell(`${decimo.avos}/12 avos`, { width: 3000 }),
          createCell(formatCurrency(decimo.gross_value), { width: 2000, alignment: AlignmentType.RIGHT })
        ]
      })
    );
    if (decimo.adiantamento > 0) {
      rows.push(
        new TableRow({
          children: [
            createCell('  (–) Adiantamento 13º', { width: 5000 }),
            createCell('Já pago', { width: 3000 }),
            createCell(`(${formatCurrency(decimo.adiantamento)})`, { width: 2000, alignment: AlignmentType.RIGHT })
          ]
        })
      );
    }
  }

  // Férias vencidas
  const feriasVenc = calculations.ferias_vencidas;
  if (feriasVenc && feriasVenc.net_value > 0) {
    rows.push(
      new TableRow({
        children: [
          createCell('Férias Vencidas + 1/3', { width: 5000 }),
          createCell(`${feriasVenc.periods ? feriasVenc.periods.length : 1} período(s) × 30 dias + 1/3`, { width: 3000 }),
          createCell(formatCurrency(feriasVenc.net_value), { width: 2000, alignment: AlignmentType.RIGHT })
        ]
      })
    );
  }

  // Férias proporcionais — show base and 1/3 separately
  const feriasProp = calculations.ferias_proporcionais;
  if (feriasProp) {
    if (feriasProp.ferias_base > 0) {
      rows.push(
        new TableRow({
          children: [
            createCell('Férias Proporcionais', { width: 5000 }),
            createCell(`${feriasProp.avos}/12 avos × salário`, { width: 3000 }),
            createCell(formatCurrency(feriasProp.ferias_base), { width: 2000, alignment: AlignmentType.RIGHT })
          ]
        })
      );
      rows.push(
        new TableRow({
          children: [
            createCell('  (+) Adicional 1/3 de Férias Proporcionais', { width: 5000 }),
            createCell('1/3 constitucional', { width: 3000 }),
            createCell(formatCurrency(feriasProp.adicional_um_terco), { width: 2000, alignment: AlignmentType.RIGHT })
          ]
        })
      );
    } else {
      rows.push(
        new TableRow({
          children: [
            createCell('Férias Proporcionais + 1/3', { width: 5000 }),
            createCell(`${feriasProp.avos}/12 avos + 1/3`, { width: 3000 }),
            createCell(formatCurrency(feriasProp.net_value), { width: 2000, alignment: AlignmentType.RIGHT })
          ]
        })
      );
    }
  }

  // Total row
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [boldText('TOTAL GERAL', 22)],
            alignment: AlignmentType.RIGHT
          })],
          columnSpan: 2,
          shading: { fill: 'D6E4F0', type: ShadingType.CLEAR, color: 'D6E4F0' },
          margins: { top: 100, bottom: 100, left: 150, right: 150 }
        }),
        new TableCell({
          children: [new Paragraph({
            children: [boldText(formatCurrency(summary.total), 22)],
            alignment: AlignmentType.RIGHT
          })],
          shading: { fill: 'D6E4F0', type: ShadingType.CLEAR, color: 'D6E4F0' },
          margins: { top: 100, bottom: 100, left: 150, right: 150 }
        })
      ]
    })
  );

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
    }
  });
}

/**
 * Generate the Word document
 */
async function generate(caseInfo, data, calculationResult) {
  const { employee_data, calculations, summary, formatted } = calculationResult;

  const today = new Date().toLocaleDateString('pt-BR');

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'CÁLCULO DE VERBAS RESCISÓRIAS',
                    bold: true,
                    size: 24,
                    color: '1F4E79'
                  })
                ],
                alignment: AlignmentType.CENTER,
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E74B5' }
                }
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  normalText(`Gerado em ${today} | `, 18),
                  normalText('Cálculo Trabalhista - Sistema de Verbas Rescisórias', 18)
                ],
                alignment: AlignmentType.CENTER
              })
            ]
          })
        },
        children: [
          // Main Title
          new Paragraph({
            children: [
              new TextRun({
                text: 'MEMÓRIA DE CÁLCULO — VERBAS RESCISÓRIAS',
                bold: true,
                size: 32,
                color: '1F4E79'
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 400 }
          }),

          // Case Information
          sectionTitle('I — INFORMAÇÕES DO PROCESSO'),

          dataRow('Processo', caseInfo.name),
          dataRow('Data do Cálculo', today),

          new Paragraph({ spacing: { before: 200 } }),

          // Employee/Employer Information
          sectionTitle('II — PARTES'),

          dataRow('Reclamante', employee_data.nome_reclamante || data.nome_reclamante || 'N/A'),
          dataRow('Reclamado', employee_data.nome_reclamado || data.nome_reclamado || 'N/A'),
          dataRow('Função', employee_data.funcao || data.funcao || 'N/A'),

          new Paragraph({ spacing: { before: 200 } }),

          // Contract Information
          sectionTitle('III — DADOS DO CONTRATO'),

          dataRow('Data de Admissão', formatDate(employee_data.data_admissao)),
          dataRow('Data de Rescisão', formatDate(employee_data.data_rescisao)),
          dataRow('Último Dia Trabalhado', formatDate(employee_data.ultimo_dia_trabalhado)),
          dataRow('Salário Base', formatCurrency(employee_data.salario)),

          new Paragraph({ spacing: { before: 200 } }),

          // Calculation Details
          sectionTitle('IV — DETALHAMENTO DOS CÁLCULOS'),

          // Saldo de salário detail
          new Paragraph({
            children: [boldText('1. Saldo de Salário:', 22)],
            spacing: { before: 200, after: 100 }
          }),
          new Paragraph({
            children: [normalText(calculations.saldo_salario?.formula || 'N/A')],
            spacing: { before: 60, after: 60 },
            indent: { left: 360 }
          }),

          // 13º detail
          new Paragraph({
            children: [boldText('2. 13º Salário Proporcional:', 22)],
            spacing: { before: 200, after: 100 }
          }),
          new Paragraph({
            children: [normalText(calculations.decimo_terceiro?.formula || 'N/A')],
            spacing: { before: 60, after: 60 },
            indent: { left: 360 }
          }),
          new Paragraph({
            children: [normalText(`Avos contados: ${calculations.decimo_terceiro?.avos || 0}/12 (meses com ≥ 15 dias trabalhados)`)],
            spacing: { before: 60, after: 60 },
            indent: { left: 360 }
          }),

          // Férias vencidas detail
          new Paragraph({
            children: [boldText('3. Férias Vencidas + 1/3:', 22)],
            spacing: { before: 200, after: 100 }
          }),
          new Paragraph({
            children: [normalText(calculations.ferias_vencidas?.formula || 'Sem férias vencidas')],
            spacing: { before: 60, after: 60 },
            indent: { left: 360 }
          }),

          // Férias proporcionais detail
          new Paragraph({
            children: [boldText('4. Férias Proporcionais + 1/3:', 22)],
            spacing: { before: 200, after: 100 }
          }),
          new Paragraph({
            children: [normalText(calculations.ferias_proporcionais?.formula || 'N/A')],
            spacing: { before: 60, after: 60 },
            indent: { left: 360 }
          }),
          new Paragraph({
            children: [normalText(`Avos contados: ${calculations.ferias_proporcionais?.avos || 0}/12 (meses com ≥ 15 dias no período aquisitivo)`)],
            spacing: { before: 60, after: 60 },
            indent: { left: 360 }
          }),
          ...(calculations.ferias_proporcionais?.periodo_aquisitivo_inicio ? [
            new Paragraph({
              children: [normalText(`Período aquisitivo iniciado em: ${formatDate(calculations.ferias_proporcionais.periodo_aquisitivo_inicio)}`)],
              spacing: { before: 60, after: 60 },
              indent: { left: 360 }
            })
          ] : []),
          new Paragraph({
            children: [normalText(`   • Férias proporcionais (base): ${formatCurrency(calculations.ferias_proporcionais?.ferias_base || 0)}`)],
            spacing: { before: 60, after: 40 },
            indent: { left: 360 }
          }),
          new Paragraph({
            children: [normalText(`   • Adicional 1/3 constitucional: ${formatCurrency(calculations.ferias_proporcionais?.adicional_um_terco || 0)}`)],
            spacing: { before: 40, after: 60 },
            indent: { left: 360 }
          }),

          new Paragraph({ spacing: { before: 200 } }),

          // Summary Table
          sectionTitle('V — RESUMO DOS VALORES'),

          new Paragraph({ spacing: { before: 200 } }),

          // Calculation table
          createCalculationTable(calculations, summary),

          new Paragraph({ spacing: { before: 400 } }),

          // Important notes
          sectionTitle('VI — OBSERVAÇÕES'),

          new Paragraph({
            children: [normalText('• A data de rescisão foi extraída do Termo de Audiência, conforme prioridade documental.')],
            spacing: { before: 100, after: 60 }
          }),
          new Paragraph({
            children: [normalText('• O último dia trabalhado foi identificado a partir do Cartão de Ponto.')],
            spacing: { before: 60, after: 60 }
          }),
          new Paragraph({
            children: [normalText('• O cálculo NÃO inclui: Aviso Prévio, FGTS e Multa de 40%.')],
            spacing: { before: 60, after: 60 }
          }),
          new Paragraph({
            children: [normalText('• Para contagem de avos (13º e Férias), meses com menos de 15 dias trabalhados não são computados.')],
            spacing: { before: 60, after: 60 }
          }),
          new Paragraph({
            children: [normalText('• Licença-maternidade é contada para fins de avos; benefícios comuns (auxílio-doença, etc.) não são contados.')],
            spacing: { before: 60, after: 60 }
          }),

          new Paragraph({ spacing: { before: 600 } }),

          // Signature area
          new Paragraph({
            children: [normalText('_'.repeat(50))],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 100 }
          }),
          new Paragraph({
            children: [normalText('Assinatura e Carimbo')],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 60 }
          }),
          new Paragraph({
            children: [normalText(`Data: ____/____/________`)],
            alignment: AlignmentType.CENTER,
            spacing: { before: 60 }
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

module.exports = { generate, formatCurrency, formatDate };
