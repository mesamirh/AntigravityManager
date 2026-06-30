import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Account } from './db';

function encodeVarint(value: number): Buffer {
  if (value < 0) throw new Error('Varint encoding only supports non-negative integers.');
  const buf: number[] = [];
  let val = value;
  while (val >= 128) {
    buf.push((val & 0x7f) | 0x80);
    val = Math.floor(val / 128);
  }
  buf.push(val);
  return Buffer.from(buf);
}

function createStringField(fieldNum: number, value: string): Buffer {
  const tag = (fieldNum << 3) | 2;
  const tagBytes = encodeVarint(tag);
  const valueBytes = Buffer.from(value, 'utf-8');
  const lenBytes = encodeVarint(valueBytes.length);
  return Buffer.concat([tagBytes, lenBytes, valueBytes]);
}

function createTimestampField(fieldNum: number, seconds: number): Buffer {
  const innerTag = (1 << 3) | 0;
  const innerTagBytes = encodeVarint(innerTag);
  const secondsBytes = encodeVarint(seconds);
  const innerMsg = Buffer.concat([innerTagBytes, secondsBytes]);

  const tag = (fieldNum << 3) | 2;
  const tagBytes = encodeVarint(tag);
  const lenBytes = encodeVarint(innerMsg.length);
  return Buffer.concat([tagBytes, lenBytes, innerMsg]);
}

function createOAuthInfo(accessToken: string, refreshToken: string, expiry: number): Buffer {
  const field1 = createStringField(1, accessToken);
  const field2 = createStringField(2, 'Bearer');
  const field3 = createStringField(3, refreshToken);
  const field4 = createTimestampField(4, expiry);
  return Buffer.concat([field1, field2, field3, field4]);
}

export function createUnifiedOauthToken(accessToken: string, refreshToken: string, expiry: number): string {
  const oauthInfo = createOAuthInfo(accessToken, refreshToken, expiry);
  const oauthInfoB64 = oauthInfo.toString('base64');

  const inner2Data = createStringField(1, oauthInfoB64);
  const tag2 = (2 << 3) | 2;
  const tag2Bytes = encodeVarint(tag2);
  const len2Bytes = encodeVarint(inner2Data.length);
  const innerField2 = Buffer.concat([tag2Bytes, len2Bytes, inner2Data]);

  const inner1 = createStringField(1, 'oauthTokenInfoSentinelKey');
  const inner = Buffer.concat([inner1, innerField2]);

  const tag1 = (1 << 3) | 2;
  const tag1Bytes = encodeVarint(tag1);
  const len1Bytes = encodeVarint(inner.length);
  const outer = Buffer.concat([tag1Bytes, len1Bytes, inner]);

  return outer.toString('base64');
}

export function getAntigravityDbPaths(): string[] {
  const appData =
    process.platform === 'win32'
      ? process.env.APPDATA || ''
      : process.env.HOME
        ? path.join(process.env.HOME, 'Library', 'Application Support')
        : '';

  if (!appData) return [];

  const candidates = [
    path.join(appData, 'Antigravity', 'User', 'globalStorage', 'state.vscdb'),
    path.join(appData, 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb'),
    path.join(appData, 'Antigravity IDE', 'User', 'state.vscdb'),
    path.join(appData, 'Code', 'User', 'globalStorage', 'state.vscdb'),
    path.join(appData, 'Code', 'User', 'state.vscdb'),
    path.join(appData, 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    path.join(appData, 'Antigravity', 'User', 'state.vscdb'),
    path.join(appData, 'Antigravity', 'state.vscdb')
  ];

  const validPaths = [];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      validPaths.push(p);
    }
  }
  return validPaths;
}

export function injectTokenIntoIDE(account: Account): boolean {
  const dbPaths = getAntigravityDbPaths();
  if (dbPaths.length === 0) {
    return false;
  }

  let tokenData: any = {};
  try {
    tokenData = JSON.parse(account.token_json);
  } catch (e) {
    return false;
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token || '';

  let expiry = Math.floor(Date.now() / 1000) + 3600;
  if (tokenData.expiry_timestamp) {
    expiry = Math.floor(tokenData.expiry_timestamp / 1000);
  }

  if (!accessToken) {
    return false;
  }

  const valueB64 = createUnifiedOauthToken(accessToken, refreshToken, expiry);

  let successCount = 0;
  for (const dbPath of dbPaths) {
    let db: Database.Database | null = null;
    try {
      db = new Database(dbPath);

      db.transaction(() => {
        db!.prepare('CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)').run();
        db!
          .prepare('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)')
          .run('antigravityUnifiedStateSync.oauthToken', valueB64);

        const authStatus = JSON.stringify({
          name: account.email,
          email: account.email,
          apiKey: accessToken
        });
        db!
          .prepare('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)')
          .run('antigravityAuthStatus', authStatus);

        db!.prepare("DELETE FROM ItemTable WHERE key = 'google.antigravity'").run();
        db!.prepare('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)').run('antigravityOnboarding', 'true');
      })();

      successCount++;
    } catch (e) {
      console.error(`Injection error for ${dbPath}:`, e);
    } finally {
      if (db) {
        db.close();
      }
    }
  }
  return successCount > 0;
}
