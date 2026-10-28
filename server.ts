import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

const DEFAULT_RETAGUARDA_TOKEN = '255f339afa5102fe6eb2c3ee46fb4b6b4d2aef2350fa5e45efc2e5044e46c58a120514e4f024e468801b93a25a4ccbe8e2477efe7cf110bd43a269accd5914dc423f95347dd1910d5ad007d166ea7c6642365527dcaaa68e93a5cca944a827af1cbd62838cf012c29e78576d435e419720efdc1e1176728154107d730b8b2c2b';

function getRetaguardaToken(req?: Request): string {
  let token = (
    process.env.RETAGUARDA_API_TOKEN || 
    (req && (req.headers['token'] || req.headers['x-retaguarda-token'] || req.body?.token)) || 
    ''
  ).toString().trim();

  // If not in env, check .env file directly if exists
  if (!token || token === 'SEU_TOKEN_DE_ACESSO_RETAGUARDA') {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/RETAGUARDA_API_TOKEN=["']?([^"'\r\n]+)["']?/);
        if (match && match[1] && match[1] !== 'SEU_TOKEN_DE_ACESSO_RETAGUARDA') {
          token = match[1].trim();
        }
      }
    } catch (e) {}
  }

  // Fallback to active valid token if still empty
  if (!token || token === 'SEU_TOKEN_DE_ACESSO_RETAGUARDA') {
    token = DEFAULT_RETAGUARDA_TOKEN;
  }

  return token;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '50mb' }));

// Determine database path
function getDatabaseFilePath(): string {
  if (process.env.SQLITE_DB_PATH) {
    return process.env.SQLITE_DB_PATH;
  }
  // If running on Windows with C:\MeusProjetos
  if (process.platform === 'win32' || fs.existsSync('C:\\MeusProjetos') || fs.existsSync('C:/MeusProjetos')) {
    const winDir = fs.existsSync('C:/MeusProjetos') ? 'C:/MeusProjetos' : 'C:\\MeusProjetos';
    if (!fs.existsSync(winDir)) {
      try {
        fs.mkdirSync(winDir, { recursive: true });
      } catch (e) {}
    }
    return path.join(winDir, 'implantacoes.db');
  }
  // Default to local project folder
  return path.resolve(process.cwd(), 'implantacoes.db');
}

const DB_FILE_PATH = getDatabaseFilePath();
let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

// Get local network IPs (e.g. 192.168.1.X) so other PCs can connect
function getLocalNetworkIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address);
        }
      }
    }
  }
  return ips;
}

