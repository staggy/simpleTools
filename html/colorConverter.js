(() => {
  'use strict';
  const T = Toolbox;
  T.setContent(`<section class="card"><h2>Choose a color</h2><div class="inline-field"><div class="form-field" style="flex:4"><label for="colorInput">Color value</label><input id="colorInput" type="text" value="#0878d1" spellcheck="false" autocomplete="off" aria-describedby="colorHelp"></div><div class="form-field" style="flex:0"><label for="colorPicker">Picker</label><input id="colorPicker" type="color" value="#0878d1" style="width:65px;height:43px"></div><button id="convertColor" type="button" class="primary-button">Convert</button></div><p id="colorHelp" class="help">Enter a CSS color, HEX, rgb(), hsl(), hsv(210, 80%, 90%), cmyk(0%, 40%, 80%, 10%), lab(), or oklch(). Alpha is supported in CSS colors and as / 50% in HSV or CMYK.</p><div id="colorSwatch" style="height:100px;border-radius:10px;border:1px solid var(--line);background:#0878d1" aria-label="Color preview"></div><p id="colorStatus" class="status" role="status" aria-live="polite"></p></section><section class="card"><div class="results-heading"><h2>Color formats</h2><button id="copyColors" class="small-button" type="button">Copy all</button></div><div id="colorResults" class="result-list"></div><p class="help">Lab and LCH use the D50 white point. OKLab and OKLCH use D65. CMYK is a mathematical approximation without a printer profile. HEX, RGB, HSV, HSL, and CMYK use sRGB; wider-gamut colors are clipped for those outputs.</p></section><p class="tool-note">All color calculations run in your browser. Powered by the bundled <a href="https://colorjs.io/" target="_blank" rel="noopener noreferrer">Color.js</a> library.</p>`);
  const $ = id => document.getElementById(id);
  const fmt = (v, digits = 4) => { v=Number(v); return Number.isFinite(v) ? String(Number(v.toFixed(digits))) : '0'; };
  function normalized(color) {
    if(color.coords.some(v=>v===null||!Number.isFinite(Number(v)))||!Number.isFinite(Number(color.alpha)))throw new Error('Enter a complete color with numeric components; missing components (none) are not supported.');
    color.coords=color.coords.map(Number);color.alpha=Number(color.alpha);return color;
  }
  function parseColor(value) {
    const custom = value.trim().match(/^(hsv|hsva|cmyk)\((.*)\)$/i);
    if (!custom) return normalized(new Color(value.trim()));
    const type = custom[1].toLowerCase(), parts = custom[2].split('/');
    if (parts.length > 2) throw new Error('Use one slash before alpha.');
    const tokens = parts[0].trim().split(/[\s,]+/).filter(Boolean);
    let alpha = parts[1]?.trim();
    if (type === 'hsva' && tokens.length === 4 && !alpha) alpha = tokens.pop();
    if (tokens.length !== (type === 'cmyk' ? 4 : 3)) throw new Error(`Expected ${type === 'cmyk' ? 4 : 3} color components.`);
    const number = (s, percent = false) => { if (!/^[+-]?(?:\d+\.?\d*|\.\d+)%?$/.test(s)) throw new Error('Use numeric color components.'); const n = Number(s.replace('%', '')); if (!Number.isFinite(n)) throw new Error('Invalid color component.'); if (percent && (n < 0 || n > 100)) throw new Error('Percent components must be between 0 and 100.'); return n; };
    const a = alpha === undefined ? 1 : number(alpha) / (alpha.endsWith('%') ? 100 : 1);
    if (a < 0 || a > 1) throw new Error('Alpha must be from 0 to 1, or 0% to 100%.');
    if (type !== 'cmyk') return new Color('hsv', [((number(tokens[0]) % 360) + 360) % 360, number(tokens[1], true), number(tokens[2], true)], a);
    const [c,m,y,k] = tokens.map(s => number(s, true) / 100);
    return new Color('srgb', [(1-c)*(1-k), (1-m)*(1-k), (1-y)*(1-k)], a);
  }
  function getFormats(color) {
    const rgb = color.to('srgb').toGamut({method:'clip'}), [r,g,b] = rgb.coords, a = color.alpha;
    const hex = '#' + [r,g,b,...(a < 1 ? [a] : [])].map(v => Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase();
    const alpha = a < 1 ? ` / ${fmt(a)}` : '';
    const k = 1 - Math.max(r,g,b), ink = k >= 1 - 1e-10 ? [0,0,0,1] : [(1-r-k)/(1-k),(1-g-k)/(1-k),(1-b-k)/(1-k),k];
    const hsl = rgb.to('hsl').coords, hsv = rgb.to('hsv').coords;
    return [
      ['HEX', hex], ['RGB / RGBA', `rgb(${[r,g,b].map(v=>fmt(v*255,2)).join(' ')}${alpha})`],
      ['HSL / HSLA', `hsl(${fmt(hsl[0])} ${fmt(hsl[1])}% ${fmt(hsl[2])}%${alpha})`],
      ['HSV', `hsv(${fmt(hsv[0])} ${fmt(hsv[1])}% ${fmt(hsv[2])}%${alpha})`],
      ['CMYK', `cmyk(${ink.map(v=>fmt(v*100)+'%').join(' ')}${alpha})`],
      ...[['Lab','lab'],['LCH','lch'],['OKLab','oklab'],['OKLCH','oklch'],['XYZ D50','xyz-d50'],['XYZ D65','xyz-d65'],['Display P3','p3']].map(([label,space])=>[label,color.to(space).toString({precision:7,inGamut:false})])
    ];
  }
  let latest = [];
  function convert() {
    try {
      const color = parseColor($('colorInput').value);
      if (![...color.coords,color.alpha].every(v=>v === null || Number.isFinite(v))) throw new Error('Color contains an invalid component.');
      if (color.alpha < 0 || color.alpha > 1) throw new Error('Alpha must be between 0 and 1.');
      latest = getFormats(color);
      $('colorResults').innerHTML = latest.map(([name,value],i)=>`<div class="result-row"><strong>${T.escape(name)}</strong><code>${T.escape(value)}</code><button class="small-button" data-copy-color="${i}" type="button" aria-label="Copy ${T.escape(name)}">Copy</button></div>`).join('');
      const rgb = color.to('srgb').toGamut({method:'clip'});
      $('colorSwatch').style.background = rgb.toString();
      $('colorPicker').value = latest[0][1].slice(0,7);
      T.status('colorStatus', color.inGamut('srgb') ? 'Converted locally.' : 'This color is outside sRGB. The sRGB outputs and preview are clipped; wide-gamut outputs retain the original color.');
      $('copyColors').disabled = false;
    } catch (error) { latest=[]; $('colorResults').replaceChildren(); $('copyColors').disabled=true; T.status('colorStatus', error.message, true); }
  }
  $('colorResults').addEventListener('click', async event => { const button = event.target.closest('[data-copy-color]'); if (!button) return; try { await T.copy(latest[Number(button.dataset.copyColor)][1]); T.status('colorStatus','Color copied.'); } catch(e) { T.status('colorStatus',e.message,true); } });
  $('copyColors').onclick=async()=>{try{await T.copy(latest.map(([k,v])=>`${k}: ${v}`).join('\n'));T.status('colorStatus','All formats copied.');}catch(e){T.status('colorStatus',e.message,true);}};
  $('convertColor').onclick=convert;
  $('colorInput').addEventListener('input',convert);
  $('colorPicker').addEventListener('input',()=>{$('colorInput').value=$('colorPicker').value;convert();});
  window.ColorConverter = {parseColor,getFormats};
  convert();
})();
