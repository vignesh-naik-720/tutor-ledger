import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import pg, { type QueryResultRow, type Pool as PgPool } from 'pg';

const { Pool } = pg;

// Dual-mode database client:
// 1. Connects to PostgreSQL if TL_DATABASE_URL points to a live database.
// 2. Seamlessly falls back to an embedded store with JSON persistence if PostgreSQL
//    is unreachable (e.g. when running without Docker locally), so tutors and reviewers
//    can test and run the application instantly out of the box!

let pool: PgPool | null = null;
let isPostgresAvailable: boolean | null = null;

// Embedded Table Store for instant zero-dependency execution
interface MemoryTable {
  [id: string]: Record<string, any>;
}

interface MemoryStoreData {
  ledger: MemoryTable;
  owner_account: MemoryTable;
  session: MemoryTable;
  family: MemoryTable;
  invoice: MemoryTable;
  payment: MemoryTable;
  recurring_bill: MemoryTable;
  one_off_expense: MemoryTable;
  scenario: MemoryTable;
  reminder_draft: MemoryTable;
  alert: MemoryTable;
  audit_event: MemoryTable;
  schema_migrations: MemoryTable;
}

const STORE_PATH = resolve(process.cwd(), 'data', 'tutor_ledger_store.json');

function createEmptyStore(): MemoryStoreData {
  return {
    ledger: {},
    owner_account: {},
    session: {},
    family: {},
    invoice: {},
    payment: {},
    recurring_bill: {},
    one_off_expense: {},
    scenario: {},
    reminder_draft: {},
    alert: {},
    audit_event: {},
    schema_migrations: {},
  };
}

let memoryStore: MemoryStoreData = createEmptyStore();

function loadStore(): void {
  try {
    if (existsSync(STORE_PATH)) {
      const raw = readFileSync(STORE_PATH, 'utf-8');
      const loaded = JSON.parse(raw);
      // Revive buffers if stored as base64 or objects
      for (const table of Object.keys(loaded) as (keyof MemoryStoreData)[]) {
        for (const rowKey of Object.keys(loaded[table])) {
          const row = loaded[table][rowKey];
          for (const col of Object.keys(row)) {
            if (row[col] && typeof row[col] === 'object' && row[col].type === 'Buffer') {
              row[col] = Buffer.from(row[col].data);
            }
          }
        }
      }
      memoryStore = { ...createEmptyStore(), ...loaded };
    }
  } catch {
    memoryStore = createEmptyStore();
  }
}

function persistStore(): void {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch {
    // Non-fatal if write fails in test/read-only
  }
}

loadStore();

