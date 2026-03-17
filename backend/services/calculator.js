/**
 * Brazilian Labor Law Calculator
 * Calculates: saldo de salário, 13º proporcional, férias vencidas, férias proporcionais
 * Does NOT include: aviso prévio, FGTS, multa 40%
 */

/**
 * Parse date string (YYYY-MM-DD) to Date object
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  const [year, month, day] = dateStr.split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * Get number of days in a month
 */
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate afastamento days of each type within a given month.
 * Returns { beneficio_comum: N, licenca_maternidade: N }
 */
function getAfastamentoDaysInMonth(afastamentos, year, month) {
  const result = { beneficio_comum: 0, licenca_maternidade: 0 };
  if (!afastamentos || afastamentos.length === 0) return result;

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // last day of month

  for (const af of afastamentos) {
    const afStart = parseDate(af.data_inicio);
    const afEnd = parseDate(af.data_fim);
    if (!afStart || !afEnd) continue;

    // Overlap with this month
    const overlapStart = afStart > monthStart ? afStart : monthStart;
    const overlapEnd = afEnd < monthEnd ? afEnd : monthEnd;

    if (overlapStart > overlapEnd) continue;

    // Count calendar days in overlap (inclusive)
    const diffMs = overlapEnd.getTime() - overlapStart.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

    if (af.tipo === 'licenca_maternidade') {
      result.licenca_maternidade += days;
    } else if (af.tipo === 'beneficio_comum') {
      result.beneficio_comum += days;
    }
  }

  return result;
}

/**
 * Calculate avos (twelfths) for a specific year (for 13º)
 * Only counts from January 1st of the year (or admission if later).
 * Months with afastamento beneficio_comum don't count; licenca_maternidade DOES count.
 */
function calculateAvosForYear(admissionDate, dismissalDate, year, afastamentos = []) {
  const admission = parseDate(admissionDate);
  const dismissal = parseDate(dismissalDate);

  if (!admission || !dismissal) return 0;

  const yearStart = new Date(year, 0, 1);
  const effectiveStart = admission > yearStart ? admission : yearStart;

  const yearEnd = new Date(year, 11, 31);
  const effectiveEnd = dismissal < yearEnd ? dismissal : yearEnd;

  if (effectiveStart > effectiveEnd) return 0;

  let avos = 0;
  let current = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);

  while (current.getFullYear() === year && current <= effectiveEnd) {
    const month = current.getMonth();
    const totalDays = daysInMonth(year, month);

    let daysInRange;
    const isFirstMonth = current.getMonth() === effectiveStart.getMonth() &&
                         current.getFullYear() === effectiveStart.getFullYear();
    const isLastMonth = current.getMonth() === effectiveEnd.getMonth() &&
                        current.getFullYear() === effectiveEnd.getFullYear();

    if (isFirstMonth && isLastMonth) {
      daysInRange = effectiveEnd.getDate() - effectiveStart.getDate() + 1;
    } else if (isFirstMonth) {
      daysInRange = totalDays - effectiveStart.getDate() + 1;
    } else if (isLastMonth) {
      daysInRange = effectiveEnd.getDate();
    } else {
      daysInRange = totalDays;
    }

    // Subtract beneficio_comum days (AUX.DOENÇA — does NOT count)
    // licenca_maternidade days already included and count as worked
    const afDays = getAfastamentoDaysInMonth(afastamentos, year, month);
    const countingDays = daysInRange - afDays.beneficio_comum;

    if (countingDays >= 15) {
      avos++;
    }

    current.setMonth(current.getMonth() + 1);
  }

  return Math.min(avos, 12);
}

/**
 * Calculate avos (twelfths) for proportional férias.
 * Based on the current (incomplete) aquisitive period.
 */
function calculateAvosFerias(admissionDate, dismissalDate, afastamentos = []) {
  const admission = parseDate(admissionDate);
  const dismissal = parseDate(dismissalDate);

  if (!admission || !dismissal) return 0;

  // Find start of current aquisitive period
  let periodStart = new Date(admission);
  while (true) {
    const nextPeriodStart = new Date(periodStart);
    nextPeriodStart.setFullYear(nextPeriodStart.getFullYear() + 1);
    if (nextPeriodStart <= dismissal) {
      periodStart = nextPeriodStart;
    } else {
      break;
    }
  }

  // Calculate avos from periodStart to dismissal, month by month
  let avos = 0;
  let current = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);

  while (current <= dismissal) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const totalDays = daysInMonth(year, month);

    const isFirstMonth = current.getMonth() === periodStart.getMonth() &&
                         current.getFullYear() === periodStart.getFullYear();
    const isLastMonth = current.getMonth() === dismissal.getMonth() &&
                        current.getFullYear() === dismissal.getFullYear();

    let daysInRange;
    if (isFirstMonth && isLastMonth) {
      daysInRange = dismissal.getDate() - periodStart.getDate() + 1;
    } else if (isFirstMonth) {
      daysInRange = totalDays - periodStart.getDate() + 1;
    } else if (isLastMonth) {
      daysInRange = dismissal.getDate();
    } else {
      daysInRange = totalDays;
    }

    // Subtract beneficio_comum (AUX.DOENÇA) — does NOT count
    // licenca_maternidade already counted (included in daysInRange) and DOES count
    const afDays = getAfastamentoDaysInMonth(afastamentos, year, month);
    const countingDays = daysInRange - afDays.beneficio_comum;

    if (countingDays >= 15) {
      avos++;
    }

    current.setMonth(current.getMonth() + 1);
  }

  return Math.min(avos, 12);
}

