import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Demand } from '../types';
import { compareAndMergeRetaguarda, RetaguardaComparisonResult } from '../utils/parser';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RotateCw, 
  Sparkles, 
  ClipboardCheck,
  Layers,
  Database,
  ShieldCheck,
  ChevronRight,
  FileSpreadsheet,
  Activity
} from 'lucide-react';

interface RetaguardaSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDemands: Demand[];
  onApplySync: (mergedDemands: Demand[], comparison: RetaguardaComparisonResult) => void;
  onOpenApiMonitor?: () => void;
}

export const RetaguardaSyncModal: React.FC<RetaguardaSyncModalProps> = ({
  isOpen,
  onClose,
  currentDemands,
  onApplySync,
  onOpenApiMonitor,
}) => {
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [comparison, setComparison] = useState<RetaguardaComparisonResult | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'new' | 'status' | 'identical'>('new');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);

    const lowerName = file.name.toLowerCase();
    const isExcel = lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('A planilha Excel não possui abas ou dados legíveis.');
          }
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvContent = XLSX.utils.sheet_to_csv(worksheet, { FS: ';', dateNF: 'DD/MM/YY' });
          setInputText(csvContent);
          processComparison(csvContent);
        } catch (err: any) {
          setErrorMessage(`Erro ao ler planilha Excel (${file.name}): ${err?.message || 'Arquivo inválido'}`);
          setComparison(null);
        }
      };
      reader.onerror = () => {
        setErrorMessage('Erro ao ler a planilha Excel enviada.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setInputText(content);
        processComparison(content);
      };
      reader.onerror = () => {
        setErrorMessage('Erro ao ler o arquivo enviado.');
      };
      reader.readAsText(file);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    setFileName(null);
    setErrorMessage(null);
    if (val.trim().length > 20) {
      processComparison(val);
    } else {
      setComparison(null);
    }
  };

  const processComparison = (rawCsv: string) => {
    try {
      const result = compareAndMergeRetaguarda(currentDemands, rawCsv);
      if (result.totalIncoming === 0) {
        setErrorMessage('Nenhuma linha de demanda válida encontrada no texto/arquivo fornecido.');
        setComparison(null);
      } else {
        setComparison(result);
        if (result.newDemands.length > 0) {
          setActivePreviewTab('new');
        } else if (result.statusChanges.length > 0) {
          setActivePreviewTab('status');
        } else {
          setActivePreviewTab('identical');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao processar arquivo da Retaguarda.');
      setComparison(null);
    }
  };

  const handleConfirmSync = () => {
    if (!comparison) return;
    setIsProcessing(true);
    try {
      onApplySync(comparison.mergedDemands, comparison);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setFileName(null);
    setComparison(null);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div 
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <RotateCw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Sincronizar Arquivo da Retaguarda
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                  XLS / XLSX / CSV
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Carregue a planilha Excel (.xls / .xlsx) ou arquivo CSV da Retaguarda para atualizar novas implantações.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Upload or Paste Panel */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Fonte dos Dados da Retaguarda (Excel ou CSV)
              </label>

              {comparison && (
                <button
                  onClick={handleClear}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                >
                  Limpar dados
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* File upload tile */}
              <label className="md:col-span-1 p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/40 hover:bg-emerald-950/20 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 group">
                <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white flex items-center justify-center transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  {fileName ? fileName : 'Enviar Planilha (.xls, .xlsx, .csv)'}
                </div>
                <p className="text-[11px] text-slate-500">
                  Compatível com planilhas Excel (.xls / .xlsx) e arquivos .csv
                </p>
                <input 
                  type="file" 
                  accept=".xlsx,.xls,.csv,.txt" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>

              {/* Textarea for direct paste */}
              <div className="md:col-span-2 relative">
                <textarea
                  rows={4}
                  placeholder="Ou cole aqui diretamente o texto/linhas exportadas do sistema retaguarda (separado por vírgula ou ponto-e-vírgula)..."
                  value={inputText}
                  onChange={handleTextChange}
                  className="w-full h-full p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Validation & Comparison Results Preview */}
          {comparison && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                  Diagnóstico de Validação & Impacto
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  {comparison.totalIncoming} registros processados do arquivo
                </span>
              </div>

              {/* KPI cards of the comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. New implementations */}
                <div 
                  onClick={() => setActivePreviewTab('new')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activePreviewTab === 'new'
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-xs'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Novas Implantações
                    </span>
                    <span className="font-mono text-lg font-black text-emerald-300">
                      +{comparison.newDemands.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Projetos que ainda não constavam na base e serão cadastrados.
                  </p>
                </div>

                {/* 2. Status changes */}
                <div 
                  onClick={() => setActivePreviewTab('status')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activePreviewTab === 'status'
                      ? 'bg-amber-950/40 border-amber-500 shadow-xs'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                      Mudanças de Status
                    </span>
                    <span className="font-mono text-lg font-black text-amber-300">
                      {comparison.statusChanges.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Demandas com status diferente da base (concluídas, canceladas, etc.).
                  </p>
                </div>

                {/* 3. Validated ongoing (identical) */}
                <div 
                  onClick={() => setActivePreviewTab('identical')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    activePreviewTab === 'identical'
                      ? 'bg-blue-950/40 border-blue-500 shadow-xs'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-blue-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      Em Andamento Alinhadas
                    </span>
                    <span className="font-mono text-lg font-black text-blue-300">
                      {comparison.identicalOngoingCount}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Projetos validados com o mesmo status 'Em Andamento'.
                  </p>
                </div>
              </div>

              {/* Data Protection Notice */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-indigo-900/40 text-xs text-indigo-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>Preservação Segura:</strong> Seus check-ins manuais, anotações de evolução e implantadores locais atribuídos <strong>serão mantidos intactos</strong> durante a sincronização.
                </span>
              </div>

              {/* Detail Tables by Selected Tab */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {activePreviewTab === 'new' && `Lista de Novas Implantações (${comparison.newDemands.length})`}
                  {activePreviewTab === 'status' && `Divergências e Mudanças de Status (${comparison.statusChanges.length})`}
                  {activePreviewTab === 'identical' && `Projetos Alinhados em Andamento (${comparison.identicalOngoingCount})`}
                </div>

                <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/60 text-xs">
                  {activePreviewTab === 'new' && (
                    comparison.newDemands.length === 0 ? (
                      <div className="p-6 text-center text-slate-500">
                        Nenhuma nova implantação detectada no arquivo. Todas as demandas já existem na base.
                      </div>
                    ) : (
                      comparison.newDemands.map((d) => (
                        <div key={d.seq} className="p-3 flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-400">#{d.seq}</span>
                              <span className="font-semibold text-slate-200">{d.razaoSocial}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {d.tipo}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[11px]">
                              Início: {d.prevInicio} • Prev. Fim: {d.prevFim} • Comercial: {d.comercial} • {d.hrsNeg}h
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                            {d.status}
                          </span>
                        </div>
                      ))
                    )
                  )}

                  {activePreviewTab === 'status' && (
                    comparison.statusChanges.length === 0 ? (
                      <div className="p-6 text-center text-slate-500">
                        Nenhuma alteração de status detectada. Todos os projetos existentes mantêm o mesmo status.
                      </div>
                    ) : (
                      comparison.statusChanges.map((change) => (
                        <div key={change.seq} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-indigo-400">#{change.seq}</span>
                              <span className="font-semibold text-slate-200">{change.razaoSocial}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({change.implantador || 'Sem implantador'})
                              </span>
                            </div>
                            {change.conclusao && (
                              <div className="text-[11px] text-slate-400">
                                Conclusão informada pela Retaguarda: <strong className="text-slate-300">{change.conclusao}</strong>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 line-through">
                              {change.oldStatus}
                            </span>
                            <ArrowRight className="w-3 h-3 text-amber-400" />
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {change.newStatus}
                            </span>
                          </div>
                        </div>
                      ))
                    )
                  )}

                  {activePreviewTab === 'identical' && (
                    <div className="p-6 text-center text-slate-400 space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-blue-400 mx-auto" />
                      <p>
                        Foram validados com sucesso <strong>{comparison.identicalOngoingCount} projetos ativos</strong> que continuam regularmente com status <strong>"Em Andamento"</strong> em conformidade com o sistema retaguarda.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>

            {onOpenApiMonitor && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenApiMonitor();
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 text-xs font-semibold flex items-center gap-1.5 transition"
                title="Acessar monitoramento em tempo real da API de Resumo Final"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Monitor da API (gravaresumofinal)</span>
              </button>
            )}
          </div>

          {comparison && (
            <button
              onClick={handleConfirmSync}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isProcessing 
                  ? 'Sincronizando...' 
                  : `Confirmar e Sincronizar (${comparison.newDemands.length} novas, ${comparison.statusChanges.length} atualizações)`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
