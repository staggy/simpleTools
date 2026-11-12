(() => {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const tool = window.SIMPLE_TOOLS.find(item => item.id === document.body.dataset.tool);
  if (!tool) throw new Error('Unknown tool page.');
  document.title = `${tool.title} · Simple Tools`;
  document.body.classList.add('tools-wide');
  document.body.innerHTML = `<div class="shell"><aside class="sidebar" id="sidebar" aria-label="Main navigation"><a class="brand" href="index.html">▦ Simple Tools</a><a class="nav-link" href="index.html"><span class="nav-icon" aria-hidden="true">⌂</span>Home</a><div class="nav-label">Tools</div><nav id="toolLinks" aria-label="Tools"></nav><div class="sidebar-bottom"><button class="nav-action" id="themeToggle" type="button"><span class="nav-icon" aria-hidden="true">◐</span><span>Use <span id="themeName">dark</span> theme</span></button></div></aside><main class="main"><div class="content"><header class="topbar"><div class="topbar-title"><button class="icon-button menu-toggle" id="menuToggle" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">☰</button><h1>${escape(tool.title)}</h1></div></header><p class="tool-intro">${escape(tool.description)}.</p><div id="toolContent"></div></div></main></div>`;
  const scripts = new Map();
  window.Toolbox = {
    escape,
    setContent(html) { document.getElementById('toolContent').innerHTML = html; },
    bytes(value) { if (!value) return '0 B'; const unit = Math.min(4, Math.floor(Math.log(value) / Math.log(1024))); return `${Number((value / 1024 ** unit).toFixed(unit ? 2 : 0))} ${['B','KiB','MiB','GiB','TiB'][unit]}`; },
    status(element, message, error = false) { if (typeof element === 'string') element = document.getElementById(element); element.textContent = message; element.classList.toggle('error', error); element.setAttribute('role', error ? 'alert' : 'status'); },
    download(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); },
    async copy(text) { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return; } const input = document.createElement('textarea'); input.value = text; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); const ok = document.execCommand('copy'); input.remove(); if (!ok) throw new Error('Clipboard unavailable. Select and copy the text manually.'); },
    loadScript(path) { if (!scripts.has(path)) scripts.set(path, new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = path; script.onload = resolve; script.onerror = () => { scripts.delete(path); reject(new Error(`Could not load local support file: ${path}`)); }; document.head.append(script); })); return scripts.get(path); }
  };
})();
