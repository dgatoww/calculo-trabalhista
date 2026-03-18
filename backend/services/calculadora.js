function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
}

function diffMonths(d1, d2) {
  const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  return months;
}

function calcularAvos(dataAdmissao, dataReferencia, afastamentos, tipo) {
  // tipo: '13' ou 'ferias'
  let avos = 0;

  const inicio = parseDate(dataAdmissao);
  const fim = parseDate(dataReferencia);

  if (!inicio || !fim) return 0;

  // Iterar mês a mês
  let current = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const fimMes = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());

  while (current <= fimMes) {
    const mesAtual = current.getMonth();
    const anoAtual = current.getFullYear();

    // Quantos dias úteis/válidos neste mês
    const primeiroDiaMes = new Date(anoAtual, mesAtual, 1);
    const ultimoDiaMes = new Date(anoAtual, mesAtual + 1, 0);

    // Início efetivo neste mês
    const inicioEfetivo = current <= inicio ? inicio : primeiroDiaMes;
    // Fim efetivo neste mês
    const fimEfetivo = ultimoDiaMes < fimMes ? ultimoDiaMes : fimMes;

    // Dias no mês
    let diasNoMes = Math.floor((fimEfetivo - inicioEfetivo) / (1000 * 60 * 60 * 24)) + 1;

    // Descontar afastamentos que NÃO contam (beneficio_comum para ambos)
    if (afastamentos && afastamentos.length > 0) {
      for (const af of afastamentos) {
        if (af.tipo === 'beneficio_comum') {
          const afInicio = parseDate(af.inicio);
          const afFim = parseDate(af.fim);

          // Interseção com o mês atual
          const afInicioMes = afInicio < primeiroDiaMes ? primeiroDiaMes : afInicio;
          const afFimMes = afFim > ultimoDiaMes ? ultimoDiaMes : afFim;

          if (afInicioMes <= afFimMes) {
            const diasAfastamento = Math.floor((afFimMes - afInicioMes) / (1000 * 60 * 60 * 24)) + 1;
            diasNoMes -= diasAfastamento;
          }
        }
        // LIC.MATERNIDADE conta para avos (não desconta)
      }
    }

    if (diasNoMes >= 15) avos++;

    current = new Date(anoAtual, mesAtual + 1, 1);
  }

  return avos;
}

function calcularSaldoSalario(salario, dataRescisao, ultimoDiaTrabalhado, adiantamento) {
  const rescisao = parseDate(dataRescisao);
  if (!rescisao) return 0;

  // Dias trabalhados = dia da rescisao no mês
  const diasTrabalhados = rescisao.getDate();

  const valorBruto = (salario / 30) * diasTrabalhados;
  const valorLiquido = valorBruto - (adiantamento || 0);

  return {
    diasTrabalhados,
    valorBruto: Math.round(valorBruto * 100) / 100,
    adiantamento: adiantamento || 0,
    valorLiquido: Math.round(valorLiquido * 100) / 100
  };
}

function calcular13Proporcional(salario, dataAdmissao, dataRescisao, afastamentos) {
  // Conta avos do ano corrente
  const rescisao = parseDate(dataRescisao);
  if (!rescisao) return 0;

  // Data inicio do calculo para 13: 1 de janeiro do ano de rescisao
  const inicioAno = new Date(rescisao.getFullYear(), 0, 1);
  const dataAdm = parseDate(dataAdmissao);

  // Usar a maior data entre admissão e inicio do ano
  const dataInicio = dataAdm > inicioAno ? dataAdmissao : `01/01/${rescisao.getFullYear()}`;

  const avos = calcularAvos(dataInicio, dataRescisao, afastamentos, '13');
  const valor = (salario / 12) * avos;

  return {
    avos,
    valor: Math.round(valor * 100) / 100
  };
}

function calcularFeriasVencidas(salario, periodos) {
  // Cada periodo vencido = salario x 1.333 (já inclui 1/3)
  const valor = salario * 1.3333333 * periodos;
  return {
    periodos,
    valor: Math.round(valor * 100) / 100
  };
}

function calcularFeriasProporcionais(salario, dataAdmissao, dataRescisao, afastamentos) {
  // Pegar o início do período aquisitivo atual
  const admissao = parseDate(dataAdmissao);
  const rescisao = parseDate(dataRescisao);

  if (!admissao || !rescisao) return { avos: 0, valor: 0 };

  // Calcular quantos períodos completos passaram
  const totalMeses = diffMonths(admissao, rescisao);
  const periodosCompletos = Math.floor(totalMeses / 12);

  // Início do período atual
  const inicioAtual = new Date(
    admissao.getFullYear() + periodosCompletos,
    admissao.getMonth(),
    admissao.getDate()
  );

  const dataInicioStr = `${String(inicioAtual.getDate()).padStart(2, '0')}/${String(inicioAtual.getMonth() + 1).padStart(2, '0')}/${inicioAtual.getFullYear()}`;

  const avos = calcularAvos(dataInicioStr, dataRescisao, afastamentos, 'ferias');
  const valor = (salario / 12) * avos * 1.3333333;

  return {
    avos,
    periodoInicio: dataInicioStr,
    valor: Math.round(valor * 100) / 100
  };
}

function calcularTudo(dados) {
  const {
    salario,
    data_admissao,
    data_rescisao,
    ultimo_dia_trabalhado,
    adiantamento,
    afastamentos,
    ferias_vencidas_periodos
  } = dados;

  const saldoSalario = calcularSaldoSalario(salario, data_rescisao, ultimo_dia_trabalhado, adiantamento);
  const decimo3 = calcular13Proporcional(salario, data_admissao, data_rescisao, afastamentos || []);
  const feriasVencidas = calcularFeriasVencidas(salario, ferias_vencidas_periodos || 0);
  const feriasProporcionais = calcularFeriasProporcionais(salario, data_admissao, data_rescisao, afastamentos || []);

  const total = saldoSalario.valorLiquido + decimo3.valor + feriasVencidas.valor + feriasProporcionais.valor;

  return {
    saldo_salario: saldoSalario,
    decimo_terceiro: decimo3,
    ferias_vencidas: feriasVencidas,
    ferias_proporcionais: feriasProporcionais,
    total: Math.round(total * 100) / 100
  };
}

module.exports = { calcularTudo };
