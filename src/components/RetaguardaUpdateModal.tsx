import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Database,
  ArrowRight,
  Activity
} from 'lucide-react';
import { Demand } from '../types';
import { sqliteService } from '../services/sqliteService';

interface RetaguardaUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  demand: Demand | null;
  onSuccess?: (updatedDemand: Demand) => void;
  activeImplantador?: string;
  onOpenApiMonitor?: () => void;
}

export const RetaguardaUpdateModal: React.FC<RetaguardaUpdateModalProps> = ({
  isOpen,
  onClose,
  demand,
  onSuccess,
  activeImplantador,
  onOpenApiMonitor,
}) => {
  if (!isOpen || !demand) return null;

  const [resumoFinal, setResumoFinal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiResponse, setApiResponse] = useState<{
    success: boolean;
    erro: number;
    descricao: string;
  } | null>(null);
  const [apiStatus, setApiStatus] = useState<{
    configured: boolean;
    endpoint: string;
    maskedToken: string | null;
  } | null>(null);

  // Check API configuration on open
  useEffect(() => {
    sqliteService.checkRetaguardaApiStatus().then(status => {
      setApiStatus(status);
    });

    // Default pre-fill if empty
    if (!resumoFinal) {
      const lastCheckIn = demand.checkIns && demand.checkIns.length > 0 
        ? demand.checkIns[demand.checkIns.length - 1] 
        : null;

      if (lastCheckIn && lastCheckIn.note) {
        setResumoFinal(lastCheckIn.note);
      } else {
        setResumoFinal(`Implantação em andamento na etapa de ${demand.currentStage}.`);
      }
    }
    setApiResponse(null);
  }, [isOpen, demand.seq]);

  // Quick preset suggestions
  const handleApplyPreset = (presetText: string) => {
    setResumoFinal(presetText);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumoFinal.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setApiResponse(null);

    const author = activeImplantador || demand.implantador || 'Operador';
    const result = await sqliteService.sendRetaguardaResumoFinal(
      demand.seq, 
      resumoFinal.trim(),
      author
    );

    setIsSubmitting(false);
    setApiResponse(result);

    if (result.success && result.erro === 0) {
      const updated: Demand = {
        ...demand,
        retaguardaAtualizado: true,
        dataRetaguardaAtualizado: result.dataRetaguardaAtualizado || new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        lastChangeSummary: `Resumo final gravado na Retaguarda via API (Seq #${demand.seq})`
      };

      if (onSuccess) {
        onSuccess(updated);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-100 flex items-center gap-2">
                <span>Atualizar Resumo Final no Retaguarda</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Demanda #{demand.seq} • {demand.razaoSocial}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 sidebar-scroll">
          {/* API Info & Technical Contract Details */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>API Oficial Retaguarda ERP (POST /gravaresumofinal)</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                ImplantacaoSeq: {demand.seq}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              O conteúdo enviado em <strong>ImplantacaoResumoFinal</strong> é acrescentado ao resumo existente na base do Retaguarda, preservando o histórico anterior através de quebras de linha automáticas.
            </p>

            {/* Server Token Status */}
            {apiStatus && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-mono">
                <span className="text-slate-400">Status do Token:</span>
                {apiStatus.configured ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Configurado no servidor</span>
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1 font-semibold" title="Defina RETAGUARDA_API_TOKEN no arquivo .env">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Token não configurado no servidor (RETAGUARDA_API_TOKEN)</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Feedback Response Banner */}
          {apiResponse && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 animate-fade-in ${
              apiResponse.success && apiResponse.erro === 0
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                : apiResponse.erro === 9
                ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                : 'bg-rose-950/60 border-rose-500/60 text-rose-200'
            }`}>
              <div className="mt-0.5 shrink-0">
                {apiResponse.success && apiResponse.erro === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-sm">
                  {apiResponse.success && apiResponse.erro === 0 
                    ? 'Resumo final gravado com sucesso no Retaguarda!' 
                    : `Erro retornado pela API (Código ${apiResponse.erro})`}
                </div>
                <p className="leading-relaxed">
                  {apiResponse.descricao}
                </p>
                {apiResponse.erro === 9 && (
                  <p className="text-[11px] opacity-90 pt-0.5">
                    💡 Dica: Verifique se o token informado no header está correto e ativo no Retaguarda ERP.
                  </p>
                )}
                {apiResponse.erro === 2 && (
                  <p className="text-[11px] opacity-90 pt-0.5">
                    💡 Dica: Verifique se a implantação de código #{demand.seq} existe cadastrada no Retaguarda.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSend} className="space-y-3.5">
            {/* Quick Suggestion Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Sugestões Rápidas de Resumo:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('Implantação finalizada com sucesso. Foram realizados os testes de integração e validação com o cliente.')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors border border-slate-700"
                >
                  Exemplo Oficial (Finalizada com Sucesso)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('Treinamento realizado com os usuários. Parametrização dos módulos validada e liberada para uso.')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors border border-slate-700"
                >
                  Treinamento Realizado
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('Homologação concluída com sucesso. Testes de emissão e rotinas operacionais validados.')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors border border-slate-700"
                >
                  Homologação Concluída
                </button>
              </div>
            </div>

            {/* Input ImplantacaoResumoFinal */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <label htmlFor="resumo-final-input" className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Conteúdo do Resumo Final (ImplantacaoResumoFinal):</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {resumoFinal.length} caracteres
                </span>
              </div>
              <textarea
                id="resumo-final-input"
                rows={4}
                value={resumoFinal}
                onChange={(e) => setResumoFinal(e.target.value)}
                placeholder="Digite o texto que será acrescentado ao resumo final da implantação no Retaguarda ERP..."
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                required
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
              {onOpenApiMonitor ? (
                <button
                  type="button"
                  onClick={onOpenApiMonitor}
                  className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-xs font-semibold flex items-center gap-1.5 transition border border-cyan-800/50"
                  title="Abrir painel de monitoramento e logs da API"
                >
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Logs & Status da API</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!resumoFinal.trim() || isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-950/50 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Send className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>{isSubmitting ? 'Enviando ao Retaguarda...' : 'Gravar no Retaguarda via API'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
