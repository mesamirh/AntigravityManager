import { select, isCancel, spinner } from '@clack/prompts';
import picocolors from 'picocolors';
import { getAccounts, getActiveAccount, setActive } from '../core/db';
import { refreshAllQuotas } from '../core/cloud';
import { renderQuotasTable } from '../ui/tables';

export async function quotasMenu() {
  while (true) {
    console.clear();
    const active = getActiveAccount();

    if (!active) {
      console.log(picocolors.yellow('  No active account found. Please set an active account first.'));
    } else {
      console.log(`\n--- Detailed Quotas for ${picocolors.cyan(active.email)} ---`);
      try {
        const q = JSON.parse(active.quota_json);
        if (q && q.models) {
          const entries = Object.entries(q.models).filter(([modelName]) => {
            // Hide internal confusing IDE models
            return !modelName.startsWith('chat_') && !modelName.startsWith('tab_');
          }) as [string, any][];

          if (entries.length === 0) {
            console.log(picocolors.yellow('  No models found in quota data.'));
          } else {
            renderQuotasTable(entries);
          }
        } else {
          console.log(picocolors.yellow('  No valid quota data exists for this account.'));
        }
      } catch (e) {
        console.log(picocolors.red('  Error parsing quota data.'));
      }
      console.log('-------------------------------------------\n');
    }

    const action = await select({
      message: 'Quotas & Monitoring:',
      options: [
        { value: 'refresh', label: 'Refresh Quotas Now' },
        { value: 'auto-switch', label: 'Auto-Switch to Best Account' },
        { value: 'watch', label: 'Start Live Monitor' },
        { value: 'back', label: 'Back to Main Menu' }
      ]
    });

    if (isCancel(action) || action === 'back') {
      return;
    }

    const s = spinner();
    switch (action) {
      case 'refresh':
        await refreshQuotasInteractive(s);
        break;
      case 'auto-switch':
        await autoSwitchInteractive(s);
        break;
      case 'watch':
        watchQuotas();
        break;
    }

    if (action !== 'watch') {
      await select({
        message: 'Press Enter to continue...',
        options: [{ value: 'ok', label: 'Continue' }]
      });
    }
  }
}

export async function refreshQuotasInteractive(s: ReturnType<typeof spinner>) {
  s.start('Connecting to Google Cloud API & fetching live quotas...');
  const errors = await refreshAllQuotas();
  if (errors.length > 0) {
    s.stop('Finished with errors.');
    for (const err of errors) console.log(picocolors.red(`  - ${err}`));
  } else {
    s.stop('Quotas successfully synced.');
  }
}

export async function autoSwitchInteractive(s: ReturnType<typeof spinner>) {
  s.start('Analyzing quotas across all accounts...');
  const errors = await refreshAllQuotas();
  if (errors.length > 0) {
    console.log(picocolors.yellow(`\n  Encountered errors while fetching some quotas:`));
    for (const err of errors) console.log(picocolors.red(`  - ${err}`));
  }

  const accounts = getAccounts();
  let bestAccount = null;
  let bestQuotaScore = -1;

  for (const acc of accounts) {
    let score = 0;
    try {
      const q = JSON.parse(acc.quota_json);
      let total = 0;
      let count = 0;
      if (q && q.models) {
        for (const m of Object.values<any>(q.models)) {
          total += m.percentage || 0;
          count++;
        }
      }
      if (count > 0) score = total / count;
    } catch (e) {}

    if (score > bestQuotaScore) {
      bestQuotaScore = score;
      bestAccount = acc.email;
    }
  }

  if (bestAccount) {
    setActive(bestAccount);
    s.stop(
      `Auto-switched to optimal account: ${picocolors.green(bestAccount)} (Avg Quota: ${Math.round(bestQuotaScore)}%)`
    );
  } else {
    s.stop('No accounts to switch to.');
  }
}

export function watchQuotas() {
  console.log(picocolors.cyan('\nStarting Live Monitor (Proxy Server running on :8080)'));
  console.log('Press Ctrl+C to stop...\n');
}
