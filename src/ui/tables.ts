import picocolors from 'picocolors';
import { createResponsiveTable, ColumnDef } from './ResponsiveTable';

export function renderAccountsTable(accounts: any[]) {
  const columns: ColumnDef[] = [
    { header: 'ID', weight: 0.05, minWidth: 4, align: 'center' },
    { header: 'Name', weight: 0.2, hideOnNarrow: true },
    { header: 'Email', weight: 0.3 },
    { header: 'Status', weight: 0.15 },
    { header: 'Gemini', weight: 0.1, align: 'center' },
    { header: 'Claude', weight: 0.1, align: 'center' },
    { header: 'Last Used', weight: 0.1, hideOnNarrow: true }
  ];

  const rows: string[][] = [];

  accounts.forEach((acc, i) => {
    let statusRaw = 'Unknown';
    let statusColor = picocolors.gray;

    let gRaw = 'N/A';
    let gColor = picocolors.gray;

    let cRaw = 'N/A';
    let cColor = picocolors.gray;

    try {
      const token = JSON.parse(acc.token_json);
      const isExpired = token.expiry_timestamp && Date.now() >= token.expiry_timestamp && !token.refresh_token;

      if (isExpired) {
        statusRaw = 'Expired';
        statusColor = picocolors.red;
      } else {
        const q = JSON.parse(acc.quota_json);
        if (q && q.models) {
          let gTotal = 0,
            gCount = 0;
          let cTotal = 0,
            cCount = 0;
          for (const [modelName, m] of Object.entries<any>(q.models)) {
            if (modelName.includes('gemini')) {
              gTotal += m.percentage || 0;
              gCount++;
            } else if (modelName.includes('claude')) {
              cTotal += m.percentage || 0;
              cCount++;
            }
          }

          let isActive = false;
          let isRateLimited = true;

          if (gCount > 0) {
            const p = Math.round(gTotal / gCount);
            gRaw = `${p}%`;
            gColor = p > 20 ? picocolors.green : p > 5 ? picocolors.yellow : picocolors.red;
            if (p > 0) isActive = true;
          }

          if (cCount > 0) {
            const p = Math.round(cTotal / cCount);
            cRaw = `${p}%`;
            cColor = p > 20 ? picocolors.green : p > 5 ? picocolors.yellow : picocolors.red;
            if (p > 0) isActive = true;
          }

          if (gCount === 0 && cCount === 0) {
            isRateLimited = false;
          }

          if (isActive) {
            statusRaw = 'Active';
            statusColor = picocolors.green;
          } else if (isRateLimited) {
            statusRaw = 'Rate Limited';
            statusColor = picocolors.yellow;
          } else {
            statusRaw = 'No Quota Data';
            statusColor = picocolors.gray;
          }
        }
      }
    } catch (e) {}

    const idPad = String(i + 1);
    const nameStr = acc.name || 'Unknown';
    const emailPad = picocolors.cyan(acc.email);
    const statusPad = statusColor(statusRaw);
    const gPad = gColor(gRaw);
    const cPad = cColor(cRaw);

    let lastUsedStr = acc.last_used ? new Date(acc.last_used).toLocaleString() : 'Never';

    rows.push([idPad, nameStr, emailPad, statusPad, gPad, cPad, picocolors.gray(lastUsedStr)]);
  });

  console.log(
    createResponsiveTable(columns, rows)
      .split('\n')
      .map((line) => '  ' + line)
      .join('\n')
  );
}

export function renderQuotasTable(entries: [string, any][]) {
  const columns: ColumnDef[] = [
    { header: 'Model Name', weight: 0.4 },
    { header: 'Quota', weight: 0.1, align: 'center' },
    { header: 'Progress', weight: 0.2 },
    { header: 'Reset Time', weight: 0.3, hideOnNarrow: true }
  ];

  const rows: string[][] = [];

  entries.sort((a, b) => {
    const pA = a[1].percentage || 0;
    const pB = b[1].percentage || 0;
    if (pA !== pB) return pB - pA;
    return a[0].localeCompare(b[0]);
  });

  const termWidth = process.stdout.columns || 100;
  const progressColChars = Math.max(10, Math.floor(termWidth * 0.2) - 4);

  for (const [modelName, info] of entries) {
    const p = info.percentage || 0;
    const color = p > 20 ? picocolors.green : p > 5 ? picocolors.yellow : picocolors.red;

    const pStr = `${p}%`;

    const filledLength = Math.round((p / 100) * progressColChars);
    const emptyLength = Math.max(0, progressColChars - filledLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);

    let resetStr = info.resetTime ? new Date(info.resetTime).toLocaleString() : 'N/A';

    rows.push([picocolors.cyan(modelName), color(pStr), color(bar), picocolors.gray(resetStr)]);
  }

  console.log(
    createResponsiveTable(columns, rows)
      .split('\n')
      .map((line) => '  ' + line)
      .join('\n')
  );
}
