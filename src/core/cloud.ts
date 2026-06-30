import { getAccounts, updateQuota, updateToken } from './db';

const CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const USER_AGENT = 'antigravity/1.11.3 Darwin/arm64';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const ENDPOINTS_LOAD_PROJECT = [
  'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:loadCodeAssist',
  'https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
  'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist'
];

const ENDPOINTS_QUOTA = [
  'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels',
  'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
];
export async function refreshAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const res = await fetch(URL_TOKEN, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Token refresh failed (${res.status}): ${res.statusText} - ${errText}`);
  }
  return res.json();
}

export async function fetchProjectId(accessToken: string) {
  for (const endpoint of ENDPOINTS_LOAD_PROJECT) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.cloudaicompanionProject) {
          return data.cloudaicompanionProject;
        }
      }
    } catch (e) {
      // Ignore network errors and try the next endpoint
    }
  }
  return null;
}

export async function fetchLiveQuota(accessToken: string) {
  const projectId = await fetchProjectId(accessToken);
  const payload = projectId ? { project: projectId } : {};

  let lastError = new Error('No endpoints available');

  for (const endpoint of ENDPOINTS_QUOTA) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401 || res.status === 403) {
        const errText = await res.text().catch(() => '');
        lastError = new Error(`Quota fetch failed (${res.status}) on ${endpoint}: ${res.statusText} - ${errText}`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Quota fetch failed (${res.status}) on ${endpoint}: ${res.statusText} - ${errText}`);
      }

      const rawData = await res.json();
      const result: any = { models: {} };
      if (rawData.models) {
        for (const [name, info] of Object.entries<any>(rawData.models)) {
          const qInfo = info.quotaInfo;
          if (qInfo) {
            result.models[name] = {
              percentage: Math.floor((qInfo.remainingFraction || 0) * 100),
              resetTime: qInfo.resetTime || ''
            };
          }
        }
      }
      return result;
    } catch (e: any) {
      lastError = e;
    }
  }

  throw lastError;
}

export async function refreshAllQuotas(): Promise<string[]> {
  const accounts = getAccounts();
  const errors: string[] = [];
  for (const acc of accounts) {
    try {
      let token = JSON.parse(acc.token_json);
      if (!token.access_token) {
        errors.push(`Account ${acc.email} is missing an access token.`);
        continue;
      }

      // Auto refresh if expired
      const now = Date.now();
      if (token.expiry_timestamp && now >= token.expiry_timestamp && token.refresh_token) {
        const newTokens = await refreshAccessToken(token.refresh_token);
        token.access_token = newTokens.access_token;
        token.expiry_timestamp = now + (newTokens.expires_in || 3600) * 1000;
        updateToken(acc.email, token);
      }

      const quota = await fetchLiveQuota(token.access_token);
      updateQuota(acc.email, quota);
    } catch (e: any) {
      errors.push(`Failed for ${acc.email}: ${e.message}`);
    }
  }
  return errors;
}