// Initialize SQLite Schema
function initSchema(database: Database) {
  database.run(`
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

    CREATE TABLE IF NOT EXISTS _diagnostico_conexao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teste_timestamp DATETIME DEFAULT (datetime('now', 'localtime')),
      descricao TEXT,
      origem_ip TEXT
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
  `);

  // Ensure new columns exist on preexisting SQLite databases for evolucoes_semanais
  try {
    const infoRes = database.exec("PRAGMA table_info(evolucoes_semanais);");
    if (infoRes.length > 0 && infoRes[0].values) {
      const colNames = infoRes[0].values.map(r => String(r[1]));
      if (!colNames.includes('horas_gastas')) {
        try { database.run("ALTER TABLE evolucoes_semanais ADD COLUMN horas_gastas REAL DEFAULT 0;"); } catch (e) {}
      }
      if (!colNames.includes('implantador_nome')) {
        try { database.run("ALTER TABLE evolucoes_semanais ADD COLUMN implantador_nome TEXT;"); } catch (e) {}
      }
      if (!colNames.includes('tempo_gasto_minutos')) {
        try { database.run("ALTER TABLE evolucoes_semanais ADD COLUMN tempo_gasto_minutos INTEGER DEFAULT 60;"); } catch (e) {}
      }
      if (!colNames.includes('tempo_gasto_segundos')) {
        try { database.run("ALTER TABLE evolucoes_semanais ADD COLUMN tempo_gasto_segundos INTEGER DEFAULT 0;"); } catch (e) {}
      }
      if (!colNames.includes('timer_duracao_formatada')) {
        try { database.run("ALTER TABLE evolucoes_semanais ADD COLUMN timer_duracao_formatada TEXT;"); } catch (e) {}
      }
      if (!colNames.includes('hora_inicio')) {
        try { database.run("ALTER TABLE evolucoes_semanais ADD COLUMN hora_inicio TEXT;"); } catch (e) {}
      }
      if (!colNames.includes('hora_fim')) {
        try { database.run("ALTER TABLE evolucoes_semanais ADD COLUMN hora_fim TEXT;"); } catch (e) {}
      }
      if (!colNames.includes('origem_tempo')) {
        try { database.run("ALTER TABLE evolucoes_semanais ADD COLUMN origem_tempo TEXT DEFAULT 'manual';"); } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Migration evolucoes_semanais check:', e);
  }

  // Ensure retaguarda columns exist on preexisting SQLite databases for demandas
  try {
    const demCols = database.exec("PRAGMA table_info(demandas);");
    if (demCols.length > 0 && demCols[0].values) {
      const colNames = demCols[0].values.map(r => String(r[1]));
      if (!colNames.includes('retaguarda_atualizado')) {
        try { database.run("ALTER TABLE demandas ADD COLUMN retaguarda_atualizado INTEGER DEFAULT 0;"); } catch (e) {}
      }
      if (!colNames.includes('data_retaguarda_atualizado')) {
        try { database.run("ALTER TABLE demandas ADD COLUMN data_retaguarda_atualizado TEXT;"); } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Migration demandas check:', e);
  }

  // Ensure new timer & minutes columns exist on preexisting historico_acompanhamentos
  try {
    const acompCols = database.exec("PRAGMA table_info(historico_acompanhamentos);");
    if (acompCols.length > 0 && acompCols[0].values) {
      const colNames = acompCols[0].values.map(r => String(r[1]));
      if (!colNames.includes('implantador_nome')) {
        try { database.run("ALTER TABLE historico_acompanhamentos ADD COLUMN implantador_nome TEXT NOT NULL DEFAULT 'Não Atribuído';"); } catch (e) {}
      }
      if (!colNames.includes('tempo_gasto_horas')) {
        try { database.run("ALTER TABLE historico_acompanhamentos ADD COLUMN tempo_gasto_horas REAL NOT NULL DEFAULT 1.0;"); } catch (e) {}
      }
      if (!colNames.includes('tempo_gasto_minutos')) {
        try { database.run("ALTER TABLE historico_acompanhamentos ADD COLUMN tempo_gasto_minutos INTEGER DEFAULT 60;"); } catch (e) {}
      }
      if (!colNames.includes('tempo_gasto_segundos')) {
        try { database.run("ALTER TABLE historico_acompanhamentos ADD COLUMN tempo_gasto_segundos INTEGER DEFAULT 0;"); } catch (e) {}
      }
      if (!colNames.includes('timer_duracao_formatada')) {
        try { database.run("ALTER TABLE historico_acompanhamentos ADD COLUMN timer_duracao_formatada TEXT;"); } catch (e) {}
      }
      if (!colNames.includes('is_cronometro')) {
        try { database.run("ALTER TABLE historico_acompanhamentos ADD COLUMN is_cronometro INTEGER DEFAULT 0;"); } catch (e) {}
      }
      if (!colNames.includes('hora_inicio')) {
        try { database.run("ALTER TABLE historico_acompanhamentos ADD COLUMN hora_inicio TEXT;"); } catch (e) {}
      }
      if (!colNames.includes('hora_fim')) {
        try { database.run("ALTER TABLE historico_acompanhamentos ADD COLUMN hora_fim TEXT;"); } catch (e) {}
      }
      if (!colNames.includes('origem_tempo')) {
        try { database.run("ALTER TABLE historico_acompanhamentos ADD COLUMN origem_tempo TEXT DEFAULT 'manual';"); } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Migration historico_acompanhamentos check:', e);
  }

  // Safely create indexes on migrated columns AFTER ALTER TABLE has run
  try {
    database.run("CREATE INDEX IF NOT EXISTS idx_acomp_implantador ON historico_acompanhamentos(implantador_nome);");
  } catch (e) {}
  try {
    database.run("CREATE INDEX IF NOT EXISTS idx_acomp_origem ON historico_acompanhamentos(origem_tempo);");
  } catch (e) {}

  // Populate historico_acompanhamentos from evolucoes_semanais if empty
  try {
    const countCheck = database.exec("SELECT COUNT(*) FROM historico_acompanhamentos;");
    const countAcomp = countCheck.length > 0 && countCheck[0].values.length > 0 ? Number(countCheck[0].values[0][0]) : 0;
    if (countAcomp === 0) {
      database.run(`
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
  } catch (e) {
    console.warn('Sync historico_acompanhamentos initial populate:', e);
  }

  // Remove any preexisting duplicates from evolucoes_semanais
  try {
    database.run(`
      DELETE FROM evolucoes_semanais 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM evolucoes_semanais 
        GROUP BY demanda_seq, data_evolucao, descricao_avanco
      );
    `);
  } catch (e) {}
}

// Save in-memory SQLite database back to disk
function saveDbToDisk() {
  if (!db) return;
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    fs.writeFileSync(DB_FILE_PATH, Buffer.from(data));
  } catch (err) {
    console.error('Failed to save SQLite file to disk:', err);
  }
}

// Load or create SQLite database on server startup
async function getOrInitDb(): Promise<Database> {
  if (db) return db;
  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      db = new SQL.Database(fileBuffer);
      initSchema(db);
      console.log('✓ Banco SQLite carregado e schema verificado com sucesso:', DB_FILE_PATH);
    } catch (e) {
      console.warn('Aviso ao inicializar schema no banco existente:', e);
      if (!db) {
        db = new SQL.Database();
      }
      try {
        initSchema(db);
      } catch (err2) {
        console.error('Falha secundária no schema:', err2);
      }
    }
  } else {
    db = new SQL.Database();
    initSchema(db);
    saveDbToDisk();
  }

  return db;
}

// ======================== API ROUTES ========================

// 1. Network & Status Info
app.get('/api/network-info', (req: Request, res: Response) => {
  const ips = getLocalNetworkIps();
  const fileExists = fs.existsSync(DB_FILE_PATH);
  let fileSize = 0;
  let mtime = '';
  if (fileExists) {
    try {
      const stat = fs.statSync(DB_FILE_PATH);
      fileSize = Math.round(stat.size / 1024);
      mtime = stat.mtime.toLocaleString('pt-BR');
    } catch (e) {}
  }

  res.json({
    port: PORT,
    localIps: ips,
    accessUrls: ips.map(ip => `http://${ip}:${PORT}`),
    dbFilePath: DB_FILE_PATH,
    fileExists,
    fileSizeKb: fileSize,
    lastModified: mtime,
  });
});

// 2. Database Status
app.get('/api/db/status', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
    const tablesRes = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const tables = tablesRes.length > 0 && tablesRes[0].values ? tablesRes[0].values.map(r => String(r[0])) : [];

    let totalDemands = 0;
    try {
      const countRes = database.exec("SELECT COUNT(*) FROM demandas;");
      if (countRes.length > 0 && countRes[0].values.length > 0) {
        totalDemands = Number(countRes[0].values[0][0]) || 0;
      }
    } catch (e) {}

    let totalTeam = 0;
    try {
      const teamRes = database.exec("SELECT COUNT(*) FROM implantadores WHERE ativo = 1;");
      if (teamRes.length > 0 && teamRes[0].values.length > 0) {
        totalTeam = Number(teamRes[0].values[0][0]) || 0;
      }
    } catch (e) {}

    const stat = fs.existsSync(DB_FILE_PATH) ? fs.statSync(DB_FILE_PATH) : null;

    res.json({
      connected: true,
      dbFilePath: DB_FILE_PATH,
      fileName: path.basename(DB_FILE_PATH),
      tables,
      totalDemands,
      totalTeamMembers: totalTeam,
      fileSizeKb: stat ? Math.round(stat.size / 1024) : 0,
      lastModified: stat ? stat.mtime.toISOString() : null,
      serverTime: new Date().toLocaleTimeString('pt-BR')
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get All Demands
app.get('/api/db/demands', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
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
    const resSql = database.exec(query);
    const demands: any[] = [];

    if (resSql.length > 0 && resSql[0].values) {
      const cols = resSql[0].columns;
      const rows = resSql[0].values;

      rows.forEach((row) => {
        const rowObj: Record<string, any> = {};
        cols.forEach((col, idx) => {
          rowObj[col] = row[idx];
        });

        demands.push({
          seq: Number(rowObj.seq) || 0,
          razaoSocial: String(rowObj.razao_social || `Cliente #${rowObj.seq}`),
          clienteId: String(rowObj.cliente_id || rowObj.seq || ''),
          implantador: String(rowObj.nome_implantador || 'Não Atribuído'),
          status: rowObj.status || 'Em Andamento',
          tipo: rowObj.tipo_demanda || 'Nova Implantação',
          prevInicio: rowObj.data_inicio ? String(rowObj.data_inicio) : '',
          prevFim: rowObj.data_previsao ? String(rowObj.data_previsao) : '',
          conclusao: rowObj.data_conclusao ? String(rowObj.data_conclusao) : '',
          comercial: 'Retaguarda',
          hrsNeg: 20,
          pessoasTreinar: 3,
          totModulos: 5,
          currentStage: rowObj.etapa_atual || 'parametrizacao',
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
        });
      });
    }

    // Attach check-ins
    try {
      const evolucoesRes = database.exec(`
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
        evolucoesRes[0].values.forEach(erow => {
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
    } catch (e) {}

    // Attach latest contact interaction from contact_interactions
    try {
      const interRes = database.exec(`
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
    } catch (e) {}

    res.json(demands);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Save Single Demand
app.post('/api/db/demands', async (req: Request, res: Response) => {
  try {
    const { demand, auditSummary } = req.body;
    if (!demand || !demand.seq) {
      return res.status(400).json({ error: 'Demand data is required' });
    }

    const database = await getOrInitDb();

    // Find or create implantador
    let implantadorId: number | null = null;
    if (demand.implantador && demand.implantador !== 'Não Atribuído') {
      const resImp = database.exec("SELECT id FROM implantadores WHERE nome = ?;", [demand.implantador]);
      if (resImp.length > 0 && resImp[0].values.length > 0) {
        implantadorId = Number(resImp[0].values[0][0]);
      } else {
        database.run("INSERT INTO implantadores (nome, cargo) VALUES (?, 'Especialista de Implantação');", [demand.implantador]);
        const idRes = database.exec("SELECT last_insert_rowid();");
        if (idRes.length > 0 && idRes[0].values.length > 0) {
          implantadorId = Number(idRes[0].values[0][0]);
        }
      }
    }

    // Upsert demand
    database.run(`
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
      demand.status || 'Em Andamento',
      demand.tipo || 'Nova Implantação',
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

    // Save check-in ONLY if explicitly requested via newCheckIn payload
    const { newCheckIn } = req.body;
    if (newCheckIn && newCheckIn.note) {
      const dateVal = newCheckIn.date || new Date().toISOString().split('T')[0];
      const noteVal = String(newCheckIn.note).trim();
      const executanteNome = newCheckIn.implantador || demand.implantador || 'Não Atribuído';
      
      let segundosVal = Number(newCheckIn.tempoGastoSegundos) || (Number(newCheckIn.minutosGastos) ? Number(newCheckIn.minutosGastos) * 60 : 0);
      let minutosVal = Number(newCheckIn.minutosGastos) || Math.max(1, Math.round(segundosVal / 60)) || 60;
      let horasVal = Number(newCheckIn.horasGastas) || Math.round((minutosVal / 60) * 100) / 100;
      const hInicio = newCheckIn.horaInicio ? String(newCheckIn.horaInicio) : null;
      const hFim = newCheckIn.horaFim ? String(newCheckIn.horaFim) : null;
      const origTempo = newCheckIn.origemTempo ? String(newCheckIn.origemTempo) : (hInicio ? 'cronometro' : 'manual');
      const isCron = origTempo === 'cronometro' ? 1 : 0;
      const duracaoFmt = newCheckIn.duracaoFormatada || (segundosVal > 0 ? `${Math.floor(segundosVal / 60)}m ${segundosVal % 60}s` : `${minutosVal} min`);

      // Find or create implantador for the executante
      let executanteId = implantadorId;
      if (executanteNome && executanteNome !== 'Não Atribuído') {
        const resExec = database.exec("SELECT id FROM implantadores WHERE nome = ?;", [executanteNome]);
        if (resExec.length > 0 && resExec[0].values.length > 0) {
          executanteId = Number(resExec[0].values[0][0]);
        } else {
          database.run("INSERT INTO implantadores (nome, cargo) VALUES (?, 'Especialista de Implantação');", [executanteNome]);
          const idRes = database.exec("SELECT last_insert_rowid();");
          if (idRes.length > 0 && idRes[0].values.length > 0) {
            executanteId = Number(idRes[0].values[0][0]);
          }
        }
      }

      // Check if this exact check-in is already in historico_acompanhamentos
      const checkRes = database.exec(`
        SELECT id FROM historico_acompanhamentos 
        WHERE demanda_seq = ? 
          AND data_execucao = ? 
          AND descricao_execucao = ?
        LIMIT 1;
      `, [demand.seq, dateVal, noteVal]);

      const alreadyExists = checkRes.length > 0 && checkRes[0].values && checkRes[0].values.length > 0;

      if (!alreadyExists) {
        database.run(`
          INSERT INTO historico_acompanhamentos (
            demanda_seq, implantador_id, implantador_nome, tempo_gasto_minutos, tempo_gasto_horas,
            tempo_gasto_segundos, timer_duracao_formatada, is_cronometro,
            hora_inicio, hora_fim, origem_tempo,
            data_execucao, etapa_processo, percentual_progresso, descricao_execucao, impedimento
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          demand.seq,
          executanteId,
          executanteNome,
          minutosVal,
          horasVal,
          segundosVal,
          duracaoFmt,
          isCron,
          hInicio,
          hFim,
          origTempo,
          dateVal,
          demand.currentStage || 'parametrizacao',
          newCheckIn.progressPercent || demand.progressPercent || 0,
          noteVal,
          newCheckIn.blocker || null
        ]);

        database.run(`
          INSERT INTO evolucoes_semanais (
            demanda_seq, implantador_id, data_evolucao, percentual_progresso, 
            descricao_avanco, descricao_impedimento, horas_gastas, implantador_nome,
            tempo_gasto_minutos, tempo_gasto_segundos, timer_duracao_formatada,
            hora_inicio, hora_fim, origem_tempo
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
          demand.seq,
          executanteId,
          dateVal,
          newCheckIn.progressPercent || demand.progressPercent || 0,
          noteVal,
          newCheckIn.blocker || null,
          horasVal,
          executanteNome,
          minutosVal,
          segundosVal,
          duracaoFmt,
          hInicio,
          hFim,
          origTempo
        ]);
      }
    }

    // Audit log
    if (auditSummary) {
      database.run(`
        INSERT INTO historico_status (demanda_seq, status_anterior, status_novo, motivo, alterado_por)
        VALUES (?, ?, ?, ?, ?);
      `, [
        demand.seq,
        'edit_details',
        auditSummary,
        demand.razaoSocial,
        demand.implantador || 'Operador Rede'
      ]);
    }

    saveDbToDisk();
    res.json({ success: true, savedAt: new Date().toLocaleTimeString('pt-BR') });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle Retaguarda Updated Status (Marcador Temporário - Futuramente via API)
app.post('/api/db/demands/toggle-retaguarda', async (req: Request, res: Response) => {
  try {
    const { seq, status } = req.body;
    if (!seq) {
      return res.status(400).json({ error: 'seq é obrigatório' });
    }

    const database = await getOrInitDb();
    let updatedVal: number;
    let dataAtualizado: string | null;

    if (status !== undefined) {
      updatedVal = status ? 1 : 0;
      dataAtualizado = status ? new Date().toISOString() : null;
    } else {
      const cur = database.exec("SELECT retaguarda_atualizado FROM demandas WHERE seq = ?;", [seq]);
      const currentVal = cur.length > 0 && cur[0].values.length > 0 ? Number(cur[0].values[0][0]) : 0;
      updatedVal = currentVal === 1 ? 0 : 1;
      dataAtualizado = updatedVal === 1 ? new Date().toISOString() : null;
    }

    database.run(
      "UPDATE demandas SET retaguarda_atualizado = ?, data_retaguarda_atualizado = ?, updated_at = datetime('now', 'localtime') WHERE seq = ?;",
      [updatedVal, dataAtualizado, seq]
    );

    // Audit log
    database.run(`
      INSERT INTO historico_status (demanda_seq, status_anterior, status_novo, motivo, alterado_por)
      VALUES (?, ?, ?, ?, ?);
    `, [
      seq,
      'retaguarda_sync',
      updatedVal === 1 ? 'Retaguarda Marcado como Atualizado' : 'Retaguarda Desmarcado (Pendente)',
      'Marcador temporário de atualização no ERP Retaguarda',
      'Operador'
    ]);

    saveDbToDisk();
    res.json({
      success: true,
      seq,
      retaguardaAtualizado: updatedVal === 1,
      dataRetaguardaAtualizado: dataAtualizado
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 14. API OFICIAL RETAGUARDA ERP - Gravar Resumo Final & Monitoramento
// Endpoint: https://api64.erpgestao.com.br/retaguardanew/rest/api_sgo/gravaresumofinal
// ========================================================

// Status das credenciais e endpoint
app.get('/api/retaguarda/status', (req: Request, res: Response) => {
  const token = getRetaguardaToken(req);
  const configured = Boolean(token && token.trim().length > 0 && token !== 'SEU_TOKEN_DE_ACESSO_RETAGUARDA');
  const endpoint = process.env.RETAGUARDA_API_URL || 'https://api64.erpgestao.com.br/retaguardanew/rest/api_sgo/gravaresumofinal';
  res.json({
    configured,
    endpoint,
    maskedToken: configured ? `${token.slice(0, 4)}...${token.slice(-4)}` : null,
    serverTime: new Date().toISOString()
  });
});

// Teste de conexão ativo em tempo real
app.post('/api/retaguarda/test-connection', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const token = getRetaguardaToken(req);
  const targetUrl = process.env.RETAGUARDA_API_URL || 'https://api64.erpgestao.com.br/retaguardanew/rest/api_sgo/gravaresumofinal';
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').toString();

  console.log(`[API RETAGUARDA 📡] [${new Date().toLocaleTimeString('pt-BR')}] Executando teste de conexão em tempo real...`);

  if (!token || token === 'SEU_TOKEN_DE_ACESSO_RETAGUARDA') {
    const durationMs = Date.now() - startTime;
    console.log(`[API RETAGUARDA ⚠️] [${new Date().toLocaleTimeString('pt-BR')}] Teste falhou: Token ausente no servidor local.`);
    return res.status(401).json({
      online: false,
      authenticated: false,
      durationMs,
      statusCode: 401,
      erro: 9,
      mensagem: 'Token de acesso não configurado no servidor (RETAGUARDA_API_TOKEN no arquivo .env).'
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Token': token
      },
      body: JSON.stringify({
        ImplantacaoSeq: 0,
        ImplantacaoResumoFinal: '[TESTE_DIAGNOSTICO_CONEXAO_AUTOMATICO]'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const result: any = await apiResponse.json().catch(() => null);

    let authenticated = false;
    let mensagemStatus = '';

    if (result && result.Erro === 2) {
      // Erro 2 = Implantação 0 não encontrada. Significa que o TOKEN É VÁLIDO e a API respondeu!
      authenticated = true;
      mensagemStatus = 'Conexão e Autenticação bem-sucedidas! A API do ERP respondeu perfeitamente e validou seu Token.';
      console.log(`[API RETAGUARDA ✅] [${new Date().toLocaleTimeString('pt-BR')}] Teste OK! Conexão ativa, Token autenticado. Latência: ${durationMs}ms`);
    } else if (result && result.Erro === 9) {
      // Erro 9 = Token inválido
      authenticated = false;
      mensagemStatus = 'API alcançada, porém o Token de acesso informado foi rejeitado pelo ERP.';
      console.log(`[API RETAGUARDA ❌] [${new Date().toLocaleTimeString('pt-BR')}] Teste: Token rejeitado pelo ERP (Erro: 9). Latência: ${durationMs}ms`);
    } else if (result) {
      mensagemStatus = result.Descricao || `Código retornado: Erro ${result.Erro}`;
    }

    // Persistir tentativa de teste no log do SQLite
    try {
      const database = await getOrInitDb();
      database.run(`
        INSERT INTO retaguarda_api_logs (
          implantacao_seq, endpoint, metodo, http_status, erro_codigo, descricao, resumo_enviado, duracao_ms, origem_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        0,
        targetUrl,
        'POST',
        apiResponse.status,
        result ? Number(result.Erro) : null,
        `[TESTE CONEXÃO] ${mensagemStatus}`,
        '[TESTE_DIAGNOSTICO_CONEXAO_AUTOMATICO]',
        durationMs,
        clientIp
      ]);
      saveDbToDisk();
    } catch (e) {}

    return res.json({
      online: true,
      authenticated,
      durationMs,
      statusCode: apiResponse.status,
      erro: result ? result.Erro : null,
      mensagem: mensagemStatus,
      rawResult: result
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';
    const errorMsg = isTimeout 
      ? 'Tempo limite excedido ao contatar api64.erpgestao.com.br (Timeout 10s). Verifique sua internet ou firewall.' 
      : `Falha de rede/DNS no PC ao conectar com ERP: ${err.message}`;

    console.log(`[API RETAGUARDA ❌] [${new Date().toLocaleTimeString('pt-BR')}] Teste Falhou: ${errorMsg}`);

    try {
      const database = await getOrInitDb();
      database.run(`
        INSERT INTO retaguarda_api_logs (
          implantacao_seq, endpoint, metodo, http_status, erro_codigo, descricao, resumo_enviado, duracao_ms, origem_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        0,
        targetUrl,
        'POST',
        isTimeout ? 408 : 500,
        500,
        `[FALHA REDE/TESTE] ${errorMsg}`,
        '[TESTE_DIAGNOSTICO_CONEXAO_AUTOMATICO]',
        durationMs,
        clientIp
      ]);
      saveDbToDisk();
    } catch (e) {}

    return res.status(500).json({
      online: false,
      authenticated: false,
      durationMs,
      statusCode: isTimeout ? 408 : 500,
      erro: 500,
      mensagem: errorMsg
    });
  }
});

// Envio real de Resumo Final para a API da Retaguarda
app.post('/api/retaguarda/gravaresumofinal', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').toString();
  const seq = Number(req.body.ImplantacaoSeq || req.body.seq);
  const resumoFinal = String(req.body.ImplantacaoResumoFinal || req.body.resumoFinal || '').trim();
  const token = getRetaguardaToken(req);
  const targetUrl = process.env.RETAGUARDA_API_URL || 'https://api64.erpgestao.com.br/retaguardanew/rest/api_sgo/gravaresumofinal';

  console.log(`\n=======================================================`);
  console.log(`[API RETAGUARDA 📡] [${new Date().toLocaleTimeString('pt-BR')}] Disparo para Implantação #${seq}`);
  console.log(`[API RETAGUARDA 📝] Texto (${resumoFinal.length} carac.): "${resumoFinal.slice(0, 120)}${resumoFinal.length > 120 ? '...' : ''}"`);
  console.log(`[API RETAGUARDA 🌐] IP Origem: ${clientIp} | Destino: ${targetUrl}`);

  if (!seq) {
    console.log(`[API RETAGUARDA ❌] Erro 2: Código seq ausente ou inválido.`);
    return res.status(400).json({
      Erro: 2,
      Descricao: 'O código ImplantacaoSeq é obrigatório e deve ser numérico.'
    });
  }

  if (!resumoFinal) {
    console.log(`[API RETAGUARDA ❌] Erro 1: Resumo final em branco.`);
    return res.status(400).json({
      Erro: 1,
      Descricao: 'O conteúdo de ImplantacaoResumoFinal não pode ser vazio.'
    });
  }

  if (!token || token === 'SEU_TOKEN_DE_ACESSO_RETAGUARDA') {
    console.log(`[API RETAGUARDA ❌] Erro 9: Token não configurado no servidor.`);
    return res.status(401).json({
      Erro: 9,
      Descricao: 'Token de acesso não configurado no servidor. Configure a variável RETAGUARDA_API_TOKEN no ambiente.'
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const apiResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Token': token
      },
      body: JSON.stringify({
        ImplantacaoSeq: seq,
        ImplantacaoResumoFinal: resumoFinal
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const result: any = await apiResponse.json().catch(() => null);

    if (!result) {
      console.log(`[API RETAGUARDA ❌] HTTP ${apiResponse.status} - Resposta inválida do ERP (${durationMs}ms)`);
      
      // Registrar log no banco SQLite
      try {
        const database = await getOrInitDb();
        database.run(`
          INSERT INTO retaguarda_api_logs (
            implantacao_seq, endpoint, metodo, http_status, erro_codigo, descricao, resumo_enviado, duracao_ms, origem_ip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [seq, targetUrl, 'POST', apiResponse.status, 502, `Resposta inválida (HTTP ${apiResponse.status})`, resumoFinal, durationMs, clientIp]);
        saveDbToDisk();
      } catch (e) {}

      return res.status(502).json({
        Erro: 502,
        Descricao: `Resposta inválida do servidor da Retaguarda (HTTP ${apiResponse.status})`
      });
    }

    console.log(`[API RETAGUARDA ${result.Erro === 0 ? '✅ SUCESSO' : '⚠️ RETORNO'}] Erro: ${result.Erro} - "${result.Descricao}" (HTTP ${apiResponse.status}, ${durationMs}ms)`);
    console.log(`=======================================================\n`);

    // Gravar no log do SQLite
    try {
      const database = await getOrInitDb();
      database.run(`
        INSERT INTO retaguarda_api_logs (
          implantacao_seq, endpoint, metodo, http_status, erro_codigo, descricao, resumo_enviado, duracao_ms, origem_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        seq,
        targetUrl,
        'POST',
        apiResponse.status,
        result.Erro !== undefined ? Number(result.Erro) : null,
        result.Descricao || '',
        resumoFinal,
        durationMs,
        clientIp
      ]);

      // Se a gravação foi bem-sucedida (Erro: 0), atualiza a demanda local no SQLite
      if (result.Erro === 0) {
        const nowIso = new Date().toISOString();
        database.run(
          "UPDATE demandas SET retaguarda_atualizado = 1, data_retaguarda_atualizado = ?, updated_at = datetime('now', 'localtime') WHERE seq = ?;",
          [nowIso, seq]
        );

        // Audit log
        database.run(`
          INSERT INTO historico_status (demanda_seq, status_anterior, status_novo, motivo, alterado_por)
          VALUES (?, ?, ?, ?, ?);
        `, [
          seq,
          'retaguarda_api_sync',
          'Resumo Final Gravado no ERP',
          `Gravado via API oficial da Retaguarda: "${resumoFinal.slice(0, 100)}${resumoFinal.length > 100 ? '...' : ''}"`,
          req.body.author || 'API Retaguarda'
        ]);
      }

      saveDbToDisk();
    } catch (dbErr) {
      console.warn('Erro ao atualizar SQLite local após API Retaguarda', dbErr);
    }

    return res.json(result);
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';
    const errorMsg = isTimeout 
      ? 'Tempo limite esgotado ao enviar para Retaguarda ERP (15s)' 
      : `Falha na requisição com a API da Retaguarda: ${err.message}`;

    console.error(`[API RETAGUARDA ❌ ERRO] [${new Date().toLocaleTimeString('pt-BR')}] ${errorMsg} (${durationMs}ms)`);
    console.log(`=======================================================\n`);

    // Gravar no log do SQLite
    try {
      const database = await getOrInitDb();
      database.run(`
        INSERT INTO retaguarda_api_logs (
          implantacao_seq, endpoint, metodo, http_status, erro_codigo, descricao, resumo_enviado, duracao_ms, origem_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        seq,
        targetUrl,
        'POST',
        isTimeout ? 408 : 500,
        500,
        errorMsg,
        resumoFinal,
        durationMs,
        clientIp
      ]);
      saveDbToDisk();
    } catch (e) {}

    return res.status(500).json({
      Erro: 500,
      Descricao: errorMsg
    });
  }
});

// Obter histórico de logs de transmissões da API
app.get('/api/retaguarda/logs', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const seqFilter = req.query.seq ? Number(req.query.seq) : null;
    const statusFilter = req.query.status ? String(req.query.status) : null; // 'success', 'error'

    let query = `
      SELECT 
        id, 
        implantacao_seq, 
        endpoint, 
        metodo, 
        http_status, 
        erro_codigo, 
        descricao, 
        resumo_enviado, 
        duracao_ms, 
        origem_ip, 
        created_at
      FROM retaguarda_api_logs
      WHERE 1=1
    `;
    const params: any[] = [];

    if (seqFilter) {
      query += ` AND implantacao_seq = ?`;
      params.push(seqFilter);
    }

    if (statusFilter === 'success') {
      query += ` AND erro_codigo = 0`;
    } else if (statusFilter === 'error') {
      query += ` AND (erro_codigo != 0 OR erro_codigo IS NULL)`;
    }

    query += ` ORDER BY id DESC LIMIT ?;`;
    params.push(limit);

    const resSql = database.exec(query, params);
    const logs: any[] = [];

    if (resSql.length > 0 && resSql[0].values) {
      resSql[0].values.forEach(row => {
        logs.push({
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
        });
      });
    }

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Estatísticas da API (taxa de sucesso, latência média, erros)
app.get('/api/retaguarda/stats', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN erro_codigo = 0 THEN 1 ELSE 0 END) as sucessos,
        SUM(CASE WHEN erro_codigo = 9 THEN 1 ELSE 0 END) as erros_token,
        SUM(CASE WHEN erro_codigo = 2 THEN 1 ELSE 0 END) as erros_nao_encontrado,
        SUM(CASE WHEN erro_codigo != 0 AND erro_codigo != 2 AND erro_codigo != 9 THEN 1 ELSE 0 END) as outros_erros,
        AVG(duracao_ms) as latencia_media,
        MAX(created_at) as ultimo_disparo
      FROM retaguarda_api_logs;
    `;
    const resSql = database.exec(query);
    let stats = {
      total: 0,
      sucessos: 0,
      errosToken: 0,
      errosNaoEncontrado: 0,
      outrosErros: 0,
      taxaSucesso: 100,
      latenciaMediaMs: 0,
      ultimoDisparo: null as string | null
    };

    if (resSql.length > 0 && resSql[0].values && resSql[0].values.length > 0) {
      const row = resSql[0].values[0];
      const total = Number(row[0]) || 0;
      const sucessos = Number(row[1]) || 0;
      stats = {
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

    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Limpar histórico de logs
app.delete('/api/retaguarda/logs', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
    database.run("DELETE FROM retaguarda_api_logs;");
    saveDbToDisk();
    console.log(`[API RETAGUARDA 🧹] [${new Date().toLocaleTimeString('pt-BR')}] Histórico de logs da API limpo.`);
    res.json({ success: true, message: 'Logs de transmissão da API limpos com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated route to register a new Acompanhamento (Histórico de Acompanhamentos)
app.post('/api/db/acompanhamentos', async (req: Request, res: Response) => {
  try {
    const { 
      demandaSeq, 
      implantadorNome, 
      tempoGastoHoras, 
      tempoGastoMinutos,
      tempoGastoSegundos,
      duracaoFormatada,
      horaInicio,
      horaFim,
      origemTempo,
      descricao, 
      impedimento, 
      etapa, 
      progresso, 
      dataExecucao 
    } = req.body;

    if (!demandaSeq || !descricao) {
      return res.status(400).json({ error: 'demandaSeq e descricao são obrigatórios' });
    }

    const database = await getOrInitDb();
    const executante = (implantadorNome || 'Não Atribuído').trim();
    
    // Accurate time calculations with second/minute/hour fidelity
    let segundos = Number(tempoGastoSegundos) || 0;
    let minutos = Number(tempoGastoMinutos) || 0;
    let horas = Number(tempoGastoHoras) || 0;

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

    const dataVal = dataExecucao || new Date().toISOString().split('T')[0];
    const nota = String(descricao).trim();
    const etapaVal = etapa || 'parametrizacao';
    const prog = Number(progresso) || 0;
    const blocker = impedimento ? String(impedimento).trim() : null;
    const hInicio = horaInicio ? String(horaInicio) : null;
    const hFim = horaFim ? String(horaFim) : null;
    const origTempo = origemTempo ? String(origemTempo) : (hInicio ? 'cronometro' : 'manual');
    const isCron = origTempo === 'cronometro' ? 1 : 0;
    const duracaoFmt = duracaoFormatada || (segundos > 0 ? `${Math.floor(segundos / 60)}m ${segundos % 60}s` : `${minutos} min`);

    // Find or create implantador
    let impId: number | null = null;
    if (executante && executante !== 'Não Atribuído') {
      const resImp = database.exec("SELECT id FROM implantadores WHERE nome = ?;", [executante]);
      if (resImp.length > 0 && resImp[0].values.length > 0) {
        impId = Number(resImp[0].values[0][0]);
      } else {
        database.run("INSERT INTO implantadores (nome, cargo) VALUES (?, 'Especialista de Implantação');", [executante]);
        const idRes = database.exec("SELECT last_insert_rowid();");
        if (idRes.length > 0 && idRes[0].values.length > 0) {
          impId = Number(idRes[0].values[0][0]);
        }
      }
    }

    // Deduplication check: verify if identical record was added
    const checkRes = database.exec(`
      SELECT id FROM historico_acompanhamentos 
      WHERE demanda_seq = ? 
        AND data_execucao = ? 
        AND descricao_execucao = ?
      LIMIT 1;
    `, [demandaSeq, dataVal, nota]);

    let insertId = 0;
    if (checkRes.length > 0 && checkRes[0].values && checkRes[0].values.length > 0) {
      insertId = Number(checkRes[0].values[0][0]);
    } else {
      database.run(`
        INSERT INTO historico_acompanhamentos (
          demanda_seq, implantador_id, implantador_nome, tempo_gasto_minutos, tempo_gasto_horas,
          tempo_gasto_segundos, timer_duracao_formatada, is_cronometro,
          hora_inicio, hora_fim, origem_tempo,
          data_execucao, etapa_processo, percentual_progresso, descricao_execucao, impedimento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        demandaSeq, impId, executante, minutos, horas,
        segundos, duracaoFmt, isCron,
        hInicio, hFim, origTempo,
        dataVal, etapaVal, prog, nota, blocker
      ]);
      const idRes = database.exec("SELECT last_insert_rowid();");
      insertId = idRes.length > 0 && idRes[0].values.length > 0 ? Number(idRes[0].values[0][0]) : 0;

      // Keep evolucoes_semanais in sync without duplicates
      database.run(`
        INSERT INTO evolucoes_semanais (
          demanda_seq, implantador_id, data_evolucao, percentual_progresso,
          descricao_avanco, descricao_impedimento, horas_gastas, implantador_nome,
          tempo_gasto_minutos, tempo_gasto_segundos, timer_duracao_formatada,
          hora_inicio, hora_fim, origem_tempo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        demandaSeq, impId, dataVal, prog,
        nota, blocker, horas, executante,
        minutos, segundos, duracaoFmt,
        hInicio, hFim, origTempo
      ]);
    }

    // Also update demand's progress and current stage
    database.run(`
      UPDATE demandas 
      SET percentual_progresso = ?, etapa_atual = ?, updated_at = datetime('now', 'localtime')
      WHERE seq = ?;
    `, [prog, etapaVal, demandaSeq]);

    saveDbToDisk();
    res.json({
      success: true,
      id: insertId,
      demandaSeq,
      implantador: executante,
      horasGastas: horas,
      minutosGastos: minutos,
      segundosGastos: segundos,
      duracaoFormatada: duracaoFmt,
      horaInicio: hInicio,
      horaFim: hFim,
      origemTempo: origTempo,
      isCronometro: isCron,
      savedAt: new Date().toLocaleTimeString('pt-BR')
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Save Batch Demands
app.post('/api/db/demands/batch', async (req: Request, res: Response) => {
  try {
    const { demands } = req.body;
    if (!Array.isArray(demands)) {
      return res.status(400).json({ error: 'Demands array is required' });
    }

    const database = await getOrInitDb();
    database.run("BEGIN TRANSACTION;");
    try {
      for (const d of demands) {
        let implantadorId: number | null = null;
        if (d.implantador && d.implantador !== 'Não Atribuído') {
          const resImp = database.exec("SELECT id FROM implantadores WHERE nome = ?;", [d.implantador]);
          if (resImp.length > 0 && resImp[0].values.length > 0) {
            implantadorId = Number(resImp[0].values[0][0]);
          }
        }

        database.run(`
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
      database.run("COMMIT;");
    } catch (err) {
      database.run("ROLLBACK;");
      throw err;
    }

    saveDbToDisk();
    res.json({ success: true, count: demands.length, savedAt: new Date().toLocaleTimeString('pt-BR') });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get & Save Team Members
app.get('/api/db/team', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
    const resSql = database.exec("SELECT nome FROM implantadores WHERE ativo = 1 ORDER BY nome ASC;");
    const members: string[] = [];
    if (resSql.length > 0 && resSql[0].values) {
      resSql[0].values.forEach(r => {
        if (r[0] && typeof r[0] === 'string' && r[0] !== 'Não Atribuído') {
          members.push(r[0]);
        }
      });
    }
    res.json(members.length > 0 ? members : ['Leonardo', 'Diogo']);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/team', async (req: Request, res: Response) => {
  try {
    const { teamMembers } = req.body;
    if (!Array.isArray(teamMembers)) {
      return res.status(400).json({ error: 'teamMembers array required' });
    }
    const database = await getOrInitDb();
    for (const member of teamMembers) {
      database.run("INSERT OR IGNORE INTO implantadores (nome, cargo) VALUES (?, 'Especialista de Implantação');", [member]);
    }
    saveDbToDisk();
    res.json({ success: true, teamMembers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Audit Log
app.post('/api/db/audit', async (req: Request, res: Response) => {
  try {
    const { entry } = req.body;
    if (!entry) return res.status(400).json({ error: 'Entry required' });
    const database = await getOrInitDb();
    database.run(`
      INSERT INTO historico_status (demanda_seq, status_anterior, status_novo, motivo, alterado_por)
      VALUES (?, ?, ?, ?, ?);
    `, [
      entry.seq || 0,
      entry.actionType || 'action',
      entry.summary || '',
      entry.razaoSocial || '',
      entry.author || 'Rede Local'
    ]);
    saveDbToDisk();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Wipe Data (clean state)
app.post('/api/db/wipe', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
    database.run("DELETE FROM demandas;");
    database.run("DELETE FROM evolucoes_semanais;");
    database.run("DELETE FROM historico_status;");
    saveDbToDisk();
    res.json({ success: true, message: 'Dados limpos com sucesso no arquivo SQLite central.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Execute SQL Console
app.post('/api/db/execute-sql', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });
    const database = await getOrInitDb();
    const result = database.exec(query);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 10. Test Disk Write
app.post('/api/db/test-write', async (req: Request, res: Response) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local';
    const database = await getOrInitDb();
    const testNote = `Teste de rede local: ${new Date().toLocaleString('pt-BR')} por ${clientIp}`;
    database.run(`
      INSERT INTO _diagnostico_conexao (descricao, origem_ip)
      VALUES (?, ?);
    `, [testNote, String(clientIp)]);
    saveDbToDisk();

    const stat = fs.statSync(DB_FILE_PATH);
    const sizeKb = Math.round(stat.size / 1024);
    const modTime = stat.mtime.toLocaleTimeString('pt-BR');

    res.json({
      success: true,
      fileSizeKb: sizeKb,
      lastModifiedTime: modTime,
      dbFilePath: DB_FILE_PATH,
      message: `Gravação confirmada no servidor central (${DB_FILE_PATH})! Tamanho: ${sizeKb} KB às ${modTime}.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Effort & Time Ranking for Implantadores
app.get('/api/db/effort-ranking', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
    
    // Check if historico_acompanhamentos has records
    let tableToQuery = 'historico_acompanhamentos';
    const checkTable = database.exec("SELECT COUNT(*) FROM historico_acompanhamentos;");
    if (!checkTable || !checkTable[0] || !checkTable[0].values || Number(checkTable[0].values[0][0]) === 0) {
      tableToQuery = 'evolucoes_semanais';
    }

    let query = '';
    if (tableToQuery === 'historico_acompanhamentos') {
      query = `
        SELECT 
          COALESCE(NULLIF(TRIM(a.implantador_nome), ''), 'Não Atribuído') as implantador,
          COUNT(a.id) as total_atendimentos,
          COALESCE(SUM(COALESCE(a.tempo_gasto_horas, 0)), 0) as total_horas,
          COUNT(DISTINCT a.demanda_seq) as demandas_distintas,
          AVG(COALESCE(a.tempo_gasto_horas, 0)) as media_horas
        FROM historico_acompanhamentos a
        WHERE COALESCE(NULLIF(TRIM(a.implantador_nome), ''), '') != ''
          AND COALESCE(NULLIF(TRIM(a.implantador_nome), ''), '') != 'Não Atribuído'
        GROUP BY implantador
        ORDER BY total_horas DESC, total_atendimentos DESC;
      `;
    } else {
      query = `
        SELECT 
          COALESCE(NULLIF(TRIM(e.implantador_nome), ''), i.nome, 'Não Atribuído') as implantador,
          COUNT(e.id) as total_atendimentos,
          COALESCE(SUM(COALESCE(e.horas_gastas, 0)), 0) as total_horas,
          COUNT(DISTINCT e.demanda_seq) as demandas_distintas,
          AVG(COALESCE(e.horas_gastas, 0)) as media_horas
        FROM evolucoes_semanais e
        LEFT JOIN implantadores i ON e.implantador_id = i.id
        WHERE COALESCE(NULLIF(TRIM(e.implantador_nome), ''), i.nome, '') != ''
          AND COALESCE(NULLIF(TRIM(e.implantador_nome), ''), i.nome, '') != 'Não Atribuído'
        GROUP BY implantador
        ORDER BY total_horas DESC, total_atendimentos DESC;
      `;
    }

    const resSql = database.exec(query);
    const rankings: any[] = [];
    let totalAllHours = 0;

    if (resSql.length > 0 && resSql[0].values) {
      resSql[0].values.forEach(row => {
        const hours = Number(row[2]) || 0;
        totalAllHours += hours;
      });

      resSql[0].values.forEach(row => {
        const hours = Number(row[2]) || 0;
        rankings.push({
          implantador: String(row[0]),
          totalAtendimentos: Number(row[1]) || 0,
          totalHoras: Math.round(hours * 10) / 10,
          demandasDistintas: Number(row[3]) || 0,
          mediaHorasPorAtendimento: Math.round((Number(row[4]) || 0) * 10) / 10,
          percentualEsforco: totalAllHours > 0 ? Math.round((hours / totalAllHours) * 100) : 0
        });
      });
    }

    res.json({
      totalEquipeHoras: Math.round(totalAllHours * 10) / 10,
      totalAtendimentos: rankings.reduce((acc, r) => acc + r.totalAtendimentos, 0),
      ranking: rankings
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Detailed Time Entries (Histórico Completo de Acompanhamentos)
app.get('/api/db/apontamentos', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
    
    // Check which table has data
    const checkTable = database.exec("SELECT COUNT(*) FROM historico_acompanhamentos;");
    const hasAcomp = checkTable && checkTable[0] && checkTable[0].values && Number(checkTable[0].values[0][0]) > 0;

    let query = '';
    if (hasAcomp) {
      query = `
        SELECT 
          a.id,
          a.demanda_seq,
          COALESCE(d.razao_social, 'Demanda #' || a.demanda_seq) as razao_social,
          COALESCE(NULLIF(TRIM(a.implantador_nome), ''), 'Não Atribuído') as implantador,
          a.data_execucao,
          COALESCE(a.tempo_gasto_horas, 0) as horas_gastas,
          COALESCE(a.tempo_gasto_minutos, CAST(ROUND(COALESCE(a.tempo_gasto_horas, 0) * 60) AS INTEGER)) as minutos_gastos,
          a.hora_inicio,
          a.hora_fim,
          COALESCE(a.origem_tempo, 'manual') as origem_tempo,
          a.descricao_execucao,
          COALESCE(a.percentual_progresso, 0) as percentual_progresso,
          a.impedimento,
          COALESCE(a.etapa_processo, 'parametrizacao') as etapa,
          COALESCE(a.tempo_gasto_segundos, 0) as segundos_gastos,
          a.timer_duracao_formatada,
          COALESCE(a.is_cronometro, 0) as is_cronometro
        FROM historico_acompanhamentos a
        LEFT JOIN demandas d ON a.demanda_seq = d.seq
        ORDER BY a.data_execucao DESC, a.id DESC;
      `;
    } else {
      query = `
        SELECT 
          e.id,
          e.demanda_seq,
          COALESCE(d.razao_social, 'Demanda #' || e.demanda_seq) as razao_social,
          COALESCE(NULLIF(TRIM(e.implantador_nome), ''), i.nome, 'Não Atribuído') as implantador,
          e.data_evolucao,
          COALESCE(e.horas_gastas, 0) as horas_gastas,
          CAST(ROUND(COALESCE(e.horas_gastas, 0) * 60) AS INTEGER) as minutos_gastos,
          e.hora_inicio,
          e.hora_fim,
          COALESCE(e.origem_tempo, 'manual') as origem_tempo,
          e.descricao_avanco,
          COALESCE(e.percentual_progresso, 0) as percentual_progresso,
          e.descricao_impedimento,
          'parametrizacao' as etapa,
          COALESCE(e.tempo_gasto_segundos, 0) as segundos_gastos,
          e.timer_duracao_formatada,
          0 as is_cronometro
        FROM evolucoes_semanais e
        LEFT JOIN demandas d ON e.demanda_seq = d.seq
        LEFT JOIN implantadores i ON e.implantador_id = i.id
        ORDER BY e.data_evolucao DESC, e.id DESC;
      `;
    }

    const resSql = database.exec(query);
    const apontamentos: any[] = [];

    if (resSql.length > 0 && resSql[0].values) {
      resSql[0].values.forEach(row => {
        apontamentos.push({
          id: Number(row[0]),
          demandaSeq: Number(row[1]),
          razaoSocial: String(row[2]),
          implantador: String(row[3]),
          data: String(row[4]),
          horasGastas: Number(row[5]) || 0,
          minutosGastos: Number(row[6]) || 0,
          horaInicio: row[7] ? String(row[7]) : undefined,
          horaFim: row[8] ? String(row[8]) : undefined,
          origemTempo: row[9] ? String(row[9]) : 'manual',
          descricao: String(row[10]),
          progresso: Number(row[11]) || 0,
          impedimento: row[12] ? String(row[12]) : undefined,
          etapa: row[13] ? String(row[13]) : 'parametrizacao',
          segundosGastos: Number(row[14]) || 0,
          duracaoFormatada: row[15] ? String(row[15]) : undefined,
          isCronometro: Boolean(row[16])
        });
      });
    }

    res.json(apontamentos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Delete Single Acompanhamento
app.delete('/api/db/acompanhamentos/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const database = await getOrInitDb();
    database.run("DELETE FROM historico_acompanhamentos WHERE id = ?;", [id]);
    database.run("DELETE FROM evolucoes_semanais WHERE id = ?;", [id]);
    saveDbToDisk();
    res.json({ success: true, message: `Registro #${id} excluído com sucesso.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ======================== CONTACT INTERACTIONS API ========================

// 14. Get All Contact Interactions for a Specific Contact / Demand
app.get('/api/db/contacts/:contactId/interactions', async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.params.contactId);
    if (!contactId) {
      return res.status(400).json({ error: 'ID de contato inválido' });
    }

    const database = await getOrInitDb();
    const query = `
      SELECT 
        id, 
        contact_id, 
        status, 
        user_id, 
        notes, 
        contacted_at, 
        created_at, 
        updated_at
      FROM contact_interactions
      WHERE contact_id = ?
      ORDER BY contacted_at DESC, id DESC;
    `;
    const resSql = database.exec(query, [contactId]);
    const interactions: any[] = [];

    if (resSql.length > 0 && resSql[0].values) {
      resSql[0].values.forEach(row => {
        interactions.push({
          id: Number(row[0]),
          contactId: Number(row[1]),
          status: String(row[2]),
          userId: row[3] ? String(row[3]) : undefined,
          notes: row[4] ? String(row[4]) : undefined,
          contactedAt: String(row[5]),
          createdAt: String(row[6]),
          updatedAt: row[7] ? String(row[7]) : undefined,
        });
      });
    }

    res.json(interactions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Get Latest Interaction for All Contacts (Map dictionary)
app.get('/api/db/contacts/latest-interactions', async (req: Request, res: Response) => {
  try {
    const database = await getOrInitDb();
    const query = `
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
    `;

    const resSql = database.exec(query);
    const map: Record<number, any> = {};

    if (resSql.length > 0 && resSql[0].values) {
      resSql[0].values.forEach(row => {
        const contactId = Number(row[0]);
        map[contactId] = {
          lastStatus: String(row[1]),
          lastContactedAt: String(row[2]),
          lastUserId: row[3] ? String(row[3]) : undefined,
          lastNotes: row[4] ? String(row[4]) : undefined,
          totalCount: Number(row[5]) || 1,
        };
      });
    }

    res.json(map);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Register New Contact Interaction (Histórico Imutável)
app.post('/api/db/contacts/interactions', async (req: Request, res: Response) => {
  try {
    const { contactId, status, userId, notes, contactedAt } = req.body;
    const cid = Number(contactId);

    if (!cid) {
      return res.status(400).json({ error: 'ID do contato é obrigatório' });
    }

    if (!status || typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({ 
        error: 'O resultado do contato é obrigatório. Selecione "Contato realizado com sucesso" ou "Sem retorno".' 
      });
    }

    const database = await getOrInitDb();

    // Integridade: Verificar se a demanda/contato existe no banco
    const demCheck = database.exec("SELECT seq, razao_social FROM demandas WHERE seq = ? LIMIT 1;", [cid]);
    if (demCheck.length === 0 || !demCheck[0].values || demCheck[0].values.length === 0) {
      return res.status(404).json({ 
        error: `Não é possível registrar contato para uma demanda inexistente (ID #${cid}).` 
      });
    }

    const demandName = String(demCheck[0].values[0][1] || `Demanda #${cid}`);
    const finalContactedAt = contactedAt ? String(contactedAt) : new Date().toISOString();
    const finalStatus = status.trim().toUpperCase() === 'SUCCESS' || status === 'Contato realizado com sucesso' 
      ? 'SUCCESS' 
      : status.trim().toUpperCase() === 'NO_RESPONSE' || status === 'Sem retorno'
      ? 'NO_RESPONSE'
      : status.trim();

    const finalUserId = userId ? String(userId).trim() : 'Sistema';
    const finalNotes = notes ? String(notes).trim() : null;

    // Grava novo registro no histórico sem sobrescrever registros anteriores
    database.run(`
      INSERT INTO contact_interactions (
        contact_id, status, user_id, notes, contacted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'));
    `, [
      cid,
      finalStatus,
      finalUserId,
      finalNotes,
      finalContactedAt
    ]);

    const idRes = database.exec("SELECT last_insert_rowid();");
    const insertId = idRes.length > 0 && idRes[0].values.length > 0 ? Number(idRes[0].values[0][0]) : 0;

    // Registrar no histórico de auditoria
    const statusLabel = finalStatus === 'SUCCESS' ? 'Contato realizado com sucesso' : 'Sem retorno';
    database.run(`
      INSERT INTO historico_status (demanda_seq, status_anterior, status_novo, motivo, alterado_por)
      VALUES (?, ?, ?, ?, ?);
    `, [
      cid,
      'contact_interaction',
      finalStatus,
      `Contato registrado: ${statusLabel}${finalNotes ? ` (${finalNotes})` : ''}`,
      finalUserId
    ]);

    saveDbToDisk();

    res.json({
      success: true,
      message: 'Contato registrado com sucesso.',
      interaction: {
        id: insertId,
        contactId: cid,
        status: finalStatus,
        userId: finalUserId,
        notes: finalNotes,
        contactedAt: finalContactedAt,
        createdAt: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('Erro ao registrar contato:', err);
    res.status(500).json({ error: 'Erro ao registrar contato no banco de dados: ' + (err.message || err) });
  }
});

// ======================== STATIC & VITE MIDDLEWARE ========================

async function startServer() {
  await getOrInitDb();

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 SERVIDOR DE REDE LOCAL ATIVO NA PORTA ${PORT}!`);
    console.log(`📁 Banco de Dados SQLite: ${DB_FILE_PATH}`);
    console.log(`💻 Acesso neste PC: http://localhost:${PORT}`);
    const ips = getLocalNetworkIps();
    ips.forEach(ip => {
      console.log(`🌐 Acesso para outros PCs na rede: http://${ip}:${PORT}`);
    });
    console.log(`=======================================================`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
