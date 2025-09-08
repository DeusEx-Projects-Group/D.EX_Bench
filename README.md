<<<<<<< HEAD
# Deus Ex Bench (Alpha) (Standalone HTML)

Self-contained benchmark UI for OpenAI and OpenAI-compatible servers (e.g., llama.cpp `/v1`).

A lightweight, portable page for transparent local AI benchmarking:
- TTFT (time-to-first-token), token-like count, tokens/s, total latency
- Prompt hash (SHA-256) included in exports for integrity
- Works with **OpenAI-compatible** servers and **llama.cpp native** `/completion`
- JSON/CSV export
- Optional CORS proxy (PowerShell) that preserves streaming
- Baseline **prompt hash** embedded in exports (to come in update)
- JSON/CSV export + Copy

## Use
1. Open `index.html` in a modern browser.
2. Accept the EULA.
3. Choose **Provider**. For local llama.cpp with OAI-compat use `http://127.0.0.1:8085/v1` (or your port).
4. Enter **API Key** if required and **Model** id.
5. **Save**, **Ping**, **Start Benchmark**, then **Send** a prompt.

> CORS: Cloud APIs may block browser calls. If so, run your existing PowerShell CORS proxy or serve this page from the same origin as the API.

© 2025 Deus Ex Projects Group. All rights reserved.
=======
# D.EX_Bench
D.EX Bench - OpenAi TTFT Testing Platform
>>>>>>> 52565d731cd15efcfa654b03d7801234bf7d57c8
