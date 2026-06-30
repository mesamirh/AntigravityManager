import { intro, select, isCancel, cancel, spinner } from '@clack/prompts';
import picocolors from 'picocolors';
import { startProxy, stopProxy } from './core/proxy';
import { 
  listAccounts, 
  addAccountInteractive, 
  removeAccountInteractive, 
  importIDEAccounts, 
  switchAccountInteractive 
} from './commands/accounts';
import { 
  viewQuotas, 
  refreshQuotasInteractive, 
  autoSwitchInteractive, 
  watchQuotas 
} from './commands/quotas';
import { 
  backupRestoreInteractive, 
  processControlInteractive, 
  runDiagnostics 
} from './commands/system';
import { 
  manageAliasesInteractive, 
  proxyConfigInteractive, 
  validateTokensInteractive 
} from './commands/config';

async function main() {
  console.clear();
  intro(picocolors.bgBlue(picocolors.white(' Antigravity Manager CLI ')));
  
  // Start the background local API proxy
  startProxy();

  while (true) {
    const action = await select({
      message: 'What would you like to do?',
      options: [
        { value: 'list', label: 'List Accounts', hint: 'View all configured accounts' },
        { value: 'view-quota', label: 'View Detailed Quotas', hint: 'View model-by-model quota breakdown' },
        { value: 'add', label: 'Add Account', hint: 'Add a new Google Cloud account to the database via OAuth' },
        { value: 'remove', label: 'Remove Account', hint: 'Delete an account from the database' },
        { value: 'import-ide', label: 'Import from IDE', hint: 'Extract Google accounts from VS Code/Cursor state' },
        { value: 'switch', label: 'Switch Account', hint: 'Change the active Google Cloud AI account' },
        { value: 'auto-switch', label: 'Auto-Switch', hint: 'Automatically pick the account with best quota' },
        { value: 'refresh', label: 'Refresh Quotas', hint: 'Fetch latest usage from Google Cloud API' },
        { value: 'validate', label: 'Validate Tokens', hint: 'Check token expiry and auto-refresh' },
        { value: 'alias', label: 'Manage Aliases', hint: 'Set shortcuts like "work" or "personal"' },
        { value: 'proxy-config', label: 'Proxy Configuration', hint: 'Configure API endpoints and mapping' },
        { value: 'backup', label: 'Backup & Restore', hint: 'Export/Import accounts to JSON' },
        { value: 'watch', label: 'Live Monitor', hint: 'Watch quotas update in real-time' },
        { value: 'process', label: 'Process Control', hint: 'Manage Antigravity App processes' },
        { value: 'doctor', label: 'Diagnostics', hint: 'Run system health checks' },
        { value: 'exit', label: 'Exit' }
      ]
    });

    if (isCancel(action) || action === 'exit') {
      stopProxy();
      cancel('Goodbye!');
      process.exit(0);
    }

    const s = spinner();

    switch (action) {
      case 'list': await listAccounts(); break;
      case 'view-quota': await viewQuotas(); break;
      case 'add': await addAccountInteractive(s); break;
      case 'remove': await removeAccountInteractive(s); break;
      case 'import-ide': await importIDEAccounts(s); break;
      case 'switch': await switchAccountInteractive(s); break;
      case 'auto-switch': await autoSwitchInteractive(s); break;
      case 'refresh': await refreshQuotasInteractive(s); break;
      case 'validate': await validateTokensInteractive(s); break;
      case 'alias': await manageAliasesInteractive(); break;
      case 'proxy-config': await proxyConfigInteractive(s); break;
      case 'backup': await backupRestoreInteractive(s); break;
      case 'watch': watchQuotas(); break;
      case 'process': await processControlInteractive(s); break;
      case 'doctor': runDiagnostics(s); break;
    }
    
    // Pause before showing the menu again so the user can read the output
    await select({
      message: 'Press Enter to return to the main menu...',
      options: [{ value: 'ok', label: 'Return to Menu' }]
    });

    console.log(''); 
  }
}

main().catch(console.error);
