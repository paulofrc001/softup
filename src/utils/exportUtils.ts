import * as XLSX from 'xlsx';
import { Demand, AlertThresholdSettings } from '../types';
import { getDemandContactInfo, DEFAULT_ALERT_THRESHOLDS } from './contactUtils';
import { parseDate, REFERENCE_DATE } from './parser';

export interface WeeklyExportOptions {
  daysWindow?: number; // default: 7 (última semana)
  includeAllOngoing?: boolean; // default: true
  onlyWithWeeklyCheckins?: boolean; // default: false
  thresholds?: AlertThresholdSettings;
  filename?: string;
  referenceDate?: Date;
}

export interface WeeklyAcompanhamentoRow {
  seq: number;
  clienteId: string;
  razaoSocial: string;
  implantador: string;
  situacaoContato: string;
  validacaoContato: string;
  dataUltimoContato: string;
  diasSemContato: number;
  dataAcompanhamento: string;
  implantadorAcompanhamento: string;
  tempoGastoHoras: number | string;
  tempoGastoMinutos: number | string;
  progressoPercent: number | string;
  etapaProcesso: string;
  descricaoAcompanhamento: string;
  impedimentoGargalo: string;
}

export interface DemandaSituacaoSemanalRow {
  seq: number;
  clienteId: string;
  razaoSocial: string;
  status: string;
  implantador: string;
  situacaoContato: string;
  classificacaoRisco: string;
  diasSemContato: number;
  dataUltimoContato: string;
  retornoContato: string;
  evoluidoNaSemana: string;
  qtdAcompanhamentosSemana: number;
  dataUltimoAcompanhamentoSemana: string;
  descricaoUltimoAcompanhamentoSemana: string;
}

/**
 * Identifica se a data do acompanhamento/check-in ocorreu na "última semana".
 * Avalia tanto a data atual real (sistema) quanto a data de corte do projeto (30/09/2026).
 */
export function isCheckInWithinLastWeek(
  checkInDateStr: string,
  daysWindow: number = 7,
  referenceDate: Date = REFERENCE_DATE
): boolean {
  if (!checkInDateStr) return false;

  const parsed = parseDate(checkInDateStr);
  const now = new Date();

  if (parsed) {
    // 1. Janela em relação à data atual real
    const diffDaysNow = Math.abs(now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDaysNow <= daysWindow) return true;

    // 2. Janela em relação à REFERENCE_DATE do dataset (30/09/2026)
    const diffDaysRef = Math.abs(referenceDate.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDaysRef <= daysWindow) return true;

    // 3. Intervalo explícito [refDate - daysWindow, refDate + daysWindow]
    const startRef = new Date(referenceDate);
    startRef.setDate(startRef.getDate() - daysWindow);
    const endRef = new Date(referenceDate);
    endRef.setDate(endRef.getDate() + 2); // margem segura de fechamento de corte
    if (parsed >= startRef && parsed <= endRef) return true;
  }

  // Tenta parse como ISO caso venha com timestamp
  try {
    const isoDate = new Date(checkInDateStr);
    if (!isNaN(isoDate.getTime())) {
      const diffDaysNow = Math.abs(now.getTime() - isoDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDaysNow <= daysWindow) return true;
      const diffDaysRef = Math.abs(referenceDate.getTime() - isoDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDaysRef <= daysWindow) return true;
    }
  } catch (e) {}

  return false;
}

/**
 * Converte a etapa técnica para rótulo legível em português.
 */
export function formatStageLabel(stage?: string): string {
  switch (stage) {
    case 'kickoff': return 'Kick-off / Alinhamento';
    case 'parametrizacao': return 'Parametrização do Sistema';
    case 'treinamento': return 'Treinamento dos Usuários';
    case 'homologacao': return 'Homologação e Testes';
    case 'tep_cs': return 'Validação CS / TEP';
    case 'concluido': return 'Concluído';
    case 'pausado_cancelado': return 'Pausado / Cancelado';
    default: return stage || 'Não especificada';
  }
}

/**
 * Coleta e estrutura os dados para exportação em XLS conforme solicitado pelo usuário:
 * - Número da implantação (seq)
 * - Situação do Contato
 * - Histórico de Acompanhamentos apenas da última semana
 */
