(() => {
  'use strict';
  const root = document.documentElement;
  let savedTheme;
  try {
    savedTheme = localStorage.getItem('simpletools-calculator-theme') || localStorage.getItem('simple-tools-theme');
  } catch {}
  root.dataset.theme = savedTheme === 'light' || savedTheme === 'dark'
    ? savedTheme
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const themeToggle = document.getElementById('themeToggle');

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
