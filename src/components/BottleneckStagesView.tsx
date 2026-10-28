import React, { useState } from 'react';
import { Demand, ProcessStage } from '../types';
import { 
  GitFork, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight, 
  ChevronRight, 
  Users, 
  Settings, 
  GraduationCap, 
  Rocket, 
  FileCheck,
  ShieldAlert,
  Lightbulb,
  ExternalLink,
  TrendingUp
} from 'lucide-react';

interface BottleneckStagesViewProps {
  demands: Demand[];
  onSelectDemand: (demand: Demand) => void;
  onViewBurnup?: () => void;
}

interface StageDetail {
  id: ProcessStage;
  title: string;
  order: number;
  icon: any;
  color: string;
  borderColor: string;
  bgLight: string;
  diagnostico: string;
  causaRaiz: string;
  planoAcao: string;
}

export const BottleneckStagesView: React.FC<BottleneckStagesViewProps> = ({
  demands,
  onSelectDemand,
  onViewBurnup,
}) => {
  const [selectedStage, setSelectedStage] = useState<ProcessStage>('kickoff');

  const stages: StageDetail[] = [
    {
      id: 'kickoff',
      title: '1. Kickoff & Fila de Alocação',
      order: 1,
      icon: Users,
      color: 'text-purple-400',
      borderColor: 'border-purple-500/40',
      bgLight: 'bg-purple-950/20',
      diagnostico: 'Demandas em andamento que ainda não possuem um implantador formalmente atribuído na planilha.',
      causaRaiz: 'Venda realizada pelo Comercial sem notificação imediata à liderança de operações ou falta de capacidade imediata no time.',
      planoAcao: 'Realizar triagem diária matinal e definir implantador em no máximo 24h úteis após a assinatura do contrato.'
    },
    {
      id: 'parametrizacao',
      title: '2. Parametrização & Escopo',
      order: 2,
      icon: Settings,
      color: 'text-blue-400',
      borderColor: 'border-blue-500/40',
      bgLight: 'bg-blue-950/20',
      diagnostico: 'Desbalanceamento entre complexidade operacional (muitos módulos: 4+) e escassas horas contratadas.',
      causaRaiz: 'Subdimensionamento na negociação comercial (ex: vender 5h para implantar 4 módulos com migração de dados).',
      planoAcao: 'Adotar matriz padrão de esforço mínimo (mínimo de 3h por módulo) ou negociar aditivo de horas antes de travar o cliente.'
    },
    {
      id: 'treinamento',
      title: '3. Capacitação & Treinamento',
      order: 3,
      icon: GraduationCap,
      color: 'text-amber-400',
      borderColor: 'border-amber-500/40',
      bgLight: 'bg-amber-950/20',
      diagnostico: 'Dificuldade de conciliar agenda com múltiplos participantes da empresa do cliente (3 a 10 pessoas).',
      causaRaiz: 'Desmarcações contínuas de agenda e falta de comprometimento dos colaboradores do cliente com o cronograma.',
      planoAcao: 'Disponibilizar trilha prévia de vídeo-aulas da Universidade Corporativa e focar sessões ao vivo apenas em dúvidas e validações práticas.'
    },
    {
      id: 'homologacao',
      title: '4. Homologação & Go-Live',
      order: 4,
      icon: Rocket,
      color: 'text-rose-400',
      borderColor: 'border-rose-500/40',
      bgLight: 'bg-rose-950/20',
      diagnostico: 'Demandas que estouraram o prazo de entrega estipulado na Prev. Fim sem entrar em produção.',
      causaRaiz: 'Insegurança do cliente para virar a chave, atraso no envio de tabelas de preços/saldos ou pendências com certificado digital.',
      planoAcao: 'Checklist obrigatório de Go-Live com data limite. Se houver recusa injustificada do cliente, congelar SLA por dependência externa.'
    },
    {
      id: 'tep_cs',
      title: '5. Encerramento & TEP (CS)',
      order: 5,
      icon: FileCheck,
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500/40',
      bgLight: 'bg-emerald-950/20',
      diagnostico: 'Sistema já operando, porém parado na etapa burocrática de assinatura do Termo de Encerramento (TEP).',
      causaRaiz: 'Demora no retorno do cliente para assinatura ou falta de cobrança ativa da transição para a equipe de CS.',
      planoAcao: 'Implementar assinatura eletrônica automática com cláusula de aprovação tácita caso não haja manifestação em 7 dias.'
    }
  ];

  // Group ongoing demands by stage
  const ongoingDemands = demands.filter(d => d.status === 'Em Andamento' || d.status === 'Concluída (CS Finalizar TEP)');

  const getStageDemands = (stageId: ProcessStage) => {
    if (stageId === 'tep_cs') {
      return ongoingDemands.filter(d => d.status === 'Concluída (CS Finalizar TEP)' || d.currentStage === 'tep_cs');
    }
    if (stageId === 'kickoff') {
      return ongoingDemands.filter(d => (!d.implantador || d.implantador === 'Não Atribuído') && d.status === 'Em Andamento');
    }
    if (stageId === 'parametrizacao') {
      return ongoingDemands.filter(d => d.totModulos >= 4 && d.hrsNeg <= d.totModulos * 3 && d.implantador !== 'Não Atribuído');
    }
    if (stageId === 'treinamento') {
      return ongoingDemands.filter(d => (d.pessoasTreinar >= 3 || d.tipo === 'Acompanhamento Treinamento') && d.daysLate === 0 && d.implantador !== 'Não Atribuído');
    }
    if (stageId === 'homologacao') {
      return ongoingDemands.filter(d => d.daysLate > 0 && d.status === 'Em Andamento');
    }
    return [];
  };

  const activeStageObj = stages.find(s => s.id === selectedStage) || stages[0];
  const stageDemandsList = getStageDemands(selectedStage);

  return (
    <div className="space-y-6">
      {/* Introduction Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <GitFork className="w-5 h-5 text-indigo-400" />
            Funil de Etapas & Mapeamento de Gargalos
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Selecione cada fase da jornada de implantação para diagnosticar onde as demandas estão represadas, entender as causas raízes e ver as ações sugeridas.
          </p>
        </div>

        {onViewBurnup && (
          <button
            onClick={onViewBurnup}
            className="px-4 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 shadow-xs"
          >
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>Ver Gráfico de Burnup de Horas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Visual Stage Stepper / Funnel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {stages.map((stage) => {
          const Icon = stage.icon;
          const count = getStageDemands(stage.id).length;
          const isSelected = selectedStage === stage.id;

          return (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className={`
                relative p-4 rounded-xl text-left border transition-all duration-200 flex flex-col justify-between
                ${isSelected 
                  ? `${stage.borderColor} bg-slate-800/90 shadow-md ring-2 ring-indigo-500/20` 
                  : 'border-slate-800 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700'}
              `}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${stage.bgLight} ${stage.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                    count > 0 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count} {count === 1 ? 'caso' : 'casos'}
                  </span>
                </div>

                <div className="text-sm font-bold text-slate-200">
                  {stage.title}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Ver diagnósticos</span>
                <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-400 transform translate-x-1' : 'text-slate-400'}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Stage Deep-Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1-col: Diagnostic & Action Plan */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
            <div className={`p-2.5 rounded-xl ${activeStageObj.bgLight} ${activeStageObj.color}`}>
              {React.createElement(activeStageObj.icon, { className: 'w-6 h-6' })}
            </div>
            <div>
              <h4 className="font-bold text-base text-slate-100">{activeStageObj.title}</h4>
              <span className="text-xs text-slate-400 font-mono">
                {stageDemandsList.length} demandas travadas nesta etapa
              </span>
            </div>
          </div>

          {/* Diagnostic */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400">
              <ShieldAlert className="w-4 h-4" />
              <span>Diagnóstico do Gargalo</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              {activeStageObj.diagnostico}
            </p>
          </div>

          {/* Root Cause */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span>Causa Raiz Mais Comum</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              {activeStageObj.causaRaiz}
            </p>
          </div>

          {/* Recommendation / Action Plan */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Lightbulb className="w-4 h-4" />
              <span>Plano de Ação Recomendado</span>
            </div>
            <p className="text-xs text-emerald-300/90 leading-relaxed p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
              {activeStageObj.planoAcao}
            </p>
          </div>
        </div>

        {/* Right 2-col: Demands stuck in this stage */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h4 className="font-bold text-base text-slate-100">
                Demandas Represadas Nesta Etapa
              </h4>
              <p className="text-xs text-slate-400">
                Clique na demanda para inspecionar histórico, módulos e pendências
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400 px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
              Total: {stageDemandsList.length}
            </span>
          </div>

          {stageDemandsList.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-slate-950/40 border border-slate-800/80">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-200">
                Fluxo limpo! Nenhuma demanda retida nesta fase.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {stageDemandsList.map((demand) => (
                <div
                  key={demand.seq}
                  onClick={() => onSelectDemand(demand)}
                  className="p-3.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">
                        #{demand.seq}
                      </span>
                      <h5 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors">
                        {demand.razaoSocial}
                      </h5>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {demand.tipo}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>Implantador: <strong className="text-slate-300">{demand.implantador}</strong></span>
                      <span>Comercial: <strong className="text-slate-300">{demand.comercial}</strong></span>
                      <span>Horas: <strong className="text-slate-300">{demand.hrsNeg}h</strong></span>
                      <span>Módulos: <strong className="text-slate-300">{demand.totModulos}</strong></span>
                    </div>

                    {demand.bottlenecks.length > 0 && (
                      <div className="text-[11px] text-rose-400 font-medium">
                        ⚠️ {demand.bottlenecks[0]}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-300">
                        {demand.prevFim}
                      </div>
                      {demand.daysLate > 0 ? (
                        <span className="text-[11px] font-mono text-rose-400 font-bold block">
                          +{demand.daysLate}d atraso
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 block">
                          No prazo
                        </span>
                      )}
                    </div>

                    <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white text-slate-400 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
