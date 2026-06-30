import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const APP_DATA =
  process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'AntigravityManager')
    : path.join(os.homedir(), '.config', 'AntigravityManager');

const DB_PATH = path.join(APP_DATA, 'cloud_accounts.db');

if (!fs.existsSync(APP_DATA)) fs.mkdirSync(APP_DATA, { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    email TEXT PRIMARY KEY,
    name TEXT,
    token_json TEXT,
    quota_json TEXT,
    last_used INTEGER
  )
`);

export interface Account {
  email: string;
  name: string;
  token_json: string;
  quota_json: string;
  last_used: number;
}

export function getAccounts(): Account[] {
  return db.prepare('SELECT * FROM accounts ORDER BY last_used DESC').all() as Account[];
}

export function getActiveAccount(): Account | null {
  const accs = getAccounts();
  return accs.length > 0 ? accs[0] : null; // Active is just the most recently used
}

export function addAccount(email: string, name: string, token: any) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO accounts (email, name, token_json, quota_json, last_used) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(email, name, JSON.stringify(token), '{}', Date.now());
}

export function updateQuota(email: string, quota: any) {
  db.prepare('UPDATE accounts SET quota_json = ? WHERE email = ?').run(JSON.stringify(quota), email);
}

export function updateToken(email: string, token: any) {
  db.prepare('UPDATE accounts SET token_json = ? WHERE email = ?').run(JSON.stringify(token), email);
}

export function deleteAccount(email: string) {
  db.prepare('DELETE FROM accounts WHERE email = ?').run(email);
}

export function setActive(email: string) {
  db.prepare('UPDATE accounts SET last_used = ? WHERE email = ?').run(Date.now(), email);
}

export function importAccounts(accounts: Account[]) {
  const stmt = db.prepare(
    'INSERT OR REPLACE INTO accounts (email, name, token_json, quota_json, last_used) VALUES (?, ?, ?, ?, ?)'
  );
  const drop = db.prepare('DELETE FROM accounts');
  const insertMany = db.transaction((accs) => {
    drop.run();
    for (const acc of accs) {
      stmt.run(acc.email, acc.name, acc.token_json, acc.quota_json, acc.last_used);
    }
  });
  insertMany(accounts);
}
