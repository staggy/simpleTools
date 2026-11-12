(() => {
  'use strict';
  const toolsBase = new URL('.', document.currentScript.src);
  window.SIMPLE_TOOLS = [
    { id: 'calculator', title: 'Calculator', href: 'calculator.html', icon: '＋', description: 'Everyday math and scientific calculations' },
    { id: 'converter', title: 'Unit Converter', href: 'calculator/converter.html', icon: '⇄', description: 'Convert common units of measurement' },
    { id: 'checksumCalculator', title: 'Checksum Calculator', href: 'checksumCalculator.html', icon: '⌁', description: 'Calculate and compare file hashes' },
    { id: 'timeSince', title: 'Time Since', href: 'timeSince.html', icon: '◷', description: 'Track time elapsed since a date' },
    { id: 'imageConverter', title: 'Image Converter', href: 'imageConverter.html', icon: '▧', description: 'Convert image formats and resize locally' },
    { id: 'hexViewer', title: 'Hex Viewer & Editor', href: 'hexViewer.html', icon: '0x', description: 'Inspect, edit, and download binary files' },
    { id: 'exifViewer', title: 'EXIF & Metadata', href: 'exifViewer.html', icon: 'ⓘ', description: 'Inspect images and remove selected metadata' },
    { id: 'colorConverter', title: 'Color Converter', href: 'colorConverter.html', icon: '◒', description: 'Convert HEX, RGB, HSL, CMYK, Lab, and more' },
    { id: 'passwordGenerator', title: 'Password Generator', href: 'passwordGenerator.html', icon: '⚿', description: 'Secure passwords with optional weather mixing' },
    { id: 'unixTimestamp', title: 'Unix Timestamp', href: 'unixTimestamp.html', icon: '◴', description: 'Convert dates and timestamps across time zones' },
    { id: 'textDiff', title: 'Text Diff Viewer', href: 'textDiff.html', icon: '≠', description: 'Compare text in aligned side-by-side views' },
    { id: 'jsonFormatter', title: 'JSON Formatter & Validator', href: 'jsonFormatter.html', icon: '{}', description: 'Validate, format, and minify JSON' }
  ];
  const root = document.documentElement;
  let savedTheme;
  try {
    savedTheme = localStorage.getItem('simpletools-calculator-theme') || localStorage.getItem('simple-tools-theme');
  } catch {}
  root.dataset.theme = savedTheme === 'light' || savedTheme === 'dark'
    ? savedTheme
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('toolGrid');
    if (grid) {
      const search = document.getElementById('toolSearch');
      const render = () => {
        const query = (search?.value || '').trim().toLowerCase();
        const found = window.SIMPLE_TOOLS.filter(tool => `${tool.title} ${tool.description}`.toLowerCase().includes(query));
        grid.innerHTML = found.map(tool => `<a class="tool-card" href="${tool.href}"><span class="tool-icon" aria-hidden="true">${tool.icon}</span><span class="tool-copy"><strong>${tool.title}</strong><small>${tool.description}</small></span><span class="arrow" aria-hidden="true">→</span></a>`).join('');
        const summary = document.getElementById('toolSummary');
        if (summary) summary.textContent = query ? `${found.length} tools match your search.` : `${window.SIMPLE_TOOLS.length} tools available`;
      };
      search?.addEventListener('input', render);
      render();
    }
    const toolLinks = document.getElementById('toolLinks');
    if (toolLinks) {
      const current = document.body.dataset.tool;
      toolLinks.innerHTML = window.SIMPLE_TOOLS.map(tool => `<a class="nav-link${tool.id === current ? ' active' : ''}" href="${tool.href}"${tool.id === current ? ' aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${tool.icon}</span>${tool.title}</a>`).join('');
    } else {
      const sidebar = document.getElementById('sidebar');
      const bottom = sidebar?.querySelector('.sidebar-bottom');
      if (bottom) window.SIMPLE_TOOLS.slice(4).forEach(tool => {
        const link = document.createElement('a');
        link.className = 'nav-link'; link.href = new URL(tool.href, toolsBase).href;
        const icon = document.createElement('span'); icon.className = 'nav-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = tool.icon;
        link.append(icon, document.createTextNode(tool.title)); sidebar.insertBefore(link, bottom);
      });
    }
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    function updateThemeButton() {
      const dark = root.dataset.theme === 'dark';
      document.getElementById('themeName').textContent = dark ? 'light' : 'dark';
      themeToggle.setAttribute('aria-label', `Use ${dark ? 'light' : 'dark'} theme`);
      themeToggle.setAttribute('aria-pressed', String(dark));
    }

    themeToggle.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('simpletools-calculator-theme', root.dataset.theme);
        localStorage.setItem('simple-tools-theme', root.dataset.theme);
      } catch {}
      updateThemeButton();
    });
    updateThemeButton();

    function setMenuOpen(open) {
      sidebar.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) sidebar.querySelector('a, button')?.focus();
    }
    menuToggle.addEventListener('click', () => setMenuOpen(!sidebar.classList.contains('open')));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && sidebar.classList.contains('open')) {
        setMenuOpen(false);
        menuToggle.focus();
      }
    });
    document.addEventListener('click', event => {
      if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) setMenuOpen(false);
    });
  });
})();