/**
 * Legacy calculateAvos (without afastamentos) — kept for backward compatibility
 */
function calculateAvos(admissionDate, dismissalDate) {
  return calculateAvosFerias(admissionDate, dismissalDate, []);
}

/**
 * Calculate completed aquisitive periods for férias vencidas
 */
function calculateAquisitivePeriods(admissionDate, dismissalDate) {
  const admission = parseDate(admissionDate);
  const dismissal = parseDate(dismissalDate);

  if (!admission || !dismissal) return [];

  const periods = [];
  let periodStart = new Date(admission);

  while (true) {
    const periodEnd = new Date(periodStart);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);

    if (periodEnd <= dismissal) {
      const concessivoEnd = new Date(periodEnd);
      concessivoEnd.setFullYear(concessivoEnd.getFullYear() + 1);

      periods.push({
        aquisitivo_start: periodStart.toISOString().split('T')[0],
        aquisitivo_end: periodEnd.toISOString().split('T')[0],
        concessivo_end: concessivoEnd.toISOString().split('T')[0],
        expired: concessivoEnd <= dismissal
      });

      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() + 1);
    } else {
      break;
    }
  }

  return periods;
}

/**
 * Main calculation function
 * @param {Object} data - Case data fields
 */
function calculate(data) {
  const {
    salario,
    data_admissao,
    data_rescisao,
    ultimo_dia_trabalhado,
    total_deducoes_mes_rescisao,
    total_deducoes,
    valor_pago_ficha,
    ferias_vencidas_count,
    ferias_vencidas_periodos
  } = data;

  const salary = parseFloat(salario) || 0;
  const admissionDate = data_admissao;
  const dismissalDate = data_rescisao;
  const lastWorkedDay = ultimo_dia_trabalhado || dismissalDate;

  if (!salary || !admissionDate || !dismissalDate) {
    throw new Error('Dados insuficientes: salário, data de admissão e data de rescisão são obrigatórios');
  }

  // Parse afastamentos from JSON string
  let afastamentos = [];
  if (data.afastamentos) {
    try {
      afastamentos = typeof data.afastamentos === 'string'
        ? JSON.parse(data.afastamentos)
        : data.afastamentos;
    } catch (e) {
      console.error('Failed to parse afastamentos:', e.message);
    }
  }

  const dismissal = parseDate(dismissalDate);
  const lastWorked = parseDate(lastWorkedDay);
  const admission = parseDate(admissionDate);

  const result = {
    employee_data: {
      nome_reclamante: data.nome_reclamante || '',
      nome_reclamado: data.nome_reclamado || '',
      numero_processo: data.numero_processo || '',
      data_admissao: admissionDate,
      data_rescisao: dismissalDate,
      ultimo_dia_trabalhado: lastWorkedDay,
      salario: salary,
      funcao: data.funcao || '',
      afastamentos
    },
    calculations: {},
    total: 0,
    calculation_date: new Date().toISOString()
  };

  // ========================================
  // 1. SALDO DE SALÁRIO
  // ========================================
  // Days = day-of-month of ultimo_dia_trabalhado
  const daysWorkedInLastMonth = lastWorked.getDate();
  const dailyRate = salary / 30;
  const grossSaldoSalario = dailyRate * daysWorkedInLastMonth;

  // Deductions: prefer total_deducoes_mes_rescisao (from ficha financeira extractor)
  const deducoes = parseFloat(total_deducoes_mes_rescisao) ||
                   parseFloat(total_deducoes) ||
                   parseFloat(valor_pago_ficha) || 0;
  const netSaldoSalario = Math.max(0, grossSaldoSalario - deducoes);

  result.calculations.saldo_salario = {
    label: 'Saldo de Salário',
    salary,
    days_worked: daysWorkedInLastMonth,
    daily_rate: dailyRate,
    gross_value: grossSaldoSalario,
    deductions: deducoes,
    net_value: netSaldoSalario,
    formula: `(R$ ${salary.toFixed(2)} ÷ 30) × ${daysWorkedInLastMonth} dias = R$ ${grossSaldoSalario.toFixed(2)} - R$ ${deducoes.toFixed(2)} deduções = R$ ${netSaldoSalario.toFixed(2)}`
  };

  // ========================================
  // 2. 13º SALÁRIO PROPORCIONAL
  // ========================================
  const dismissalYear = dismissal.getFullYear();
  const avosDecimoTerceiro = calculateAvosForYear(admissionDate, dismissalDate, dismissalYear, afastamentos);
  const decimoTerceiroValue = (avosDecimoTerceiro / 12) * salary;

  const adiantamento13 = parseFloat(data.adiantamento_decimo_terceiro) || 0;
  const net13 = Math.max(0, decimoTerceiroValue - adiantamento13);

  result.calculations.decimo_terceiro = {
    label: '13º Salário Proporcional',
    salary,
    avos: avosDecimoTerceiro,
    gross_value: decimoTerceiroValue,
    adiantamento: adiantamento13,
    net_value: net13,
    formula: `${avosDecimoTerceiro}/12 × R$ ${salary.toFixed(2)} = R$ ${decimoTerceiroValue.toFixed(2)}${adiantamento13 > 0 ? ` - R$ ${adiantamento13.toFixed(2)} adiantamento = R$ ${net13.toFixed(2)}` : ''}`
  };

  // ========================================
  // 3. FÉRIAS VENCIDAS
  // ========================================
  let feriasVencidasValue = 0;
  let feriasVencidasPeriods = [];

  const docVencidasCount = ferias_vencidas_count !== undefined && ferias_vencidas_count !== null && ferias_vencidas_count !== ''
    ? parseInt(ferias_vencidas_count)
    : null;

  if (docVencidasCount !== null && !isNaN(docVencidasCount)) {
    // Use count from extracted document (Rel. 11.004)
    feriasVencidasValue = docVencidasCount * salary * (1 + 1 / 3);

    if (ferias_vencidas_periodos) {
      try {
        const periodos = typeof ferias_vencidas_periodos === 'string'
          ? JSON.parse(ferias_vencidas_periodos)
          : ferias_vencidas_periodos;
        feriasVencidasPeriods = periodos.map(p => ({
          ...p,
          value: salary * (1 + 1 / 3),
          days: 30
        }));
      } catch (e) { /* ignore parse errors */ }
    }
  } else {
    // Fallback: calculate from dates — count ALL complete aquisitive periods
    const aquisitivePeriods = calculateAquisitivePeriods(admissionDate, dismissalDate);
    aquisitivePeriods.forEach(period => {
      // All complete aquisitive periods are treated as vencidas in rescisão context
      const periodoValue = salary * (1 + 1 / 3);
      feriasVencidasValue += periodoValue;
      feriasVencidasPeriods.push({ ...period, value: periodoValue, days: 30 });
    });
  }

  if (data.ferias_vencidas_manual) {
    feriasVencidasValue = parseFloat(data.ferias_vencidas_manual) || feriasVencidasValue;
  }

  result.calculations.ferias_vencidas = {
    label: 'Férias Vencidas',
    periods: feriasVencidasPeriods,
    salary,
    gross_value: feriasVencidasValue,
    net_value: feriasVencidasValue,
    formula: feriasVencidasPeriods.length > 0
      ? `${feriasVencidasPeriods.length} período(s) × R$ ${salary.toFixed(2)} × (1 + 1/3) = R$ ${feriasVencidasValue.toFixed(2)}`
      : 'Sem férias vencidas'
  };

  // ========================================
  // 4. FÉRIAS PROPORCIONAIS + 1/3
  // ========================================
  const avosFerias = calculateAvosFerias(admissionDate, dismissalDate, afastamentos);
  const feriasProporcValue = (avosFerias / 12) * salary * (1 + 1 / 3);

  result.calculations.ferias_proporcionais = {
    label: 'Férias Proporcionais + 1/3',
    salary,
    avos: avosFerias,
    multiplier: 1 + 1 / 3,
    gross_value: feriasProporcValue,
    net_value: feriasProporcValue,
    formula: `${avosFerias}/12 × R$ ${salary.toFixed(2)} × (1 + 1/3) = R$ ${feriasProporcValue.toFixed(2)}`
  };

  // ========================================
  // TOTAL
  // ========================================
  result.total = netSaldoSalario + net13 + feriasVencidasValue + feriasProporcValue;

  result.summary = {
    saldo_salario: netSaldoSalario,
    decimo_terceiro: net13,
    ferias_vencidas: feriasVencidasValue,
    ferias_proporcionais: feriasProporcValue,
    total: result.total
  };

  result.formatted = {
    saldo_salario: formatCurrency(netSaldoSalario),
    decimo_terceiro: formatCurrency(net13),
    ferias_vencidas: formatCurrency(feriasVencidasValue),
    ferias_proporcionais: formatCurrency(feriasProporcValue),
    total: formatCurrency(result.total)
  };

  return result;
}

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
 * Format date for display (YYYY-MM-DD to DD/MM/YYYY)
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

module.exports = {
  calculate,
  calculateAvos,
  calculateAvosForYear,
  calculateAquisitivePeriods,
  calculateAvosFerias,
  getAfastamentoDaysInMonth,
  formatCurrency,
  formatDate,
  parseDate
};
