import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Clock, 
  Database, 
  Server, 
  ShieldCheck, 
  ShieldAlert, 
  ExternalLink, 
  Terminal, 
  HelpCircle, 
  Search, 
  Filter, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  Info,
  Zap,
  Globe
} from 'lucide-react';
import { RetaguardaApiLog, RetaguardaApiStats } from '../types';
import { sqliteService } from '../services/sqliteService';

interface RetaguardaApiMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterSeq?: number;
}

export const RetaguardaApiMonitorModal: React.FC<RetaguardaApiMonitorModalProps> = ({
  isOpen,
  onClose,
  filterSeq
}) => {
  if (!isOpen) return null;

  const [logs, setLogs] = useState<RetaguardaApiLog[]>([]);
  const [stats, setStats] = useState<RetaguardaApiStats | null>(null);
  const [apiStatus, setApiStatus] = useState<{ configured: boolean; endpoint: string; maskedToken: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    online: boolean;
    authenticated: boolean;
    durationMs: number;
    statusCode: number;
    erro: number | null;
    mensagem: string;
    rawResult?: any;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'logs' | 'instructions' | 'raw_test'>('logs');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [searchSeq, setSearchSeq] = useState<string>(filterSeq ? String(filterSeq) : '');
  const [selectedLog, setSelectedLog] = useState<RetaguardaApiLog | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [status, fetchedStats, fetchedLogs] = await Promise.all([
        sqliteService.checkRetaguardaApiStatus(),
        sqliteService.getRetaguardaStats(),
        sqliteService.getRetaguardaLogs({
          limit: 100,
          seq: searchSeq ? Number(searchSeq) : undefined,
          status: statusFilter
        })
      ]);
      setApiStatus(status);
      setStats(fetchedStats);
      setLogs(fetchedLogs);
    } catch (err) {
      console.error('Failed to load API monitor data', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchSeq, statusFilter]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // auto-refresh a cada 15 segundos
    return () => clearInterval(interval);
  }, [loadData]);

  // Executar teste de conexão
  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await sqliteService.testRetaguardaConnection();
      setTestResult(res);
      // Recarrega estatísticas e logs após teste
      await loadData();
    } catch (err: any) {
      setTestResult({
        online: false,
        authenticated: false,
        durationMs: 0,
        statusCode: 500,
        erro: 500,
        mensagem: err.message || 'Falha ao executar teste de conexão.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Limpar logs
  const handleClearLogs = async () => {
    if (window.confirm('Deseja realmente limpar todos os logs de envio da API Retaguarda armazenados no banco de dados SQLite?')) {
      await sqliteService.clearRetaguardaLogs();
      await loadData();
      setSelectedLog(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl shadow-cyan-950/30 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-monitor-title"
      >
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="api-monitor-title" className="text-lg font-bold text-white tracking-tight">
                  Monitoramento em Tempo Real da API Retaguarda ERP
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  POST gravaresumofinal
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-mono text-slate-300 truncate max-w-md">
                  {apiStatus?.endpoint || 'https://api64.erpgestao.com.br/retaguardanew/rest/api_sgo/gravaresumofinal'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick test button */}
            <button
              onClick={handleRunTest}
              disabled={isTesting}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-sm ${
                isTesting 
                  ? 'bg-slate-800 text-slate-400 cursor-wait'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/20 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isTesting ? 'Testando Conexão...' : 'Testar Conexão Agora'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* STATUS BAR & QUICK METRICS */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 shrink-0">
          {/* Connection status indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  apiStatus?.configured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  apiStatus?.configured ? 'bg-emerald-500' : 'bg-amber-500'
                }`}></span>
              </div>
              <span className="text-xs font-medium text-slate-300">
                Token do Servidor:
              </span>
              <span className={`text-xs font-bold ${
                apiStatus?.configured ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {apiStatus?.configured ? `Configurado (${apiStatus.maskedToken})` : 'Pendente no .env'}
              </span>
            </div>

            {testResult && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                testResult.authenticated 
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                  : testResult.online 
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' 
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                {testResult.authenticated ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span>
                  {testResult.authenticated 
                    ? `API Online & Autenticada (${testResult.durationMs}ms)` 
                    : `Falha: ${testResult.mensagem}`}
                </span>
              </div>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Disparos:</span>
              <strong className="text-white font-mono">{stats?.total || 0}</strong>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span>Sucessos (Erro 0):</span>
              <strong className="font-mono">{stats?.sucessos || 0}</strong>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-amber-400">
              <span>Erros de Token:</span>
              <strong className="font-mono">{stats?.errosToken || 0}</strong>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Latência Média:</span>
              <strong className="text-cyan-400 font-mono">{stats?.latenciaMediaMs ? `${stats.latenciaMediaMs}ms` : '--'}</strong>
            </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="px-5 pt-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
                activeTab === 'logs'
                  ? 'text-cyan-400 border-cyan-400 bg-slate-800/60'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Histórico de Transmissões ({logs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('instructions')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
                activeTab === 'instructions'
                  ? 'text-cyan-400 border-cyan-400 bg-slate-800/60'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Como Monitorar no PC (Terminal & SQLite)</span>
            </button>
            <button
              onClick={() => setActiveTab('raw_test')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
                activeTab === 'raw_test'
                  ? 'text-cyan-400 border-cyan-400 bg-slate-800/60'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Diagnóstico de Resposta Bruta</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              title="Atualizar lista"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition text-xs flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                title="Limpar logs"
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: LOGS DE TRANSMISSÃO */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              {/* FILTROS E BUSCA */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Filtrar:</span>
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-md transition font-medium ${
                        statusFilter === 'all' 
                          ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setStatusFilter('success')}
                      className={`px-2.5 py-1 rounded-md transition font-medium ${
                        statusFilter === 'success' 
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Sucesso (Erro 0)
                    </button>
                    <button
                      onClick={() => setStatusFilter('error')}
                      className={`px-2.5 py-1 rounded-md transition font-medium ${
                        statusFilter === 'error' 
                          ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Falhas / Rejeições
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      placeholder="Buscar por #Seq..."
                      value={searchSeq}
                      onChange={(e) => setSearchSeq(e.target.value)}
                      className="pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36"
                    />
                  </div>
                  {searchSeq && (
                    <button
                      onClick={() => setSearchSeq('')}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Limpar filtro
                    </button>
                  )}
                </div>
              </div>

              {/* LOGS TABLE */}
              {logs.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/20">
                  <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-slate-300">Nenhum registro de transmissão da API no momento</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Quando você enviar um resumo final pelo botão "Enviar para API Retaguarda ERP" ou executar um "Testar Conexão Agora", cada requisição e sua respectiva resposta ficarão gravadas aqui e no banco SQLite.
                  </p>
                  <button
                    onClick={handleRunTest}
                    disabled={isTesting}
                    className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    Testar Conexão Agora
                  </button>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50 shadow-inner">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3">Data / Hora</th>
                          <th className="py-2.5 px-3">Implantação</th>
                          <th className="py-2.5 px-3">Status ERP</th>
                          <th className="py-2.5 px-3">Mensagem de Retorno</th>
                          <th className="py-2.5 px-3">Latência</th>
                          <th className="py-2.5 px-3">Origem</th>
                          <th className="py-2.5 px-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {logs.map((log) => {
                          const isSuccess = log.erroCodigo === 0;
                          const isTokenError = log.erroCodigo === 9;
                          const isNotFound = log.erroCodigo === 2;
                          const isDiagTest = log.implantacaoSeq === 0;

                          return (
                            <tr 
                              key={log.id} 
                              className={`hover:bg-slate-800/40 transition cursor-pointer ${
                                selectedLog?.id === log.id ? 'bg-cyan-950/30 border-l-2 border-l-cyan-400' : ''
                              }`}
                              onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                            >
                              <td className="py-2.5 px-3 text-slate-300 font-sans whitespace-nowrap">
                                <span className="font-mono text-xs">
                                  {new Date(log.createdAt).toLocaleDateString('pt-BR')} {new Date(log.createdAt).toLocaleTimeString('pt-BR')}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {isDiagTest ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/60 text-blue-300 border border-blue-500/30">
                                    Diagnóstico #0
                                  </span>
                                ) : (
                                  <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                    #{log.implantacaoSeq}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {isSuccess ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Erro: 0 (Sucesso)
                                  </span>
                                ) : isTokenError ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-400 border border-amber-500/30">
                                    <AlertTriangle className="w-3 h-3" />
                                    Erro: 9 (Token)
                                  </span>
                                ) : isNotFound ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-950/80 text-purple-400 border border-purple-500/30">
                                    <Info className="w-3 h-3" />
                                    Erro: 2 (Não existe)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/80 text-rose-400 border border-rose-500/30">
                                    <XCircle className="w-3 h-3" />
                                    Erro: {log.erroCodigo ?? 'Falha'}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 font-sans text-slate-300 max-w-xs truncate" title={log.descricao}>
                                {log.descricao || '--'}
                              </td>

                              <td className="py-2.5 px-3 text-cyan-400 font-mono whitespace-nowrap">
                                {log.duracaoMs}ms
                              </td>

                              <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                {log.origemIp.replace('::ffff:', '')}
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLog(selectedLog?.id === log.id ? null : log);
                                  }}
                                  className="text-slate-400 hover:text-cyan-400 text-xs inline-flex items-center gap-1 font-sans"
                                >
                                  {selectedLog?.id === log.id ? 'Ocultar' : 'Detalhes'}
                                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${selectedLog?.id === log.id ? 'rotate-90' : ''}`} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DETALHES DO LOG SELECIONADO */}
              {selectedLog && (
                <div className="p-4 bg-slate-900 border border-cyan-500/30 rounded-xl space-y-3 animate-fade-in shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        Detalhes da Transmissão #{selectedLog.id}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({new Date(selectedLog.createdAt).toLocaleString('pt-BR')})
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedLog(null)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      Fechar Detalhes
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-1">Payload Enviado (ImplantacaoResumoFinal):</span>
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 font-sans text-xs whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {selectedLog.resumoEnviado || '(Sem conteúdo)'}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Resposta Retornada pelo Servidor do ERP:</span>
                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                        <div><strong className="text-slate-400">Endpoint:</strong> <span className="text-cyan-400">{selectedLog.endpoint}</span></div>
                        <div><strong className="text-slate-400">HTTP Status:</strong> <span className="text-white">{selectedLog.httpStatus}</span></div>
                        <div><strong className="text-slate-400">Código de Erro ERP:</strong> <span className="text-white">{selectedLog.erroCodigo ?? 'Null'}</span></div>
                        <div><strong className="text-slate-400">Descrição ERP:</strong> <span className="text-emerald-300 font-sans">{selectedLog.descricao}</span></div>
                        <div><strong className="text-slate-400">Tempo de Resposta:</strong> <span className="text-cyan-400">{selectedLog.duracaoMs}ms</span></div>
                        <div><strong className="text-slate-400">IP Solicitante:</strong> <span className="text-slate-300">{selectedLog.origemIp}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMO MONITORAR NO PC QUE RODA A OPERAÇÃO */}
          {activeTab === 'instructions' && (
            <div className="space-y-6 text-slate-300 text-xs">
              {/* INTRODUÇÃO */}
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
                <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2 mb-1.5">
                  <Server className="w-4 h-4 text-cyan-400" />
                  Como monitorar a API no PC que está rodando a operação
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  No computador onde o Node.js / servidor do painel está em execução, existem <strong>4 formas complementares e em tempo real</strong> de auditar se as conexões com o endpoint <code className="text-cyan-400 font-mono">api64.erpgestao.com.br/retaguardanew/rest/api_sgo/gravaresumofinal</code> deram certo.
                </p>
              </div>

              {/* FORMA 1: MONITOR VISUAL (ESTE PAINEL) */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <h4 className="text-sm font-bold text-white">Pelo Próprio Painel Visual (Neste Modal)</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    Mais fácil & imediato
                  </span>
                </div>
                <p className="text-slate-400">
                  Qualquer computador da rede ou o PC principal pode abrir este modal a qualquer momento clicando em <strong>"Monitor API"</strong> no topo da página ou dentro da tela da implantação.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
                  <li><strong>Botão "Testar Conexão Agora":</strong> envia um pacote diagnóstico seguro para a API e valida o Token em tempo real.</li>
                  <li><strong>Feed em Tempo Real:</strong> exibe cada chamada com código de retorno (<code className="text-emerald-400">Erro: 0</code> = Sucesso, <code className="text-amber-400">Erro: 9</code> = Token inválido, <code className="text-purple-400">Erro: 2</code> = Não encontrada).</li>
                  <li><strong>Medidor de Latência:</strong> confere o tempo de resposta em milissegundos.</li>
                </ul>
              </div>

              {/* FORMA 2: TERMINAL / CMD DO PC */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    <h4 className="text-sm font-bold text-white">Pela Janela do Terminal / Console (CMD / PowerShell)</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                    Em tempo real no Windows
                  </span>
                </div>
                <p className="text-slate-400">
                  Na janela preta onde você rodou <code className="text-cyan-300 font-mono">npm run dev</code> ou <code className="text-cyan-300 font-mono">node server.ts</code>, o servidor imprime logs detalhados a cada transmissão:
                </p>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                  <div className="text-cyan-400">[API RETAGUARDA 📡] [10:42:15] Disparo para Implantação #123</div>
                  <div className="text-slate-400">[API RETAGUARDA 📝] Texto (82 carac.): "Treinamento do módulo financeiro concluído..."</div>
                  <div className="text-slate-400">[API RETAGUARDA 🌐] IP Origem: 192.168.1.15 | Destino: api64.erpgestao.com.br</div>
                  <div className="text-emerald-400 font-bold">[API RETAGUARDA ✅ SUCESSO] Erro: 0 - "Sucesso" (HTTP 200, 312ms)</div>
                </div>
                <p className="text-slate-400 text-[11px]">
                  💡 <em>Se houver qualquer problema de Token (<code className="text-amber-400">Erro: 9</code>) ou queda de internet (<code className="text-rose-400">Timeout 15s</code>), o erro aparecerá imediatamente no console em vermelho.</em>
                </p>
              </div>

              {/* FORMA 3: CONSULTA SQL DIRETA NO ARQUIVO implantacoes.db */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold text-xs">
                      3
                    </span>
                    <h4 className="text-sm font-bold text-white">Consultando Diretamente no Banco SQLite (DB Browser)</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-purple-950 text-purple-400 border border-purple-500/30">
                    Auditoria física permanente
                  </span>
                </div>
                <p className="text-slate-400">
                  Todas as transmissões ficam gravadas na tabela <code className="text-cyan-400 font-mono">retaguarda_api_logs</code> dentro do arquivo <code className="text-white font-mono">C:\MeusProjetos\implantacoes.db</code>.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Consultar as últimas 20 chamadas da API:</span>
                    <button
                      onClick={() => copyToClipboard('SELECT id, implantacao_seq, http_status, erro_codigo, descricao, duracao_ms, created_at FROM retaguarda_api_logs ORDER BY id DESC LIMIT 20;', 'sql1')}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px]"
                    >
                      {copiedSection === 'sql1' ? 'Copiado!' : 'Copiar SQL'}
                    </button>
                  </div>
                  <pre className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-cyan-300 font-mono text-[11px] overflow-x-auto">
{`SELECT id, implantacao_seq, http_status, erro_codigo, descricao, duracao_ms, created_at 
FROM retaguarda_api_logs 
ORDER BY id DESC LIMIT 20;`}
                  </pre>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Ver todas as implantações com resumo já gravado no ERP:</span>
                    <button
                      onClick={() => copyToClipboard('SELECT seq, razao_social, retaguarda_atualizado, data_retaguarda_atualizado FROM demandas WHERE retaguarda_atualizado = 1 ORDER BY data_retaguarda_atualizado DESC;', 'sql2')}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px]"
                    >
                      {copiedSection === 'sql2' ? 'Copiado!' : 'Copiar SQL'}
                    </button>
                  </div>
                  <pre className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-cyan-300 font-mono text-[11px] overflow-x-auto">
{`SELECT seq, razao_social, retaguarda_atualizado, data_retaguarda_atualizado 
FROM demandas 
WHERE retaguarda_atualizado = 1 
ORDER BY data_retaguarda_atualizado DESC;`}
                  </pre>
                </div>
              </div>

              {/* FORMA 4: INDICADORES VISUAIS POR DEMANDA */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold text-xs">
                      4
                    </span>
                    <h4 className="text-sm font-bold text-white">Indicadores Visuais na Própria Demanda</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
                    No fluxo de trabalho
                  </span>
                </div>
                <p className="text-slate-400">
                  Quando a API responde com <code className="text-emerald-400">Erro: 0 ("Sucesso")</code>, a demanda recebe automaticamente:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">Badge verde <strong className="text-emerald-400">"Retaguarda Atualizado"</strong> no card</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-slate-300">Data e hora exata da última sincronização com o ERP</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIAGNÓSTICO DE RESPOSTA BRUTA */}
          {activeTab === 'raw_test' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    Teste Diagnóstico da Conexão e Validação do Token
                  </h3>
                  <button
                    onClick={handleRunTest}
                    disabled={isTesting}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Executando Teste...' : 'Disparar Teste Agora'}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  Este teste envia uma requisição para <code className="text-cyan-400 font-mono">https://api64.erpgestao.com.br/retaguardanew/rest/api_sgo/gravaresumofinal</code> usando o cabeçalho <code className="text-slate-300 font-mono">Token</code> configurado na máquina para comprovar a rota de rede, DNS, certificado SSL e aceitação da credencial sem modificar nenhum cliente real.
                </p>

                {testResult ? (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[11px]">Status Conexão</span>
                        <strong className={testResult.online ? 'text-emerald-400' : 'text-rose-400'}>
                          {testResult.online ? 'Servidor Acessível' : 'Inacessível'}
                        </strong>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[11px]">Autenticação Token</span>
                        <strong className={testResult.authenticated ? 'text-emerald-400' : 'text-amber-400'}>
                          {testResult.authenticated ? 'Token Válido & Aceito' : 'Token Recusado/Pendente'}
                        </strong>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[11px]">HTTP Status</span>
                        <strong className="text-cyan-400 font-mono">{testResult.statusCode}</strong>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[11px]">Latência</span>
                        <strong className="text-cyan-400 font-mono">{testResult.durationMs}ms</strong>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 block mb-1">JSON Bruto Retornado pelo Endpoint:</span>
                      <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto">
                        {JSON.stringify(testResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    Clique em "Disparar Teste Agora" para obter o diagnóstico imediato.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tabela física de auditoria: <code className="text-slate-300 font-mono">retaguarda_api_logs</code> em <code className="text-slate-300 font-mono">implantacoes.db</code></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Fechar Monitor
          </button>
        </div>
      </div>
    </div>
  );
};
