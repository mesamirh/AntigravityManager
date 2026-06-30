# Antigravity Manager

Antigravity Manager is a powerful CLI utility that acts as an intelligent proxy and orchestrator for Google Cloud's AI services. It is designed to sit between AI client applications (like Cursor, VS Code, or custom clients) and Google's internal APIs, providing a seamless multi-account pooling and quota tracking experience.

## Features

- **Local API Proxy**: Runs a local background server on port `8080` (by default) that acts as an OpenAI and Anthropic compatible endpoint. It translates requests from these formats into Google Gemini native requests.
- **Multi-Account Pooling**: Add unlimited Google accounts via an automated OAuth 2.0 flow. 
- **Intelligent Auto-Switching**: The proxy automatically monitors quotas in the background. If the active account falls below a 5% quota threshold or hits a rate limit, the system gracefully rotates to the next optimal account mid-flight.
- **Detailed Quota Tracking**: Visualizes exact quota numbers model-by-model, filtering out internal models to keep the display clean. 
- **Process Control**: Automatically detect, gracefully shut down, or force-kill running Antigravity IDE instances, allowing you to inject a new active account before relaunching.
- **State Snapshots**: Create, restore, and delete full snapshots of your account database. Quickly rollback to a known good state or share account configurations across machines.

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

## Interacting with the CLI

- **List Accounts**: Shows a color-coded table of all accounts, their active status (Active, Rate Limited, Expired), overall quota health, and last used time.
- **View Detailed Quotas**: Provides a precise model-by-model breakdown for a selected account, including progress bars and reset times.
- **Add Account**: Triggers an OAuth flow in your default browser.
- **Switch Account**: Manually force the active account to change and reboot any connected IDEs.
- **Process Control**: Check if Antigravity is running and send commands to launch or terminate it.
- **Proxy Configuration**: Change the local proxy port or request timeout duration.
- **Backup & Restore**: Create full JSON snapshots of your account database, stored in your system's `App Data` directory.

## Integrating Clients (Proxy Usage)

Point your AI applications to the local proxy:

- **Base URL**: `http://localhost:8080/v1`
- **API Key**: Any dummy string (e.g. `sk-antigravity`)

The proxy intercepts `/v1/chat/completions` (OpenAI format) and `/v1/messages` (Anthropic format) and dynamically translates them. It maps models like `claude-3-5-sonnet-20240620` and `gpt-4o` to `gemini-1.5-pro` and `gemini-1.5-flash` natively.
