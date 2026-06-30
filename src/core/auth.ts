import http from 'http';
import open from 'open';
import { URL } from 'url';

const CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://127.0.0.1:8888/';
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
  'https://www.googleapis.com/auth/aicode'
].join(' ');

export const AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent&include_granted_scopes=true`;
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_USERINFO = 'https://www.googleapis.com/oauth2/v2/userinfo';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expiry_timestamp?: number;
}

export interface UserInfo {
  email: string;
  name: string;
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch(URL_TOKEN, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to exchange code: ${res.statusText} - ${errText}`);
  }

  const data = await res.json();
  data.expiry_timestamp = Date.now() + (data.expires_in * 1000);
  return data;
}

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch(URL_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch user info: ${res.statusText}`);
  return res.json();
}

export async function startOAuthFlow(): Promise<{ tokens: OAuthTokens; user: UserInfo }> {
  return new Promise((resolve, reject) => {
    let server: http.Server;
    
    // Safety timeout to prevent hanging forever
    const timeout = setTimeout(() => {
      if (server) server.close();
      reject(new Error('OAuth flow timed out'));
    }, 5 * 60 * 1000);

    server = http.createServer(async (req, res) => {
      try {
        if (!req.url) return;
        const url = new URL(req.url, `http://${req.headers.host}`);
        if (url.pathname !== '/') return;

        const code = url.searchParams.get('code');
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication successful!</h1><p>You can close this window and return to the terminal.</p><script>setTimeout(() => window.close(), 3000);</script>');
          
          server.close();
          clearTimeout(timeout);

          const tokens = await exchangeCodeForTokens(code);
          const user = await fetchUserInfo(tokens.access_token);
          resolve({ tokens, user });
        } else if (url.searchParams.get('error')) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication failed!</h1><p>Please check the terminal.</p>');
          server.close();
          clearTimeout(timeout);
          reject(new Error(`OAuth error: ${url.searchParams.get('error')}`));
        }
      } catch (err) {
        console.error('Error in OAuth callback:', err);
        res.writeHead(500).end('Internal Server Error');
      }
    });

    server.listen(8888, '127.0.0.1', async () => {
      try {
        await open(AUTH_URL);
      } catch (e) {
        // Ignore open errors, user can click the link
      }
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        clearTimeout(timeout);
        reject(new Error('Port 8888 is already in use. Cannot start OAuth server.'));
      }
    });
  });
}
