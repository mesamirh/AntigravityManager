import { exec } from 'child_process';
import os from 'os';

export function isIDERunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd =
      os.platform() === 'win32'
        ? 'tasklist /FI "IMAGENAME eq Antigravity IDE.exe" | find /I "Antigravity IDE.exe"'
        : 'pgrep -x "Antigravity IDE"';

    exec(cmd, (err, stdout) => {
      resolve(!err && stdout.trim().length > 0);
    });
  });
}

export function killIDE(force = true): Promise<boolean> {
  return new Promise((resolve) => {
    let cmd = '';
    if (os.platform() === 'win32') {
      cmd = force ? 'taskkill /F /IM "Antigravity IDE.exe" /T' : 'taskkill /IM "Antigravity IDE.exe"'; // Graceful
    } else {
      cmd = force ? 'pkill -9 -x "Antigravity IDE"' : 'pkill -15 -x "Antigravity IDE"';
    }

    exec(cmd, (err) => {
      resolve(!err);
    });
  });
}

export function launchIDE(): Promise<boolean> {
  return new Promise((resolve) => {
    // Attempt URI protocol launch first, fallback to executable
    const cmd =
      os.platform() === 'win32'
        ? 'start "" "antigravity-ide://" || start "" "Antigravity IDE.exe"'
        : os.platform() === 'darwin'
          ? 'open "antigravity-ide://" || open -a "Antigravity IDE"'
          : 'xdg-open "antigravity-ide://" || antigravity-ide &';

    exec(cmd, (err) => {
      resolve(!err);
    });
  });
}
