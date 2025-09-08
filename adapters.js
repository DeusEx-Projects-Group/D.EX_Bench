// adapters.js
window.Bench = {
  // Define providers and their presets
  providers: {
    openai: {
      presets: [
        {
          name: 'gpt-4o-mini streaming',
          baseUrl: '',           // will be filled from UI
          route: '/v1/chat/completions',
          stream: true,
          needsKey: true
        },
        {
          name: 'gpt-4o-mini non-streaming',
          baseUrl: '',
          route: '/v1/chat/completions',
          stream: false,
          needsKey: true
        }
      ]
    },
    llamacpp_native: {
      presets: [
        {
          name: 'llama.cpp streaming',
          baseUrl: '',
          route: '/chat',
          stream: true,
          needsKey: false
        },
        {
          name: 'llama.cpp non-streaming',
          baseUrl: '',
          route: '/chat',
          stream: false,
          needsKey: false
        }
      ]
    }
  },

  // Run a single benchmark with metrics and optional streaming
  runOnce: async function (cfg) {
    const url = cfg.baseUrl.replace(/\/+$/, '') + cfg.route;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (cfg.apiKey) {
      headers['Authorization'] = `Bearer ${cfg.apiKey}`;
    }

    const payload = {
      model: cfg.model,
      messages: [
        { role: 'system', content: cfg.sysPrompt },
        { role: 'user', content: cfg.userText }
      ],
      stream: cfg.stream
    };

    const encoder = new TextEncoder();
    const startTime = performance.now();
    let firstTokenTime = null;
    let tokenCount = 0;
    let collected = '';

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    // Handle streaming response
    if (cfg.stream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // naive split on newlines and "data: "
        chunk.split('\n').forEach(line => {
          if (!line.startsWith('data: ')) return;
          const json = line.slice(6).trim();
          if (json === '[DONE]') return;
          try {
            const obj = JSON.parse(json);
            const text = obj.choices[0].delta.content || '';
            if (text) {
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
                this.notifyTTFT(firstTokenTime - startTime);
              }
              tokenCount += 1;
              collected += text;
              this.appendToken(text);
            }
          } catch (e) {
            console.warn('Stream parse error', e);
          }
        });
      }
    }
    // Handle non-streaming response
    else {
      const json = await res.json();
      const content = json.choices[0].message.content || '';
      firstTokenTime = performance.now();
      this.notifyTTFT(firstTokenTime - startTime);
      // simple token imitation: split on whitespace
      const tokens = content.split(/\s+/);
      tokens.forEach(tok => {
        tokenCount += 1;
        this.appendToken(tok + ' ');
      });
      collected = content;
    }

    const endTime = performance.now();
    const totalMs = Math.round(endTime - startTime);
    const ttftMs = Math.round((firstTokenTime - startTime) || totalMs);
    const tps = Math.round((tokenCount / (totalMs / 1000)) || 0);

    return {
      ttftMs,
      tokenLikeCount: tokenCount,
      tokensPerSec: tps,
      totalMs
    };
  },

  // Export last result as JSON file
  exportJSON: function () {
    if (!window.lastBenchResult) return;
    const data = JSON.stringify(window.lastBenchResult, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bench-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Export last result as CSV file
  exportCSV: function () {
    if (!window.lastBenchResult) return;
    const result = window.lastBenchResult;
    const headers = Object.keys(result);
    const values = headers.map(k => `"${String(result[k]).replace(/"/g, '""')}"`);
    const csv = headers.join(',') + '\n' + values.join(',');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bench-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Ping base URL to measure simple latency
  ping: async function (baseUrl) {
    const url = baseUrl.replace(/\/+$/, '');
    const start = performance.now();
    try {
      const res = await fetch(url, { method: 'GET', cache: 'no-cache' });
      const ms = Math.round(performance.now() - start);
      return { ok: res.ok, ms };
    } catch (e) {
      const ms = Math.round(performance.now() - start);
      return { ok: false, ms };
    }
  },

  // Helpers forwarded to UI
  notifyTTFT: ms => window.BenchUI.notifyTTFT(ms),
  appendToken: txt => window.BenchUI.appendToken(txt)
};