export function getPool(connectionString?: string): PgPool | null {
  if (!connectionString || connectionString.trim() === '' || connectionString === 'embedded' || connectionString === 'sqlite') {
    isPostgresAvailable = false;
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 1500,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch {
      // ignore
    }
    pool = null;
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  // Try PostgreSQL if we haven't determined it is unreachable
  if (pool && isPostgresAvailable !== false) {
    try {
      const result = await pool.query<T>(text, [...params]);
      isPostgresAvailable = true;
      return result.rows;
    } catch (err: any) {
      // If connection refused, fall back to embedded store
      if (
        err.code === 'ECONNREFUSED' ||
        err.code === 'ENOTFOUND' ||
        err.code === 'ETIMEDOUT' ||
        err.message?.includes('connect ECONNREFUSED')
      ) {
        isPostgresAvailable = false;
        console.warn('⚠️ PostgreSQL unavailable. Running seamlessly on embedded storage engine.');
      } else if (isPostgresAvailable === true) {
        // Real DB error on active postgres
        throw err;
      }
    }
  }

  // Execute on embedded memory/json store
  return executeInMemoryQuery<T>(text, params);
}

/**
 * Embedded SQL query emulator for the application's specific queries
 */
function executeInMemoryQuery<T>(text: string, params: readonly unknown[]): T[] {
  const normalized = text.trim().replace(/\s+/g, ' ');

  // 1. Transaction commands (BEGIN, COMMIT, ROLLBACK)
  if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(normalized)) {
    return [] as T[];
  }

  // 2. INSERT statements
  const insertMatch = /^INSERT INTO ([a-z_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)(?:\s*RETURNING\s*(.+))?/i.exec(normalized);
  if (insertMatch) {
    const tableName = insertMatch[1]!.toLowerCase() as keyof MemoryStoreData;
    const cols = insertMatch[2]!.split(',').map((c) => c.trim().toLowerCase());
    const valPlaceholders = insertMatch[3]!.split(',').map((v) => v.trim());

    const table = memoryStore[tableName] || (memoryStore[tableName] = {});

    const row: Record<string, any> = {
      created_at: new Date(),
      updated_at: new Date(),
    };

    let paramIdx = 0;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]!;
      const placeholder = valPlaceholders[i];
      if (!placeholder) {
        row[col] = params[paramIdx++];
      } else if (placeholder.startsWith('$')) {
        const pNum = parseInt(placeholder.slice(1), 10) - 1;
        row[col] = params[pNum];
      } else if (placeholder.toLowerCase() === 'false') {
        row[col] = false;
      } else if (placeholder.toLowerCase() === 'true') {
        row[col] = true;
      } else if (placeholder.toLowerCase() === 'now()') {
        row[col] = new Date().toISOString();
      } else if (placeholder.startsWith("'") && placeholder.endsWith("'")) {
        row[col] = placeholder.slice(1, -1);
      } else if (!isNaN(Number(placeholder))) {
        row[col] = Number(placeholder);
      } else {
        row[col] = params[paramIdx++];
      }
    }

    // Default version
    if ('version' in row && row.version === undefined) {
      row.version = 1;
    }

    // Check unique constraints:
    // a) Invoice: UNIQUE (ledger_id, family_id, period_start)
    if (tableName === 'invoice') {
      const pStart = String(row.period_start || '').slice(0, 10);
      for (const existing of Object.values(table)) {
        if (
          existing.ledger_id === row.ledger_id &&
          existing.family_id === row.family_id &&
          String(existing.period_start).slice(0, 10) === pStart
        ) {
          const err: any = new Error('duplicate key value violates unique constraint "invoice_unique_period"');
          err.code = '23505';
          throw err;
        }
      }
    }

    // b) Payment: UNIQUE (ledger_id, client_event_id)
    if (tableName === 'payment') {
      for (const existing of Object.values(table)) {
        if (existing.ledger_id === row.ledger_id && existing.client_event_id === row.client_event_id) {
          const err: any = new Error('duplicate key value violates unique constraint "payment_unique_client_event"');
          err.code = '23505';
          throw err;
        }
      }
    }

    // Key selection
    let rowKey = row.id;
    if (row.id_hash) {
      rowKey = Buffer.isBuffer(row.id_hash) ? row.id_hash.toString('hex') : String(row.id_hash);
    }
    if (!rowKey) {
      rowKey = String(Object.keys(table).length + 1);
      row.id = rowKey;
    }

    table[rowKey] = row;
    persistStore();
    return [row] as unknown as T[];
  }

  // 3. UPDATE statements
  const updateMatch = /^UPDATE ([a-z_]+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i.exec(normalized);
  if (updateMatch) {
    const tableName = updateMatch[1]!.toLowerCase() as keyof MemoryStoreData;
    const setClause = updateMatch[2]!;
    const whereClause = updateMatch[3]!;
    const table = memoryStore[tableName] || (memoryStore[tableName] = {});

    // Parse SET assignments
    const assignments = setClause.split(',').map((s) => s.trim());
    const matchedRows: any[] = [];

    for (const [key, row] of Object.entries(table)) {
      if (evalWhere(whereClause, row, params)) {
        for (const assign of assignments) {
          const [colPart, valPart] = assign.split('=').map((s) => s.trim());
          const col = colPart!.toLowerCase();
          if (valPart!.startsWith('$')) {
            const pNum = parseInt(valPart!.slice(1), 10) - 1;
            row[col] = params[pNum];
          } else if (valPart === 'version + 1') {
            row[col] = (Number(row[col]) || 1) + 1;
          } else if (valPart!.toLowerCase() === 'now()') {
            row[col] = new Date().toISOString();
          } else if (valPart!.toLowerCase() === 'null') {
            row[col] = null;
          } else if (valPart!.startsWith("'") && valPart!.endsWith("'")) {
            row[col] = valPart!.slice(1, -1);
          } else if (!isNaN(Number(valPart))) {
            row[col] = Number(valPart);
          }
        }
        row.updated_at = new Date().toISOString();
        matchedRows.push(row);
      }
    }
    persistStore();
    return matchedRows as unknown as T[];
  }

  // 4. DELETE statements
  const deleteMatch = /^DELETE FROM ([a-z_]+)\s*(?:WHERE\s+(.+))?$/i.exec(normalized);
  if (deleteMatch) {
    const tableName = deleteMatch[1]!.toLowerCase() as keyof MemoryStoreData;
    const whereClause = deleteMatch[2];
    const table = memoryStore[tableName] || (memoryStore[tableName] = {});

    const deleted: any[] = [];
    for (const [key, row] of Object.entries(table)) {
      if (!whereClause || evalWhere(whereClause, row, params)) {
        deleted.push(row);
        delete table[key];
      }
    }
    persistStore();
    return deleted as unknown as T[];
  }

  // 5. SELECT statements (supports optional single JOIN)
  const selectMatch = /^SELECT\s+(.+?)\s+FROM\s+([a-z_]+)(?:\s+([a-z0-9_]+))?(?:\s+JOIN\s+([a-z_]+)\s+([a-z0-9_]+)\s+ON\s+([a-z0-9_.]+)\s*=\s*([a-z0-9_.]+))?(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i.exec(normalized);
  if (selectMatch) {
    const colsStr = selectMatch[1]!;
    const tableName = selectMatch[2]!.toLowerCase() as keyof MemoryStoreData;
    const joinTableName = selectMatch[4]?.toLowerCase() as keyof MemoryStoreData | undefined;
    const joinLeftCol = selectMatch[6]?.split('.').pop();
    const joinRightCol = selectMatch[7]?.split('.').pop();
    const whereClause = selectMatch[8];
    const orderByClause = selectMatch[9];
    const limitClause = selectMatch[10];

    const table = memoryStore[tableName] || {};
    let rows: any[] = Object.values(table);

    // Apply JOIN if present
    if (joinTableName && joinLeftCol && joinRightCol) {
      const joinTable = memoryStore[joinTableName] || {};
      const joined: any[] = [];
      for (const pRow of rows) {
        const matchVal = pRow[joinLeftCol] ?? pRow[joinRightCol];
        const matchJoin = Object.values(joinTable).find(
          (jRow) => jRow[joinRightCol] === matchVal || jRow[joinLeftCol] === matchVal
        );
        if (matchJoin) {
          joined.push({ ...matchJoin, ...pRow });
        }
      }
      rows = joined;
    }

    // Apply WHERE
    if (whereClause) {
      rows = rows.filter((row) => evalWhere(whereClause, row, params));
    }

    // Handle COUNT(*)
    if (/^COUNT\(\*\)(?:\s+AS\s+([a-z0-9_]+))?$/i.test(colsStr)) {
      const alias = /AS\s+([a-z0-9_]+)/i.exec(colsStr)?.[1] || 'count';
      return [{ [alias]: rows.length }] as unknown as T[];
    }

    // Apply ORDER BY
    if (orderByClause) {
      const parts = orderByClause.split(',').map((p) => p.trim());
      rows.sort((a, b) => {
        for (const part of parts) {
          const [col, dir = 'ASC'] = part.split(/\s+/);
          const valA = a[col!];
          const valB = b[col!];
          if (valA === valB) continue;
          const isDesc = dir.toUpperCase() === 'DESC';
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          if (valA < valB) return isDesc ? 1 : -1;
          if (valA > valB) return isDesc ? -1 : 1;
        }
        return 0;
      });
    }

    // Apply LIMIT
    if (limitClause) {
      rows = rows.slice(0, parseInt(limitClause, 10));
    }

    // Map columns
    const mapped = rows.map((row) => mapColumns(colsStr, row));
    return mapped as unknown as T[];
  }

  return [] as T[];
}

function evalWhere(whereClause: string, row: Record<string, any>, params: readonly unknown[]): boolean {
  // Support AND-separated conditions
  const conditions = whereClause.split(/\s+AND\s+/i);
  for (const cond of conditions) {
    const trimmed = cond.trim();
    // match: column (= | != | <> | IS NOT | IS | IN) value
    const match = /^([a-z0-9_.]+)\s*(=|!=|<>|IS NOT|IS|IN)\s*(.+)$/i.exec(trimmed);
    if (!match) continue;

    const rawCol = match[1]!.toLowerCase();
    const col = rawCol.includes('.') ? rawCol.split('.').pop()! : rawCol;
    const op = match[2]!.toUpperCase();
    const right = match[3]!.trim();

    let targetVal: any;
    if (op === 'IN') {
      const inValues = right
        .replace(/[()]/g, '')
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
      const rowVal = row[col];
      if (!inValues.includes(String(rowVal))) return false;
      continue;
    }

    if (right.startsWith('$')) {
      const pNum = parseInt(right.slice(1), 10) - 1;
      targetVal = params[pNum];
    } else if (right.toUpperCase() === 'NULL') {
      targetVal = null;
    } else if (right.toUpperCase() === 'TRUE') {
      targetVal = true;
    } else if (right.toUpperCase() === 'FALSE') {
      targetVal = false;
    } else if (right.startsWith("'") && right.endsWith("'")) {
      targetVal = right.slice(1, -1);
    } else if (!isNaN(Number(right))) {
      targetVal = Number(right);
    }

    const rowVal = row[col];

    // Buffer equality check
    if (Buffer.isBuffer(rowVal) && Buffer.isBuffer(targetVal)) {
      const eq = rowVal.equals(targetVal);
      if (op === '=' && !eq) return false;
      if ((op === '!=' || op === '<>') && eq) return false;
      continue;
    }

    if (op === '=') {
      if (rowVal != targetVal) return false;
    } else if (op === '!=' || op === '<>') {
      if (rowVal == targetVal) return false;
    } else if (op === 'IS') {
      if (targetVal === null && rowVal !== null && rowVal !== undefined) return false;
    } else if (op === 'IS NOT') {
      if (targetVal === null && (rowVal === null || rowVal === undefined)) return false;
    }
  }
  return true;
}

function mapColumns(colsStr: string, row: Record<string, any>): Record<string, any> {
  if (colsStr.trim() === '*') return { ...row };

  const res: Record<string, any> = {};
  const colExprs = colsStr.split(',').map((c) => c.trim());

  for (const expr of colExprs) {
    // to_char(col, 'YYYY-MM-DD') AS alias
    const toCharMatch = /^to_char\(([a-z0-9_.]+),\s*[^)]+\)\s+AS\s+([a-z0-9_]+)$/i.exec(expr);
    if (toCharMatch) {
      const rawSrcCol = toCharMatch[1]!;
      const srcCol = rawSrcCol.includes('.') ? rawSrcCol.split('.').pop()! : rawSrcCol;
      const alias = toCharMatch[2]!;
      const val = row[srcCol];
      res[alias] = val ? String(val).slice(0, 10) : null;
      continue;
    }

    // col AS alias
    const aliasMatch = /^([a-z0-9_.]+)\s+AS\s+([a-z0-9_]+)$/i.exec(expr);
    if (aliasMatch) {
      const rawSrc = aliasMatch[1]!;
      const srcCol = rawSrc.includes('.') ? rawSrc.split('.').pop()! : rawSrc;
      res[aliasMatch[2]!] = row[srcCol];
      continue;
    }

    // Plain column (possibly with table prefix like i.id)
    const cleanCol = expr.includes('.') ? expr.split('.').pop()! : expr;
    res[cleanCol] = row[cleanCol];
  }
  return res;
}
