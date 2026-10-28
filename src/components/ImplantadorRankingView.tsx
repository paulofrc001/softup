import React, { useState, useEffect, useMemo } from 'react';
import { Demand } from '../types';
import { sqliteService } from '../services/sqliteService';
import { 
  Trophy, 
  Award, 
  Clock, 
  User, 
  CheckCircle2, 
  BarChart3, 
  TrendingUp, 
  Search, 
  Download, 
  Filter, 
  Flame, 
  Calendar, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Database, 
  HelpCircle, 
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Zap,
  Timer
} from 'lucide-react';

interface ImplantadorRankingViewProps {
  demands: Demand[];
  activeTeamMembers: string[];
  onSelectDemand?: (demand: Demand) => void;
  onOpenCheckInModal?: (demand: Demand) => void;
}

interface RankingItem {
  implantador: string;
  totalAtendimentos: number;
  totalHoras: number;
  demandasDistintas: number;
  mediaHorasPorAtendimento: number;
  percentualEsforco: number;
}

interface ApontamentoItem {
  id: number;
  demandaSeq: number;
  razaoSocial: string;
  implantador: string;
  data: string;
  horasGastas: number;
  minutosGastos?: number;
  segundosGastos?: number;
  duracaoFormatada?: string;
  horaInicio?: string;
  horaFim?: string;
  origemTempo?: string;
  isCronometro?: boolean;
  descricao: string;
  progresso: number;
  impedimento?: string;
  etapa?: string;
}