export function prepareWeeklyExportData(
  demands: Demand[],
  options: WeeklyExportOptions = {}
): {
  acompanhamentosSemana: WeeklyAcompanhamentoRow[];
  situacaoGeralContatos: DemandaSituacaoSemanalRow[];
  totalAcompanhamentosSemana: number;
  totalDemandasComAcompanhamento: number;
} {
  const daysWindow = options.daysWindow ?? 7;
  const thresholds = options.thresholds ?? DEFAULT_ALERT_THRESHOLDS;
  const referenceDate = options.referenceDate ?? REFERENCE_DATE;

  const acompanhamentosSemana: WeeklyAcompanhamentoRow[] = [];
  const situacaoGeralContatos: DemandaSituacaoSemanalRow[] = [];

  let totalDemandasComAcompanhamento = 0;

  demands.forEach(demand => {
    // Avalia situação do contato da demanda
    const contactInfo = getDemandContactInfo(demand, thresholds);

    const situacaoContato = contactInfo.statusLabel || 'Sem Registro de Contato';
    const validacaoContato = contactInfo.interactionStatusBadge?.label 
      || (contactInfo.latestInteraction ? 'Contato Registrado' : 'Sem validação direta');
    const dataUltimoContato = contactInfo.lastContactDateStr || 'Não informado';
    const diasSemContato = contactInfo.daysWithoutContact || 0;

    let classificacaoRisco = 'Em Dia';
    if (contactInfo.isCritical) classificacaoRisco = 'Crítico';
    else if (contactInfo.isAlert) classificacaoRisco = 'Alerta';
    else if (contactInfo.isUnassigned) classificacaoRisco = 'Sem Implantador';

    // Filtra acompanhamentos que pertencem apenas à última semana
    const checkIns = demand.checkIns || [];
    const checkInsDaSemana = checkIns.filter(c => {
      // Se a demanda foi marcada explicitamente como updatedThisWeek ou lastUpdatedAt recente
      if (demand.updatedThisWeek) return true;
      if (demand.lastUpdatedAt) {
        const diffDays = Math.abs(Date.now() - new Date(demand.lastUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= daysWindow) return true;
      }
      return isCheckInWithinLastWeek(c.date, daysWindow, referenceDate);
    });

    if (checkInsDaSemana.length > 0) {
      totalDemandasComAcompanhamento++;

      // Registra linha a linha cada acompanhamento da última semana
      checkInsDaSemana.forEach(c => {
        acompanhamentosSemana.push({
          seq: demand.seq,
          clienteId: demand.clienteId || '',
          razaoSocial: demand.razaoSocial || '',
          implantador: demand.implantador || 'Não Atribuído',
          situacaoContato,
          validacaoContato,
          dataUltimoContato,
          diasSemContato,
          dataAcompanhamento: c.date || 'Recente',
          implantadorAcompanhamento: c.implantador || demand.implantador || 'Não Atribuído',
          tempoGastoHoras: c.horasGastas !== undefined ? Number(c.horasGastas).toFixed(2) : '1.00',
          tempoGastoMinutos: c.minutosGastos !== undefined ? c.minutosGastos : (c.horasGastas ? Math.round(c.horasGastas * 60) : 60),
          progressoPercent: `${c.progressPercent || demand.progressPercent || 0}%`,
          etapaProcesso: formatStageLabel(c.stage || demand.currentStage),
          descricaoAcompanhamento: c.note || 'Acompanhamento registrado',
          impedimentoGargalo: c.blocker || (demand.bottlenecks && demand.bottlenecks[0]) || 'Nenhum'
        });
      });
    } else if (!options.onlyWithWeeklyCheckins) {
      // Se solicitado incluir demandas em andamento mesmo sem acompanhamento na semana
      if (options.includeAllOngoing && demand.status === 'Em Andamento') {
        acompanhamentosSemana.push({
          seq: demand.seq,
          clienteId: demand.clienteId || '',
          razaoSocial: demand.razaoSocial || '',
          implantador: demand.implantador || 'Não Atribuído',
          situacaoContato,
          validacaoContato,
          dataUltimoContato,
          diasSemContato,
          dataAcompanhamento: 'Sem acompanhamento nesta semana',
          implantadorAcompanhamento: '-',
          tempoGastoHoras: 0,
          tempoGastoMinutos: 0,
          progressoPercent: `${demand.progressPercent || 0}%`,
          etapaProcesso: formatStageLabel(demand.currentStage),
          descricaoAcompanhamento: 'Nenhum acompanhamento registrado no período de corte da última semana.',
          impedimentoGargalo: (demand.bottlenecks && demand.bottlenecks[0]) || 'Nenhum'
        });
      }
    }

    // Registra na visão consolidada geral de contatos
    situacaoGeralContatos.push({
      seq: demand.seq,
      clienteId: demand.clienteId || '',
      razaoSocial: demand.razaoSocial || '',
      status: demand.status,
      implantador: demand.implantador || 'Não Atribuído',
      situacaoContato,
      classificacaoRisco,
      diasSemContato,
      dataUltimoContato,
      retornoContato: contactInfo.interactionStatusBadge?.label || (contactInfo.hasContact ? 'Registrado' : 'Sem retorno'),
      evoluidoNaSemana: checkInsDaSemana.length > 0 ? 'SIM' : 'NÃO',
      qtdAcompanhamentosSemana: checkInsDaSemana.length,
      dataUltimoAcompanhamentoSemana: checkInsDaSemana.length > 0 ? checkInsDaSemana[checkInsDaSemana.length - 1].date : '-',
      descricaoUltimoAcompanhamentoSemana: checkInsDaSemana.length > 0 
        ? checkInsDaSemana[checkInsDaSemana.length - 1].note 
        : 'Sem acompanhamento na semana'
    });
  });

  return {
    acompanhamentosSemana,
    situacaoGeralContatos,
    totalAcompanhamentosSemana: acompanhamentosSemana.filter(a => a.dataAcompanhamento !== 'Sem acompanhamento nesta semana').length,
    totalDemandasComAcompanhamento
  };
}

/**
 * Calcula larguras automáticas de colunas para garantir leitura perfeita sem truncamento no Excel.
 */
function calculateColumnWidths(data: (string | number)[][]): { wch: number }[] {
  if (data.length === 0) return [];
  const colCount = data[0].length;
  const widths: number[] = new Array(colCount).fill(12);

  data.forEach(row => {
    row.forEach((cell, colIdx) => {
      const valStr = cell !== null && cell !== undefined ? String(cell) : '';
      if (valStr.length + 3 > widths[colIdx]) {
        widths[colIdx] = Math.min(Math.max(valStr.length + 3, widths[colIdx]), 70); // cap em 70 caracteres
      }
    });
  });

  return widths.map(wch => ({ wch }));
}

/**
 * Gera e dispara o download do arquivo .xlsx nativo contendo:
 * - Número da implantação
 * - Situação do Contato
 * - Histórico de Acompanhamentos da última semana
 */
export function exportWeeklyContactsAndAcompanhamentosToXls(
  demands: Demand[],
  options: WeeklyExportOptions = {}
): { filename: string; totalAcompanhamentos: number; totalDemandas: number } {
  const prepared = prepareWeeklyExportData(demands, options);
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10);
  const filename = options.filename || `implantacoes_contatos_acompanhamentos_semana_${dateStamp}.xlsx`;

  // 1. Cria Workbook Excel
  const workbook = XLSX.utils.book_new();

  // 2. Prepara Planilha 1: Acompanhamentos da Semana
  const headersSheet1 = [
    'Nº Implantação',
    'Razão Social / Cliente',
    'Cód. Cliente',
    'Implantador Responsável',
    'Situação do Contato',
    'Validação do Contato',
    'Data Último Contato',
    'Dias Sem Contato',
    'Data Acompanhamento (Semana)',
    'Implantador Executor',
    'Tempo Gasto (h)',
    'Tempo Gasto (min)',
    'Progresso (%)',
    'Etapa do Processo',
    'Histórico do Acompanhamento',
    'Gargalo / Impedimento'
  ];

  const rowsSheet1: (string | number)[][] = prepared.acompanhamentosSemana.map(r => [
    r.seq,
    r.razaoSocial,
    r.clienteId,
    r.implantador,
    r.situacaoContato,
    r.validacaoContato,
    r.dataUltimoContato,
    r.diasSemContato,
    r.dataAcompanhamento,
    r.implantadorAcompanhamento,
    r.tempoGastoHoras,
    r.tempoGastoMinutos,
    r.progressoPercent,
    r.etapaProcesso,
    r.descricaoAcompanhamento,
    r.impedimentoGargalo
  ]);

  const dataSheet1 = [headersSheet1, ...rowsSheet1];
  const worksheet1 = XLSX.utils.aoa_to_sheet(dataSheet1);
  worksheet1['!cols'] = calculateColumnWidths(dataSheet1);

  XLSX.utils.book_append_sheet(workbook, worksheet1, 'Acompanhamentos da Semana');

  // 3. Prepara Planilha 2: Situação Geral de Contatos
  const headersSheet2 = [
    'Nº Implantação',
    'Cód. Cliente',
    'Razão Social',
    'Status Implantação',
    'Implantador Responsável',
    'Situação do Contato',
    'Classificação de Risco',
    'Dias Sem Contato',
    'Data do Último Contato',
    'Retorno de Contato',
    'Evoluído na Semana?',
    'Qtd Acompanhamentos na Semana',
    'Data Último Acompanhamento (Semana)',
    'Resumo do Último Acompanhamento'
  ];

  const rowsSheet2: (string | number)[][] = prepared.situacaoGeralContatos.map(r => [
    r.seq,
    r.clienteId,
    r.razaoSocial,
    r.status,
    r.implantador,
    r.situacaoContato,
    r.classificacaoRisco,
    r.diasSemContato,
    r.dataUltimoContato,
    r.retornoContato,
    r.evoluidoNaSemana,
    r.qtdAcompanhamentosSemana,
    r.dataUltimoAcompanhamentoSemana,
    r.descricaoUltimoAcompanhamentoSemana
  ]);

  const dataSheet2 = [headersSheet2, ...rowsSheet2];
  const worksheet2 = XLSX.utils.aoa_to_sheet(dataSheet2);
  worksheet2['!cols'] = calculateColumnWidths(dataSheet2);

  XLSX.utils.book_append_sheet(workbook, worksheet2, 'Situação Contatos & Semana');

  // 4. Grava e dispara download
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx' });

  return {
    filename,
    totalAcompanhamentos: prepared.totalAcompanhamentosSemana,
    totalDemandas: prepared.totalDemandasComAcompanhamento
  };
}

