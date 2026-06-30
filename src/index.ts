import { intro, select, isCancel, cancel } from '@clack/prompts';
import picocolors from 'picocolors';
import { startProxy, stopProxy } from './core/proxy';
import { getAccounts } from './core/db';
import { accountsMenu } from './commands/accounts';
import { quotasMenu } from './commands/quotas';
import { systemMenu } from './commands/system';

function calculatePooledQuota(): { gemini: string; claude: string } {
  const accounts = getAccounts();
  if (accounts.length === 0) return { gemini: 'N/A', claude: 'N/A' };

  let gTotal = 0,
    gCount = 0;
  let cTotal = 0,
    cCount = 0;

  for (const acc of accounts) {
    try {
      const q = JSON.parse(acc.quota_json);
      if (q && q.models) {
        for (const [modelName, m] of Object.entries<any>(q.models)) {
          if (modelName.includes('gemini')) {
            gTotal += m.percentage || 0;
            gCount++;
          } else if (modelName.includes('claude')) {
            cTotal += m.percentage || 0;
            cCount++;
          }
        }
      }
    } catch (e) {}
  }

  return {
    gemini: gCount === 0 ? 'N/A' : `${Math.round(gTotal / gCount)}%`,
    claude: cCount === 0 ? 'N/A' : `${Math.round(cTotal / cCount)}%`
  };
}

async function main() {
  console.clear();
  intro(picocolors.bgBlue(picocolors.white(' Antigravity Manager CLI ')));

  // Start the background local API proxy
  startProxy();

  while (true) {
    console.clear();
    intro(picocolors.bgBlue(picocolors.white(' Antigravity Manager CLI ')));
    const pooled = calculatePooledQuota();
    console.log(
      picocolors.dim(
        `  Proxy: ${picocolors.green('Running (:8080)')} | Pooled Quotas - Gemini: ${picocolors.cyan(pooled.gemini)}, Claude: ${picocolors.cyan(pooled.claude)}`
      )
    );
    console.log('');

    const action = await select({
      message: 'Main Dashboard:',
      options: [
        {
          value: 'accounts',
          label: 'Manage Accounts',
          hint: 'Add, switch, or remove Google Cloud accounts'
        },
        {
          value: 'quotas',
          label: 'Quotas & Monitoring',
          hint: 'View, refresh, and monitor usage limits'
        },
        {
          value: 'system',
          label: 'System & Settings',
          hint: 'Proxy config, aliases, backup, diagnostics'
        },
        { value: 'exit', label: 'Exit' }
      ]
    });

    if (isCancel(action) || action === 'exit') {
      stopProxy();
      cancel('Goodbye!');
      process.exit(0);
    }

    switch (action) {
      case 'accounts':
        await accountsMenu();
        break;
      case 'quotas':
        await quotasMenu();
        break;
      case 'system':
        await systemMenu();
        break;
    }
  }
}

main().catch(console.error);
