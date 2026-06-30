import http from 'http';
import { getAccounts, getActiveAccount, setActive } from './db';
import { refreshAllQuotas } from './cloud';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

import { transformClaudeRequestIn } from '../antigravity/ClaudeRequestMapper';
import { transformResponse } from '../antigravity/ClaudeResponseMapper';
import { StreamingState, PartProcessor } from '../antigravity/ClaudeStreamingMapper';

const APP_DATA =
  process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'AntigravityManager')
    : path.join(process.env.HOME || '', '.config', 'AntigravityManager');

const CONFIG_FILE = path.join(APP_DATA, 'proxy_config.json');

export function getProxyConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {}
  }
  return { port: 8080, timeoutMs: 30000 };
}

export function saveProxyConfig(config: { port: number; timeoutMs: number }) {
  if (!fs.existsSync(APP_DATA)) fs.mkdirSync(APP_DATA, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let server: http.Server | null = null;
let monitorInterval: NodeJS.Timeout | null = null;

// Model mapping from OpenAI/Anthropic to Gemini native models
const modelMapping: Record<string, string> = {
  'claude-3-5-sonnet-20240620': 'gemini-1.5-pro',
  'claude-3-opus-20240229': 'gemini-1.5-pro',
  'claude-3-haiku-20240307': 'gemini-1.5-flash',
  'gpt-4': 'gemini-1.5-pro',
  'gpt-4o': 'gemini-1.5-pro',
  'gpt-3.5-turbo': 'gemini-1.5-flash'
};

async function checkAndAutoSwitch() {
  await refreshAllQuotas();
  const active = getActiveAccount();
  if (!active) return;

  let needsSwitch = false;
  try {
    const q = JSON.parse(active.quota_json);
    let total = 0;
    let count = 0;
    if (q && q.models) {
      for (const [name, m] of Object.entries<any>(q.models)) {
        if (!name.startsWith('chat_') && !name.startsWith('tab_')) {
          total += m.percentage || 0;
          count++;
        }
      }
    }
    const score = count > 0 ? total / count : 0;
    if (score < 5) needsSwitch = true;
  } catch (e) {
    needsSwitch = true;
  }

  if (needsSwitch) {
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
          for (const [name, m] of Object.entries<any>(q.models)) {
            if (!name.startsWith('chat_') && !name.startsWith('tab_')) {
              total += m.percentage || 0;
              count++;
            }
          }
        }
        if (count > 0) score = total / count;
      } catch (e) {}

      if (score > bestQuotaScore) {
        bestQuotaScore = score;
        bestAccount = acc.email;
      }
    }

    if (bestAccount && bestAccount !== active.email && bestQuotaScore >= 5) {
      setActive(bestAccount);
    }
  }
}

export function startProxy() {
  if (server) return;
  const config = getProxyConfig();

  server = http.createServer((req, res) => {
    if (req.method === 'POST' && (req.url === '/v1/chat/completions' || req.url === '/v1/messages')) {
      req.setTimeout(config.timeoutMs);

      const active = getActiveAccount();
      if (!active) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'No active account found in AntigravityManager'
          })
        );
        return;
      }

      let token = '';
      try {
        const tokenObj = JSON.parse(active.token_json);
        token = tokenObj.access_token || '';
      } catch (e) {
        // ignore
      }

      // Read body
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        let parsedBody: any = {};
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { message: 'Invalid JSON' } }));
        }

        const requestedModel = parsedBody.model || 'unknown';
        const mappedModel = modelMapping[requestedModel] || requestedModel;
        const isStreaming = Boolean(parsedBody.stream);

        try {
          const geminiReq = transformClaudeRequestIn(parsedBody, mappedModel);
          const baseUrl = 'https://cloudcode-pa.googleapis.com/v1internal';

          if (isStreaming) {
            const url = `${baseUrl}/models/${mappedModel}:streamGenerateContent?alt=sse`;
            const response = await axios.post(url, geminiReq, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              responseType: 'stream',
              timeout: config.timeoutMs
            });

            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive'
            });

            const state = new StreamingState();
            const processor = new PartProcessor(state);

            let buffer = '';
            response.data.on('data', (chunk: Buffer) => {
              buffer += chunk.toString('utf-8');
              let boundary = buffer.indexOf('\n\n');
              while (boundary !== -1) {
                const eventText = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);

                if (eventText.startsWith('data: ')) {
                  const dataStr = eventText.slice(6).trim();
                  if (dataStr === '[DONE]') continue;

                  try {
                    const payload = JSON.parse(dataStr);
                    if (!state.messageStartSent) {
                      res.write(state.emitMessageStart(payload));
                    }

                    const parts = payload.candidates?.[0]?.content?.parts || [];
                    for (const part of parts) {
                      const outChunks = processor.process(part);
                      for (const out of outChunks) res.write(out);
                    }
                  } catch (err) {}
                }
                boundary = buffer.indexOf('\n\n');
              }
            });

            response.data.on('end', () => {
              const finishChunks = state.emitFinish();
              for (const fc of finishChunks) res.write(fc);
              res.end();
            });

            response.data.on('error', () => {
              res.end();
            });
          } else {
            // Non-streaming
            const url = `${baseUrl}/models/${mappedModel}:generateContent`;
            const response = await axios.post(url, geminiReq, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: config.timeoutMs
            });

            const anthropicRes = transformResponse(response.data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(anthropicRes));
          }
        } catch (error: any) {
          let status = 500;
          let errMsg = error.message;
          if (axios.isAxiosError(error)) {
            status = error.response?.status || 500;
            errMsg = error.response?.data?.error?.message || errMsg;
          }
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: {
                type: 'api_error',
                message: errMsg
              }
            })
          );
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(config.port, () => {
    // silently running in background
    monitorInterval = setInterval(checkAndAutoSwitch, 5 * 60 * 1000);
    checkAndAutoSwitch().catch(() => {});
  });
}

export function stopProxy() {
  if (server) {
    server.close();
    server = null;
  }
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
