import React from 'react';
import { 
  Menu, 
  Search, 
  RefreshCw, 
  Download, 
  AlertCircle,
  Calendar,
  Layers,
  Database,
  UploadCloud,
  HardDrive,
  FileSpreadsheet,
  Activity
} from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
  isMobileOpen?: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  stagnantCount: number;
  onOpenRetaguardaSync?: () => void;
  onOpenSqliteConnect?: () => void;
  onOpenApiMonitor?: () => void;
  isSqliteConnected?: boolean;
  hasDirectWriteAccess?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  isMobileOpen = false,
  searchTerm,
  onSearchChange,
  onRefresh,
  onExport,
  stagnantCount,
  onOpenRetaguardaSync,
  onOpenSqliteConnect,
  onOpenApiMonitor,
  isSqliteConnected = false,
  hasDirectWriteAccess = false,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      {/* Mobile menu trigger & title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="min-w-[44px] min-h-[44px] p-2.5 -ml-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 lg:hidden focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex items-center justify-center transition-colors"
          aria-label={isMobileOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
          aria-expanded={isMobileOpen}
          aria-controls="main-sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              Controle de Implantações & Gargalos
            </h2>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              v2.6
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Monitoramento em tempo real de demandas sem avanço semanal e gargalos operacionais
          </p>
        </div>
      </div>

      {/* Center Search */}
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, razão social, implantador ou seq..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Retaguarda Sync Action Button */}
        {onOpenRetaguardaSync && (
          <button
            onClick={onOpenRetaguardaSync}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-950/40"
            title="Importar e sincronizar arquivo da retaguarda"
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Sincronizar Retaguarda</span>
            <span className="sm:hidden">Retaguarda</span>
          </button>
        )}

        {/* Retaguarda API Real-Time Monitor Button */}
        {onOpenApiMonitor && (
          <button
            onClick={onOpenApiMonitor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-700/60 text-xs font-semibold transition-all shadow-xs"
            title="Monitorar em tempo real as respostas e conexões da API Retaguarda"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden md:inline">Monitor API</span>
            <span className="md:hidden">API</span>
          </button>
        )}

        {/* SQLite Local .db Connection Trigger */}
        {onOpenSqliteConnect && (
          <button
            onClick={onOpenSqliteConnect}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shadow-xs ${
              hasDirectWriteAccess
                ? 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border-emerald-600/80 shadow-emerald-950/30'
                : isSqliteConnected 
                ? 'bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border-cyan-700/80 shadow-cyan-950/30' 
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Conectar ao banco SQLite local (C:\MeusProjetos\implantacoes.db)"
          >
            <HardDrive className={`w-3.5 h-3.5 ${hasDirectWriteAccess ? 'text-emerald-400' : isSqliteConnected ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">
              {hasDirectWriteAccess ? 'SQLite (Tempo Real)' : 'SQLite (.db)'}
            </span>
            {isSqliteConnected ? (
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${hasDirectWriteAccess ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
            ) : (
              <span className="text-[10px] text-slate-400 hidden xl:inline">C:\MeusProjetos</span>
            )}
          </button>
        )}

        {/* Date Reference Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-mono">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Corte: 30/09/2026</span>
        </div>

        {/* Action: Export XLS / Relatórios */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/70 text-emerald-300 hover:text-emerald-200 text-xs font-bold border border-emerald-600/70 transition-all shadow-xs cursor-pointer"
          title="Exportar relatórios em XLS (Situação de Contato & Acompanhamentos da Semana)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Exportar XLS</span>
          <span className="sm:hidden">XLS</span>
        </button>

        {/* Action: Reload */}
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          title="Recarregar dados originais"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </header>
  );
};
