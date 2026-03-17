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
  infoBox: {
    backgroundColor: '#ebf8ff',
    border: '1px solid #bee3f8',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '13px',
    color: '#2c5282',
    marginBottom: '20px',
    lineHeight: '1.6'
  },
  warningBox: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fbd38d',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '13px',
    color: '#7b341e',
    marginBottom: '20px',
    lineHeight: '1.6'
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
    gap: '20px',
    marginBottom: '24px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '2px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    padding: '8px',
    borderRadius: '6px',
    transition: 'background 0.2s'
  },
  fieldRowEditing: {
    backgroundColor: '#ebf8ff',
    border: '1px solid #bee3f8'
  },
  fieldRowManual: {
    backgroundColor: '#f0fff4'
  },
  fieldLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#4a5568',
    width: '160px',
    flexShrink: 0
  },
  fieldValueContainer: {
    flex: 1
  },
  fieldValue: {
    fontSize: '14px',
    color: '#1a202c',
    fontWeight: '500'
  },
  fieldSource: {
    fontSize: '11px',
    color: '#a0aec0',
    marginTop: '2px'
  },
  fieldSourceManual: {
    color: '#38a169',
    fontWeight: '600'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #2E74B5',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'white'
  },
  editBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    color: '#2E74B5',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: '500'
  },
  saveBtn: {
    backgroundColor: '#38a169',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    color: 'white',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: '600'
  },
  cancelBtn: {
    backgroundColor: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    color: '#4a5568',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  emptyField: {
    fontSize: '13px',
    color: '#e53e3e',
    fontStyle: 'italic'
  },
  bottomActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
  },
  calculateBtn: {
    backgroundColor: '#2E74B5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 28px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(46,116,181,0.3)'
  },
  saveAllBtn: {
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  requiredMark: {
    color: '#e53e3e',
    marginLeft: '2px'
  },
  legendBox: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '10px 14px',
    backgroundColor: 'white',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '12px',
    color: '#4a5568'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }
};

const SOURCE_LABELS = {
  termo_audiencia: 'Termo de Audiência',
  cartao_ponto: 'Cartão de Ponto',
  ficha_financeira: 'Ficha Financeira',
  historico_movimentacoes: 'Histórico de Movimentações',
  historico_ferias: 'Histórico de Férias',
  manual: 'Corrigido manualmente'
};

const FIELD_SECTIONS = [
  {
    title: '👤 Identificação das Partes',
    fields: [
      { key: 'numero_processo', label: 'Nº do Processo', type: 'text', required: false },
      { key: 'nome_reclamante', label: 'Reclamante', type: 'text', required: false },
      { key: 'nome_reclamado', label: 'Reclamado', type: 'text', required: false },
      { key: 'funcao', label: 'Função/Cargo', type: 'text', required: false }
    ]
  },
  {
    title: '📅 Datas do Contrato',
    fields: [
      { key: 'data_admissao', label: 'Data de Admissão', type: 'date', required: true },
      { key: 'data_rescisao', label: 'Data de Rescisão', type: 'date', required: true, priority: true },
      { key: 'ultimo_dia_trabalhado', label: 'Último Dia Trabalhado', type: 'date', required: false }
    ]
  },
  {
    title: '💰 Remuneração',
    fields: [
      { key: 'salario', label: 'Salário Base (R$)', type: 'number', required: true },
      { key: 'total_deducoes', label: 'Total de Deduções (R$)', type: 'number', required: false },
      { key: 'adiantamento_decimo_terceiro', label: 'Adiantamento 13º (R$)', type: 'number', required: false }
    ]
  },
  {
    title: '🏖️ Férias',
    fields: [
      { key: 'avos_ferias_proporcionais', label: 'Avos Férias (manual)', type: 'number', required: false },
      { key: 'dias_ferias_vencidas', label: 'Dias Férias Vencidas', type: 'number', required: false }
    ]
  }
];

