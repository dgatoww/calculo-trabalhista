import React, { useState, useEffect } from 'react';
import api from '../services/api';

const styles = {
  container: {},
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '8px'
  },
  sectionSubtitle: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '24px'
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    border: '1px solid #feb2b2',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#c53030',
    marginBottom: '20px'
  },
  summaryCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    borderTop: '4px solid #e2e8f0',
    textAlign: 'center'
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  summaryValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a202c'
  },
  totalCard: {
    backgroundColor: '#1F4E79',
    borderRadius: '10px',
    padding: '24px',
    boxShadow: '0 4px 16px rgba(31,78,121,0.3)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    color: 'white'
  },
  totalLabel: {
    fontSize: '18px',
    fontWeight: '700'
  },
  totalSubtext: {
    fontSize: '13px',
    opacity: 0.8,
    marginTop: '4px'
  },
  totalValue: {
    fontSize: '32px',
    fontWeight: '800',
    letterSpacing: '-0.5px'
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    marginBottom: '20px'
  },
  detailTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1F4E79',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '2px solid #2E74B5',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailTitleValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a202c'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '10px 0',
    borderBottom: '1px solid #f7fafc'
  },
  detailKey: {
    fontSize: '13px',
    color: '#4a5568',
    flex: 1
  },
  detailVal: {
    fontSize: '13px',
    color: '#1a202c',
    fontWeight: '600',
    textAlign: 'right'
  },
  formulaBox: {
    backgroundColor: '#f7fafc',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#4a5568',
    fontFamily: 'monospace',
    marginTop: '12px',
    wordBreak: 'break-word'
  },
  employeeCard: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    marginBottom: '20px'
  },
  employeeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
    marginTop: '12px'
  },
  employeeField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  employeeLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#a0aec0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  employeeValue: {
    fontSize: '14px',
    color: '#1a202c',
    fontWeight: '500'
  },
  actionsBar: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    marginBottom: '24px'
  },
  downloadBtn: {
    backgroundColor: '#2E74B5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 8px rgba(46,116,181,0.3)'
  },
  recalcBtn: {
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  noCalcBox: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
  },
  calcBtn: {
    backgroundColor: '#2E74B5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '16px',
    boxShadow: '0 2px 8px rgba(46,116,181,0.3)'
  },
  periodTable: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '8px',
    fontSize: '13px'
  },
  th: {
    backgroundColor: '#f7fafc',
    padding: '8px 12px',
    textAlign: 'left',
    fontWeight: '600',
    color: '#4a5568',
    borderBottom: '2px solid #e2e8f0'
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
    color: '#2d3748'
  }
};

