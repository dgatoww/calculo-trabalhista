import React, { useState, useRef } from 'react';
import api from '../services/api';

const DOCUMENT_TYPES = [
  {
    id: 'termo_audiencia',
    label: 'Termo de Audiência',
    description: 'Documento judicial com data de rescisão e dados das partes.',
    icon: '⚖️',
    priority: true
  },
  {
    id: 'cartao_ponto',
    label: 'Cartão de Ponto',
    description: 'Registros de presença para identificar o último dia trabalhado.',
    icon: '🕐'
  },
  {
    id: 'ficha_financeira',
    label: 'Ficha Financeira',
    description: 'Histórico de pagamentos e deduções do período.',
    icon: '💰'
  },
  {
    id: 'historico_movimentacoes',
    label: 'Histórico de Movimentações',
    description: 'Histórico de alterações contratuais, promoções e mudanças.',
    icon: '📋'
  },
  {
    id: 'historico_ferias',
    label: 'Histórico de Férias',
    description: 'Períodos de férias tiradas e saldos.',
    icon: '🏖️'
  }
];

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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: '2px solid transparent',
    transition: 'all 0.2s'
  },
  cardPriority: {
    border: '2px solid #2E74B5'
  },
  cardUploaded: {
    border: '2px solid #38a169',
    backgroundColor: '#f0fff4'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px'
  },
  cardIcon: {
    fontSize: '28px',
    lineHeight: 1
  },
  cardInfo: {
    flex: 1
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  priorityBadge: {
    fontSize: '10px',
    backgroundColor: '#2E74B5',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '8px',
    fontWeight: '600',
    letterSpacing: '0.5px'
  },
  cardDesc: {
    fontSize: '13px',
    color: '#718096',
    lineHeight: '1.5'
  },
  dropZone: {
    border: '2px dashed #e2e8f0',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '12px'
  },
  dropZoneActive: {
    border: '2px dashed #2E74B5',
    backgroundColor: '#ebf8ff'
  },
  dropZoneUploaded: {
    border: '2px solid #38a169',
    backgroundColor: '#f0fff4'
  },
  dropZoneText: {
    fontSize: '13px',
    color: '#718096',
    marginTop: '6px'
  },
  uploadedInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px'
  },
  uploadedFileName: {
    fontSize: '13px',
    color: '#2f855a',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px'
  },
  statusIcon: {
    fontSize: '16px'
  },
  progressBar: {
    width: '100%',
    height: '6px',
    backgroundColor: '#e2e8f0',
    borderRadius: '3px',
    marginTop: '8px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2E74B5',
    borderRadius: '3px',
    transition: 'width 0.3s'
  },
  uploadBtn: {
    display: 'inline-block',
    backgroundColor: '#2E74B5',
    color: 'white',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
    marginTop: '6px',
    transition: 'all 0.2s'
  },
  replaceBtn: {
    display: 'inline-block',
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    marginTop: '6px'
  },
  errorText: {
    color: '#e53e3e',
    fontSize: '12px',
    marginTop: '6px'
  },
  extractedPreview: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#f7fafc',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#4a5568'
  },
  extractedItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
    borderBottom: '1px solid #e2e8f0'
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
  proceedBtn: {
    backgroundColor: '#38a169',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(56,161,105,0.3)'
  },
  infoBox: {
    backgroundColor: '#ebf8ff',
    border: '1px solid #bee3f8',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '13px',
    color: '#2c5282',
    marginBottom: '16px',
    lineHeight: '1.6'
  }
};

const FIELD_LABELS = {
  nome_reclamante: 'Reclamante',
  nome_reclamado: 'Reclamado',
  data_admissao: 'Data de Admissão',
  data_rescisao: 'Data de Rescisão',
  salario: 'Salário',
  ultimo_dia_trabalhado: 'Último Dia Trabalhado',
  funcao: 'Função'
};

