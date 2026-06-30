import { select, text, isCancel, spinner, note } from '@clack/prompts';
import picocolors from 'picocolors';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getAccounts, addAccount, setActive, deleteAccount } from '../core/db';
import { startOAuthFlow, exchangeCodeForTokens, AUTH_URL, fetchUserInfo } from '../core/auth';
import { refreshAllQuotas } from '../core/cloud';
import { killIDE, launchIDE, isIDERunning } from '../core/process';
import { injectTokenIntoIDE } from '../core/ideInjector';
import { renderAccountsTable } from '../ui/tables';
export async function accountsMenu() {
  while (true) {
    console.clear();
    const accounts = getAccounts();

    if (accounts.length === 0) {
      console.log(picocolors.yellow('  No accounts found in database.'));
    } else {
      renderAccountsTable(accounts);
    }

    const action = await select({
      message: 'Manage Accounts:',
      options: [
        { value: 'switch', label: 'Switch Active Account' },
        { value: 'add', label: 'Add New Account' },
        { value: 'remove', label: 'Remove Account' },
        { value: 'import', label: 'Import from IDE' },
        { value: 'back', label: 'Back to Main Menu' }
      ]
    });

    if (isCancel(action) || action === 'back') {
      return;
    }

    const s = spinner();
    switch (action) {
      case 'switch':
        await switchAccountInteractive(s);
        break;
      case 'add':
        await addAccountInteractive(s);
        break;
      case 'remove':
        await removeAccountInteractive(s);
        break;
      case 'import':
        await importIDEAccounts(s);
        break;
    }

    await select({
      message: 'Press Enter to continue...',
      options: [{ value: 'ok', label: 'Continue' }]
    });
  }
}

export async function addAccountInteractive(s: ReturnType<typeof spinner>) {
  note(
    `To authenticate, we will open a browser window to Google.\nIf that fails, please visit this URL manually:\n\n${picocolors.cyan(AUTH_URL)}`,
    'Authentication Setup'
  );

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
      s.start('Fetching initial quota data...');
      await refreshAllQuotas();
      s.stop(`Successfully added account: ${picocolors.green(userData.email)}`);
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
    options: [...accounts.map((a) => ({ value: a.email, label: a.email })), { value: 'back', label: 'Cancel / Back' }]
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
    path.join(
      process.env.HOME || '',
      'Library',
      'Application Support',
      'Cursor',
      'User',
      'globalStorage',
      'state.vscdb'
    ),
    path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'state.vscdb'),
    path.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'state.vscdb')
  ];

  let found = 0;
  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      try {
        const db = new Database(dbPath, { readonly: true });
        const oauthRow = db
          .prepare("SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.oauthToken'")
          .get() as any;
        if (oauthRow) {
          const match = oauthRow.value.match(/ya29\.[a-zA-Z0-9_-]+/);
          const refreshTokenMatch = oauthRow.value.match(/(1\/\/[a-zA-Z0-9_-]+)/);
          if (match) {
            const tokenJson = {
              access_token: match[0],
              refresh_token: refreshTokenMatch ? refreshTokenMatch[1] : undefined
            };
            const email = `ide-import-${found + 1}@local.ide`;
            addAccount(email, 'Imported from IDE', tokenJson);
            found++;
          }
        }
        db.close();
      } catch (e) {}
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
    options: accounts.map((a) => ({ value: a.email, label: a.email }))
  });

  if (isCancel(accountToSwitch)) return;

  s.start('Killing IDE processes...');
  await killIDE(false);

  for (let i = 0; i < 10; i++) {
    const running = await isIDERunning();
    if (!running) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 1000));

  setActive(accountToSwitch.toString());

  const targetAccount = accounts.find((a) => a.email === accountToSwitch.toString());
  if (targetAccount) {
    s.message('Injecting token into IDE state.vscdb...');
    const injected = injectTokenIntoIDE(targetAccount);
    if (!injected) {
      console.log(
        picocolors.yellow(
          '\nWarning: Failed to inject token directly into IDE state.vscdb. If you are not using the proxy, you may need to sign in again in the IDE.'
        )
      );
    }
  }

  s.message('Launching IDE with new account...');
  await launchIDE();
  s.stop(`Successfully switched IDE to ${picocolors.green(accountToSwitch.toString())}`);
}
