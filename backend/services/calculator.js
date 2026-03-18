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
 * Find the start date of the current aquisitive férias period.
 * Applies the rule: if a single AUX.DOENÇA period lasted more than 6 consecutive months,
 * the aquisitive period is zeroed and restarts from the day after the AUX.DOENÇA ended.
 */
function findFeriasPeriodStart(admissionDate, dismissalDate, afastamentos) {
  const admission = parseDate(admissionDate);
  const dismissal = parseDate(dismissalDate);
  if (!admission || !dismissal) return null;

  let periodStart = new Date(admission);

  while (true) {
    const nextPeriodStart = new Date(periodStart);
    nextPeriodStart.setFullYear(nextPeriodStart.getFullYear() + 1);

    if (nextPeriodStart > dismissal) {
      // Current (incomplete) period — this is what we want
      break;
    }

    // Check if any AUX.DOENÇA > 6 consecutive months ended within this period
    const longAux = (afastamentos || []).find(af => {
      if (af.tipo !== 'beneficio_comum') return false;
      const afStart = parseDate(af.data_inicio);
      const afEnd = parseDate(af.data_fim);
      if (!afStart || !afEnd) return false;
      // Duration > 6 months?
      const sixMonthsLater = new Date(afStart);
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      if (afEnd <= sixMonthsLater) return false;
      // Did this AUX.DOENÇA end within the current aquisitive period?
      return afEnd > periodStart && afEnd < nextPeriodStart;
    });

    if (longAux) {
      // Reset: new period starts from day after AUX.DOENÇA ended (return to work)
      const afEnd = parseDate(longAux.data_fim);
      const returnDate = new Date(afEnd);
      returnDate.setDate(returnDate.getDate() + 1);
      periodStart = returnDate;
      // Do NOT advance by 1 year — restart search from new period start
      continue;
    }

    // This period completed normally — advance to next
    periodStart = nextPeriodStart;
  }

  return periodStart;
}

/**
 * Calculate avos (twelfths) for proportional férias.
 * Based on the current (incomplete) aquisitive period.
 * Applies AUX.DOENÇA > 6 months reset rule.
 */