export const ImplantadorRankingView: React.FC<ImplantadorRankingViewProps> = ({
  demands,
  activeTeamMembers,
  onSelectDemand,
  onOpenCheckInModal,
}) => {
  const [rankingData, setRankingData] = useState<{
    totalEquipeHoras: number;
    totalAtendimentos: number;
    ranking: RankingItem[];
  }>({
    totalEquipeHoras: 0,
    totalAtendimentos: 0,
    ranking: [],
  });

  const [apontamentos, setApontamentos] = useState<ApontamentoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterImplantador, setFilterImplantador] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriodo, setFilterPeriodo] = useState<'all' | '7d' | '30d'>('all');
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Load ranking & apontamentos data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rankRes, acompRes] = await Promise.all([
        sqliteService.getEffortRanking(),
        sqliteService.getApontamentos(),
      ]);

      if (rankRes) {
        setRankingData(rankRes);
      }
      if (acompRes) {
        setApontamentos(acompRes);
      }
    } catch (err) {
      console.error('Falha ao carregar ranking:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [demands]);

  // Handle delete single apontamento
  const handleDeleteApontamento = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja realmente excluir este registro de acompanhamento? As horas serão recalculadas.')) return;

    const ok = await sqliteService.deleteAcompanhamento(id);
    if (ok) {
      setActionFeedback(`Apontamento #${id} excluído com sucesso.`);
      setTimeout(() => setActionFeedback(null), 4000);
      loadData();
    }
  };

  // Filtered Apontamentos for history table
  const filteredApontamentos = useMemo(() => {
    return apontamentos.filter(item => {
      // Implantador filter
      if (filterImplantador !== 'all' && item.implantador !== filterImplantador) {
        return false;
      }

      // Period filter
      if (filterPeriodo !== 'all' && item.data) {
        const itemDate = new Date(item.data.includes('/') ? item.data.split('/').reverse().join('-') : item.data);
        if (!isNaN(itemDate.getTime())) {
          const diffDays = (Date.now() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
          if (filterPeriodo === '7d' && diffDays > 7) return false;
          if (filterPeriodo === '30d' && diffDays > 30) return false;
        }
      }

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesClient = item.razaoSocial?.toLowerCase().includes(term);
        const matchesSeq = String(item.demandaSeq).includes(term);
        const matchesDesc = item.descricao?.toLowerCase().includes(term);
        const matchesImp = item.implantador?.toLowerCase().includes(term);
        return matchesClient || matchesSeq || matchesDesc || matchesImp;
      }

      return true;
    });
  }, [apontamentos, filterImplantador, filterPeriodo, searchTerm]);

  // Export CSV
  const handleExportCsv = () => {
    if (filteredApontamentos.length === 0) return;

    const headers = [
      'ID',
      'Seq Demanda',
      'Cliente / Razão Social',
      'Implantador Executante',
      'Data Execução',
      'Horas Gastas',
      'Progresso (%)',
      'Etapa',
      'Descrição da Ação',
      'Impedimento / Bloqueio'
    ];

    const rows = filteredApontamentos.map(a => [
      a.id,
      a.demandaSeq,
      `"${(a.razaoSocial || '').replace(/"/g, '""')}"`,
      `"${(a.implantador || '').replace(/"/g, '""')}"`,
      a.data,
      a.horasGastas,
      `${a.progresso}%`,
      a.etapa || 'parametrizacao',
      `"${(a.descricao || '').replace(/"/g, '""')}"`,
      `"${(a.impedimento || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ranking_esforco_implantadores_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copySqlScript = () => {
    const script = `-- Script de Criação e Consulta das Tabelas de Acompanhamentos e Esforço (SQLite)

-- 1. Tabela Principal de Histórico de Acompanhamentos (com alta fidelidade de tempo e cronômetro)
CREATE TABLE IF NOT EXISTS historico_acompanhamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  demanda_seq INTEGER NOT NULL REFERENCES demandas(seq) ON DELETE CASCADE,
  implantador_id INTEGER REFERENCES implantadores(id),
  implantador_nome TEXT NOT NULL,
  tempo_gasto_minutos INTEGER DEFAULT 60,
  tempo_gasto_horas REAL NOT NULL DEFAULT 1.0,
  tempo_gasto_segundos INTEGER DEFAULT 0,
  timer_duracao_formatada TEXT,
  is_cronometro INTEGER DEFAULT 0,
  hora_inicio TEXT,
  hora_fim TEXT,
  origem_tempo TEXT DEFAULT 'manual', -- 'cronometro' | 'marco_5m' | 'marco_15m' | 'marco_30m' | 'marco_1h' | 'manual'
  data_execucao DATE NOT NULL DEFAULT (date('now', 'localtime')),
  etapa_processo TEXT DEFAULT 'parametrizacao',
  percentual_progresso INTEGER DEFAULT 0,
  descricao_execucao TEXT NOT NULL,
  impedimento TEXT,
  created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_acomp_demanda ON historico_acompanhamentos(demanda_seq);
CREATE INDEX IF NOT EXISTS idx_acomp_implantador ON historico_acompanhamentos(implantador_nome);
CREATE INDEX IF NOT EXISTS idx_acomp_data ON historico_acompanhamentos(data_execucao);
CREATE INDEX IF NOT EXISTS idx_acomp_origem ON historico_acompanhamentos(origem_tempo);

-- 2. Consulta de Ranking de Esforço por Implantador
SELECT 
  implantador_nome as implantador,
  COUNT(id) as total_atendimentos,
  ROUND(SUM(tempo_gasto_horas), 1) as total_horas_gastas,
  SUM(COALESCE(tempo_gasto_minutos, CAST(ROUND(tempo_gasto_horas * 60) AS INTEGER))) as total_minutos,
  COUNT(DISTINCT demanda_seq) as demandas_distintas,
  ROUND(AVG(tempo_gasto_horas), 1) as media_horas_por_atendimento
FROM historico_acompanhamentos
GROUP BY implantador_nome
ORDER BY total_horas_gastas DESC, total_atendimentos DESC;`;

    navigator.clipboard.writeText(script);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const leader = rankingData.ranking[0];
  const totalHours = rankingData.totalEquipeHoras;
  const avgHoursPerCall = rankingData.totalAtendimentos > 0 
    ? Math.round((totalHours / rankingData.totalAtendimentos) * 10) / 10 
    : 0;

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Ranking de Esforço dos Implantadores
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Métricas de produtividade apuradas em tempo real a partir dos lançamentos no <strong>Histórico de Acompanhamentos</strong> (tabela <code className="text-indigo-300 font-mono text-[11px] bg-slate-800/80 px-1.5 py-0.5 rounded">historico_acompanhamentos</code>).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          <button
            onClick={loadData}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700/60"
            title="Recarregar dados do banco central"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => setShowSqlGuide(!showSqlGuide)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border ${
              showSqlGuide 
                ? 'bg-indigo-600 text-white border-indigo-500' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/60'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>Estrutura SQL & Tabelas</span>
            {showSqlGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={handleExportCsv}
            disabled={filteredApontamentos.length === 0}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Collapsible SQL Table Structure & Step-by-Step Guide */}
      {showSqlGuide && (
        <div className="p-5 rounded-2xl bg-slate-950 border border-indigo-900/60 space-y-4 shadow-2xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <span>Passo a Passo das Tabelas no SQLite</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                O sistema já cria e migra a tabela automaticamente no arquivo central <code>implantacoes.db</code>. Abaixo está o script caso deseje visualizar ou executar no DB Browser for SQLite.
              </p>
            </div>

            <button
              onClick={copySqlScript}
              className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'Copiado!' : 'Copiar Script SQL'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px]">1</span>
                Tabela <code className="text-indigo-200">historico_acompanhamentos</code>
              </span>
              <p className="text-slate-400 leading-relaxed">
                Armazena cada intervenção realizada por um implantador: <code>demanda_seq</code>, <code>implantador_nome</code>, <code>tempo_gasto_horas</code>, <code>data_execucao</code> e <code>descricao_execucao</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px]">2</span>
                Prevenção de Duplicatas
              </span>
              <p className="text-slate-400 leading-relaxed">
                A gravação é desvinculada da edição geral de demanda. Cada clique em "Salvar Acompanhamento" grava exatamente 1 registro único.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">3</span>
                Cálculo do Ranking
              </span>
              <p className="text-slate-400 leading-relaxed">
                O dashboard executa <code>SUM(tempo_gasto_horas)</code> e <code>COUNT(id)</code> agrupado por <code>implantador_nome</code> para ordenar quem mais trabalhou e atendeu.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Script DDL para execução no DB Browser for SQLite:
            </span>
            <pre className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
{`CREATE TABLE IF NOT EXISTS historico_acompanhamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  demanda_seq INTEGER NOT NULL REFERENCES demandas(seq) ON DELETE CASCADE,
  implantador_id INTEGER REFERENCES implantadores(id),
  implantador_nome TEXT NOT NULL,
  tempo_gasto_minutos INTEGER DEFAULT 60,
  tempo_gasto_horas REAL NOT NULL DEFAULT 1.0,
  tempo_gasto_segundos INTEGER DEFAULT 0,
  timer_duracao_formatada TEXT,
  is_cronometro INTEGER DEFAULT 0,
  hora_inicio TEXT,
  hora_fim TEXT,
  origem_tempo TEXT DEFAULT 'manual', -- 'cronometro' | 'marco_5m' | 'marco_15m' | 'marco_30m' | 'marco_1h' | 'manual'
  data_execucao DATE NOT NULL DEFAULT (date('now', 'localtime')),
  etapa_processo TEXT DEFAULT 'parametrizacao',
  percentual_progresso INTEGER DEFAULT 0,
  descricao_execucao TEXT NOT NULL,
  impedimento TEXT,
  created_at DATETIME DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_acomp_demanda ON historico_acompanhamentos(demanda_seq);
CREATE INDEX IF NOT EXISTS idx_acomp_implantador ON historico_acompanhamentos(implantador_nome);
CREATE INDEX IF NOT EXISTS idx_acomp_data ON historico_acompanhamentos(data_execucao);
CREATE INDEX IF NOT EXISTS idx_acomp_origem ON historico_acompanhamentos(origem_tempo);`}
            </pre>
          </div>
        </div>
      )}

      {/* Top 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Horas Totais da Equipe */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Esforço Total da Equipe</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
              {totalHours}h
            </span>
            <span className="text-xs text-amber-400 font-medium">acumuladas</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Soma de todo o tempo dedicado em acompanhamentos
          </p>
        </div>

        {/* Card 2: Total de Atendimentos */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Acompanhamentos Feitos</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
              {rankingData.totalAtendimentos}
            </span>
            <span className="text-xs text-indigo-400 font-medium">intervenções</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Total de registros gravados na tabela
          </p>
        </div>

        {/* Card 3: Média de Horas por Atendimento */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Média por Intervenção</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
              {avgHoursPerCall}h
            </span>
            <span className="text-xs text-cyan-400 font-medium">por demanda</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Tempo médio dedicado a cada evolução
          </p>
        </div>

        {/* Card 4: Implantador Mais Ativo */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Líder em Esforço</span>
            <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              <Trophy className="w-4 h-4 text-yellow-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-yellow-400 line-clamp-1">
              {leader ? leader.implantador : 'Nenhum'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {leader ? `${leader.totalHoras}h gastas (${leader.percentualEsforco}% do total)` : 'Sem apontamentos'}
          </p>
        </div>
      </div>

      {/* Visual Podium for Top 3 Leaders */}
      {rankingData.ranking.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <span>Pódio de Produtividade & Execução</span>
              </h3>
              <p className="text-xs text-slate-400">
                Os implantadores com maior dedicação registrada no sistema
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* 1st Place - Gold */}
            {rankingData.ranking[0] && (
              <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-950/40 via-slate-950 to-slate-900 border-2 border-amber-500/60 shadow-xl space-y-3 relative group">
                <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 shadow-md">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>1º LUGAR</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-lg">
                    {rankingData.ranking[0].implantador.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-100 group-hover:text-amber-300 transition-colors">
                      {rankingData.ranking[0].implantador}
                    </h4>
                    <p className="text-xs text-amber-400 font-mono font-semibold">
                      {rankingData.ranking[0].totalHoras} horas dedicadas
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Atendimentos realizados:</span>
                    <strong className="text-slate-200 font-mono">{rankingData.ranking[0].totalAtendimentos}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Clientes atendidos:</span>
                    <strong className="text-slate-200 font-mono">{rankingData.ranking[0].demandasDistintas}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Participação na equipe:</span>
                    <strong className="text-amber-400 font-mono">{rankingData.ranking[0].percentualEsforco}%</strong>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-yellow-400 h-2 rounded-full" 
                    style={{ width: `${Math.min(100, rankingData.ranking[0].percentualEsforco)}%` }}
                  />
                </div>
              </div>
            )}

            {/* 2nd Place - Silver */}
            {rankingData.ranking[1] && (
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-800/40 via-slate-950 to-slate-900 border border-slate-700 shadow-lg space-y-3 relative group">
                <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-slate-300 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-md">
                  <span>2º LUGAR</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-700/40 text-slate-300 border border-slate-600 flex items-center justify-center font-bold text-lg">
                    {rankingData.ranking[1].implantador.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-100 group-hover:text-slate-200 transition-colors">
                      {rankingData.ranking[1].implantador}
                    </h4>
                    <p className="text-xs text-slate-300 font-mono font-semibold">
                      {rankingData.ranking[1].totalHoras} horas dedicadas
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Atendimentos realizados:</span>
                    <strong className="text-slate-200 font-mono">{rankingData.ranking[1].totalAtendimentos}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Clientes atendidos:</span>
                    <strong className="text-slate-200 font-mono">{rankingData.ranking[1].demandasDistintas}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Participação na equipe:</span>
                    <strong className="text-slate-300 font-mono">{rankingData.ranking[1].percentualEsforco}%</strong>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-slate-400 h-2 rounded-full" 
                    style={{ width: `${Math.min(100, rankingData.ranking[1].percentualEsforco)}%` }}
                  />
                </div>
              </div>
            )}

            {/* 3rd Place - Bronze */}
            {rankingData.ranking[2] && (
              <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-950/20 via-slate-950 to-slate-900 border border-amber-900/40 shadow-lg space-y-3 relative group">
                <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-amber-700 text-amber-100 font-bold text-[11px] flex items-center gap-1 shadow-md">
                  <span>3º LUGAR</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-900/30 text-amber-400 border border-amber-800/50 flex items-center justify-center font-bold text-lg">
                    {rankingData.ranking[2].implantador.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-100 group-hover:text-amber-200 transition-colors">
                      {rankingData.ranking[2].implantador}
                    </h4>
                    <p className="text-xs text-amber-500 font-mono font-semibold">
                      {rankingData.ranking[2].totalHoras} horas dedicadas
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Atendimentos realizados:</span>
                    <strong className="text-slate-200 font-mono">{rankingData.ranking[2].totalAtendimentos}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Clientes atendidos:</span>
                    <strong className="text-slate-200 font-mono">{rankingData.ranking[2].demandasDistintas}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Participação na equipe:</span>
                    <strong className="text-amber-500 font-mono">{rankingData.ranking[2].percentualEsforco}%</strong>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-amber-600 h-2 rounded-full" 
                    style={{ width: `${Math.min(100, rankingData.ranking[2].percentualEsforco)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <span>Quadro Geral de Esforço da Equipe</span>
            </h3>
            <p className="text-xs text-slate-400">
              Classificação completa ordenada pelo volume total de horas trabalhadas
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px] bg-slate-950/40">
                <th className="py-3 px-4">Posição</th>
                <th className="py-3 px-4">Implantador</th>
                <th className="py-3 px-4 text-center">Horas Dedicadas</th>
                <th className="py-3 px-4 text-center">Atendimentos</th>
                <th className="py-3 px-4 text-center">Demandas Distintas</th>
                <th className="py-3 px-4 text-center">Média por Ação</th>
                <th className="py-3 px-4 text-center">Participação (%)</th>
                <th className="py-3 px-4 text-right">Filtrar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rankingData.ranking.length > 0 ? (
                rankingData.ranking.map((item, idx) => (
                  <tr key={item.implantador} className="hover:bg-slate-850/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold">
                      {idx === 0 && <span className="text-amber-400 font-bold">🥇 #1</span>}
                      {idx === 1 && <span className="text-slate-300 font-bold">🥈 #2</span>}
                      {idx === 2 && <span className="text-amber-600 font-bold">🥉 #3</span>}
                      {idx > 2 && <span className="text-slate-500">#{idx + 1}</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs">
                          {item.implantador.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-200">{item.implantador}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400">
                      {item.totalHoras}h
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                      {item.totalAtendimentos}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-cyan-400">
                      {item.demandasDistintas} clientes
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                      {item.mediaHorasPorAtendimento}h
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(100, item.percentualEsforco)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-indigo-300 font-semibold">{item.percentualEsforco}%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setFilterImplantador(item.implantador)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors text-[11px] font-medium"
                      >
                        Ver Extrato
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                    Nenhum lançamento de esforço registrado ainda. Abra qualquer demanda e registre um acompanhamento com horas gastas!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Apontamentos History Table */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              <span>Extrato Detalhado do Histórico de Acompanhamentos</span>
            </h3>
            <p className="text-xs text-slate-400">
              Registros individuais salvos com quem executou e quanto tempo foi gasto ({filteredApontamentos.length} encontrados)
            </p>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cliente, seq, nota..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
              />
            </div>

            {/* Filter by Implantador */}
            <select
              value={filterImplantador}
              onChange={(e) => setFilterImplantador(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todos os Implantadores</option>
              {rankingData.ranking.map(r => (
                <option key={r.implantador} value={r.implantador}>{r.implantador}</option>
              ))}
            </select>

            {/* Filter by Period */}
            <select
              value={filterPeriodo}
              onChange={(e) => setFilterPeriodo(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todo o Período</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>

            {(filterImplantador !== 'all' || searchTerm || filterPeriodo !== 'all') && (
              <button
                onClick={() => {
                  setFilterImplantador('all');
                  setSearchTerm('');
                  setFilterPeriodo('all');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Apontamentos Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px] bg-slate-950/40">
                <th className="py-3 px-3">Data</th>
                <th className="py-3 px-3">Demanda / Cliente</th>
                <th className="py-3 px-3">Executante</th>
                <th className="py-3 px-3 text-center">Tempo Gasto</th>
                <th className="py-3 px-3">Etapa / Progresso</th>
                <th className="py-3 px-3">Ação Executada</th>
                <th className="py-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredApontamentos.length > 0 ? (
                filteredApontamentos.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-850/60 transition-colors group">
                    <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {item.data}
                    </td>

                    <td className="py-3 px-3 max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-indigo-400">#{item.demandaSeq}</span>
                        <span className="font-semibold text-slate-200 truncate">{item.razaoSocial}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-semibold text-[11px] flex items-center gap-1 w-fit">
                        <User className="w-3 h-3 text-cyan-400" />
                        <span>{item.implantador}</span>
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-mono whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        {item.origemTempo === 'cronometro' || item.isCronometro ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-800/70 font-bold text-[11px] flex items-center gap-1 mx-auto w-fit shadow-xs">
                            <Timer className="w-3 h-3 text-emerald-400" />
                            <span>{item.duracaoFormatada || (item.minutosGastos ? `${item.minutosGastos}m` : `${item.horasGastas}h`)} ({item.horasGastas}h)</span>
                          </span>
                        ) : item.origemTempo === 'marco_5m' ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-800/70 font-bold text-[11px] flex items-center gap-1 mx-auto w-fit">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>Marco 5 min (0,08h)</span>
                          </span>
                        ) : item.origemTempo === 'marco_15m' ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-800/70 font-bold text-[11px] flex items-center gap-1 mx-auto w-fit">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>Marco 15 min (0,25h)</span>
                          </span>
                        ) : item.origemTempo === 'marco_30m' ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-800/70 font-bold text-[11px] flex items-center gap-1 mx-auto w-fit">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>Marco 30 m (0,50h)</span>
                          </span>
                        ) : item.origemTempo === 'marco_1h' ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-800/70 font-bold text-[11px] flex items-center gap-1 mx-auto w-fit">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>Marco 1 hora (1,00h)</span>
                          </span>
                        ) : item.origemTempo?.startsWith('marco_') ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/60 font-bold text-[11px] flex items-center gap-1 mx-auto w-fit">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>Marco {item.minutosGastos} min ({item.horasGastas}h)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700 font-bold text-[11px] flex items-center gap-1 mx-auto w-fit">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{item.minutosGastos || Math.round(item.horasGastas * 60)} min ({item.horasGastas}h)</span>
                          </span>
                        )}

                        {item.horaInicio && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            🕒 {item.horaInicio}{item.horaFim ? ` às ${item.horaFim}` : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="text-slate-300 capitalize">{item.etapa || 'parametrizacao'}</span>
                      <span className="text-indigo-400 font-mono font-bold ml-1">({item.progresso}%)</span>
                    </td>

                    <td className="py-3 px-3 max-w-md">
                      <p className="text-slate-300 leading-relaxed text-[11px]">{item.descricao}</p>
                      {item.impedimento && (
                        <span className="text-[10px] text-rose-400 font-medium flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Gargalo: {item.impedimento}</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        {onSelectDemand && (
                          <button
                            onClick={() => {
                              const d = demands.find(dem => dem.seq === item.demandaSeq);
                              if (d) onSelectDemand(d);
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors text-[10px] font-semibold"
                            title="Abrir detalhes desta demanda"
                          >
                            Abrir Demanda
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteApontamento(item.id, e)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                          title="Excluir este lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    Nenhum acompanhamento encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
