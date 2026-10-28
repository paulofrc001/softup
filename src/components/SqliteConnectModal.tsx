import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  FolderCheck, 
  Upload, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  HardDrive, 
  ShieldCheck, 
  Zap, 
  Key, 
  Sparkles,
  Terminal,
  HelpCircle,
  Play,
  FileCheck2,
  AlertTriangle
} from 'lucide-react';
import { sqliteService, SqliteConnectionState } from '../services/sqliteService';
import { Demand } from '../types';

interface SqliteConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDemands: Demand[];
  activeTeamMembers: string[];
  onDemandsLoadedFromSqlite: (demands: Demand[], teamMembers: string[]) => void;
}

export function SqliteConnectModal({
  isOpen,
  onClose,
  currentDemands,
  activeTeamMembers,
  onDemandsLoadedFromSqlite
}: SqliteConnectModalProps) {
  const [modalTab, setModalTab] = useState<'connection' | 'test' | 'sql'>('connection');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [connectionState, setConnectionState] = useState<SqliteConnectionState>(sqliteService.getState());
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    fileSizeKb: number;
    lastModifiedTime: string;
  } | null>(null);

  // SQL Terminal State
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT seq, razao_social, status, percentual_progresso FROM demandas LIMIT 5;');
  const [sqlResults, setSqlResults] = useState<{ columns: string[]; values: any[][] }[] | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = sqliteService.subscribe(newState => {
      setConnectionState(newState);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const handleConnectDirect = async () => {
    setLoading(true);
    setStatusMsg(null);
    setTestResult(null);
    try {
      const { demands, teamMembers } = await sqliteService.connectWithFilePicker();
      const updatedState = sqliteService.getState();
      setConnectionState(updatedState);
      onDemandsLoadedFromSqlite(demands, teamMembers);
      
      if (updatedState.hasDirectWriteAccess) {
        setStatusMsg({
          type: 'success',
          text: `Sucesso! O arquivo ${updatedState.fileName} está conectado com permissão de gravação direta. Qualquer alteração feita no sistema grava no arquivo em tempo real (sem download)!`
        });
      } else {
        setStatusMsg({
          type: 'info',
          text: `Arquivo ${updatedState.fileName} conectado. Para gravar em tempo real sem download, clique no botão "Habilitar Gravação em Tempo Real".`
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStatusMsg({
          type: 'error',
          text: err.message || 'Falha ao conectar com o arquivo SQLite.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnableWritePermission = async () => {
    setLoading(true);
    try {
      const granted = await sqliteService.requestWritePermission();
      if (granted) {
        setStatusMsg({
          type: 'success',
          text: 'Permissão de gravação direta concedida! O arquivo local será atualizado automaticamente a cada clique.'
        });
      } else {
        setStatusMsg({
          type: 'info',
          text: 'Permissão não concedida. O navegador precisa que você autorize a edição do arquivo.'
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Erro ao solicitar permissão de gravação.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReloadFromDisk = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const { demands, teamMembers } = await sqliteService.reloadFromDisk();
      onDemandsLoadedFromSqlite(demands, teamMembers);
      setStatusMsg({
        type: 'success',
        text: `Dados atualizados diretamente do disco! ${demands.length} demandas e ${teamMembers.length} implantadores consultados em tempo real.`
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Erro ao consultar arquivo do disco.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMsg(null);
    try {
      const { demands, teamMembers } = await sqliteService.connectFromFile(file);
      const updatedState = sqliteService.getState();
      setConnectionState(updatedState);
      onDemandsLoadedFromSqlite(demands, teamMembers);
      setStatusMsg({
        type: 'success',
        text: `Arquivo ${file.name} carregado! ${demands.length} demandas lidas do SQLite.`
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Erro ao ler arquivo SQLite.'
      });
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleRunDiskTest = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await sqliteService.testDiskWrite();
      setTestResult(res);
      setConnectionState(sqliteService.getState());
    } catch (e: any) {
      setTestResult({
        success: false,
        fileSizeKb: 0,
        lastModifiedTime: '',
        message: e.message || 'Erro ao executar teste de gravação.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSql = async () => {
    setSqlError(null);
    setSqlResults(null);
    try {
      const results = await sqliteService.executeSql(sqlQuery);
      setSqlResults(results);
    } catch (err: any) {
      setSqlError(err.message || 'Erro ao executar consulta SQL.');
    }
  };

  const handleManualSave = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      await sqliteService.syncDemandsToSqlite(currentDemands, activeTeamMembers);
      const updated = sqliteService.getState();
      setConnectionState(updated);
      
      if (updated.hasDirectWriteAccess) {
        setStatusMsg({
          type: 'success',
          text: `Gravado instantaneamente no arquivo físico C:\\MeusProjetos\\${updated.fileName} às ${updated.lastDirectWriteTime || 'agora'} sem download!`
        });
      } else {
        sqliteService.downloadDatabaseFile('implantacoes.db');
        setStatusMsg({
          type: 'success',
          text: 'Arquivo implantacoes.db exportado! Substitua-o na sua pasta C:\\MeusProjetos\\.'
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Erro ao sincronizar com o banco SQLite.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div 
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Banco SQLite em Tempo Real
                {connectionState.hasDirectWriteAccess ? (
                  <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Tempo Real (Sem Download)
                  </span>
                ) : connectionState.isConnected ? (
                  <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium">
                    Conectado (Somente Leitura)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                    Aguardando Conexão
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                C:\MeusProjetos\implantacoes.db
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-2 gap-2 shrink-0">
          <button
            onClick={() => setModalTab('connection')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors flex items-center gap-2 border-t border-x ${
              modalTab === 'connection'
                ? 'bg-slate-900 border-slate-700 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Conexão & Status</span>
          </button>
          <button
            onClick={() => setModalTab('test')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors flex items-center gap-2 border-t border-x ${
              modalTab === 'test'
                ? 'bg-slate-900 border-slate-700 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Diagnóstico & Teste de Gravação</span>
          </button>
          <button
            onClick={() => setModalTab('sql')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors flex items-center gap-2 border-t border-x ${
              modalTab === 'sql'
                ? 'bg-slate-900 border-slate-700 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Console SQL (Consultar Tabelas)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Status Message */}
          {statusMsg && (
            <div className={`p-4 rounded-xl flex items-start gap-3 border text-xs leading-relaxed ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200' 
                : statusMsg.type === 'error'
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                : 'bg-indigo-950/40 border-indigo-800/80 text-indigo-200'
            }`}>
              {statusMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Last write error alert if present */}
          {connectionState.lastWriteError && (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-700/80 text-xs text-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Atenção ao gravar no disco:</strong>
                <span>{connectionState.lastWriteError}</span>
              </div>
            </div>
          )}

          {/* TAB 1: CONNECTION */}
          {modalTab === 'connection' && (
            <div className="space-y-6">
              {/* Central Local Network Server Banner */}
              {connectionState.isNetworkServer && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-cyan-950/50 border border-emerald-500/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h4 className="text-sm font-bold text-emerald-300">
                        Servidor de Rede Local Ativo (Host Central)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Multi-Usuários Conectados
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Este computador está servindo o arquivo <strong className="text-cyan-300">{connectionState.filePath}</strong> para toda a sua rede interna. 
                    <strong> Outros computadores na sua rede já abrem conectados automaticamente!</strong>
                  </p>

                  {connectionState.networkAccessUrls && connectionState.networkAccessUrls.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-semibold text-slate-300">
                        Endereço para outros PCs da equipe acessarem no navegador:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {connectionState.networkAccessUrls.map((url, idx) => (
                          <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400 font-bold">
                            <span>{url}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(url);
                                setStatusMsg({
                                  type: 'success',
                                  text: `Endereço copiado: ${url} - Basta abrir no navegador de outro PC na sua rede!`
                                });
                              }}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                            >
                              Copiar Link
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Real-time explanation banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-950/60 to-slate-900 border border-cyan-800/40 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-cyan-300">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Gravação e Consulta Direta no Arquivo Físico (Sem Download)</span>
                </div>
                <p className="leading-relaxed text-slate-300">
                  Para que as alterações reflitam no arquivo <strong className="text-cyan-200">implantacoes.db</strong> no seu computador sem necessidade de download, use a <strong>Opção 1</strong> e permita a edição no navegador.
                </p>
              </div>

              {/* Connection Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Direct File Picker (Recommended for Chrome/Edge) */}
                <div className="p-4 rounded-xl bg-gradient-to-b from-cyan-950/30 to-slate-900 border border-cyan-700/50 flex flex-col justify-between space-y-4 shadow-lg shadow-cyan-950/20">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Opção 1: Tempo Real Direto (Sem Download)
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-cyan-400" />
                      Conectar Arquivo no Windows
                    </h4>
                    <p className="text-xs text-slate-400">
                      Abre o explorador para escolher <strong className="text-slate-200">implantacoes.db</strong>. Permita a edição quando o navegador solicitar para gravar sem downloads.
                    </p>
                  </div>

                  <button
                    onClick={handleConnectDirect}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FolderCheck className="w-4 h-4" />}
                    <span>Conectar C:\MeusProjetos\implantacoes.db</span>
                  </button>
                </div>

                {/* Standard File Upload */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Opção 2: Somente Leitura (Upload)
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-indigo-400" />
                      Carregar Arquivo .db
                    </h4>
                    <p className="text-xs text-slate-400">
                      Carrega os dados para consulta. (Nesta opção, alterações precisarão ser baixadas).
                    </p>
                  </div>

                  <label className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-700">
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span>Escolher Arquivo .db</span>
                    <input 
                      type="file" 
                      accept=".db,.sqlite,.sqlite3" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Current Connection Details & Real-Time Controls */}
              {connectionState.isConnected && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Status da Conexão Direta
                    </h4>
                    {connectionState.hasDirectWriteAccess && (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Gravação Direta no Disco Ativa
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Arquivo Conectado</div>
                      <div className="text-xs font-bold text-slate-200 truncate">{connectionState.fileName}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Demandas no Banco</div>
                      <div className="text-sm font-bold font-mono text-cyan-400">{connectionState.totalDemands}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Gravação Direta</div>
                      <div className={`text-xs font-bold ${connectionState.hasDirectWriteAccess ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {connectionState.hasDirectWriteAccess ? 'Em Tempo Real (Ativo)' : 'Pendente Permissão'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Última Gravação</div>
                      <div className="text-xs font-bold font-mono text-slate-200">
                        {connectionState.lastDirectWriteTime || 'Pronto'}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Real-time Re-query & Save */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleReloadFromDisk}
                        disabled={loading}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-slate-700"
                        title="Consulta novamente o arquivo implantacoes.db no seu disco para trazer alterações feitas no DB Browser"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : 'text-cyan-400'}`} />
                        <span>Consultar / Recarregar do Disco</span>
                      </button>

                      {!connectionState.hasDirectWriteAccess && (
                        <button
                          onClick={handleEnableWritePermission}
                          disabled={loading}
                          className="px-3 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-semibold text-xs transition-colors flex items-center gap-1.5 border border-amber-500/40"
                        >
                          <Key className="w-3.5 h-3.5 text-amber-400" />
                          <span>Habilitar Gravação em Tempo Real</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={handleManualSave}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-md shadow-emerald-950/50"
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        {connectionState.hasDirectWriteAccess ? 'Gravar no Disco Agora' : 'Salvar Alterações'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIAGNOSTICS & TEST */}
          {modalTab === 'test' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  Teste Imediato de Gravação Física no Windows
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Este teste escreve uma entrada de auditoria diretamente no arquivo físico <code className="text-cyan-300 font-mono">C:\MeusProjetos\implantacoes.db</code> e faz a leitura reversa do arquivo no disco para confirmar que o Windows recebeu e salvou os bytes.
                </p>

                <div className="pt-2">
                  <button
                    onClick={handleRunDiskTest}
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                    <span>Executar Teste de Gravação Agora</span>
                  </button>
                </div>

                {testResult && (
                  <div className={`p-4 mt-3 rounded-xl border text-xs leading-relaxed space-y-2 ${
                    testResult.success
                      ? 'bg-emerald-950/50 border-emerald-700/80 text-emerald-200'
                      : 'bg-rose-950/50 border-rose-700/80 text-rose-200'
                  }`}>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {testResult.success ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span>{testResult.success ? 'Gravação Física Confirmada!' : 'Falha na Gravação Direta'}</span>
                    </div>
                    <p>{testResult.message}</p>
                    {testResult.success && (
                      <div className="flex items-center gap-4 pt-1 font-mono text-[11px] text-emerald-300">
                        <span>Tamanho do Arquivo: <strong>{testResult.fileSizeKb} KB</strong></span>
                        <span>Horário no Disco: <strong>{testResult.lastModifiedTime}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Troubleshooting DB Browser for SQLite */}
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/40 space-y-2.5 text-xs text-indigo-200">
                <h4 className="font-bold flex items-center gap-2 text-indigo-300">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  Por que minha alteração pode não aparecer no DB Browser for SQLite?
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1 leading-relaxed">
                  <li>
                    <strong className="text-white">Pressione F5 no DB Browser:</strong> O DB Browser mantém em memória cache da tabela que você está visualizando. Ele <strong>não atualiza a tela automaticamente</strong> quando outro programa grava no arquivo. Vá na aba <em>"Navegar Dados"</em> (Browse Data) e tecle <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300 font-mono">F5</kbd> (ou clique no ícone de recarregar).
                  </li>
                  <li>
                    <strong className="text-white">Bloqueio de Arquivo no Windows (Lock):</strong> Se no DB Browser o botão <em>"Escrever Alterações"</em> (Write Changes) estiver aceso ou se você iniciou uma edição manual de célula nele, o Windows bloqueia o arquivo contra gravação externa. Clique em <em>"Escrever Alterações"</em> ou feche a transação no DB Browser.
                  </li>
                  <li>
                    <strong className="text-white">Conexão via Opção 1:</strong> Certifique-se de que conectou usando o botão <em>"Conectar C:\MeusProjetos\implantacoes.db"</em> e permitiu a edição no aviso do navegador.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: SQL TERMINAL */}
          {modalTab === 'sql' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>Consulta SQL Direta no Banco</span>
                  <span className="text-[11px] text-slate-400 font-normal">Tabelas: demandas, implantadores, evolucoes_semanais</span>
                </label>
                <div className="flex gap-2">
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    rows={3}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    placeholder="Digite seu comando SQL..."
                  />
                  <button
                    onClick={handleExecuteSql}
                    className="px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 shrink-0"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Executar</span>
                  </button>
                </div>
              </div>

              {/* Shortcut buttons */}
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button
                  onClick={() => {
                    setSqlQuery('SELECT seq, razao_social, status, percentual_progresso FROM demandas LIMIT 10;');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
                >
                  Ver Demandas
                </button>
                <button
                  onClick={() => {
                    setSqlQuery('SELECT demanda_seq, data_evolucao, percentual_progresso, descricao_avanco FROM evolucoes_semanais ORDER BY id DESC LIMIT 5;');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
                >
                  Ver Evoluções
                </button>
                <button
                  onClick={() => {
                    setSqlQuery('SELECT id, nome, cargo, ativo FROM implantadores;');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
                >
                  Ver Implantadores
                </button>
                <button
                  onClick={() => {
                    setSqlQuery('SELECT * FROM _diagnostico_conexao ORDER BY id DESC LIMIT 5;');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
                >
                  Ver Testes Gravados
                </button>
              </div>

              {sqlError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-300 font-mono">
                  {sqlError}
                </div>
              )}

              {sqlResults && sqlResults.length > 0 && (
                <div className="space-y-4">
                  {sqlResults.map((res, rIdx) => (
                    <div key={rIdx} className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                          <tr>
                            {res.columns.map((col, cIdx) => (
                              <th key={cIdx} className="p-2.5 font-bold">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {res.values.length === 0 ? (
                            <tr>
                              <td colSpan={res.columns.length} className="p-4 text-center text-slate-500">
                                0 linhas retornadas.
                              </td>
                            </tr>
                          ) : (
                            res.values.map((row, rowIdx) => (
                              <tr key={rowIdx} className="hover:bg-slate-900/40">
                                {row.map((val, vIdx) => (
                                  <td key={vIdx} className="p-2.5 whitespace-nowrap">
                                    {val === null || val === undefined ? (
                                      <span className="text-slate-500 italic">NULL</span>
                                    ) : (
                                      String(val)
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            {connectionState.hasDirectWriteAccess 
              ? '🟢 Modo Tempo Real: Gravação física direta no arquivo ativada'
              : 'Conecte via Opção 1 para salvar direto no arquivo físico sem download.'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
