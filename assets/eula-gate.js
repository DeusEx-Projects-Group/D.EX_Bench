// ./assets/eula-gate.js
(() => {
  // minimal, isolated styles (do not affect existing UI)
  const css = `
  #de-eula-overlay{position:fixed;inset:0;background:rgba(0,0,0,.70);display:none;align-items:center;justify-content:center;z-index:99999}
  #de-eula-card{width:min(900px,92vw);max-height:80vh;background:#0f141a;color:#e6f2ed;border:1px solid #27323d;border-radius:16px;
    box-shadow:0 10px 40px rgba(0,0,0,.6);padding:16px;display:flex;flex-direction:column}
  #de-eula-text{white-space:pre-wrap;overflow:auto;background:#0a0e13;border:1px solid #1e2730;padding:12px;border-radius:12px;flex:1}
  #de-eula-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}
  #de-eula-actions button{background:#9adbc8;color:#0d1513;border:none;border-radius:10px;padding:10px 14px;cursor:pointer}
  #de-eula-actions button#de-eula-decline{background:#2a353f;color:#e6f2ed;border:1px solid #3a4854}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  }

  async function loadEula() {
    const res = await fetch('./assets/EULA.md', {cache:'no-cache'});
    if (!res.ok) throw new Error('EULA.md fetch failed');
    return await res.text();
  }

  function getSaved() {
    try { return JSON.parse(localStorage.getItem('DEUS_EX_EULA') || 'null'); }
    catch { return null; }
  }
  function save(obj) {
    localStorage.setItem('DEUS_EX_EULA', JSON.stringify(obj));
  }

  function showOverlay(eulaText, hash) {
    const overlay = document.getElementById('de-eula-overlay');
    const bodyStyle = document.body.style;
    const txt = document.getElementById('de-eula-text');
    const accept = document.getElementById('de-eula-accept');
    const decline = document.getElementById('de-eula-decline');

    txt.textContent = eulaText;
    overlay.style.display = 'flex';
    bodyStyle.pointerEvents = 'none'; // block underlying UI
    overlay.addEventListener('click', e => e.stopPropagation());

    accept.addEventListener('click', () => {
      const acceptedAt = new Date().toISOString();
      const stamp = { hash, acceptedAt };
      save(stamp);
      window.DEUS_EX_EULA = stamp;
      overlay.style.display = 'none';
      bodyStyle.pointerEvents = ''; // restore UI
    }, { once: true });

    decline.addEventListener('click', () => {
      location.href = 'about:blank';
    }, { once: true });
  }

  window.addEventListener('DOMContentLoaded', async () => {
    try {
      const eula = await loadEula();
      const hash = await sha256Hex(eula);
      const saved = getSaved();
      // expose globally for exporters
      window.DEUS_EX_EULA = saved && saved.hash === hash ? saved : null;

      if (!saved || saved.hash !== hash) {
        // new or changed EULA → gate until accepted
        showOverlay(eula, hash);
      } else {
        // already accepted current EULA → nothing to show
      }
    } catch (e) {
      console.error('EULA gate error:', e);
      // fail-open so you aren’t locked out; you can change to fail-closed if preferred
    }
  });
})();
