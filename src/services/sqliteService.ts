import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { Demand, DemandStatus, ProcessStage, ContactInteraction, LatestContactSummary, RetaguardaApiLog, RetaguardaApiStats } from '../types';

let sqlInstance: SqlJsStatic | null = null;

async function getSqlInstance(): Promise<SqlJsStatic> {
  if (sqlInstance) return sqlInstance;

  const candidateUrls = [
    sqlWasmUrl,
    '/sql-wasm.wasm',
    'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm',
    'https://sql.js.org/dist/sql-wasm.wasm'
  ];

  let wasmBinary: ArrayBuffer | null = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf && buf.byteLength > 1000) {
          wasmBinary = buf;
          break;
        }
      }
    } catch (e) {
      // Try next candidate URL
    }
  }

  if (wasmBinary) {
    sqlInstance = await initSqlJs({
      wasmBinary
    });
    return sqlInstance;
  }

  // Fallback if pre-fetching was blocked
  sqlInstance = await initSqlJs({
    locateFile: () => sqlWasmUrl || '/sql-wasm.wasm'
  });
  return sqlInstance;
}

export interface SqliteConnectionState {
  isConnected: boolean;
  isNetworkServer: boolean;
  networkAccessUrls: string[];
  fileName: string;
  filePath: string;
  lastSyncAt: string | null;
  lastDirectWriteTime: string | null;
  lastWriteError: string | null;
  tables: string[];
  totalDemands: number;
  totalTeamMembers: number;
  hasDirectWriteAccess: boolean;
}

class SqliteService {
  private activeDb: Database | null = null;
  private fileHandle: any = null; // FileSystemFileHandle
  private lastFileModified: number = 0;
  private isServerBackendAvailable: boolean | null = null;
  private listeners: Array<(state: SqliteConnectionState) => void> = [];
  private connectionState: SqliteConnectionState = {
    isConnected: false,
    isNetworkServer: false,
    networkAccessUrls: [],
    fileName: 'implantacoes.db',
    filePath: 'C:\\MeusProjetos\\implantacoes.db',
    lastSyncAt: null,
    lastDirectWriteTime: null,
    lastWriteError: null,
    tables: [],
    totalDemands: 0,
    totalTeamMembers: 0,
    hasDirectWriteAccess: false,
  };

  getState(): SqliteConnectionState {
    return { ...this.connectionState };
  }

  subscribe(listener: (state: SqliteConnectionState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(l => {
      try {
        l(state);
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Check if Central Network Server is active
  async checkServerBackend(): Promise<boolean> {
    try {
      const res = await fetch('/api/db/status');
      if (res.ok) {
        const data = await res.json();
        this.isServerBackendAvailable = true;
        this.connectionState.isConnected = true;
        this.connectionState.isNetworkServer = true;
        this.connectionState.hasDirectWriteAccess = true;
        this.connectionState.filePath = data.dbFilePath || 'C:\\MeusProjetos\\implantacoes.db';
        this.connectionState.fileName = data.fileName || 'implantacoes.db';
        this.connectionState.tables = data.tables || [];
        this.connectionState.totalDemands = data.totalDemands || 0;
        this.connectionState.totalTeamMembers = data.totalTeamMembers || 0;
        this.connectionState.lastSyncAt = data.lastModified || new Date().toISOString();
        this.connectionState.lastDirectWriteTime = data.serverTime || new Date().toLocaleTimeString('pt-BR');
        
        // Fetch network IPs
        try {
          const netRes = await fetch('/api/network-info');
          if (netRes.ok) {
            const netData = await netRes.json();
            this.connectionState.networkAccessUrls = netData.accessUrls || [];
          }
        } catch (e) {}

        this.notify();
        return true;
      }
    } catch (e) {
      // Backend not running (pure client mode)
    }
    this.isServerBackendAvailable = false;
    return false;
  }

  // Initialize SQLite database
  async initDatabase(): Promise<Database | null> {
    const isServer = await this.checkServerBackend();
    if (isServer) {
      return null;
    }

    if (this.activeDb) return this.activeDb;
    const SQL = await getSqlInstance();
    const db = new SQL.Database();
    this.initSchema(db);
    this.activeDb = db;
    this.updateTablesList();
    return db;
  }

  supportsDirectFileSystem(): boolean {
    return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
  }

  // Connect using direct File System Access API (when not using server)
  async connectWithFilePicker(): Promise<{ demands: Demand[]; teamMembers: string[] }> {
    if (!this.supportsDirectFileSystem()) {
      throw new Error('Seu navegador não suporta a API de Acesso a Arquivos nativa. Use o botão de upload do arquivo .db.');
    }

    // @ts-ignore
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Banco de Dados SQLite (*.db, *.sqlite, *.sqlite3)',
          accept: {
            'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'],
            'application/octet-stream': ['.db']
          }
        }
      ],
      multiple: false
    });

    this.fileHandle = fileHandle;
    const file = await fileHandle.getFile();
    this.lastFileModified = file.lastModified;
    const arrayBuffer = await file.arrayBuffer();

    let hasDirectWriteAccess = false;
    try {
      if (fileHandle.requestPermission) {
        const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
        hasDirectWriteAccess = perm === 'granted';
      } else if (fileHandle.queryPermission) {
        const perm = await fileHandle.queryPermission({ mode: 'readwrite' });
        hasDirectWriteAccess = perm === 'granted';
      }
    } catch (e) {
      console.warn('Could not acquire direct readwrite permission', e);
      hasDirectWriteAccess = false;
    }

    this.connectionState.fileName = file.name;
    this.connectionState.filePath = `C:\\MeusProjetos\\${file.name}`;
    this.connectionState.hasDirectWriteAccess = hasDirectWriteAccess;

    return this.loadFromBuffer(new Uint8Array(arrayBuffer));
  }

  // Request write permission again if not granted initially
  async requestWritePermission(): Promise<boolean> {
    if (this.connectionState.isNetworkServer) return true;
    if (!this.fileHandle || !this.fileHandle.requestPermission) return false;
    try {
      const perm = await this.fileHandle.requestPermission({ mode: 'readwrite' });
      this.connectionState.hasDirectWriteAccess = perm === 'granted';
      this.notify();
      return this.connectionState.hasDirectWriteAccess;
    } catch (e) {
      return false;
    }
  }

  // Re-read physical file from disk (consult in real-time if modified externally)
  async reloadFromDisk(): Promise<{ demands: Demand[]; teamMembers: string[] }> {
    if (this.connectionState.isNetworkServer) {
      const [demands, teamMembers] = await Promise.all([
        this.getAllDemands(),
        this.getTeamMembers()
      ]);
      return { demands, teamMembers };
    }

    if (!this.fileHandle) {
      throw new Error('Nenhum arquivo físico conectado.');
    }
    const file = await this.fileHandle.getFile();
    this.lastFileModified = file.lastModified;
    const arrayBuffer = await file.arrayBuffer();
    return this.loadFromBuffer(new Uint8Array(arrayBuffer));
  }

  // Connect from a traditional File input
  async connectFromFile(file: File): Promise<{ demands: Demand[]; teamMembers: string[] }> {
    this.fileHandle = null;
    const arrayBuffer = await file.arrayBuffer();
    this.connectionState.fileName = file.name;
    this.connectionState.filePath = `C:\\MeusProjetos\\${file.name}`;
    this.connectionState.hasDirectWriteAccess = false;

    return this.loadFromBuffer(new Uint8Array(arrayBuffer));
  }

  // Load and parse SQLite binary buffer
  async loadFromBuffer(buffer: Uint8Array): Promise<{ demands: Demand[]; teamMembers: string[] }> {
    const SQL = await getSqlInstance();
    const db = new SQL.Database(buffer);
    this.initSchema(db);
    this.activeDb = db;
    this.updateTablesList();

    const teamMembers = await this.getTeamMembers();
    const demands = await this.getAllDemands();

    this.connectionState.isConnected = true;
    this.connectionState.totalDemands = demands.length;
    this.connectionState.totalTeamMembers = teamMembers.length;
    this.connectionState.lastSyncAt = new Date().toISOString();
    this.notify();

    return { demands, teamMembers };
  }

