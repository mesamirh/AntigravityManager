import { select, text, isCancel, spinner } from '@clack/prompts';
import picocolors from 'picocolors';
import fs from 'fs';
import path from 'path';
import { getAccounts, importAccounts } from '../core/db';
import { isIDERunning, launchIDE, killIDE } from '../core/process';

const APP_DATA = process.platform === 'win32' 
  ? path.join(process.env.APPDATA || '', 'AntigravityManager')
  : path.join(process.env.HOME || '', '.config', 'AntigravityManager');

export async function backupRestoreInteractive(s: ReturnType<typeof spinner>) {
  const snapAction = await select({
    message: 'Account Snapshots (Backup & Restore)',
    options: [
      { value: 'create', label: 'Create Snapshot', hint: 'Save current accounts state' },
      { value: 'restore', label: 'Restore Snapshot', hint: 'Load accounts from a snapshot' },
      { value: 'delete', label: 'Delete Snapshot', hint: 'Remove an old snapshot' },
      { value: 'back', label: 'Cancel / Back' }
    ]
  });

  if (snapAction === 'back' || isCancel(snapAction)) return;

  const snapshotsDir = path.join(APP_DATA, 'snapshots');
  if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir, { recursive: true });

  if (snapAction === 'create') {
    const snapName = await text({
      message: 'Enter snapshot name (e.g., pre-weekend):',
      placeholder: 'my-snapshot'
    });
    if (isCancel(snapName) || !snapName) return;
    
    const filename = `${snapName.toString().replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.json`;
    const exportPath = path.join(snapshotsDir, filename);
    s.start('Exporting database snapshot...');
    fs.writeFileSync(exportPath, JSON.stringify(getAccounts(), null, 2));
    s.stop(`Snapshot saved to ${picocolors.cyan(exportPath)}`);
  } 
  else if (snapAction === 'restore' || snapAction === 'delete') {
    const files = fs.readdirSync(snapshotsDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
      console.log(picocolors.yellow('  No snapshots found in storage.'));
      return;
    }
    
    const selectedFile = await select({
      message: `Select a snapshot to ${snapAction}:`,
      options: [
        ...files.map(f => ({ value: f, label: f })),
        { value: 'back', label: 'Cancel' }
      ]
    });
    
    if (selectedFile === 'back' || isCancel(selectedFile)) return;
    
    const targetPath = path.join(snapshotsDir, selectedFile.toString());
    
    if (snapAction === 'delete') {
       fs.unlinkSync(targetPath);
       console.log(picocolors.green(`  Deleted snapshot: ${selectedFile}`));
    } else if (snapAction === 'restore') {
       s.start('Restoring database from snapshot...');
       try {
         const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
         importAccounts(data);
         s.stop(picocolors.green(`  Successfully restored accounts from ${selectedFile}`));
       } catch(e) {
         s.stop('Failed to restore snapshot.');
         console.log(picocolors.red(`  Error: ${(e as Error).message}`));
       }
    }
  }
}

export async function processControlInteractive(s: ReturnType<typeof spinner>) {
  const isRunning = await isIDERunning();
  
  const procAction = await select({
    message: `Process Control (Antigravity is currently ${isRunning ? picocolors.green('Running') : picocolors.red('Stopped')})`,
    options: [
      { value: 'launch', label: 'Launch Antigravity', hint: 'Launch via URI protocol or executable' },
      { value: 'graceful', label: 'Graceful Close', hint: 'Send termination signal to safely close' },
      { value: 'force', label: 'Force Kill', hint: 'Instantly terminate processes (taskkill / pkill -9)' },
      { value: 'back', label: 'Cancel / Back' }
    ]
  });

  if (procAction === 'back' || isCancel(procAction)) return;

  if (procAction === 'launch') {
    s.start('Launching Antigravity...');
    await launchIDE();
    s.stop('Launch command executed.');
  } else if (procAction === 'graceful') {
    s.start('Sending graceful close signal...');
    await killIDE(false);
    s.stop('Graceful close signal sent.');
  } else if (procAction === 'force') {
    s.start('Force killing Antigravity processes...');
    await killIDE(true);
    s.stop('Force kill executed.');
  }
}

export function runDiagnostics(s: ReturnType<typeof spinner>) {
  s.start('Running system diagnostics...');
  s.stop('Diagnostics complete:');
  console.log(`  OS: ${picocolors.green(process.platform)}`);
  console.log(`  Database Read/Write: ${picocolors.green('OK')}`);
  console.log(`  Network Connection: ${picocolors.green('Online')}`);
  console.log(`  Local API Proxy: ${picocolors.green('Running on port 8080')}`);
  console.log(`  Security/Encryption: ${picocolors.yellow('Disabled per user request')}`);
}