function formatCurrency(value) {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(parseFloat(value) || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

const COLOR_MAP = {
  saldo_salario: '#2E74B5',
  decimo_terceiro: '#805ad5',
  ferias_vencidas: '#ed8936',
  ferias_proporcionais: '#38a169',
  total: '#1F4E79'
};

export default function CalculationResult({ caseData, setLoading, setLoadingMessage, onRecalculate }) {
  const [calculation, setCalculation] = useState(null);
  const [error, setError] = useState('');
  const [loadingCalc, setLoadingCalc] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadCalculation();
  }, [caseData?.id]);

  const loadCalculation = async () => {
    setLoadingCalc(true);
    try {
      const result = await api.getCalculation(caseData.id);
      setCalculation(result.calculation);
      setError('');
    } catch (err) {
      if (err.response?.status === 404) {
        setCalculation(null);
      } else {
        setError('Erro ao carregar cálculo: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoadingCalc(false);
    }
  };

  const handleRecalculate = async () => {
    setLoading(true);
    setLoadingMessage('Recalculando verbas rescisórias...');
    try {
      const result = await api.calculate(caseData.id);
      setCalculation(result.calculation);
      setError('');
      if (onRecalculate) await onRecalculate();
    } catch (err) {
      setError('Erro no cálculo: ' + (err.response?.data?.message || err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setLoadingMessage('Gerando documento Word...');
    try {
      await api.generateDocx(caseData.id);
    } catch (err) {
      setError('Erro ao gerar documento: ' + (err.response?.data?.error || err.message));
    } finally {
      setDownloading(false);
    }
  };

  if (loadingCalc) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
        Carregando resultado...
      </div>
    );
  }

  if (!calculation) {
    return (
      <div>
        <h2 style={styles.sectionTitle}>Resultado do Cálculo</h2>
        <div style={styles.noCalcBox}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#2d3748', marginBottom: '8px' }}>
            Nenhum cálculo realizado
          </h3>
          <p style={{ fontSize: '15px', color: '#718096', marginBottom: '8px' }}>
            Revise os dados e clique em calcular para obter os resultados.
          </p>
          {error && <div style={{ ...styles.errorBox, maxWidth: '400px', margin: '16px auto' }}>{error}</div>}
          <button style={styles.calcBtn} onClick={handleRecalculate}>
            Calcular Agora
          </button>
        </div>
      </div>
    );
  }

  const { employee_data, calculations, summary } = calculation;

  const summaryItems = [
    { key: 'saldo_salario', label: 'Saldo de Salário', value: summary?.saldo_salario },
    { key: 'decimo_terceiro', label: '13º Proporcional', value: summary?.decimo_terceiro },
    { key: 'ferias_vencidas', label: 'Férias Vencidas', value: summary?.ferias_vencidas },
    { key: 'ferias_proporcionais', label: 'Férias Proporcionais', value: summary?.ferias_proporcionais }
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.sectionTitle}>Resultado do Cálculo</h2>
      <p style={styles.sectionSubtitle}>
        Verbas rescisórias calculadas conforme os dados do processo.
      </p>

      {error && <div style={styles.errorBox}>{error}</div>}

      {/* Actions bar */}
      <div style={styles.actionsBar}>
        <button style={styles.recalcBtn} onClick={handleRecalculate}>
          🔄 Recalcular
        </button>
        <button
          style={{ ...styles.downloadBtn, opacity: downloading ? 0.7 : 1 }}
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? '⏳ Gerando...' : '📄 Baixar Documento Word (.docx)'}
        </button>
      </div>

      {/* Employee info */}
      {employee_data && (
        <div style={styles.employeeCard}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a202c', marginBottom: '4px' }}>
            👤 Dados do Processo
          </div>
          <div style={styles.employeeGrid}>
            {employee_data.nome_reclamante && (
              <div style={styles.employeeField}>
                <span style={styles.employeeLabel}>Reclamante</span>
                <span style={styles.employeeValue}>{employee_data.nome_reclamante}</span>
              </div>
            )}
            {employee_data.nome_reclamado && (
              <div style={styles.employeeField}>
                <span style={styles.employeeLabel}>Reclamado</span>
                <span style={styles.employeeValue}>{employee_data.nome_reclamado}</span>
              </div>
            )}
            <div style={styles.employeeField}>
              <span style={styles.employeeLabel}>Admissão</span>
              <span style={styles.employeeValue}>{formatDate(employee_data.data_admissao)}</span>
            </div>
            <div style={styles.employeeField}>
              <span style={styles.employeeLabel}>Rescisão</span>
              <span style={styles.employeeValue}>{formatDate(employee_data.data_rescisao)}</span>
            </div>
            <div style={styles.employeeField}>
              <span style={styles.employeeLabel}>Último Dia Trabalhado</span>
              <span style={styles.employeeValue}>{formatDate(employee_data.ultimo_dia_trabalhado)}</span>
            </div>
            <div style={styles.employeeField}>
              <span style={styles.employeeLabel}>Salário Base</span>
              <span style={styles.employeeValue}>{formatCurrency(employee_data.salario)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={styles.summaryCards}>
        {summaryItems.map(item => (
          <div key={item.key} style={{
            ...styles.summaryCard,
            borderTopColor: COLOR_MAP[item.key] || '#e2e8f0'
          }}>
            <div style={styles.summaryLabel}>{item.label}</div>
            <div style={{ ...styles.summaryValue, color: COLOR_MAP[item.key] || '#1a202c' }}>
              {formatCurrency(item.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Total card */}
      <div style={styles.totalCard}>
        <div>
          <div style={styles.totalLabel}>TOTAL GERAL — VERBAS RESCISÓRIAS</div>
          <div style={styles.totalSubtext}>
            Não inclui: Aviso Prévio, FGTS, Multa 40%
          </div>
        </div>
        <div style={styles.totalValue}>{formatCurrency(summary?.total)}</div>
      </div>

      {/* Detailed breakdown */}
      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1a202c', marginBottom: '16px' }}>
        Detalhamento do Cálculo
      </h3>

      {/* Saldo de salário */}
      {calculations?.saldo_salario && (
        <div style={styles.detailCard}>
          <div style={styles.detailTitle}>
            <span>💼 Saldo de Salário</span>
            <span style={styles.detailTitleValue}>
              {formatCurrency(calculations.saldo_salario.net_value)}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Salário base</span>
            <span style={styles.detailVal}>{formatCurrency(calculations.saldo_salario.salary)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Dias trabalhados no último mês</span>
            <span style={styles.detailVal}>{calculations.saldo_salario.days_worked} dias</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Valor diário (salário ÷ 30)</span>
            <span style={styles.detailVal}>{formatCurrency(calculations.saldo_salario.daily_rate)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Valor bruto (dias × diária)</span>
            <span style={styles.detailVal}>{formatCurrency(calculations.saldo_salario.gross_value)}</span>
          </div>
          {calculations.saldo_salario.deductions > 0 && (
            calculations.saldo_salario.deducoes_items && calculations.saldo_salario.deducoes_items.length > 0
              ? calculations.saldo_salario.deducoes_items.map((item, i) => (
                  <div key={i} style={styles.detailRow}>
                    <span style={styles.detailKey}>(–) {item.descricao}</span>
                    <span style={{ ...styles.detailVal, color: '#e53e3e' }}>
                      ({formatCurrency(item.valor)})
                    </span>
                  </div>
                ))
              : (
                <div style={styles.detailRow}>
                  <span style={styles.detailKey}>(–) Deduções (Ficha Financeira)</span>
                  <span style={{ ...styles.detailVal, color: '#e53e3e' }}>
                    ({formatCurrency(calculations.saldo_salario.deductions)})
                  </span>
                </div>
              )
          )}
          <div style={{ ...styles.detailRow, fontWeight: '700', borderTop: '2px solid #e2e8f0' }}>
            <span style={{ ...styles.detailKey, fontWeight: '700', color: '#1a202c' }}>
              SALDO DE SALÁRIO LÍQUIDO
            </span>
            <span style={{ ...styles.detailVal, color: '#2E74B5', fontSize: '15px' }}>
              {formatCurrency(calculations.saldo_salario.net_value)}
            </span>
          </div>
          <div style={styles.formulaBox}>
            Fórmula: {calculations.saldo_salario.formula}
          </div>
        </div>
      )}

      {/* 13º salário */}
      {calculations?.decimo_terceiro && (
        <div style={styles.detailCard}>
          <div style={styles.detailTitle}>
            <span>🎄 13º Salário Proporcional</span>
            <span style={styles.detailTitleValue}>
              {formatCurrency(calculations.decimo_terceiro.net_value)}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Salário base</span>
            <span style={styles.detailVal}>{formatCurrency(calculations.decimo_terceiro.salary)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Avos contados no ano</span>
            <span style={styles.detailVal}>
              {calculations.decimo_terceiro.avos}/12
              <span style={{ fontSize: '11px', color: '#718096', marginLeft: '6px' }}>
                (meses com ≥ 15 dias trabalhados)
              </span>
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Valor bruto (avos/12 × salário)</span>
            <span style={styles.detailVal}>{formatCurrency(calculations.decimo_terceiro.gross_value)}</span>
          </div>
          {calculations.decimo_terceiro.adiantamento > 0 && (
            <div style={styles.detailRow}>
              <span style={styles.detailKey}>Adiantamento já pago</span>
              <span style={{ ...styles.detailVal, color: '#e53e3e' }}>
                ({formatCurrency(calculations.decimo_terceiro.adiantamento)})
              </span>
            </div>
          )}
          <div style={{ ...styles.detailRow, fontWeight: '700', borderTop: '2px solid #e2e8f0' }}>
            <span style={{ ...styles.detailKey, fontWeight: '700', color: '#1a202c' }}>
              13º SALÁRIO A RECEBER
            </span>
            <span style={{ ...styles.detailVal, color: '#805ad5', fontSize: '15px' }}>
              {formatCurrency(calculations.decimo_terceiro.net_value)}
            </span>
          </div>
          <div style={styles.formulaBox}>
            Fórmula: {calculations.decimo_terceiro.formula}
          </div>
        </div>
      )}

      {/* Férias vencidas */}
      {calculations?.ferias_vencidas && (
        <div style={styles.detailCard}>
          <div style={styles.detailTitle}>
            <span>🏖️ Férias Vencidas + 1/3</span>
            <span style={styles.detailTitleValue}>
              {formatCurrency(calculations.ferias_vencidas.net_value)}
            </span>
          </div>
          {calculations.ferias_vencidas.periods && calculations.ferias_vencidas.periods.length > 0 ? (
            <>
              <table style={styles.periodTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>Período Aquisitivo</th>
                    <th style={styles.th}>Fim Concessivo</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {calculations.ferias_vencidas.periods.map((period, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>
                        {formatDate(period.aquisitivo_start)} a {formatDate(period.aquisitivo_end)}
                      </td>
                      <td style={styles.td}>{formatDate(period.concessivo_end)}</td>
                      <td style={styles.td}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: period.expired ? '#fff5f5' : '#f0fff4',
                          color: period.expired ? '#c53030' : '#2f855a'
                        }}>
                          {period.expired ? 'Vencidas' : 'No prazo'}
                        </span>
                      </td>
                      <td style={styles.td}>{formatCurrency(period.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ color: '#718096', fontSize: '14px', padding: '8px 0' }}>
              Nenhum período de férias vencidas identificado.
            </div>
          )}
          {calculations.ferias_vencidas.ferias_base > 0 && (
            <div style={styles.detailRow}>
              <span style={styles.detailKey}>Férias (base, sem 1/3)</span>
              <span style={styles.detailVal}>{formatCurrency(calculations.ferias_vencidas.ferias_base)}</span>
            </div>
          )}
          {calculations.ferias_vencidas.adicional_um_terco > 0 && (
            <div style={styles.detailRow}>
              <span style={styles.detailKey}>(+) Adicional 1/3</span>
              <span style={styles.detailVal}>{formatCurrency(calculations.ferias_vencidas.adicional_um_terco)}</span>
            </div>
          )}
          <div style={styles.formulaBox}>
            Fórmula: {calculations.ferias_vencidas.formula}
          </div>
        </div>
      )}

      {/* Férias proporcionais */}
      {calculations?.ferias_proporcionais && (
        <div style={styles.detailCard}>
          <div style={styles.detailTitle}>
            <span>📅 Férias Proporcionais + 1/3</span>
            <span style={styles.detailTitleValue}>
              {formatCurrency(calculations.ferias_proporcionais.net_value)}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Salário base</span>
            <span style={styles.detailVal}>{formatCurrency(calculations.ferias_proporcionais.salary)}</span>
          </div>
          {calculations.ferias_proporcionais.periodo_aquisitivo_inicio && (
            <div style={styles.detailRow}>
              <span style={styles.detailKey}>Início do período aquisitivo</span>
              <span style={styles.detailVal}>{formatDate(calculations.ferias_proporcionais.periodo_aquisitivo_inicio)}</span>
            </div>
          )}
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Avos do período aquisitivo</span>
            <span style={styles.detailVal}>
              {calculations.ferias_proporcionais.avos}/12
              <span style={{ fontSize: '11px', color: '#718096', marginLeft: '6px' }}>
                (meses com ≥ 15 dias | LIC.MATERNIDADE conta, AUX.DOENÇA não conta)
              </span>
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Férias proporcionais (avos/12 × salário)</span>
            <span style={styles.detailVal}>{formatCurrency(calculations.ferias_proporcionais.ferias_base)}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>(+) Adicional constitucional 1/3</span>
            <span style={styles.detailVal}>{formatCurrency(calculations.ferias_proporcionais.adicional_um_terco)}</span>
          </div>
          <div style={{ ...styles.detailRow, fontWeight: '700', borderTop: '2px solid #e2e8f0' }}>
            <span style={{ ...styles.detailKey, fontWeight: '700', color: '#1a202c' }}>
              FÉRIAS PROPORCIONAIS + 1/3
            </span>
            <span style={{ ...styles.detailVal, color: '#38a169', fontSize: '15px' }}>
              {formatCurrency(calculations.ferias_proporcionais.net_value)}
            </span>
          </div>
          <div style={styles.formulaBox}>
            Fórmula: {calculations.ferias_proporcionais.formula}
          </div>
        </div>
      )}

      {/* Final total */}
      <div style={{
        ...styles.totalCard,
        marginTop: '24px'
      }}>
        <div>
          <div style={styles.totalLabel}>TOTAL GERAL DE VERBAS RESCISÓRIAS</div>
          <div style={{ ...styles.totalSubtext, marginTop: '6px' }}>
            ✓ Saldo de Salário + 13º + Férias Vencidas + Férias Proporcionais
          </div>
          <div style={styles.totalSubtext}>
            ✗ Não inclui: Aviso Prévio, FGTS, Multa de 40%
          </div>
        </div>
        <div style={styles.totalValue}>{formatCurrency(summary?.total)}</div>
      </div>

      {/* Second download button at bottom */}
      <div style={{ ...styles.actionsBar, marginTop: '16px' }}>
        <button style={styles.recalcBtn} onClick={handleRecalculate}>
          🔄 Recalcular
        </button>
        <button
          style={{ ...styles.downloadBtn, opacity: downloading ? 0.7 : 1 }}
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? '⏳ Gerando documento...' : '📄 Baixar Documento Word (.docx)'}
        </button>
      </div>
    </div>
  );
}
