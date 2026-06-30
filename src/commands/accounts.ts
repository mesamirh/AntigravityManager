import { select, text, isCancel, spinner, note } from '@clack/prompts';
import picocolors from 'picocolors';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getAccounts, addAccount, setActive, deleteAccount } from '../core/db';
import { startOAuthFlow, exchangeCodeForTokens, AUTH_URL, fetchUserInfo } from '../core/auth';
import { killIDE, launchIDE } from '../core/process';
import { renderAccountsTable } from '../ui/tables';

export async function listAccounts() {
  const accounts = getAccounts();
  if (accounts.length === 0) {
    console.log(picocolors.yellow('  No accounts found in database.'));
    return;
  }
  
  renderAccountsTable(accounts);
}

export async function addAccountInteractive(s: ReturnType<typeof spinner>) {
  note(`To authenticate, we will open a browser window to Google.\nIf that fails, please visit this URL manually:\n\n${picocolors.cyan(AUTH_URL)}`, 'Authentication Setup');
  
  const mode = await select({
    message: 'How would you like to authenticate?',
    options: [
      { value: 'auto', label: 'Auto (Open browser and intercept code)' },
      { value: 'manual', label: 'Manual (Paste code from browser)' },
      { value: 'back', label: 'Back' }
    ]
  });

  if (mode === 'back' || isCancel(mode)) return;

  let tokenData;
  let userData = { email: '', name: '' };

  try {
    if (mode === 'auto') {
      s.start('Waiting for authentication...');
      const authRes = await startOAuthFlow();
      tokenData = authRes.tokens;
      userData = authRes.user;
      s.stop('Successfully authenticated via OAuth.');
    } else {
      const code = await text({ message: 'Paste the authorization code:' });
      if (isCancel(code)) return;
      s.start('Exchanging code for tokens...');
      tokenData = await exchangeCodeForTokens(code.toString());
      userData = await fetchUserInfo(tokenData.access_token);
      s.stop('Successfully exchanged code.');
    }

    if (userData.email) {
      addAccount(userData.email, userData.name, tokenData);
      console.log(`Successfully added account: ${picocolors.green(userData.email)}`);
    } else {
      console.log(picocolors.red('Could not determine email, account not saved.'));
    }
  } catch (e: any) {
    if (s) s.stop('Authentication failed.');
    console.error(picocolors.red(`Error: ${e.message}`));
  }
}

export async function removeAccountInteractive(s: ReturnType<typeof spinner>) {
  const accounts = getAccounts();
  if (accounts.length === 0) {
    console.log(picocolors.yellow('No accounts available to remove.'));
    return;
  }
  
  const accountToRemove = await select({
    message: 'Select an account to remove:',
    options: [
      ...accounts.map(a => ({ value: a.email, label: a.email })),
      { value: 'back', label: 'Cancel / Back' }
    ]
  });

  if (accountToRemove === 'back' || isCancel(accountToRemove)) return;

  s.start(`Removing account ${accountToRemove.toString()}...`);
  deleteAccount(accountToRemove.toString());
  s.stop(`Successfully removed account: ${picocolors.green(accountToRemove.toString())}`);
}

export async function importIDEAccounts(s: ReturnType<typeof spinner>) {
  s.start('Searching for VS Code / Cursor state databases...');
  const possiblePaths = [
    path.join(process.env.HOME || '', 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'state.vscdb'),
    path.join(process.env.HOME || '', 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'state.vscdb'),
    path.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
  ];
  
  let found = 0;
  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      try {
        const db = new Database(dbPath, { readonly: true });
        const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.oauthToken'").get() as any;
        if (row && row.value) {
          const val = row.value.toString();
          // Simple regex to extract token strings from protobuf binary payload
          const accessTokenMatch = val.match(/(ya29\.[a-zA-Z0-9_-]+)/);
          const refreshTokenMatch = val.match(/(1\/\/[a-zA-Z0-9_-]+)/);
          if (accessTokenMatch) {
              const tokenJson = { 
                access_token: accessTokenMatch[1], 
                refresh_token: refreshTokenMatch ? refreshTokenMatch[1] : undefined 
              };
              const email = `ide-import-${found+1}@local.ide`;
              addAccount(email, 'Imported from IDE', tokenJson);
              found++;
          }
        }
        db.close();
      } catch (e) {
        // Ignore locked DBs or missing tables
      }
    }
  }
  if (found > 0) {
    s.stop(`Imported ${found} accounts from IDE databases.`);
  } else {
    s.stop('No accounts found in IDE databases.');
  }
}

export async function switchAccountInteractive(s: ReturnType<typeof spinner>) {
  const accounts = getAccounts();
  if (accounts.length === 0) {
    console.log(picocolors.yellow('No accounts available to switch to.'));
    return;
  }
  
  const accountToSwitch = await select({
    message: 'Select an account to inject into IDE:',
    options: accounts.map(a => ({ value: a.email, label: a.email }))
  });

  if (isCancel(accountToSwitch)) return;

  s.start('Killing IDE processes...');
  await killIDE(false); // Graceful
  setActive(accountToSwitch.toString());
  s.message('Launching IDE with new account...');
  await launchIDE();
  s.stop(`Successfully switched IDE to ${picocolors.green(accountToSwitch.toString())}`);
}
