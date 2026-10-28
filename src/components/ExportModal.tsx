import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Filter, 
  PhoneCall, 
  Layers, 
  Check,
  AlertTriangle
} from 'lucide-react';
import { Demand, AlertThresholdSettings } from '../types';
import { 
  exportWeeklyContactsAndAcompanhamentosToXls, 
  exportAllDemandsToXls, 
  prepareWeeklyExportData 
} from '../utils/exportUtils';
import { DEFAULT_ALERT_THRESHOLDS } from '../utils/contactUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  demands: Demand[];
  thresholds?: AlertThresholdSettings;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  demands,
  thresholds = DEFAULT_ALERT_THRESHOLDS,
}) => {
  const [daysWindow, setDaysWindow] = useState<number>(7);
  const [onlyWithWeeklyCheckins, setOnlyWithWeeklyCheckins] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<{ filename: string; count: number } | null>(null);

  // Fecha no ESC
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Preview em tempo real dos dados calculados
  const previewData = useMemo(() => {
    return prepareWeeklyExportData(demands, {
      daysWindow,
      includeAllOngoing: true,
      onlyWithWeeklyCheckins,
      thresholds,
    });
  }, [demands, daysWindow, onlyWithWeeklyCheckins, thresholds]);

  if (!isOpen) return null;

  // Ação principal solicitada: Exportar XLS de Número da Implantação, Situação de Contato e Acompanhamentos da Última Semana
  const handleExportWeeklyXls = () => {
    setIsExporting(true);
    try {
      const result = exportWeeklyContactsAndAcompanhamentosToXls(demands, {
        daysWindow,
        includeAllOngoing: !onlyWithWeeklyCheckins,
        onlyWithWeeklyCheckins,
        thresholds,
      });

      setSuccessToast({
        filename: result.filename,
        count: result.totalAcompanhamentos,
      });

      setTimeout(() => {
        setIsExporting(false);
      }, 600);
    } catch (e) {
      console.error('Erro na exportação', e);
      setIsExporting(false);
      alert('Ocorreu um erro ao gerar o arquivo Excel.');
    }
  };

  // Ação secundária: Exportar Todas as Demandas em XLS
  const handleExportAllXls = () => {
    setIsExporting(true);
    try {
      const filename = exportAllDemandsToXls(demands);
      setSuccessToast({
        filename,
        count: demands.length,
      });
      setTimeout(() => {
        setIsExporting(false);
      }, 600);
    } catch (e) {
      console.error('Erro na exportação geral', e);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                <span>Exportação em Planilha XLS</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  .xlsx Nativo
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Geração de relatórios com situação de contato e histórico semanal
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 sidebar-scroll">
          {/* Success Notification */}
          {successToast && (
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-600/60 text-emerald-200 flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-bold block text-slate-100">
                    Planilha gerada com sucesso!
                  </span>
                  <span>
                    Arquivo <strong>{successToast.filename}</strong> baixado automaticamente.
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSuccessToast(null)}
                className="text-[11px] underline text-emerald-300 hover:text-white"
              >
                Dispensar
              </button>
            </div>
          )}

          {/* CARD PRINCIPAL (A SOLICITAÇÃO EXATA DO USUÁRIO) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-emerald-950/30 border border-indigo-700/50 shadow-lg space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-indigo-800/40 pb-3">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                <PhoneCall className="w-4 h-4 text-emerald-400" />
                <span>Relatório Semanal de Contatos & Acompanhamentos</span>
              </div>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                2 Planilhas no mesmo arquivo
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Exporta uma planilha Excel estruturada contendo o <strong>Número da Implantação (Seq)</strong>, a <strong>Situação do Contato</strong> (status, validação, último retorno) e o <strong>Histórico de Acompanhamentos apenas da última semana</strong> com tempo gasto, autor e impedimentos.
            </p>

            {/* Live Metrics Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                <span className="block text-2xl font-black font-mono text-emerald-400">
                  {previewData.totalAcompanhamentosSemana}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Acompanhamentos na Semana
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                <span className="block text-2xl font-black font-mono text-indigo-400">
                  {previewData.totalDemandasComAcompanhamento}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Implantações com Evolução
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center col-span-2 sm:col-span-1">
                <span className="block text-2xl font-black font-mono text-amber-400">
                  {previewData.situacaoGeralContatos.filter(r => r.classificacaoRisco === 'Crítico' || r.classificacaoRisco === 'Alerta').length}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Em Alerta / Crítico
                </span>
              </div>
            </div>

            {/* Filter Configuration */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Janela de corte dos acompanhamentos */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Período do Histórico de Acompanhamentos:</span>
                  </label>
                  <select
                    value={daysWindow}
                    onChange={(e) => setDaysWindow(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value={7}>Última semana (Últimos 7 dias - Padrão)</option>
                    <option value={14}>Últimas 2 semanas (14 dias)</option>
                    <option value={30}>Último mês (30 dias)</option>
                    <option value={9999}>Todos os acompanhamentos históricos</option>
                  </select>
                </div>

                {/* 2. Escopo de linhas incluídas */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Linhas na Planilha Detalhada:</span>
                  </label>
                  <select
                    value={onlyWithWeeklyCheckins ? 'only_weekly' : 'all_ongoing'}
                    onChange={(e) => setOnlyWithWeeklyCheckins(e.target.value === 'only_weekly')}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="all_ongoing">
                      Todas as demandas ativas (com acompanhamentos da semana vinculados)
                    </option>
                    <option value="only_weekly">
                      Apenas demandas com acompanhamentos registrados na semana
                    </option>
                  </select>
                </div>
              </div>

              {/* Informação sobre as abas que serão criadas */}
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <span className="font-semibold text-slate-200 block">
                  📄 Estrutura das Abas no arquivo Excel gerado:
                </span>
                <ul className="space-y-1 pl-4 list-disc text-slate-400">
                  <li>
                    <strong className="text-slate-200">Aba 1 - "Acompanhamentos da Semana":</strong> Contém o Nº Implantação, Razão Social, Situação do Contato, Data Último Contato, Data do Acompanhamento, Implantador Executor, Tempo Gasto, Progresso, Histórico e Gargalo/Impedimento.
                  </li>
                  <li>
                    <strong className="text-slate-200">Aba 2 - "Situação Contatos & Semana":</strong> Visão consolidada de todas as implantações, classificadas por risco de estagnação, indicando se houve evolução na semana e o último relato.
                  </li>
                </ul>
              </div>
            </div>

            {/* Botão de Ação Primário */}
            <button
              onClick={handleExportWeeklyXls}
              disabled={isExporting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>
                {isExporting 
                  ? 'Gerando Planilha Excel...' 
                  : 'Baixar Exportação em XLS (Contato & Acompanhamentos da Semana)'}
              </span>
            </button>
          </div>

          {/* CARD SECUNDÁRIO: EXPORTAÇÃO DA BASE COMPLETA */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Outras Opções de Exportação</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {demands.length} implantações cadastradas
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Caso precise de um espelho completo de todas as colunas da base cadastral original de implantações:
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleExportAllXls}
                disabled={isExporting}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar Todas as Implantações (XLS)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            Compatível com Microsoft Excel, LibreOffice e Google Sheets
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
