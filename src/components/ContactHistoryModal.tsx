import React, { useState, useEffect } from 'react';
import { Demand, ContactInteraction } from '../types';
import { sqliteService } from '../services/sqliteService';
import { formatContactDateTime } from '../utils/contactUtils';
import { 
  X, 
  History, 
  CheckCircle2, 
  PhoneOff, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  Plus, 
  RefreshCw,
  Search,
  MessageSquare,
  Sparkles
} from 'lucide-react';

interface ContactHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  demand: Demand | null;
  onOpenRegisterNew?: (demand: Demand) => void;
}

export const ContactHistoryModal: React.FC<ContactHistoryModalProps> = ({
  isOpen,
  onClose,
  demand,
  onOpenRegisterNew,
}) => {
  if (!isOpen || !demand) return null;

  const [interactions, setInteractions] = useState<ContactInteraction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const list = await sqliteService.getContactInteractions(demand.seq);
      setInteractions(list);
    } catch (err) {
      console.error('Erro ao carregar histórico de contatos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && demand) {
      loadHistory();
    }
  }, [isOpen, demand?.seq]);

  const filteredList = interactions.filter(item => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    const matchStatus = (item.status === 'SUCCESS' ? 'sucesso' : 'sem retorno').includes(term);
    const matchUser = item.userId ? item.userId.toLowerCase().includes(term) : false;
    const matchNotes = item.notes ? item.notes.toLowerCase().includes(term) : false;
    const matchDate = item.contactedAt.toLowerCase().includes(term);
    return matchStatus || matchUser || matchNotes || matchDate;
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 transform transition-all flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="history-modal-title" className="text-base sm:text-lg font-bold text-slate-100">
                  Histórico de Contatos
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  #{demand.seq}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({interactions.length} {interactions.length === 1 ? 'registro' : 'registros'})
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                {demand.razaoSocial} • Cód: {demand.clienteId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenRegisterNew && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRegisterNew(demand);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-950/40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Contato</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-3 sm:px-5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar no histórico por usuário, resultado ou notas..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={loadHistory}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
            title="Recarregar histórico"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>

        {/* Interactions List Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {isLoading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto" />
              <p className="text-xs text-slate-400">Carregando histórico do banco de dados...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-10 text-center space-y-4 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <History className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200">
                  {searchFilter ? 'Nenhum registro encontrado para a busca' : 'Nenhum contato registrado ainda'}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {searchFilter 
                    ? 'Tente pesquisar por outro termo ou limpe o filtro.'
                    : 'Registre a primeira tentativa ou realização de contato para iniciar o histórico de interações com o cliente.'}
                </p>
              </div>

              {onOpenRegisterNew && !searchFilter && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRegisterNew(demand);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-950/50 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Primeiro Contato</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredList.map((item, index) => {
                const isSuccess = item.status === 'SUCCESS' || item.status === 'Contato realizado com sucesso';
                const timeInfo = formatContactDateTime(item.contactedAt);

                return (
                  <div 
                    key={item.id || index}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2.5 relative group"
                  >
                    {/* Top Row: Date, Badge, User */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isSuccess 
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {isSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <PhoneOff className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span>{isSuccess ? 'Contato realizado com sucesso' : 'Sem retorno'}</span>
                        </span>

                        {/* Order indicator for most recent */}
                        {index === 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                            Último Contato
                          </span>
                        )}
                      </div>

                      {/* Timestamp & Responsible */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                        <span className="flex items-center gap-1 text-slate-300 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{timeInfo.fullFormatted || item.contactedAt}</span>
                        </span>

                        {item.userId && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <span className="text-slate-500">—</span>
                            <User className="w-3 h-3 text-slate-400" />
                            <strong className="text-slate-200">{item.userId}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notes Box if provided */}
                    {item.notes && (
                      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed whitespace-pre-wrap">{item.notes}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ordenados do mais recente para o mais antigo</span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenRegisterNew && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRegisterNew(demand);
                }}
                className="sm:hidden px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
              >
                + Registrar
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
