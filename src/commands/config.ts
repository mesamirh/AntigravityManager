import { select, text, isCancel, spinner } from '@clack/prompts';
import picocolors from 'picocolors';
import fs from 'fs';
import path from 'path';
import { getProxyConfig, saveProxyConfig, stopProxy, startProxy } from '../core/proxy';
import { refreshAllQuotas } from '../core/cloud';

const APP_DATA = process.platform === 'win32' 
  ? path.join(process.env.APPDATA || '', 'AntigravityManager')
  : path.join(process.env.HOME || '', '.config', 'AntigravityManager');

const ALIAS_FILE = path.join(APP_DATA, 'aliases.json');

function getAliases(): Record<string, string> {
  if (!fs.existsSync(ALIAS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(ALIAS_FILE, 'utf-8')); }
  catch { return {}; }
}

function saveAliases(aliases: Record<string, string>) {
  if (!fs.existsSync(APP_DATA)) fs.mkdirSync(APP_DATA, { recursive: true });
  fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2));
}

export async function manageAliasesInteractive() {
  const aliasAction = await select({
    message: 'Alias Management',
    options: [
      { value: 'view', label: 'View Aliases' },
      { value: 'add', label: 'Add Alias' },
      { value: 'remove', label: 'Remove Alias' },
      { value: 'back', label: 'Back' }
    ]
  });
  
  if (aliasAction === 'back' || isCancel(aliasAction)) return;
  const aliases = getAliases();

  if (aliasAction === 'view') {
    console.log('\n--- Current Aliases ---');
    for (const [k, v] of Object.entries(aliases)) {
      console.log(`  ${picocolors.cyan(k)} -> ${v}`);
    }
    if (Object.keys(aliases).length === 0) console.log('  (None)');
  } 
  else if (aliasAction === 'add') {
    const name = await text({ message: 'Enter alias name (e.g. work):' });
    if (isCancel(name)) return;
    const email = await text({ message: 'Enter target email:' });
    if (isCancel(email)) return;
    aliases[name.toString()] = email.toString();
    saveAliases(aliases);
    console.log(picocolors.green('Alias saved.'));
  }
  else if (aliasAction === 'remove') {
    const aliasToRemove = await text({ message: 'Enter alias name to remove:' });
    if (isCancel(aliasToRemove)) return;
    delete aliases[aliasToRemove.toString()];
    saveAliases(aliases);
    console.log(picocolors.green('Alias removed.'));
  }
}

export async function proxyConfigInteractive(s: ReturnType<typeof spinner>) {
  const config = getProxyConfig();
  const portAnswer = await text({
    message: `Enter proxy port (current: ${config.port}):`,
    placeholder: config.port.toString()
  });
  if (isCancel(portAnswer)) return;
  
  const timeoutAnswer = await text({
    message: `Enter request timeout in ms (current: ${config.timeoutMs}):`,
    placeholder: config.timeoutMs.toString()
  });
  if (isCancel(timeoutAnswer)) return;

  const port = portAnswer ? parseInt(portAnswer.toString()) : config.port;
  const timeoutMs = timeoutAnswer ? parseInt(timeoutAnswer.toString()) : config.timeoutMs;
  
  saveProxyConfig({ port, timeoutMs });
  s.start('Restarting proxy server...');
  stopProxy();
  startProxy();
  s.stop(picocolors.green(`Proxy server reconfigured and listening on port ${port}`));
}

export async function validateTokensInteractive(s: ReturnType<typeof spinner>) {
  s.start('Checking OAuth token expirations...');
  const errors = await refreshAllQuotas(); // refreshAllQuotas handles token refresh internally
  if (errors.length > 0) {
    s.stop('Finished checking tokens, but found issues:');
    for (const err of errors) console.log(picocolors.red(`  - ${err}`));
  } else {
    s.stop('All tokens have been checked/refreshed successfully.');
  }
}
