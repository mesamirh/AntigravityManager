# Antigravity Manager

Antigravity Manager is a powerful CLI utility that acts as an intelligent proxy and orchestrator for Google Cloud's AI services. It is designed to sit between AI client applications (like Cursor, VS Code, or custom clients) and Google's internal APIs, providing a seamless multi-account pooling and quota tracking experience.

## Features

- **Local API Proxy**: Runs a local background server on port `8080` (by default) that acts as an OpenAI and Anthropic compatible endpoint. It translates requests from these formats into Google Gemini native requests.
- **Multi-Account Pooling**: Add unlimited Google accounts via an automated OAuth 2.0 flow. 
- **Intelligent Auto-Switching**: The proxy automatically monitors quotas in the background. If the active account falls below a 5% quota threshold or hits a rate limit, the system gracefully rotates to the next optimal account mid-flight.
- **Detailed Quota Tracking**: Visualizes exact quota numbers separately for Gemini and Claude models, tracking the pooled availability across all your accounts in a sleek Terminal UI dashboard.
- **Process Control**: Automatically detect, gracefully shut down, or force-kill running Antigravity IDE instances, allowing you to inject a new active account before relaunching.
- **State Snapshots**: Create, restore, and delete full snapshots of your account database. Quickly rollback to a known good state or share account configurations across machines.
- **Auto-Formatting**: Integrated with Prettier to keep all source code automatically formatted and clean.

## Installation & Usage

Ensure you have Node.js and `npm` installed.

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the CLI and Background Proxy:
   ```bash
   npm start
   ```

Upon running `npm start`, a terminal UI will appear, and the local proxy server will silently boot in the background (defaulting to `http://localhost:8080`).

## Interactive TUI Dashboard

The CLI is structured into three primary dashboards for easy navigation:

### Manage Accounts
- **View Accounts Table**: Shows a color-coded table of all accounts, displaying their exact Gemini and Claude quota percentages side-by-side.
- **Add Account**: Triggers an OAuth flow in your default browser.
- **Delete Account**: Removes a configured account from the pool.
- **Switch Account**: Manually force the active account to change.

### Quotas & Monitoring
- **View Active Quotas**: Provides a precise model-by-model breakdown for the current active account.
- **Pooled Quotas**: Check the combined average quota available across your entire account pool.

### System & Settings
- **Process Control**: Check if the Antigravity IDE is running and send commands to launch or terminate it.
- **Proxy Configuration**: Change the local proxy port or request timeout duration.
- **Backup & Restore**: Create full JSON snapshots of your account database.

## Database Storage

The application securely stores your configuration and OAuth tokens in a local SQLite file named `cloud_accounts.db` located in your system's App Data directory:
- **Mac/Linux**: `~/.config/AntigravityManager/cloud_accounts.db`
- **Windows**: `%APPDATA%\AntigravityManager\cloud_accounts.db`

## Integrating Clients (Proxy Usage)

Point your AI applications to the local proxy:

- **Base URL**: `http://localhost:8080/v1`
- **API Key**: Any dummy string (e.g. `sk-antigravity`)

The proxy intercepts `/v1/chat/completions` (OpenAI format) and `/v1/messages` (Anthropic format) and dynamically translates them. It maps models like `claude-3-5-sonnet-20240620` and `gpt-4o` to `gemini-1.5-pro` and `gemini-1.5-flash` natively.

## Development

To format your code automatically, run:
```bash
npm run format
```