function formatExtractedValue(field, value) {
  if (!value) return '';
  if (field === 'salario' || field === 'total_deducoes' || field === 'valor_pago_ficha') {
    const num = parseFloat(value);
    if (!isNaN(num)) return `R$ ${num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }
  if (field.includes('data') && value.includes('-')) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return value;
}

export default function UploadSection({ caseData, onUploadComplete, setLoading, setLoadingMessage, onGoToReview }) {
  const [uploadStates, setUploadStates] = useState({});
  const [dragOver, setDragOver] = useState(null);
  const fileInputRefs = useRef({});

  // Build map of already uploaded documents
  const uploadedDocs = {};
  if (caseData?.documents) {
    caseData.documents.forEach(doc => {
      uploadedDocs[doc.type] = doc;
    });
  }

  const setUploadState = (docType, state) => {
    setUploadStates(prev => ({ ...prev, [docType]: { ...prev[docType], ...state } }));
  };

  const handleFileSelect = async (docType, file) => {
    if (!file) return;

    setUploadState(docType, {
      uploading: true,
      progress: 0,
      error: null,
      fileName: file.name
    });

    setLoadingMessage(`Enviando e processando ${file.name}...`);

    try {
      const result = await api.uploadDocument(
        caseData.id,
        file,
        docType,
        (progress) => setUploadState(docType, { progress })
      );

      setUploadState(docType, {
        uploading: false,
        progress: 100,
        success: true,
        document: result.document,
        warning: result.warning || null
      });

      await onUploadComplete();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Erro no upload';
      setUploadState(docType, {
        uploading: false,
        progress: 0,
        error: errMsg
      });
    }
  };

  const handleDrop = (e, docType) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(docType, file);
  };

  const handleInputChange = (e, docType) => {
    const file = e.target.files[0];
    if (file) handleFileSelect(docType, file);
    e.target.value = '';
  };

  const hasAnyUpload = Object.keys(uploadedDocs).length > 0 ||
    Object.values(uploadStates).some(s => s?.success);

  return (
    <div style={styles.container}>
      <h2 style={styles.sectionTitle}>Envio de Documentos</h2>
      <p style={styles.sectionSubtitle}>
        Faça upload dos documentos do processo. Os dados serão extraídos automaticamente.
      </p>

      <div style={styles.infoBox}>
        <strong>Como funciona:</strong> O sistema extrai automaticamente os dados dos PDFs (ou usa OCR para documentos escaneados).
        Após o upload, você poderá revisar e corrigir todos os campos antes do cálculo.
        O <strong>Termo de Audiência</strong> tem prioridade sobre os demais documentos em caso de divergência.
      </div>

      <div style={styles.grid}>
        {DOCUMENT_TYPES.map(docType => {
          const uploadState = uploadStates[docType.id] || {};
          const existingDoc = uploadedDocs[docType.id];
          const isUploading = uploadState.uploading;
          const isUploaded = uploadState.success || (existingDoc && existingDoc.extraction_status !== 'error');
          const hasError = uploadState.error || (existingDoc?.extraction_status === 'error');

          return (
            <div
              key={docType.id}
              style={{
                ...styles.card,
                ...(docType.priority ? styles.cardPriority : {}),
                ...(isUploaded ? styles.cardUploaded : {})
              }}
            >
              <div style={styles.cardHeader}>
                <div style={styles.cardIcon}>{docType.icon}</div>
                <div style={styles.cardInfo}>
                  <div style={styles.cardTitle}>
                    {docType.label}
                    {docType.priority && (
                      <span style={styles.priorityBadge}>PRIORIDADE</span>
                    )}
                  </div>
                  <div style={styles.cardDesc}>{docType.description}</div>
                </div>
              </div>

              {/* Drop zone */}
              <div
                style={{
                  ...styles.dropZone,
                  ...(dragOver === docType.id ? styles.dropZoneActive : {}),
                  ...(isUploaded ? styles.dropZoneUploaded : {})
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(docType.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, docType.id)}
                onClick={() => !isUploading && fileInputRefs.current[docType.id]?.click()}
              >
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/tiff"
                  style={{ display: 'none' }}
                  ref={el => fileInputRefs.current[docType.id] = el}
                  onChange={e => handleInputChange(e, docType.id)}
                />

                {isUploading ? (
                  <div>
                    <div style={{ fontSize: '14px', color: '#2E74B5', fontWeight: '600' }}>
                      Processando... {uploadState.progress}%
                    </div>
                    <div style={styles.progressBar}>
                      <div style={{ ...styles.progressFill, width: `${uploadState.progress}%` }} />
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '6px' }}>
                      Extraindo dados do documento...
                    </div>
                  </div>
                ) : isUploaded ? (
                  <div>
                    <div style={styles.uploadedInfo}>
                      <span style={styles.statusIcon}>✅</span>
                      <span style={styles.uploadedFileName}>
                        {uploadState.document?.original_name || existingDoc?.original_name || 'Enviado'}
                      </span>
                    </div>
                    <button style={styles.replaceBtn} onClick={e => {
                      e.stopPropagation();
                      fileInputRefs.current[docType.id]?.click();
                    }}>
                      Substituir arquivo
                    </button>
                  </div>
                ) : (
                  <div>
                    <div>📤</div>
                    <div style={styles.dropZoneText}>
                      Arraste o PDF aqui ou
                    </div>
                    <button style={styles.uploadBtn}>Selecionar Arquivo</button>
                    <div style={{ fontSize: '11px', color: '#a0aec0', marginTop: '4px' }}>
                      PDF, PNG, JPG ou TIFF
                    </div>
                  </div>
                )}

                {hasError && !isUploading && (
                  <div style={styles.errorText}>
                    ⚠️ {uploadState.error || 'Erro na extração — dados serão preenchidos manualmente'}
                  </div>
                )}

                {uploadState.warning && (
                  <div style={{ ...styles.errorText, color: '#c05621' }}>
                    ⚠️ {uploadState.warning}
                  </div>
                )}
              </div>

              {/* Extracted data preview */}
              {(isUploaded || existingDoc) && (() => {
                const doc = uploadState.document || existingDoc;
                const extracted = doc?.extracted_data?.fields || {};
                const relevantFields = Object.entries(extracted)
                  .filter(([k, v]) => v && FIELD_LABELS[k])
                  .slice(0, 4);

                if (relevantFields.length === 0) return null;

                return (
                  <div style={styles.extractedPreview}>
                    <div style={{ fontWeight: '600', marginBottom: '4px', color: '#2d3748' }}>
                      Dados extraídos:
                    </div>
                    {relevantFields.map(([field, value]) => (
                      <div key={field} style={styles.extractedItem}>
                        <span style={{ color: '#4a5568' }}>{FIELD_LABELS[field]}:</span>
                        <span style={{ fontWeight: '500', color: '#1a202c' }}>
                          {formatExtractedValue(field, value)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div style={styles.bottomActions}>
        <div style={{ fontSize: '14px', color: '#718096' }}>
          {Object.keys(uploadedDocs).length} de {DOCUMENT_TYPES.length} documentos enviados
          {!uploadedDocs['termo_audiencia'] && (
            <div style={{ color: '#c05621', fontSize: '12px', marginTop: '4px' }}>
              ⚠️ O Termo de Audiência é o documento mais importante para o cálculo.
            </div>
          )}
        </div>
        <button
          style={{
            ...styles.proceedBtn,
            opacity: hasAnyUpload ? 1 : 0.5,
            cursor: hasAnyUpload ? 'pointer' : 'not-allowed'
          }}
          onClick={hasAnyUpload ? onGoToReview : undefined}
          disabled={!hasAnyUpload}
        >
          Revisar Dados Extraídos →
        </button>
      </div>
    </div>
  );
}