  private updateTablesList() {
    if (!this.activeDb) return;
    try {
      const res = this.activeDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      const tables: string[] = [];
      if (res.length > 0 && res[0].values) {
        res[0].values.forEach(row => {
          if (row[0]) tables.push(String(row[0]));
        });
      }
      this.connectionState.tables = tables;
    } catch (e) {
      console.warn('Error reading tables list', e);
    }
  }

  // Get all active team members from SQLite
  async getTeamMembers(): Promise<string[]> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/team');
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Failed to fetch team from network server', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return ['Leonardo', 'Diogo'];

    const teamMembers: string[] = [];
    try {
      const teamRes = db.exec("SELECT nome FROM implantadores WHERE ativo = 1 ORDER BY nome ASC;");
      if (teamRes.length > 0 && teamRes[0].values) {
        teamRes[0].values.forEach(row => {
          if (row[0] && typeof row[0] === 'string' && row[0] !== 'Não Atribuído') {
            teamMembers.push(row[0]);
          }
        });
      }
    } catch (e) {
      console.warn('Could not read implantadores from sqlite', e);
    }
    return teamMembers.length > 0 ? teamMembers : ['Leonardo', 'Diogo'];
  }

  // Get all demands from SQLite
  async getAllDemands(): Promise<Demand[]> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/demands');
        if (res.ok) {
          const demands = await res.json();
          this.connectionState.totalDemands = demands.length;
          this.notify();
          return demands;
        }
      } catch (e) {
        console.warn('Failed to fetch demands from network server', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return [];

    const demands: Demand[] = [];
    try {
      const query = `
        SELECT 
          d.seq,
          d.razao_social,
          d.cliente_id,
          d.status,
          d.tipo_demanda,
          d.etapa_atual,
          d.data_inicio,
          d.data_previsao,
          d.data_conclusao,
          d.percentual_progresso,
          d.bloqueado_cliente,
          d.motivo_bloqueio,
          d.complexidade,
          COALESCE(d.retaguarda_atualizado, 0) as retaguarda_atualizado,
          d.data_retaguarda_atualizado,
          i.nome as nome_implantador
        FROM demandas d
        LEFT JOIN implantadores i ON d.implantador_id = i.id
        ORDER BY d.seq ASC;
      `;
      const res = db.exec(query);
      if (res.length > 0 && res[0].values) {
        const cols = res[0].columns;
        const rows = res[0].values;

        rows.forEach((row) => {
          const rowObj: Record<string, any> = {};
          cols.forEach((col, idx) => {
            rowObj[col] = row[idx];
          });

          const demand: Demand = {
            seq: Number(rowObj.seq) || 0,
            razaoSocial: String(rowObj.razao_social || `Cliente #${rowObj.seq}`),
            clienteId: String(rowObj.cliente_id || rowObj.seq || ''),
            implantador: String(rowObj.nome_implantador || 'Não Atribuído'),
            status: (rowObj.status as DemandStatus) || 'Em Andamento',
            tipo: (rowObj.tipo_demanda as any) || 'Nova Implantação',
            prevInicio: rowObj.data_inicio ? String(rowObj.data_inicio) : '',
            prevFim: rowObj.data_previsao ? String(rowObj.data_previsao) : '',
            conclusao: rowObj.data_conclusao ? String(rowObj.data_conclusao) : '',
            comercial: 'Retaguarda',
            hrsNeg: 20,
            pessoasTreinar: 3,
            totModulos: 5,
            currentStage: (rowObj.etapa_atual as ProcessStage) || 'parametrizacao',
            progressPercent: Number(rowObj.percentual_progresso) || 0,
            daysOpen: 0,
            daysLate: 0,
            daysSinceLastEvolution: 0,
            weeklyEvolutionState: 'em_dia',
            bottlenecks: rowObj.bloqueado_cliente ? ['Bloqueado pelo Cliente'] : [],
            notes: rowObj.motivo_bloqueio ? String(rowObj.motivo_bloqueio) : undefined,
            retaguardaAtualizado: Boolean(rowObj.retaguarda_atualizado),
            dataRetaguardaAtualizado: rowObj.data_retaguarda_atualizado ? String(rowObj.data_retaguarda_atualizado) : undefined,
            checkIns: []
          };

          demands.push(demand);
        });
      }
    } catch (e) {
      console.warn('Could not read demandas from sqlite', e);
    }

    // Load weekly check-ins from SQLite
    if (demands.length > 0) {
      try {
        const evolucoesRes = db.exec(`
          SELECT 
            e.id,
            e.demanda_seq, 
            e.data_evolucao, 
            e.percentual_progresso, 
            e.descricao_avanco, 
            e.descricao_impedimento,
            COALESCE(e.horas_gastas, 0) as horas_gastas,
            COALESCE(e.implantador_nome, i.nome, '') as executante
          FROM evolucoes_semanais e
          LEFT JOIN implantadores i ON e.implantador_id = i.id
          ORDER BY e.data_evolucao DESC, e.id DESC;
        `);
        if (evolucoesRes.length > 0 && evolucoesRes[0].values) {
          const evolRows = evolucoesRes[0].values;
          evolRows.forEach(erow => {
            const seq = Number(erow[1]);
            const d = demands.find(item => item.seq === seq);
            if (d) {
              d.checkIns = d.checkIns || [];
              d.checkIns.push({
                id: Number(erow[0]),
                date: String(erow[2] || ''),
                progressPercent: Number(erow[3]) || 0,
                note: String(erow[4] || ''),
                stage: d.currentStage,
                blocker: erow[5] ? String(erow[5]) : undefined,
                horasGastas: Number(erow[6]) || 0,
                implantador: String(erow[7] || d.implantador || 'Não Atribuído')
              });
              d.updatedThisWeek = true;
            }
          });
        }
      } catch (e) {
        console.warn('Could not load evolucoes_semanais', e);
      }

      // Attach contact_interactions locally
      try {
        const interRes = db.exec(`
          SELECT 
            ci.contact_id,
            ci.status,
            ci.contacted_at,
            ci.user_id,
            ci.notes,
            (SELECT COUNT(*) FROM contact_interactions c2 WHERE c2.contact_id = ci.contact_id) as total_interactions
          FROM contact_interactions ci
          INNER JOIN (
            SELECT contact_id, MAX(contacted_at) as max_date, MAX(id) as max_id
            FROM contact_interactions
            GROUP BY contact_id
          ) latest ON ci.contact_id = latest.contact_id AND ci.id = latest.max_id;
        `);
        if (interRes.length > 0 && interRes[0].values) {
          interRes[0].values.forEach(row => {
            const cId = Number(row[0]);
            const d = demands.find(item => item.seq === cId);
            if (d) {
              d.latestContactInteraction = {
                lastStatus: String(row[1]),
                lastContactedAt: String(row[2]),
                lastUserId: row[3] ? String(row[3]) : undefined,
                lastNotes: row[4] ? String(row[4]) : undefined,
                totalCount: Number(row[5]) || 1,
              };
            }
          });
        }
      } catch (e) {
        console.warn('Could not load contact_interactions', e);
      }
    }

    return demands;
  }

  // Save single demand into SQLite
  async saveDemand(demand: Demand, auditSummary?: string): Promise<void> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/demands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demand, auditSummary })
        });
        if (res.ok) {
          const data = await res.json();
          this.connectionState.lastDirectWriteTime = data.savedAt || new Date().toLocaleTimeString('pt-BR');
          this.notify();
          return;
        }
      } catch (e) {
        console.warn('Network server saveDemand failed, fallback to local', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return;

    let implantadorId: number | null = null;
    if (demand.implantador && demand.implantador !== 'Não Atribuído') {
      const res = db.exec("SELECT id FROM implantadores WHERE nome = ?;", [demand.implantador]);
      if (res.length > 0 && res[0].values.length > 0) {
        implantadorId = Number(res[0].values[0][0]);
      } else {
        db.run("INSERT INTO implantadores (nome, cargo) VALUES (?, 'Especialista de Implantação');", [demand.implantador]);
        const idRes = db.exec("SELECT last_insert_rowid();");
        if (idRes.length > 0 && idRes[0].values.length > 0) {
          implantadorId = Number(idRes[0].values[0][0]);
        }
      }
    }

    db.run(`
      INSERT INTO demandas (
        seq, razao_social, implantador_id, status, tipo_demanda, etapa_atual,
        data_inicio, data_previsao, data_conclusao, percentual_progresso,
        bloqueado_cliente, motivo_bloqueio, retaguarda_atualizado, data_retaguarda_atualizado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(seq) DO UPDATE SET
        razao_social = excluded.razao_social,
        implantador_id = excluded.implantador_id,
        status = excluded.status,
        tipo_demanda = excluded.tipo_demanda,
        etapa_atual = excluded.etapa_atual,
        data_inicio = excluded.data_inicio,
        data_previsao = excluded.data_previsao,
        data_conclusao = excluded.data_conclusao,
        percentual_progresso = excluded.percentual_progresso,
        bloqueado_cliente = excluded.bloqueado_cliente,
        motivo_bloqueio = excluded.motivo_bloqueio,
        retaguarda_atualizado = excluded.retaguarda_atualizado,
        data_retaguarda_atualizado = excluded.data_retaguarda_atualizado;
    `, [
      demand.seq,
      demand.razaoSocial,
      implantadorId,
      demand.status,
      demand.tipo,
      demand.currentStage || 'parametrizacao',
      demand.prevInicio || null,
      demand.prevFim || null,
      demand.conclusao || null,
      demand.progressPercent || 0,
      demand.bottlenecks && demand.bottlenecks.includes('Bloqueado pelo Cliente') ? 1 : 0,
      demand.notes || null,
      demand.retaguardaAtualizado ? 1 : 0,
      demand.dataRetaguardaAtualizado || (demand.retaguardaAtualizado ? new Date().toISOString() : null)
    ]);

    if (auditSummary) {
      this.recordAudit({
        seq: demand.seq,
        razaoSocial: demand.razaoSocial,
        actionType: 'edit_details',
        summary: auditSummary,
        author: demand.implantador || 'Operador'
      });
    }

    this.connectionState.lastSyncAt = new Date().toISOString();
    await this.autoPersistToFile();
  }

  // Register a new Acompanhamento (Histórico de Acompanhamentos e Esforço)
  async addAcompanhamento(data: {
    demandaSeq: number;
    implantadorNome: string;
    tempoGastoHoras: number;
    tempoGastoMinutos?: number;
    tempoGastoSegundos?: number;
    duracaoFormatada?: string;
    isCronometro?: boolean;
    horaInicio?: string;
    horaFim?: string;
    origemTempo?: string;
    descricao: string;
    impedimento?: string;
    etapa?: string;
    progresso?: number;
    dataExecucao?: string;
  }): Promise<{ success: boolean; id?: number; error?: string }> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/acompanhamentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          const resData = await res.json();
          this.connectionState.lastDirectWriteTime = resData.savedAt || new Date().toLocaleTimeString('pt-BR');
          this.notify();
          return { success: true, id: resData.id };
        }
      } catch (e: any) {
        console.warn('Network server addAcompanhamento failed, fallback to local', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return { success: false, error: 'Banco de dados não disponível' };

    try {
      const executante = (data.implantadorNome || 'Não Atribuído').trim();
      
      let segundos = Number(data.tempoGastoSegundos) || 0;
      let minutos = Number(data.tempoGastoMinutos) || 0;
      let horas = Number(data.tempoGastoHoras) || 0;

      if (segundos > 0) {
        minutos = Math.max(1, Math.round(segundos / 60));
        horas = Math.round((minutos / 60) * 100) / 100;
      } else if (minutos > 0) {
        segundos = minutos * 60;
        horas = Math.round((minutos / 60) * 100) / 100;
      } else if (horas > 0) {
        minutos = Math.round(horas * 60);
        segundos = minutos * 60;
      } else {
        minutos = 60;
        segundos = 3600;
        horas = 1.0;
      }

      const dataVal = data.dataExecucao || new Date().toISOString().split('T')[0];
      const nota = String(data.descricao).trim();
      const etapaVal = data.etapa || 'parametrizacao';
      const prog = Number(data.progresso) || 0;
      const blocker = data.impedimento ? String(data.impedimento).trim() : null;
      const hInicio = data.horaInicio ? String(data.horaInicio) : null;
      const hFim = data.horaFim ? String(data.horaFim) : null;
      const origTempo = data.origemTempo ? String(data.origemTempo) : (hInicio ? 'cronometro' : 'manual');
      const isCron = origTempo === 'cronometro' ? 1 : 0;
      const duracaoFmt = data.duracaoFormatada || (segundos > 0 ? `${Math.floor(segundos / 60)}m ${segundos % 60}s` : `${minutos} min`);

      // Find or create implantador
      let impId: number | null = null;
      if (executante && executante !== 'Não Atribuído') {
        const resImp = db.exec("SELECT id FROM implantadores WHERE nome = ?;", [executante]);
        if (resImp.length > 0 && resImp[0].values.length > 0) {
          impId = Number(resImp[0].values[0][0]);
        } else {
          db.run("INSERT INTO implantadores (nome, cargo) VALUES (?, 'Especialista de Implantação');", [executante]);
          const idRes = db.exec("SELECT last_insert_rowid();");
          if (idRes.length > 0 && idRes[0].values.length > 0) {
            impId = Number(idRes[0].values[0][0]);
          }
        }
      }

      // Check deduplication
      const checkRes = db.exec(`
        SELECT id FROM historico_acompanhamentos 
        WHERE demanda_seq = ? 
          AND data_execucao = ? 
          AND descricao_execucao = ?
        LIMIT 1;
      `, [data.demandaSeq, dataVal, nota]);

      let insertId = 0;
      if (checkRes.length > 0 && checkRes[0].values && checkRes[0].values.length > 0) {
        insertId = Number(checkRes[0].values[0][0]);
      } else {
        db.run(`
          INSERT INTO historico_acompanhamentos (
            demanda_seq, implantador_id, implantador_nome, tempo_gasto_minutos, tempo_gasto_horas,
            tempo_gasto_segundos, timer_duracao_formatada, is_cronometro,
            hora_inicio, hora_fim, origem_tempo,
            data_execucao, etapa_processo, percentual_progresso, descricao_execucao, impedimento
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          data.demandaSeq, impId, executante, minutos, horas,
          segundos, duracaoFmt, isCron,
          hInicio, hFim, origTempo,
          dataVal, etapaVal, prog, nota, blocker
        ]);
        const idRes = db.exec("SELECT last_insert_rowid();");
        insertId = idRes.length > 0 && idRes[0].values.length > 0 ? Number(idRes[0].values[0][0]) : 0;

        // Keep evolucoes_semanais in sync
        db.run(`
          INSERT INTO evolucoes_semanais (
            demanda_seq, implantador_id, data_evolucao, percentual_progresso,
            descricao_avanco, descricao_impedimento, horas_gastas, implantador_nome,
            tempo_gasto_minutos, tempo_gasto_segundos, timer_duracao_formatada,
            hora_inicio, hora_fim, origem_tempo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          data.demandaSeq, impId, dataVal, prog,
          nota, blocker, horas, executante,
          minutos, segundos, duracaoFmt,
          hInicio, hFim, origTempo
        ]);
      }

      // Update demand progress
      db.run(`
        UPDATE demandas 
        SET percentual_progresso = ?, etapa_atual = ?, updated_at = datetime('now', 'localtime')
        WHERE seq = ?;
      `, [prog, etapaVal, data.demandaSeq]);

      this.connectionState.lastSyncAt = new Date().toISOString();
      await this.autoPersistToFile();
      return { success: true, id: insertId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Delete an acompanhamento record
  async deleteAcompanhamento(id: number): Promise<boolean> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch(`/api/db/acompanhamentos/${id}`, { method: 'DELETE' });
        if (res.ok) {
          return true;
        }
      } catch (e) {}
    }

    const db = await this.initDatabase();
    if (!db) return false;
    try {
      db.run("DELETE FROM historico_acompanhamentos WHERE id = ?;", [id]);
      db.run("DELETE FROM evolucoes_semanais WHERE id = ?;", [id]);
      await this.autoPersistToFile();
      return true;
    } catch (e) {
      return false;
    }
  }

  // ==================== CONTACT INTERACTIONS METHODS ====================

  // Get all contact interactions for a specific contact/demand
  async getContactInteractions(contactId: number): Promise<ContactInteraction[]> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch(`/api/db/contacts/${contactId}/interactions`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Network server getContactInteractions failed, fallback to local', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return [];

    try {
      const res = db.exec(`
        SELECT id, contact_id, status, user_id, notes, contacted_at, created_at, updated_at
        FROM contact_interactions
        WHERE contact_id = ?
        ORDER BY contacted_at DESC, id DESC;
      `, [contactId]);

      if (res.length > 0 && res[0].values) {
        return res[0].values.map(row => ({
          id: Number(row[0]),
          contactId: Number(row[1]),
          status: String(row[2]),
          userId: row[3] ? String(row[3]) : undefined,
          notes: row[4] ? String(row[4]) : undefined,
          contactedAt: String(row[5]),
          createdAt: String(row[6]),
          updatedAt: row[7] ? String(row[7]) : undefined,
        }));
      }
    } catch (e) {
      console.warn('Error reading contact_interactions locally', e);
    }
    return [];
  }

  // Get map of latest interactions for all contacts
  async getLatestContactInteractions(): Promise<Record<number, LatestContactSummary>> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/contacts/latest-interactions');
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Network server getLatestContactInteractions failed, fallback to local', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return {};

    const map: Record<number, LatestContactSummary> = {};
    try {
      const res = db.exec(`
        SELECT 
          ci.contact_id,
          ci.status,
          ci.contacted_at,
          ci.user_id,
          ci.notes,
          (SELECT COUNT(*) FROM contact_interactions c2 WHERE c2.contact_id = ci.contact_id) as total_interactions
        FROM contact_interactions ci
        INNER JOIN (
          SELECT contact_id, MAX(contacted_at) as max_date, MAX(id) as max_id
          FROM contact_interactions
          GROUP BY contact_id
        ) latest ON ci.contact_id = latest.contact_id AND ci.id = latest.max_id;
      `);

      if (res.length > 0 && res[0].values) {
        res[0].values.forEach(row => {
          const cId = Number(row[0]);
          map[cId] = {
            lastStatus: String(row[1]),
            lastContactedAt: String(row[2]),
            lastUserId: row[3] ? String(row[3]) : undefined,
            lastNotes: row[4] ? String(row[4]) : undefined,
            totalCount: Number(row[5]) || 1,
          };
        });
      }
    } catch (e) {
      console.warn('Error reading latest contact_interactions locally', e);
    }
    return map;
  }

  // Register new contact interaction
  async addContactInteraction(data: {
    contactId: number;
    status: string;
    userId?: string;
    notes?: string;
    contactedAt?: string;
  }): Promise<{ success: boolean; interaction?: ContactInteraction; error?: string }> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/contacts/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          this.connectionState.lastDirectWriteTime = new Date().toLocaleTimeString('pt-BR');
          this.notify();
          return { success: true, interaction: resData.interaction };
        } else {
          return { success: false, error: resData.error || 'Erro ao registrar contato' };
        }
      } catch (e: any) {
        console.warn('Network server addContactInteraction failed, attempting local fallback', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return { success: false, error: 'Banco de dados não disponível' };

    try {
      const cid = Number(data.contactId);
      if (!cid) return { success: false, error: 'ID do contato é obrigatório' };
      if (!data.status || !data.status.trim()) {
        return { success: false, error: 'O resultado do contato é obrigatório. Selecione "Contato realizado com sucesso" ou "Sem retorno".' };
      }

      // Check demand exists
      const demCheck = db.exec("SELECT seq FROM demandas WHERE seq = ? LIMIT 1;", [cid]);
      if (demCheck.length === 0 || !demCheck[0].values || demCheck[0].values.length === 0) {
        return { success: false, error: `Demanda inexistente (#${cid}).` };
      }

      const contactedAt = data.contactedAt || new Date().toISOString();
      const status = data.status.trim().toUpperCase() === 'SUCCESS' || data.status === 'Contato realizado com sucesso'
        ? 'SUCCESS'
        : data.status.trim().toUpperCase() === 'NO_RESPONSE' || data.status === 'Sem retorno'
        ? 'NO_RESPONSE'
        : data.status.trim();
      const userId = data.userId ? data.userId.trim() : 'Sistema';
      const notes = data.notes ? data.notes.trim() : null;

      db.run(`
        INSERT INTO contact_interactions (
          contact_id, status, user_id, notes, contacted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'));
      `, [cid, status, userId, notes, contactedAt]);

      const idRes = db.exec("SELECT last_insert_rowid();");
      const insertId = idRes.length > 0 && idRes[0].values.length > 0 ? Number(idRes[0].values[0][0]) : 0;

      const interaction: ContactInteraction = {
        id: insertId,
        contactId: cid,
        status,
        userId,
        notes: notes || undefined,
        contactedAt,
        createdAt: new Date().toISOString(),
      };

      this.connectionState.lastSyncAt = new Date().toISOString();
      await this.autoPersistToFile();
      this.notify();

      return { success: true, interaction };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao gravar contato' };
    }
  }

  // Save all demands into SQLite (batch)
  async saveAllDemands(demands: Demand[]): Promise<void> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/demands/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demands })
        });
        if (res.ok) {
          const data = await res.json();
          this.connectionState.totalDemands = demands.length;
          this.connectionState.lastDirectWriteTime = data.savedAt || new Date().toLocaleTimeString('pt-BR');
          this.notify();
          return;
        }
      } catch (e) {
        console.warn('Network server saveAllDemands failed, fallback to local', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return;

    db.run("BEGIN TRANSACTION;");
    try {
      for (const d of demands) {
        let implantadorId: number | null = null;
        if (d.implantador && d.implantador !== 'Não Atribuído') {
          const res = db.exec("SELECT id FROM implantadores WHERE nome = ?;", [d.implantador]);
          if (res.length > 0 && res[0].values.length > 0) {
            implantadorId = Number(res[0].values[0][0]);
          }
        }

        db.run(`
          INSERT INTO demandas (
            seq, razao_social, implantador_id, status, tipo_demanda, etapa_atual,
            data_inicio, data_previsao, data_conclusao, percentual_progresso,
            bloqueado_cliente, motivo_bloqueio
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(seq) DO UPDATE SET
            razao_social = excluded.razao_social,
            implantador_id = excluded.implantador_id,
            status = excluded.status,
            tipo_demanda = excluded.tipo_demanda,
            etapa_atual = excluded.etapa_atual,
            data_inicio = excluded.data_inicio,
            data_previsao = excluded.data_previsao,
            data_conclusao = excluded.data_conclusao,
            percentual_progresso = excluded.percentual_progresso,
            bloqueado_cliente = excluded.bloqueado_cliente,
            motivo_bloqueio = excluded.motivo_bloqueio;
        `, [
          d.seq,
          d.razaoSocial,
          implantadorId,
          d.status,
          d.tipo,
          d.currentStage || 'parametrizacao',
          d.prevInicio || null,
          d.prevFim || null,
          d.conclusao || null,
          d.progressPercent || 0,
          d.bottlenecks && d.bottlenecks.includes('Bloqueado pelo Cliente') ? 1 : 0,
          d.notes || null
        ]);
      }
      db.run("COMMIT;");
    } catch (err) {
      db.run("ROLLBACK;");
      throw err;
    }

    this.connectionState.totalDemands = demands.length;
    this.connectionState.lastSyncAt = new Date().toISOString();
    await this.autoPersistToFile();
  }

  // Toggle Retaguarda Updated marker (Marcador Temporário - Futuramente via API)
  async toggleRetaguarda(seq: number, status?: boolean): Promise<{ retaguardaAtualizado: boolean; dataRetaguardaAtualizado?: string }> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/demands/toggle-retaguarda', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seq, status })
        });
        if (res.ok) {
          const data = await res.json();
          return {
            retaguardaAtualizado: data.retaguardaAtualizado,
            dataRetaguardaAtualizado: data.dataRetaguardaAtualizado
          };
        }
      } catch (e) {
        console.warn('toggleRetaguarda network failed, fallback to local', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return { retaguardaAtualizado: Boolean(status) };

    let newVal = status !== undefined ? (status ? 1 : 0) : null;
    if (newVal === null) {
      const cur = db.exec("SELECT retaguarda_atualizado FROM demandas WHERE seq = ?;", [seq]);
      const curVal = cur.length > 0 && cur[0].values.length > 0 ? Number(cur[0].values[0][0]) : 0;
      newVal = curVal === 1 ? 0 : 1;
    }
    const dataIso = newVal === 1 ? new Date().toISOString() : null;

    db.run(
      "UPDATE demandas SET retaguarda_atualizado = ?, data_retaguarda_atualizado = ?, updated_at = datetime('now', 'localtime') WHERE seq = ?;",
      [newVal, dataIso, seq]
    );

    this.recordAudit({
      seq,
      razaoSocial: `Demanda #${seq}`,
      actionType: 'retaguarda_sync',
      summary: newVal === 1 ? 'Retaguarda marcado como atualizado' : 'Retaguarda desmarcado (pendente)',
      author: 'Operador'
    });

    await this.autoPersistToFile();
    return {
      retaguardaAtualizado: newVal === 1,
      dataRetaguardaAtualizado: dataIso || undefined
    };
  }

  // ==================== RETAGUARDA ERP API INTEGRATION ====================

  // Check Retaguarda ERP API status
  async checkRetaguardaApiStatus(): Promise<{ configured: boolean; endpoint: string; maskedToken: string | null }> {
    try {
      const res = await fetch('/api/retaguarda/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return {
      configured: false,
      endpoint: 'https://api64.erpgestao.com.br/retaguardanew/rest/api_sgo/gravaresumofinal',
      maskedToken: null
    };
  }

  // Envia e grava o Resumo Final diretamente no ERP Retaguarda através da API oficial
  async sendRetaguardaResumoFinal(seq: number, resumoFinal: string, author?: string): Promise<{
    success: boolean;
    erro: number;
    descricao: string;
    dataRetaguardaAtualizado?: string;
  }> {
    try {
      const res = await fetch('/api/retaguarda/gravaresumofinal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ImplantacaoSeq: seq,
          ImplantacaoResumoFinal: resumoFinal,
          author
        })
      });

      const data = await res.json().catch(() => null);

      if (!data) {
        return {
          success: false,
          erro: res.status,
          descricao: `Servidor retornou resposta inesperada (HTTP ${res.status})`
        };
      }

      if (data.Erro === 0) {
        const nowIso = new Date().toISOString();
        const db = await this.initDatabase();
        if (db) {
          db.run(
            "UPDATE demandas SET retaguarda_atualizado = 1, data_retaguarda_atualizado = ?, updated_at = datetime('now', 'localtime') WHERE seq = ?;",
            [nowIso, seq]
          );
          this.recordAudit({
            seq,
            razaoSocial: `Demanda #${seq}`,
            actionType: 'retaguarda_sync',
            summary: `Resumo final gravado no Retaguarda via API: "${resumoFinal.slice(0, 70)}${resumoFinal.length > 70 ? '...' : ''}"`,
            author: author || 'Operador'
          });
          await this.autoPersistToFile();
        }

        return {
          success: true,
          erro: 0,
          descricao: data.Descricao || 'Sucesso',
          dataRetaguardaAtualizado: nowIso
        };
      } else {
        return {
          success: false,
          erro: data.Erro,
          descricao: data.Descricao || 'Erro na API da Retaguarda'
        };
      }
    } catch (err: any) {
      return {
        success: false,
        erro: 500,
        descricao: `Falha na requisição com o servidor: ${err.message}`
      };
    }
  }

  // Testa a conexão em tempo real com o servidor do ERP Retaguarda
  async testRetaguardaConnection(): Promise<{
    online: boolean;
    authenticated: boolean;
    durationMs: number;
    statusCode: number;
    erro: number | null;
    mensagem: string;
    rawResult?: any;
  }> {
    try {
      const res = await fetch('/api/retaguarda/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => null);
      if (data) {
        return data;
      }
      return {
        online: false,
        authenticated: false,
        durationMs: 0,
        statusCode: res.status,
        erro: res.status,
        mensagem: `Servidor retornou código HTTP ${res.status}`
      };
    } catch (err: any) {
      return {
        online: false,
        authenticated: false,
        durationMs: 0,
        statusCode: 500,
        erro: 500,
        mensagem: `Falha ao acionar teste local: ${err.message}`
      };
    }
  }

  // Recupera histórico de transmissões registradas no SQLite
  async getRetaguardaLogs(params?: { limit?: number; seq?: number; status?: 'all' | 'success' | 'error' }): Promise<RetaguardaApiLog[]> {
    if (this.connectionState.isNetworkServer) {
      try {
        const query = new URLSearchParams();
        if (params?.limit) query.append('limit', String(params.limit));
        if (params?.seq) query.append('seq', String(params.seq));
        if (params?.status && params.status !== 'all') query.append('status', params.status);

        const res = await fetch(`/api/retaguarda/logs?${query.toString()}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Network server getRetaguardaLogs failed, fallback to local', e);
      }
    }

    const db = await this.initDatabase();
    if (!db) return [];

    try {
      const limit = Math.min(params?.limit || 50, 200);
      let sql = `
        SELECT id, implantacao_seq, endpoint, metodo, http_status, erro_codigo, descricao, resumo_enviado, duracao_ms, origem_ip, created_at
        FROM retaguarda_api_logs
        WHERE 1=1
      `;
      const sqlParams: any[] = [];
      if (params?.seq) {
        sql += ` AND implantacao_seq = ?`;
        sqlParams.push(params.seq);
      }
      if (params?.status === 'success') {
        sql += ` AND erro_codigo = 0`;
      } else if (params?.status === 'error') {
        sql += ` AND (erro_codigo != 0 OR erro_codigo IS NULL)`;
      }

      sql += ` ORDER BY id DESC LIMIT ?;`;
      sqlParams.push(limit);

      const res = db.exec(sql, sqlParams);
      if (res.length > 0 && res[0].values) {
        return res[0].values.map(row => ({
          id: Number(row[0]),
          implantacaoSeq: Number(row[1]),
          endpoint: String(row[2]),
          metodo: String(row[3]),
          httpStatus: Number(row[4]),
          erroCodigo: row[5] !== null ? Number(row[5]) : null,
          descricao: String(row[6] || ''),
          resumoEnviado: String(row[7] || ''),
          duracaoMs: Number(row[8]) || 0,
          origemIp: String(row[9] || ''),
          createdAt: String(row[10])
        }));
      }
    } catch (e) {
      console.warn('Error reading retaguarda_api_logs locally', e);
    }
    return [];
  }

  // Estatísticas de performance e assertividade da API Retaguarda
  async getRetaguardaStats(): Promise<RetaguardaApiStats> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/retaguarda/stats');
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
    }

    const db = await this.initDatabase();
    const defaultStats: RetaguardaApiStats = {
      total: 0,
      sucessos: 0,
      errosToken: 0,
      errosNaoEncontrado: 0,
      outrosErros: 0,
      taxaSucesso: 100,
      latenciaMediaMs: 0,
      ultimoDisparo: null
    };

    if (!db) return defaultStats;

    try {
      const res = db.exec(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN erro_codigo = 0 THEN 1 ELSE 0 END) as sucessos,
          SUM(CASE WHEN erro_codigo = 9 THEN 1 ELSE 0 END) as erros_token,
          SUM(CASE WHEN erro_codigo = 2 THEN 1 ELSE 0 END) as erros_nao_encontrado,
          SUM(CASE WHEN erro_codigo != 0 AND erro_codigo != 2 AND erro_codigo != 9 THEN 1 ELSE 0 END) as outros_erros,
          AVG(duracao_ms) as latencia_media,
          MAX(created_at) as ultimo_disparo
        FROM retaguarda_api_logs;
      `);

      if (res.length > 0 && res[0].values && res[0].values.length > 0) {
        const row = res[0].values[0];
        const total = Number(row[0]) || 0;
        const sucessos = Number(row[1]) || 0;
        return {
          total,
          sucessos,
          errosToken: Number(row[2]) || 0,
          errosNaoEncontrado: Number(row[3]) || 0,
          outrosErros: Number(row[4]) || 0,
          taxaSucesso: total > 0 ? Math.round((sucessos / total) * 100) : 100,
          latenciaMediaMs: Math.round(Number(row[5]) || 0),
          ultimoDisparo: row[6] ? String(row[6]) : null
        };
      }
    } catch (e) {}
    return defaultStats;
  }

  // Limpa os registros de logs da API
  async clearRetaguardaLogs(): Promise<boolean> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/retaguarda/logs', { method: 'DELETE' });
        if (res.ok) return true;
      } catch (e) {}
    }

    const db = await this.initDatabase();
    if (!db) return false;
    try {
      db.run("DELETE FROM retaguarda_api_logs;");
      await this.autoPersistToFile();
      return true;
    } catch (e) {
      return false;
    }
  }

  // Save team members in SQLite
  async saveTeamMembers(teamMembers: string[]): Promise<void> {
    if (this.connectionState.isNetworkServer) {
      try {
        await fetch('/api/db/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamMembers })
        });
        this.connectionState.totalTeamMembers = teamMembers.length;
        this.notify();
        return;
      } catch (e) {}
    }

    const db = await this.initDatabase();
    if (!db) return;
    for (const member of teamMembers) {
      db.run("INSERT OR IGNORE INTO implantadores (nome, cargo) VALUES (?, 'Especialista de Implantação');", [member]);
    }
    this.connectionState.totalTeamMembers = teamMembers.length;
    await this.autoPersistToFile();
  }

  // Record audit log into SQLite
  async recordAudit(entry: {
    seq: number;
    razaoSocial: string;
    actionType: string;
    summary: string;
    author?: string;
  }): Promise<void> {
    if (this.connectionState.isNetworkServer) {
      try {
        await fetch('/api/db/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry })
        });
        return;
      } catch (e) {}
    }

    const db = await this.initDatabase();
    if (!db) return;
    try {
      db.run(`
        INSERT INTO historico_status (demanda_seq, status_anterior, status_novo, motivo, alterado_por)
        VALUES (?, ?, ?, ?, ?);
      `, [
        entry.seq,
        entry.actionType,
        entry.summary,
        entry.razaoSocial,
        entry.author || 'Sistema'
      ]);
    } catch (e) {
      console.warn('Could not record audit in sqlite', e);
    }
  }

  // Clear all data from SQLite tables (clean state)
  async wipeAllData(): Promise<void> {
    if (this.connectionState.isNetworkServer) {
      try {
        await fetch('/api/db/wipe', { method: 'POST' });
        this.connectionState.totalDemands = 0;
        this.notify();
        return;
      } catch (e) {}
    }

    const db = await this.initDatabase();
    if (!db) return;
    db.run("DELETE FROM demandas;");
    db.run("DELETE FROM evolucoes_semanais;");
    db.run("DELETE FROM historico_status;");
    this.connectionState.totalDemands = 0;
    this.connectionState.lastSyncAt = new Date().toISOString();
    await this.autoPersistToFile();
  }

  // Sync memory demands to SQLite
  async syncDemandsToSqlite(demands: Demand[], teamMembers: string[]): Promise<Uint8Array | null> {
    await this.saveTeamMembers(teamMembers);
    await this.saveAllDemands(demands);
    if (!this.activeDb) {
      await this.initDatabase();
    }
    return this.activeDb ? this.activeDb.export() : null;
  }

  // Execute an arbitrary SQL query for diagnostic or inspecting
  async executeSql(query: string): Promise<{ columns: string[]; values: any[][] }[]> {
    if (this.connectionState.isNetworkServer) {
      const res = await fetch('/api/db/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao executar SQL no servidor.');
      }
      return await res.json();
    }

    if (!this.activeDb) {
      throw new Error('Banco de dados SQLite não inicializado.');
    }
    return this.activeDb.exec(query);
  }

  // Get effort ranking for implantadores
  async getEffortRanking(): Promise<{ totalEquipeHoras: number; totalAtendimentos: number; ranking: any[] }> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/effort-ranking');
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
    }

    // Fallback: calculate from memory or local db
    const demands = await this.getAllDemands();
    const map = new Map<string, { totalHoras: number; totalAtendimentos: number; demandasSet: Set<number> }>();
    let totalAllHours = 0;

    demands.forEach(d => {
      if (d.checkIns) {
        d.checkIns.forEach(c => {
          const emp = c.implantador || d.implantador;
          if (!emp || emp === 'Não Atribuído') return;
          const hrs = Number(c.horasGastas) || 0;
          totalAllHours += hrs;
          const cur = map.get(emp) || { totalHoras: 0, totalAtendimentos: 0, demandasSet: new Set() };
          cur.totalHoras += hrs;
          cur.totalAtendimentos += 1;
          cur.demandasSet.add(d.seq);
          map.set(emp, cur);
        });
      }
    });

    const ranking = Array.from(map.entries()).map(([implantador, data]) => ({
      implantador,
      totalHoras: Math.round(data.totalHoras * 10) / 10,
      totalAtendimentos: data.totalAtendimentos,
      demandasDistintas: data.demandasSet.size,
      mediaHorasPorAtendimento: data.totalAtendimentos > 0 ? Math.round((data.totalHoras / data.totalAtendimentos) * 10) / 10 : 0,
      percentualEsforco: totalAllHours > 0 ? Math.round((data.totalHoras / totalAllHours) * 100) : 0
    })).sort((a, b) => b.totalHoras - a.totalHoras || b.totalAtendimentos - a.totalAtendimentos);

    return {
      totalEquipeHoras: Math.round(totalAllHours * 10) / 10,
      totalAtendimentos: ranking.reduce((acc, r) => acc + r.totalAtendimentos, 0),
      ranking
    };
  }

  // Get detailed time entries list
  async getApontamentos(): Promise<any[]> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/apontamentos');
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
    }

    const demands = await this.getAllDemands();
    const entries: any[] = [];
    demands.forEach(d => {
      if (d.checkIns) {
        d.checkIns.forEach(c => {
          const minutos = Number(c.minutosGastos) || Math.round((Number(c.horasGastas) || 1) * 60);
          entries.push({
            id: c.id || Math.random(),
            demandaSeq: d.seq,
            razaoSocial: d.razaoSocial,
            implantador: c.implantador || d.implantador || 'Não Atribuído',
            data: c.date,
            horasGastas: Number(c.horasGastas) || 0,
            minutosGastos: minutos,
            segundosGastos: Number((c as any).segundosGastos) || minutos * 60,
            duracaoFormatada: (c as any).duracaoFormatada,
            horaInicio: c.horaInicio,
            horaFim: c.horaFim,
            origemTempo: (c as any).origemTempo || 'manual',
            isCronometro: Boolean((c as any).origemTempo === 'cronometro'),
            descricao: c.note,
            progresso: c.progressPercent,
            impedimento: c.blocker,
            etapa: c.stage || d.currentStage || 'parametrizacao'
          });
        });
      }
    });
    return entries.sort((a, b) => (b.id || 0) - (a.id || 0));
  }

  // Check if file has external modifications without opening stream
  async hasExternalChanges(): Promise<boolean> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/status');
        if (res.ok) {
          const data = await res.json();
          return data.lastModified !== this.connectionState.lastSyncAt;
        }
      } catch (e) {
        return false;
      }
    }

    if (!this.fileHandle || this.isWriting) return false;
    try {
      const file = await this.fileHandle.getFile();
      return file.lastModified > this.lastFileModified;
    } catch (e) {
      return false;
    }
  }

  private isWriting = false;
  private writeQueue: Promise<any> = Promise.resolve();

  // Robust write to physical disk with automatic cache invalidation recovery
  async writeBinaryToDisk(binaryData: Uint8Array): Promise<{ success: boolean; error?: string }> {
    if (!this.fileHandle || !this.fileHandle.createWritable) {
      return { success: false, error: 'Manipulador de arquivo direto não disponível.' };
    }

    return new Promise((resolve) => {
      this.writeQueue = this.writeQueue.then(async () => {
        this.isWriting = true;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            if (this.fileHandle.getFile) {
              await this.fileHandle.getFile();
            }

            const writable = await this.fileHandle.createWritable({ keepExistingData: false });
            await writable.write(binaryData);
            await writable.close();

            const fileAfterWrite = await this.fileHandle.getFile();
            this.lastFileModified = fileAfterWrite.lastModified;

            const now = new Date();
            this.connectionState.lastDirectWriteTime = now.toLocaleTimeString('pt-BR');
            this.connectionState.lastSyncAt = now.toISOString();
            this.connectionState.lastWriteError = null;
            this.notify();

            resolve({ success: true });
            return;
          } catch (err: any) {
            console.warn(`Write attempt ${attempts} error:`, err);
            const isStateCacheError = 
              err.name === 'InvalidStateError' || 
              err.message?.includes('state cached in an interface object') ||
              err.message?.includes('changed since it was read from disk');

            if (isStateCacheError && attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 100));
              try {
                const refreshed = await this.fileHandle.getFile();
                this.lastFileModified = refreshed.lastModified;
              } catch (e) {}
              continue;
            }

            let errMsg = err.message || 'Falha ao gravar no disco';
            if (isStateCacheError) {
              errMsg = 'O arquivo foi modificado no Windows (ex: pelo DB Browser). Pressione "Consultar / Recarregar do Disco" para sincronizar antes de salvar.';
            } else if (err.name === 'NoModificationAllowedError' || err.message?.includes('locked') || err.message?.includes('EBUSY')) {
              errMsg = 'Arquivo bloqueado no Windows pelo DB Browser for SQLite. Feche o DB Browser ou clique em "Escrever Alterações" para liberá-lo.';
            }

            this.connectionState.lastWriteError = errMsg;
            this.notify();
            resolve({ success: false, error: errMsg });
            return;
          }
        }
      }).finally(() => {
        this.isWriting = false;
      });
    });
  }

  // Explicit test function that writes and immediately verifies physical disk write
  async testDiskWrite(): Promise<{
    success: boolean;
    fileSizeKb: number;
    lastModifiedTime: string;
    message: string;
  }> {
    if (this.connectionState.isNetworkServer) {
      try {
        const res = await fetch('/api/db/test-write', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          this.connectionState.lastDirectWriteTime = data.lastModifiedTime;
          this.connectionState.lastWriteError = null;
          this.notify();
          return data;
        }
      } catch (e: any) {
        return {
          success: false,
          fileSizeKb: 0,
          lastModifiedTime: '',
          message: e.message || 'Falha no teste do servidor.'
        };
      }
    }

    if (!this.fileHandle) {
      return {
        success: false,
        fileSizeKb: 0,
        lastModifiedTime: '',
        message: 'Você conectou o banco via upload simples ou o arquivo não está conectado. Conecte usando a Opção 1 (Conectar C:\\MeusProjetos\\implantacoes.db) para habilitar gravação direta.'
      };
    }

    try {
      if (this.fileHandle.requestPermission) {
        const perm = await this.fileHandle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          return {
            success: false,
            fileSizeKb: 0,
            lastModifiedTime: '',
            message: 'O navegador não autorizou a gravação. Conceda permissão de leitura e gravação no aviso do navegador.'
          };
        }
        this.connectionState.hasDirectWriteAccess = true;
      }

      const db = await this.initDatabase();
      if (!db) throw new Error('Falha ao abrir banco');

      const testNote = `Teste de gravação em tempo real: ${new Date().toLocaleString('pt-BR')}`;
      db.run(`
        CREATE TABLE IF NOT EXISTS _diagnostico_conexao (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teste_timestamp DATETIME DEFAULT (datetime('now', 'localtime')),
          descricao TEXT
        );
      `);
      db.run("INSERT INTO _diagnostico_conexao (descricao) VALUES (?);", [testNote]);

      const binaryData = db.export();
      const writeResult = await this.writeBinaryToDisk(binaryData);

      if (!writeResult.success) {
        return {
          success: false,
          fileSizeKb: 0,
          lastModifiedTime: '',
          message: writeResult.error || 'Erro ao gravar no disco.'
        };
      }

      const fileOnDisk = await this.fileHandle.getFile();
      const sizeKb = Math.round(fileOnDisk.size / 1024);
      const modifiedTime = new Date(fileOnDisk.lastModified).toLocaleTimeString('pt-BR');

      return {
        success: true,
        fileSizeKb: sizeKb,
        lastModifiedTime: modifiedTime,
        message: `Gravação direta confirmada com sucesso em C:\\MeusProjetos\\${fileOnDisk.name}! (${sizeKb} KB gravados no disco às ${modifiedTime}).`
      };
    } catch (err: any) {
      console.error('Test disk write failed', err);
      let errMsg = err.message || 'Erro desconhecido ao tentar gravar no disco.';
      this.connectionState.lastWriteError = errMsg;
      this.notify();
      return {
        success: false,
        fileSizeKb: 0,
        lastModifiedTime: '',
        message: errMsg
      };
    }
  }

  // Auto persist to disk file if direct write access is open
  private async autoPersistToFile(): Promise<boolean> {
    if (this.activeDb && this.fileHandle && this.fileHandle.createWritable) {
      const binaryData = this.activeDb.export();
      const result = await this.writeBinaryToDisk(binaryData);
      return result.success;
    }
    return false;
  }

  // Download the SQLite .db binary file
  downloadDatabaseFile(filename = 'implantacoes.db') {
    if (!this.activeDb) return;
    const binary = this.activeDb.export();
    const blob = new Blob([new Uint8Array(binary)], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private initSchema(db: Database) {
    db.run(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS implantadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        email TEXT,
        telefone TEXT,
        cargo TEXT DEFAULT 'Implantador',
        capacidade_maxima INTEGER DEFAULT 15,
        ativo INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS demandas (
        seq INTEGER PRIMARY KEY,
        cliente_id INTEGER,
        implantador_id INTEGER REFERENCES implantadores(id),
        razao_social TEXT NOT NULL,
        tipo_demanda TEXT DEFAULT 'Nova Implantação',
        status TEXT NOT NULL DEFAULT 'Em Andamento',
        etapa_atual TEXT DEFAULT 'parametrizacao',
        data_abertura DATE,
        data_inicio DATE,
        data_previsao DATE,
        data_conclusao DATE,
        percentual_progresso INTEGER DEFAULT 0,
        bloqueado_cliente INTEGER DEFAULT 0,
        motivo_bloqueio TEXT,
        complexidade TEXT DEFAULT 'Média',
        sistema_origem TEXT DEFAULT 'Retaguarda ERP',
        retaguarda_atualizado INTEGER DEFAULT 0,
        data_retaguarda_atualizado TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS evolucoes_semanais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        demanda_seq INTEGER NOT NULL REFERENCES demandas(seq) ON DELETE CASCADE,
        implantador_id INTEGER REFERENCES implantadores(id),
        data_evolucao DATE NOT NULL DEFAULT (date('now', 'localtime')),
        percentual_progresso INTEGER,
        descricao_avanco TEXT NOT NULL,
        proxima_acao TEXT,
        tem_impedimento INTEGER DEFAULT 0,
        descricao_impedimento TEXT,
        horas_gastas REAL DEFAULT 0,
        implantador_nome TEXT,
        tempo_gasto_minutos INTEGER DEFAULT 60,
        tempo_gasto_segundos INTEGER DEFAULT 0,
        timer_duracao_formatada TEXT,
        hora_inicio TEXT,
        hora_fim TEXT,
        origem_tempo TEXT DEFAULT 'manual',
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

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
        origem_tempo TEXT DEFAULT 'manual',
        data_execucao DATE NOT NULL DEFAULT (date('now', 'localtime')),
        etapa_processo TEXT DEFAULT 'parametrizacao',
        percentual_progresso INTEGER DEFAULT 0,
        descricao_execucao TEXT NOT NULL,
        impedimento TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_acomp_demanda ON historico_acompanhamentos(demanda_seq);
      CREATE INDEX IF NOT EXISTS idx_acomp_data ON historico_acompanhamentos(data_execucao);

      CREATE TABLE IF NOT EXISTS historico_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        demanda_seq INTEGER,
        status_anterior TEXT,
        status_novo TEXT,
        motivo TEXT,
        alterado_por TEXT DEFAULT 'Sistema',
        data_alteracao DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS contact_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES demandas(seq) ON DELETE CASCADE,
        status TEXT NOT NULL,
        user_id TEXT,
        notes TEXT,
        contacted_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_contact_inter_contact_id ON contact_interactions(contact_id);
      CREATE INDEX IF NOT EXISTS idx_contact_inter_contacted_at ON contact_interactions(contacted_at);

      CREATE TABLE IF NOT EXISTS retaguarda_api_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        implantacao_seq INTEGER,
        endpoint TEXT NOT NULL,
        metodo TEXT DEFAULT 'POST',
        http_status INTEGER,
        erro_codigo INTEGER,
        descricao TEXT,
        resumo_enviado TEXT,
        duracao_ms INTEGER,
        origem_ip TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_retaguarda_logs_seq ON retaguarda_api_logs(implantacao_seq);
      CREATE INDEX IF NOT EXISTS idx_retaguarda_logs_created ON retaguarda_api_logs(created_at);

      DELETE FROM evolucoes_semanais 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM evolucoes_semanais 
        GROUP BY demanda_seq, data_evolucao, descricao_avanco
      );
    `);

    // Ensure new columns exist on preexisting SQLite databases
    try {
      const infoRes = db.exec("PRAGMA table_info(evolucoes_semanais);");
      if (infoRes.length > 0 && infoRes[0].values) {
        const colNames = infoRes[0].values.map(r => String(r[1]));
        if (!colNames.includes('horas_gastas')) {
          try { db.run("ALTER TABLE evolucoes_semanais ADD COLUMN horas_gastas REAL DEFAULT 0;"); } catch (e) {}
        }
        if (!colNames.includes('implantador_nome')) {
          try { db.run("ALTER TABLE evolucoes_semanais ADD COLUMN implantador_nome TEXT;"); } catch (e) {}
        }
        if (!colNames.includes('tempo_gasto_minutos')) {
          try { db.run("ALTER TABLE evolucoes_semanais ADD COLUMN tempo_gasto_minutos INTEGER DEFAULT 60;"); } catch (e) {}
        }
        if (!colNames.includes('tempo_gasto_segundos')) {
          try { db.run("ALTER TABLE evolucoes_semanais ADD COLUMN tempo_gasto_segundos INTEGER DEFAULT 0;"); } catch (e) {}
        }
        if (!colNames.includes('timer_duracao_formatada')) {
          try { db.run("ALTER TABLE evolucoes_semanais ADD COLUMN timer_duracao_formatada TEXT;"); } catch (e) {}
        }
        if (!colNames.includes('hora_inicio')) {
          try { db.run("ALTER TABLE evolucoes_semanais ADD COLUMN hora_inicio TEXT;"); } catch (e) {}
        }
        if (!colNames.includes('hora_fim')) {
          try { db.run("ALTER TABLE evolucoes_semanais ADD COLUMN hora_fim TEXT;"); } catch (e) {}
        }
        if (!colNames.includes('origem_tempo')) {
          try { db.run("ALTER TABLE evolucoes_semanais ADD COLUMN origem_tempo TEXT DEFAULT 'manual';"); } catch (e) {}
        }
      }

      const acompCols = db.exec("PRAGMA table_info(historico_acompanhamentos);");
      if (acompCols.length > 0 && acompCols[0].values) {
        const colNames = acompCols[0].values.map(r => String(r[1]));
        if (!colNames.includes('implantador_nome')) {
          try { db.run("ALTER TABLE historico_acompanhamentos ADD COLUMN implantador_nome TEXT NOT NULL DEFAULT 'Não Atribuído';"); } catch (e) {}
        }
        if (!colNames.includes('tempo_gasto_horas')) {
          try { db.run("ALTER TABLE historico_acompanhamentos ADD COLUMN tempo_gasto_horas REAL NOT NULL DEFAULT 1.0;"); } catch (e) {}
        }
        if (!colNames.includes('tempo_gasto_minutos')) {
          try { db.run("ALTER TABLE historico_acompanhamentos ADD COLUMN tempo_gasto_minutos INTEGER DEFAULT 60;"); } catch (e) {}
        }
        if (!colNames.includes('tempo_gasto_segundos')) {
          try { db.run("ALTER TABLE historico_acompanhamentos ADD COLUMN tempo_gasto_segundos INTEGER DEFAULT 0;"); } catch (e) {}
        }
        if (!colNames.includes('timer_duracao_formatada')) {
          try { db.run("ALTER TABLE historico_acompanhamentos ADD COLUMN timer_duracao_formatada TEXT;"); } catch (e) {}
        }
        if (!colNames.includes('is_cronometro')) {
          try { db.run("ALTER TABLE historico_acompanhamentos ADD COLUMN is_cronometro INTEGER DEFAULT 0;"); } catch (e) {}
        }
        if (!colNames.includes('hora_inicio')) {
          try { db.run("ALTER TABLE historico_acompanhamentos ADD COLUMN hora_inicio TEXT;"); } catch (e) {}
        }
        if (!colNames.includes('hora_fim')) {
          try { db.run("ALTER TABLE historico_acompanhamentos ADD COLUMN hora_fim TEXT;"); } catch (e) {}
        }
        if (!colNames.includes('origem_tempo')) {
          try { db.run("ALTER TABLE historico_acompanhamentos ADD COLUMN origem_tempo TEXT DEFAULT 'manual';"); } catch (e) {}
        }
      }

      // Ensure retaguarda columns exist on preexisting SQLite databases for demandas
      try {
        const demCols = db.exec("PRAGMA table_info(demandas);");
        if (demCols.length > 0 && demCols[0].values) {
          const colNames = demCols[0].values.map(r => String(r[1]));
          if (!colNames.includes('retaguarda_atualizado')) {
            try { db.run("ALTER TABLE demandas ADD COLUMN retaguarda_atualizado INTEGER DEFAULT 0;"); } catch (e) {}
          }
          if (!colNames.includes('data_retaguarda_atualizado')) {
            try { db.run("ALTER TABLE demandas ADD COLUMN data_retaguarda_atualizado TEXT;"); } catch (e) {}
          }
        }
      } catch (e) {}

      try {
        db.run("CREATE INDEX IF NOT EXISTS idx_acomp_implantador ON historico_acompanhamentos(implantador_nome);");
      } catch (e) {}
      try {
        db.run("CREATE INDEX IF NOT EXISTS idx_acomp_origem ON historico_acompanhamentos(origem_tempo);");
      } catch (e) {}
    } catch (e) {}

    // Populate historico_acompanhamentos from evolucoes_semanais if empty
    try {
      const countCheck = db.exec("SELECT COUNT(*) FROM historico_acompanhamentos;");
      const countAcomp = countCheck.length > 0 && countCheck[0].values.length > 0 ? Number(countCheck[0].values[0][0]) : 0;
      if (countAcomp === 0) {
        db.run(`
          INSERT INTO historico_acompanhamentos (
            demanda_seq, implantador_id, implantador_nome, tempo_gasto_horas,
            data_execucao, etapa_processo, percentual_progresso, descricao_execucao,
            impedimento, created_at
          )
          SELECT 
            e.demanda_seq,
            e.implantador_id,
            COALESCE(NULLIF(TRIM(e.implantador_nome), ''), i.nome, 'Não Atribuído'),
            COALESCE(e.horas_gastas, 1.0),
            e.data_evolucao,
            'parametrizacao',
            COALESCE(e.percentual_progresso, 0),
            e.descricao_avanco,
            e.descricao_impedimento,
            e.created_at
          FROM evolucoes_semanais e
          LEFT JOIN implantadores i ON e.implantador_id = i.id;
        `);
      }
    } catch (e) {}
  }
}

export const sqliteService = new SqliteService();
