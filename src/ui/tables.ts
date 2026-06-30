import picocolors from 'picocolors';

export function renderAccountsTable(accounts: any[]) {
  console.log('  ┌────┬──────────────────────┬──────────────────────────────┬──────────────┬────────┬──────────────────────┐');
  console.log(`  │ ${picocolors.bold('ID'.padEnd(2))} │ ${picocolors.bold('Name'.padEnd(20))} │ ${picocolors.bold('Email'.padEnd(28))} │ ${picocolors.bold('Status'.padEnd(12))} │ ${picocolors.bold('Quota'.padEnd(6))} │ ${picocolors.bold('Last Used'.padEnd(20))} │`);
  console.log('  ├────┼──────────────────────┼──────────────────────────────┼──────────────┼────────┼──────────────────────┤');

  accounts.forEach((acc, i) => {
    let statusRaw = 'Unknown';
    let statusColor = picocolors.gray;
    let qRaw = 'N/A';
    let qColor = picocolors.gray;
    
    try {
      const token = JSON.parse(acc.token_json);
      const isExpired = token.expiry_timestamp && Date.now() >= token.expiry_timestamp && !token.refresh_token;
      
      if (isExpired) {
        statusRaw = 'Expired';
        statusColor = picocolors.red;
      } else {
        const q = JSON.parse(acc.quota_json);
        if (q && q.models) {
            const m = q.models['gemini-3.1-pro-high'] || q.models['gemini-3.1-pro-low'] || Object.values(q.models)[0] as any;
            if (m) {
              const p = m.percentage || 0;
              if (p === 0) {
                statusRaw = 'Rate Limited';
                statusColor = picocolors.yellow;
              } else {
                statusRaw = 'Active';
                statusColor = picocolors.green;
              }
              qRaw = `${p}%`;
              qColor = p > 20 ? picocolors.green : (p > 5 ? picocolors.yellow : picocolors.red);
            }
        }
      }
    } catch(e) {}
    
    const idPad = String(i + 1).padEnd(2);
    const nameStr = acc.name ? acc.name.substring(0, 20) : 'Unknown';
    const namePad = nameStr.padEnd(20);
    const emailPad = acc.email.substring(0, 28).padEnd(28);
    const statusPad = statusRaw.padEnd(12);
    const quotaPad = qRaw.padStart(6);
    
    let lastUsedStr = acc.last_used ? new Date(acc.last_used).toLocaleString() : 'Never';
    lastUsedStr = lastUsedStr.substring(0, 20);
    const datePad = lastUsedStr.padEnd(20);

    console.log(`  │ ${idPad} │ ${namePad} │ ${picocolors.cyan(emailPad)} │ ${statusColor(statusPad)} │ ${qColor(quotaPad)} │ ${picocolors.gray(datePad)} │`);
  });
  console.log('  └────┴──────────────────────┴──────────────────────────────┴──────────────┴────────┴──────────────────────┘');
}

export function renderQuotasTable(entries: [string, any][]) {
  console.log('  ┌────────────────────────────────┬─────────┬────────────┬──────────────────────────────┐');
  console.log(`  │ ${picocolors.bold('Model Name'.padEnd(30))} │ ${picocolors.bold('Quota'.padEnd(7))} │ ${picocolors.bold('Progress'.padEnd(10))} │ ${picocolors.bold('Reset Time'.padEnd(28))} │`);
  console.log('  ├────────────────────────────────┼─────────┼────────────┼──────────────────────────────┤');
  
  // Sort by percentage descending, then alphabetically
  entries.sort((a, b) => {
    const pA = a[1].percentage || 0;
    const pB = b[1].percentage || 0;
    if (pA !== pB) return pB - pA;
    return a[0].localeCompare(b[0]);
  });

  for (const [modelName, info] of entries) {
    const p = info.percentage || 0;
    const color = p > 20 ? picocolors.green : (p > 5 ? picocolors.yellow : picocolors.red);
    
    const pStr = `${p}%`;
    const pPad = pStr.padStart(7);
    
    const filledLength = Math.round(p / 10);
    const emptyLength = 10 - filledLength;
    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    
    let resetStr = info.resetTime ? new Date(info.resetTime).toLocaleString() : 'N/A';
    resetStr = resetStr.padEnd(28);

    console.log(`  │ ${picocolors.cyan(modelName.padEnd(30))} │ ${color(pPad)} │ ${color(bar)} │ ${picocolors.gray(resetStr)} │`);
  }
  console.log('  └────────────────────────────────┴─────────┴────────────┴──────────────────────────────┘');
}