/**
 * Exporta todas as demandas completas em formato XLS para quando o usuário desejar backup integral.
 */
export function exportAllDemandsToXls(demands: Demand[], filename?: string): string {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const targetFilename = filename || `todas_implantacoes_${dateStamp}.xlsx`;

  const headers = [
    'Seq',
    'Prev. Início',
    'Prev. Fim',
    'Implantador',
    'Cliente ID',
    'Razão Social',
    'Comercial',
    'Horas Negociadas',
    'Pessoas a Treinar',
    'Módulos',
    'Status',
    'Dias Sem Evolução',
    'Situação do Contato',
    'Data Último Contato',
    'Gargalo Identificado',
    'Retaguarda Atualizado'
  ];

  const rows = demands.map(d => {
    const contact = getDemandContactInfo(d);
    return [
      d.seq,
      d.prevInicio,
      d.prevFim,
      d.implantador,
      d.clienteId,
      d.razaoSocial,
      d.comercial,
      d.hrsNeg,
      d.pessoasTreinar,
      d.totModulos,
      d.status,
      d.daysSinceLastEvolution,
      contact.statusLabel,
      contact.lastContactDateStr || '-',
      (d.bottlenecks && d.bottlenecks[0]) || '',
      d.retaguardaAtualizado ? 'Sim' : 'Não'
    ];
  });

  const data = [headers, ...rows];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet['!cols'] = calculateColumnWidths(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Implantações');

  XLSX.writeFile(workbook, targetFilename, { bookType: 'xlsx' });
  return targetFilename;
}