function formatDisplayValue(field, value) {
  if (!value && value !== 0) return null;

  if (field.type === 'date') {
    if (value && value.includes('-')) {
      const [y, m, d] = value.split('-');
      return `${d}/${m}/${y}`;
    }
    return value;
  }

  if (field.type === 'number') {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    if (field.key === 'salario' || field.key.includes('dedu') || field.key.includes('adiantamento') || field.key.includes('ferias_vencidas_manual')) {
      return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return String(num);
  }

  return String(value);
}

function parseInputValue(field, inputValue) {
  if (!inputValue) return null;
  if (field.type === 'number') {
    return parseFloat(inputValue.replace(',', '.')) || null;
  }
  return inputValue;
}

function FieldEditor({ fieldDef, fieldData, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const value = fieldData?.value;
  const source = fieldData?.source;
  const isManual = fieldData?.manually_edited;
  const isRequired = fieldDef.required;
  const isPriority = fieldDef.priority;
  const isEmpty = !value;

  const startEdit = () => {
    setInputValue(value || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    const parsed = parseInputValue(fieldDef, inputValue);
    onSave(fieldDef.key, parsed !== null ? String(parsed) : inputValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div style={{
      ...styles.fieldRow,
      ...(isEditing ? styles.fieldRowEditing : {}),
      ...(isManual && !isEditing ? styles.fieldRowManual : {})
    }}>
      <div style={styles.fieldLabel}>
        {fieldDef.label}
        {isRequired && <span style={styles.requiredMark}>*</span>}
        {isPriority && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#2E74B5' }}>⚖</span>}
      </div>

      <div style={styles.fieldValueContainer}>
        {isEditing ? (
          <input
            style={styles.input}
            type={fieldDef.type === 'date' ? 'date' : fieldDef.type === 'number' ? 'number' : 'text'}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            step={fieldDef.type === 'number' ? '0.01' : undefined}
            min={fieldDef.type === 'number' ? '0' : undefined}
          />
        ) : (
          <div>
            {isEmpty ? (
              <span style={styles.emptyField}>
                {isRequired ? '⚠️ Campo obrigatório — preencher' : 'Não identificado'}
              </span>
            ) : (
              <div style={styles.fieldValue}>
                {formatDisplayValue(fieldDef, value)}
              </div>
            )}
            {source && !isEmpty && (
              <div style={{
                ...styles.fieldSource,
                ...(isManual ? styles.fieldSourceManual : {})
              }}>
                {isManual ? '✏️ ' : '📄 '}
                {SOURCE_LABELS[source] || source}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {isEditing ? (
          <>
            <button style={styles.saveBtn} onClick={handleSave}>Salvar</button>
            <button style={styles.cancelBtn} onClick={handleCancel}>✕</button>
          </>
        ) : (
          <button style={styles.editBtn} onClick={startEdit}>
            {isEmpty ? '+ Preencher' : '✏️ Editar'}
          </button>
        )}
      </div>
    </div>
  );
}

const TIPO_LABELS = {
  beneficio_comum: 'AUX. DOENÇA',
  licenca_maternidade: 'LIC. MATERNIDADE',
  outros: 'Outros'
};

function AfastamentosSection({ afastamentosJson, onSave }) {
  const [editing, setEditing] = useState(false);
  const [jsonText, setJsonText] = useState('');

  let afastamentos = [];
  try {
    afastamentos = afastamentosJson ? JSON.parse(afastamentosJson) : [];
  } catch (e) { /* ignore */ }

  const startEdit = () => {
    setJsonText(JSON.stringify(afastamentos, null, 2));
    setEditing(true);
  };

  const handleSave = () => {
    try {
      JSON.parse(jsonText); // validate
      onSave('afastamentos', jsonText);
      setEditing(false);
    } catch (e) {
      alert('JSON inválido: ' + e.message);
    }
  };

  return (
    <div style={{ ...styles.card, marginBottom: '24px' }}>
      <div style={styles.cardTitle}>
        🏥 Afastamentos
        <button style={{ ...styles.editBtn, marginLeft: 'auto' }} onClick={startEdit}>
          {editing ? '✕ Cancelar' : '✏️ Editar JSON'}
        </button>
      </div>

      {editing ? (
        <div>
          <textarea
            style={{
              width: '100%', height: '200px', fontFamily: 'monospace', fontSize: '12px',
              padding: '8px', border: '1px solid #2E74B5', borderRadius: '6px',
              boxSizing: 'border-box', resize: 'vertical'
            }}
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button style={styles.saveBtn} onClick={handleSave}>Salvar</button>
            <button style={styles.cancelBtn} onClick={() => setEditing(false)}>Cancelar</button>
          </div>
          <div style={{ fontSize: '12px', color: '#718096', marginTop: '8px' }}>
            Formato: [{' '}&#123;"data_inicio": "YYYY-MM-DD", "data_fim": "YYYY-MM-DD", "motivo": "AUX.DOENCA", "tipo": "beneficio_comum"&#125;{' '}]<br />
            Tipos válidos: <code>beneficio_comum</code> (AUX.DOENÇA — não conta avos) | <code>licenca_maternidade</code> (conta avos)
          </div>
        </div>
      ) : afastamentos.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#a0aec0', fontStyle: 'italic' }}>
          Nenhum afastamento registrado. Clique em "Editar JSON" para adicionar.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#4a5568', fontWeight: '600' }}>Início</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#4a5568', fontWeight: '600' }}>Fim</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#4a5568', fontWeight: '600' }}>Motivo</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#4a5568', fontWeight: '600' }}>Impacto nos Avos</th>
            </tr>
          </thead>
          <tbody>
            {afastamentos.map((af, i) => {
              const contaAvos = af.tipo === 'licenca_maternidade';
              const formatD = d => d ? d.split('-').reverse().join('/') : '—';
              return (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 8px' }}>{formatD(af.data_inicio)}</td>
                  <td style={{ padding: '6px 8px' }}>{formatD(af.data_fim)}</td>
                  <td style={{ padding: '6px 8px' }}>{af.motivo || TIPO_LABELS[af.tipo] || af.tipo}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
                      backgroundColor: contaAvos ? '#c6f6d5' : '#fed7d7',
                      color: contaAvos ? '#276749' : '#c53030'
                    }}>
                      {contaAvos ? '✓ Conta' : '✗ Não conta'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function DataReview({ caseData, onDataSaved, setLoading, setLoadingMessage }) {
  const [localData, setLocalData] = useState({});
  const [pendingChanges, setPendingChanges] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (caseData?.data) {
      setLocalData(caseData.data);
    }
  }, [caseData]);

  const handleFieldSave = (fieldKey, value) => {
    // Update local state immediately
    setLocalData(prev => ({
      ...prev,
      [fieldKey]: {
        value,
        source: 'manual',
        manually_edited: true,
        updated_at: new Date().toISOString()
      }
    }));

    // Queue for batch save
    setPendingChanges(prev => ({ ...prev, [fieldKey]: value }));
  };

  const handleSaveAll = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      setError('');
      return;
    }

    setSaving(true);
    setLoadingMessage('Salvando alterações...');
    try {
      await api.updateCaseData(caseData.id, pendingChanges);
      setPendingChanges({});
      setError('');
    } catch (err) {
      setError('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleCalculate = async () => {
    // First save any pending changes
    if (Object.keys(pendingChanges).length > 0) {
      setSaving(true);
      setLoadingMessage('Salvando dados...');
      try {
        await api.updateCaseData(caseData.id, pendingChanges);
        setPendingChanges({});
      } catch (err) {
        setError('Erro ao salvar dados antes do cálculo: ' + (err.response?.data?.error || err.message));
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    // Validate required fields
    const requiredFields = [
      { key: 'salario', label: 'Salário' },
      { key: 'data_admissao', label: 'Data de Admissão' },
      { key: 'data_rescisao', label: 'Data de Rescisão' }
    ];

    const missing = requiredFields.filter(f => !localData[f.key]?.value);
    if (missing.length > 0) {
      setError(`Campos obrigatórios não preenchidos: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    setLoading(true);
    setLoadingMessage('Calculando verbas rescisórias...');
    try {
      await api.calculate(caseData.id);
      await onDataSaved();
    } catch (err) {
      setError('Erro no cálculo: ' + (err.response?.data?.message || err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Check for missing required fields
  const requiredFields = ['salario', 'data_admissao', 'data_rescisao'];
  const missingRequired = requiredFields.filter(f => !localData[f]?.value);

  return (
    <div style={styles.container}>
      <h2 style={styles.sectionTitle}>Revisão dos Dados Extraídos</h2>
      <p style={styles.sectionSubtitle}>
        Verifique e corrija os dados identificados automaticamente nos documentos.
      </p>

      {/* Legend */}
      <div style={styles.legendBox}>
        <div style={styles.legendItem}>
          <span>📄</span>
          <span>Extraído automaticamente do PDF</span>
        </div>
        <div style={styles.legendItem}>
          <span>✏️</span>
          <span style={{ color: '#38a169' }}>Corrigido manualmente</span>
        </div>
        <div style={styles.legendItem}>
          <span style={{ color: '#e53e3e' }}>*</span>
          <span>Campo obrigatório para o cálculo</span>
        </div>
      </div>

      {/* Warnings */}
      {missingRequired.length > 0 && (
        <div style={styles.warningBox}>
          <strong>Campos obrigatórios não preenchidos:</strong>
          {' '}{missingRequired.map(f => {
            const fieldDef = FIELD_SECTIONS.flatMap(s => s.fields).find(fd => fd.key === f);
            return fieldDef?.label || f;
          }).join(', ')}.
          <br />
          Por favor, preencha estes campos antes de calcular.
        </div>
      )}

      {error && <div style={styles.errorBox}>{error}</div>}

      {hasPendingChanges && (
        <div style={{
          ...styles.infoBox,
          backgroundColor: '#fffbeb',
          borderColor: '#fbd38d',
          color: '#7b341e'
        }}>
          Você tem {Object.keys(pendingChanges).length} campo(s) com alterações não salvas.
          Clique em "Salvar Alterações" ou prossiga para o cálculo (os dados serão salvos automaticamente).
        </div>
      )}

      {/* Field sections */}
      <div style={styles.grid}>
        {FIELD_SECTIONS.map(section => (
          <div key={section.title} style={styles.card}>
            <div style={styles.cardTitle}>{section.title}</div>
            {section.fields.map(fieldDef => (
              <FieldEditor
                key={fieldDef.key}
                fieldDef={fieldDef}
                fieldData={localData[fieldDef.key]}
                onSave={handleFieldSave}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Afastamentos section */}
      <AfastamentosSection
        afastamentosJson={localData['afastamentos']?.value || null}
        onSave={handleFieldSave}
      />

      {/* Additional notes card */}
      <div style={{ ...styles.card, marginBottom: '24px' }}>
        <div style={styles.cardTitle}>📝 Informações Adicionais</div>
        <div style={{ fontSize: '13px', color: '#718096', lineHeight: '1.8' }}>
          <p><strong>Regras de cálculo aplicadas:</strong></p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
            <li>Saldo de salário: (Salário ÷ 30) × dias trabalhados no último mês − deduções da ficha financeira</li>
            <li>13º proporcional: Avos do ano da rescisão (meses com ≥ 15 dias trabalhados)</li>
            <li>Férias proporcionais: Avos do período aquisitivo atual × Salário × (1 + 1/3)</li>
            <li>Férias vencidas: Períodos aquisitivos completos não usufruídos × Salário × (1 + 1/3)</li>
            <li><strong>NÃO inclui:</strong> Aviso prévio, FGTS, Multa 40%</li>
          </ul>
        </div>
      </div>

      {/* Bottom actions */}
      <div style={styles.bottomActions}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {hasPendingChanges && (
            <button
              style={styles.saveAllBtn}
              onClick={handleSaveAll}
              disabled={saving}
            >
              {saving ? 'Salvando...' : `Salvar Alterações (${Object.keys(pendingChanges).length})`}
            </button>
          )}
          <span style={{ fontSize: '13px', color: '#718096' }}>
            {hasPendingChanges
              ? 'Alterações pendentes'
              : 'Todos os dados estão salvos'}
          </span>
        </div>
        <button
          style={{
            ...styles.calculateBtn,
            opacity: missingRequired.length > 0 ? 0.6 : 1,
            cursor: missingRequired.length > 0 ? 'not-allowed' : 'pointer'
          }}
          onClick={missingRequired.length === 0 ? handleCalculate : undefined}
          disabled={missingRequired.length > 0}
        >
          Calcular Verbas Rescisórias →
        </button>
      </div>
    </div>
  );
}