function calculateAvosFerias(admissionDate, dismissalDate, afastamentos = []) {
  const admission = parseDate(admissionDate);
  const dismissal = parseDate(dismissalDate);

  if (!admission || !dismissal) return 0;

  // Find start of current aquisitive period (with AUX.DOENÇA reset rule applied)
  const periodStart = findFeriasPeriodStart(admissionDate, dismissalDate, afastamentos);
  if (!periodStart) return 0;

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

  // Deductions: compute from ficha_meses_json when available (most accurate)
  let deducoesTotal = 0;
  let deducoesItems = [];

  if (data.ficha_meses_json) {
    try {
      const fichaMeses = JSON.parse(data.ficha_meses_json);
      // Rescisão month key: YYYY-MM from ultimo_dia_trabalhado
      const rescisaoMonthKey = lastWorked.toISOString().slice(0, 7);

      const rescisaoMes = fichaMeses[rescisaoMonthKey];
      if (rescisaoMes) {
        // Adiantamento salarial (código 017, período 1) — already paid to employee
        const adiantamento = rescisaoMes.p1 && rescisaoMes.p1['017'] ? rescisaoMes.p1['017'] : 0;
        if (adiantamento > 0) {
          deducoesItems.push({ descricao: 'Adiantamento Salarial (017/P1)', valor: adiantamento });
          deducoesTotal += adiantamento;
        }
        // Fechamento salarial (código 001, período 2) — second half payment if already processed
        const fechamento = rescisaoMes.p2 && rescisaoMes.p2['001'] ? rescisaoMes.p2['001'] : 0;
        if (fechamento > 0) {
          deducoesItems.push({ descricao: 'Fechamento Salarial (001/P2)', valor: fechamento });
          deducoesTotal += fechamento;
        }
        // Other period 2 deductions (125, etc.)
        if (rescisaoMes.p2) {
          for (const [code, val] of Object.entries(rescisaoMes.p2)) {
            if (code !== '001' && code !== '017' && val > 0) {
              deducoesItems.push({ descricao: `Desconto cód.${code}/P2`, valor: val });
              deducoesTotal += val;
            }
          }
        }
      }

      // Deduct payments from months AFTER ultimo_dia_trabalhado (overpayments)
      for (const [monthKey, mesData] of Object.entries(fichaMeses)) {
        if (monthKey > rescisaoMonthKey) {
          const p1Adiant = (mesData.p1 && mesData.p1['017']) || 0;
          const p1Salary = (mesData.p1 && mesData.p1['001']) || 0;
          const p2Salary = (mesData.p2 && mesData.p2['001']) || 0;
          const mesTotal = p1Adiant + p1Salary + p2Salary;
          if (mesTotal > 0) {
            deducoesItems.push({ descricao: `Pagamento indevido ${monthKey}`, valor: mesTotal });
            deducoesTotal += mesTotal;
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse ficha_meses_json:', e.message);
    }
  }

  // Fallback to legacy fields if no ficha_meses_json data
  if (deducoesTotal === 0) {
    deducoesTotal = parseFloat(total_deducoes_mes_rescisao) ||
                    parseFloat(total_deducoes) ||
                    parseFloat(valor_pago_ficha) || 0;
    if (deducoesTotal > 0) {
      deducoesItems = [{ descricao: 'Deduções (Ficha Financeira)', valor: deducoesTotal }];
    }
  }

  const netSaldoSalario = Math.max(0, grossSaldoSalario - deducoesTotal);

  result.calculations.saldo_salario = {
    label: 'Saldo de Salário',
    salary,
    days_worked: daysWorkedInLastMonth,
    daily_rate: dailyRate,
    gross_value: grossSaldoSalario,
    deductions: deducoesTotal,
    deducoes_items: deducoesItems,
    net_value: netSaldoSalario,
    formula: `(R$ ${salary.toFixed(2)} ÷ 30) × ${daysWorkedInLastMonth} dias = R$ ${grossSaldoSalario.toFixed(2)}${deducoesTotal > 0 ? ` − R$ ${deducoesTotal.toFixed(2)} deduções = R$ ${netSaldoSalario.toFixed(2)}` : ''}`
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
    const feriasVencidasBase = docVencidasCount * salary;
    const feriasVencidasAdicional = feriasVencidasBase / 3;
    feriasVencidasValue = feriasVencidasBase + feriasVencidasAdicional;

    if (ferias_vencidas_periodos) {
      try {
        const periodos = typeof ferias_vencidas_periodos === 'string'
          ? JSON.parse(ferias_vencidas_periodos)
          : ferias_vencidas_periodos;
        feriasVencidasPeriods = periodos.map(p => ({
          ...p,
          ferias_base: salary,
          adicional_um_terco: salary / 3,
          value: salary + salary / 3,
          days: 30
        }));
      } catch (e) { /* ignore parse errors */ }
    }
  } else {
    // Fallback: calculate from dates — count ALL complete aquisitive periods
    const aquisitivePeriods = calculateAquisitivePeriods(admissionDate, dismissalDate);
    aquisitivePeriods.forEach(period => {
      const periodoBase = salary;
      const periodoAdicional = salary / 3;
      const periodoValue = periodoBase + periodoAdicional;
      feriasVencidasValue += periodoValue;
      feriasVencidasPeriods.push({
        ...period,
        ferias_base: periodoBase,
        adicional_um_terco: periodoAdicional,
        value: periodoValue,
        days: 30
      });
    });
  }

  if (data.ferias_vencidas_manual) {
    feriasVencidasValue = parseFloat(data.ferias_vencidas_manual) || feriasVencidasValue;
  }

  const feriasVencidasBase = feriasVencidasPeriods.reduce((s, p) => s + (p.ferias_base || 0), 0);
  const feriasVencidasAdicional = feriasVencidasPeriods.reduce((s, p) => s + (p.adicional_um_terco || 0), 0);

  result.calculations.ferias_vencidas = {
    label: 'Férias Vencidas',
    periods: feriasVencidasPeriods,
    salary,
    ferias_base: feriasVencidasBase,
    adicional_um_terco: feriasVencidasAdicional,
    gross_value: feriasVencidasValue,
    net_value: feriasVencidasValue,
    formula: feriasVencidasPeriods.length > 0
      ? `${feriasVencidasPeriods.length} período(s) × R$ ${salary.toFixed(2)} + 1/3 (R$ ${(salary / 3).toFixed(2)}) = R$ ${feriasVencidasValue.toFixed(2)}`
      : 'Sem férias vencidas'
  };

  // ========================================
  // 4. FÉRIAS PROPORCIONAIS + 1/3
  // ========================================
  const avosFerias = calculateAvosFerias(admissionDate, dismissalDate, afastamentos);
  const periodStartFerias = findFeriasPeriodStart(admissionDate, dismissalDate, afastamentos);
  const feriasProporcBase = (avosFerias / 12) * salary;
  const feriasProporcAdicional = feriasProporcBase / 3;
  const feriasProporcTotal = feriasProporcBase + feriasProporcAdicional;

  result.calculations.ferias_proporcionais = {
    label: 'Férias Proporcionais + 1/3',
    salary,
    avos: avosFerias,
    periodo_aquisitivo_inicio: periodStartFerias ? periodStartFerias.toISOString().split('T')[0] : null,
    ferias_base: feriasProporcBase,
    adicional_um_terco: feriasProporcAdicional,
    gross_value: feriasProporcTotal,
    net_value: feriasProporcTotal,
    formula: `${avosFerias}/12 × R$ ${salary.toFixed(2)} = R$ ${feriasProporcBase.toFixed(2)} + 1/3 (R$ ${feriasProporcAdicional.toFixed(2)}) = R$ ${feriasProporcTotal.toFixed(2)}`
  };

  // ========================================
  // TOTAL
  // ========================================
  result.total = netSaldoSalario + net13 + feriasVencidasValue + feriasProporcTotal;

  result.summary = {
    saldo_salario: netSaldoSalario,
    decimo_terceiro: net13,
    ferias_vencidas: feriasVencidasValue,
    ferias_proporcionais: feriasProporcTotal,
    total: result.total
  };

  result.formatted = {
    saldo_salario: formatCurrency(netSaldoSalario),
    decimo_terceiro: formatCurrency(net13),
    ferias_vencidas: formatCurrency(feriasVencidasValue),
    ferias_proporcionais: formatCurrency(feriasProporcTotal),
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
  findFeriasPeriodStart,
  getAfastamentoDaysInMonth,
  formatCurrency,
  formatDate,
  parseDate
};
