import { exec } from 'child_process';
import os from 'os';

export function isIDERunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = os.platform() === 'win32'
      ? 'tasklist /FI "IMAGENAME eq Antigravity Manager.exe" | find /I "Antigravity Manager.exe"'
      : 'pgrep -f "Antigravity Manager" || pgrep -f "Antigravity"';
      
    exec(cmd, (err, stdout) => {
      resolve(!err && stdout.trim().length > 0);
    });
  });
}

export function killIDE(force = true): Promise<boolean> {
  return new Promise((resolve) => {
    let cmd = '';
    if (os.platform() === 'win32') {
      cmd = force 
        ? 'taskkill /F /IM "Antigravity Manager.exe" /T'
        : 'taskkill /IM "Antigravity Manager.exe"'; // Graceful
    } else {
      cmd = force
        ? 'pkill -9 -f "Antigravity Manager" || pkill -9 -f "Antigravity"'
        : 'pkill -15 -f "Antigravity Manager" || pkill -15 -f "Antigravity"'; // Graceful
    }
      
    exec(cmd, (err) => {
      resolve(!err);
    });
  });
}

export function launchIDE(): Promise<boolean> {
  return new Promise((resolve) => {
    // Attempt URI protocol launch first, fallback to executable
    const cmd = os.platform() === 'win32'
      ? 'start "" "antigravity://" || start "" "Antigravity Manager.exe"' 
      : os.platform() === 'darwin' 
        ? 'open "antigravity://" || open -a "Antigravity Manager" || open -a "Antigravity"' 
        : 'xdg-open "antigravity://" || antigravity-manager &';
        
    exec(cmd, (err) => {
      resolve(!err);
    });
  });
}
