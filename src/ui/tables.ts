import picocolors from 'picocolors';

export function renderAccountsTable(accounts: any[]) {
  console.log(
    '  ┌────┬──────────────────────┬──────────────────────────────┬──────────────┬────────┬────────┬──────────────────────┐'
  );
  console.log(
    `  │ ${picocolors.bold('ID'.padEnd(2))} │ ${picocolors.bold('Name'.padEnd(20))} │ ${picocolors.bold('Email'.padEnd(28))} │ ${picocolors.bold('Status'.padEnd(12))} │ ${picocolors.bold('Gemini'.padEnd(6))} │ ${picocolors.bold('Claude'.padEnd(6))} │ ${picocolors.bold('Last Used'.padEnd(20))} │`
  );
  console.log(
    '  ├────┼──────────────────────┼──────────────────────────────┼──────────────┼────────┼────────┼──────────────────────┤'
  );

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
            isRateLimited = false; // No quota data yet
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

    const idPad = String(i + 1).padEnd(2);
    const nameStr = acc.name ? acc.name.substring(0, 20) : 'Unknown';
    const namePad = nameStr.padEnd(20);
    const emailPad = acc.email.substring(0, 28).padEnd(28);
    const statusPad = statusRaw.padEnd(12);
    const gPad = gRaw.padStart(6);
    const cPad = cRaw.padStart(6);

    let lastUsedStr = acc.last_used ? new Date(acc.last_used).toLocaleString() : 'Never';
    lastUsedStr = lastUsedStr.substring(0, 20);
    const datePad = lastUsedStr.padEnd(20);

    console.log(
      `  │ ${idPad} │ ${namePad} │ ${picocolors.cyan(emailPad)} │ ${statusColor(statusPad)} │ ${gColor(gPad)} │ ${cColor(cPad)} │ ${picocolors.gray(datePad)} │`
    );
  });
  console.log(
    '  └────┴──────────────────────┴──────────────────────────────┴──────────────┴────────┴────────┴──────────────────────┘'
  );
}

export function renderQuotasTable(entries: [string, any][]) {
  console.log('  ┌────────────────────────────────┬─────────┬────────────┬──────────────────────────────┐');
  console.log(
    `  │ ${picocolors.bold('Model Name'.padEnd(30))} │ ${picocolors.bold('Quota'.padEnd(7))} │ ${picocolors.bold('Progress'.padEnd(10))} │ ${picocolors.bold('Reset Time'.padEnd(28))} │`
  );
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
    const color = p > 20 ? picocolors.green : p > 5 ? picocolors.yellow : picocolors.red;

    const pStr = `${p}%`;
    const pPad = pStr.padStart(7);

    const filledLength = Math.round(p / 10);
    const emptyLength = 10 - filledLength;
    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);

    let resetStr = info.resetTime ? new Date(info.resetTime).toLocaleString() : 'N/A';
    resetStr = resetStr.padEnd(28);

    console.log(
      `  │ ${picocolors.cyan(modelName.padEnd(30))} │ ${color(pPad)} │ ${color(bar)} │ ${picocolors.gray(resetStr)} │`
    );
  }
  console.log('  └────────────────────────────────┴─────────┴────────────┴──────────────────────────────┘');
}
