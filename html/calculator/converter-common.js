(() => {
  const metricPrefixes = [
    ['Exa', 'E', 18],
    ['Peta', 'P', 15],
    ['Tera', 'T', 12],
    ['Giga', 'G', 9],
    ['Mega', 'M', 6],
    ['Kilo', 'k', 3],
    ['Hecto', 'h', 2],
    ['Deca', 'da', 1],
    ['No prefix', '—', 0],
    ['Deci', 'd', -1],
    ['Centi', 'c', -2],
    ['Milli', 'm', -3],
    ['Micro', 'µ', -6],
    ['Nano', 'n', -9],
    ['Pico', 'p', -12],
    ['Femto', 'f', -15],
    ['Atto', 'a', -18]
  ];
  const metricNotes = {
    Volume: 'For liters, 1 mL = 0.001 L. For cubic units, cube the length multiplier: 1 cm³ = 0.000001 m³.',
    Length: 'Prefixes apply to meters: 1 km = 1,000 m; 1 mm = 0.001 m.',
    'Weight and mass': 'Prefixes apply to grams: 1 kg = 1,000 g; 1 mg = 0.001 g.',
    Energy: 'Prefixes apply to joules: 1 kJ = 1,000 J. Calories, watt-hours, and BTU require separate conversion factors.',
    Area: 'For square units, square the prefix multiplier: kilo is 10³, so 1 km² = 10⁶ m² = 1,000,000 m².',
    Speed: 'Prefixes scale the length unit. Changing the time unit also changes the result: 1 km/h = 1,000 m / 3,600 s ≈ 0.277778 m/s.',
    Time: 'Prefixes apply to seconds: 1 ms = 0.001 s. Minutes, hours, days, months, and years use separate conversion factors.',
    Power: 'Prefixes apply to watts: 1 kW = 1,000 W; 1 MW = 1,000,000 W. Horsepower uses a separate conversion factor.',
    Data: 'Decimal prefixes use powers of 10: 1 kB = 1,000 B. Binary prefixes use powers of 1,024: 1 KiB = 1,024 B. A byte (B) is 8 bits (b).',
    Pressure: 'Prefixes apply to pascals: 1 kPa = 1,000 Pa. Bar, atmosphere, PSI, torr, and mmHg require separate conversion factors.'
  };
  function metricReference(category) {
    if (!metricNotes[category]) return '';
    const decimalMultiplier = exponent => exponent < 0
      ? `0.${'0'.repeat(-exponent - 1)}1`
      : `1${'0'.repeat(exponent)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `<section class="card metric-reference" aria-labelledby="metricPrefixHeading">
      <h2 id="metricPrefixHeading">Metric prefix reference</h2>
      <p class="muted" id="metricPrefixNote">${metricNotes[category]}</p>
      <div class="metric-table-scroll" role="region" aria-label="Metric prefix comparison table" tabindex="0">
        <table class="metric-table" aria-describedby="metricPrefixNote">
          <caption>Multipliers relative to the same unit without a prefix</caption>
          <thead><tr><th scope="col">Prefix</th><th scope="col">Symbol</th><th scope="col">Multiplier<br>(scientific notation)</th><th scope="col">Multiplier<br>(decimal)</th></tr></thead>
          <tbody>${metricPrefixes.map(([name, symbol, exponent]) => `<tr${exponent === 0 ? ' class="metric-base"' : ''}><th scope="row">${name}</th><td class="metric-symbol">${symbol}</td><td class="metric-number">10<sup>${exponent}</sup></td><td class="metric-number">${decimalMultiplier(exponent)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <p class="muted metric-source">Symbols are case-sensitive. <a href="https://www.bipm.org/en/measurement-units/si-prefixes" target="_blank" rel="noopener noreferrer">SI prefix definitions</a></p>
    </section>`;
  }
  window.setupConverterLayout = () => {
    const base = location.pathname.endsWith('/converter.html') ? '' : '../';
    const app = document.getElementById('converterApp');
    const content = app.querySelector('.content');
    const shell = document.createElement('div');
    shell.className = 'shell';
    shell.innerHTML = `<aside class="sidebar" id="sidebar" aria-label="Main navigation">
      <a class="brand" href="${base}../index.html">▦ Simple Tools</a>
      <div class="nav-label">Workspace</div>
      <a class="nav-link" href="${base}../index.html"><span class="nav-icon" aria-hidden="true">⌂</span>Home</a>
      <div class="nav-label">Calculator</div>
      <a class="nav-link" href="${base}../calculator.html"><span class="nav-icon" aria-hidden="true">▦</span>Standard</a>
      <a class="nav-link" href="${base}scientific.html"><span class="nav-icon" aria-hidden="true">⚗</span>Scientific</a>
      <a class="nav-link" href="${base}graphing.html"><span class="nav-icon" aria-hidden="true">⌁</span>Graphing</a>
      <a class="nav-link" href="${base}programmer.html"><span class="nav-icon" aria-hidden="true">‹›</span>Programmer</a>
      <a class="nav-link" href="${base}date-calculation.html"><span class="nav-icon" aria-hidden="true">▣</span>Date calculation</a>
      <div class="nav-label">Converter</div>
      <a class="nav-link active" href="${base}converter.html" aria-current="${base ? 'location' : 'page'}"><span class="nav-icon" aria-hidden="true">⇄</span>Unit converter</a>
      <div class="nav-label">Tools</div>
      <a class="nav-link" href="${base}../checksumCalculator.html"><span class="nav-icon" aria-hidden="true">⌁</span>Checksum Calculator</a>
      <a class="nav-link" href="${base}../timeSince.html"><span class="nav-icon" aria-hidden="true">◷</span>Time Since</a>
      <div class="sidebar-bottom"><button class="nav-action" id="themeToggle" type="button"><span class="nav-icon" aria-hidden="true">◐</span><span>Use <span id="themeName">dark</span> theme</span></button></div>
    </aside><main class="main"></main>`;
    shell.querySelector('main').append(content);
    app.replaceChildren(shell);
  };
  window.setupUnitConverter = (category, units) => {
    const slug = location.pathname.split('/').pop().replace('.html','');
    const entries = Object.entries(units);
    const app = document.getElementById('converterApp');
    app.innerHTML = `<div class="content"><header class="topbar"><div class="topbar-title"><button class="icon-button menu-toggle" id="menuToggle" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">☰</button><div><a href="../converter.html" class="muted">← All converters</a><h1 style="margin-top:8px">${category} converter</h1></div></div></header><section class="card"><div class="form-grid"><div class="form-field"><label for="valueInput">Value</label><input id="valueInput" type="number" value="1" step="any"></div><div class="form-field"><label for="fromUnit">From</label><select class="field" id="fromUnit"></select></div><div class="form-field"><label for="toUnit">To</label><select class="field" id="toUnit"></select></div><div class="form-field"><label>Result</label><output id="conversionResult" class="converter-result" aria-live="polite">—</output></div></div><p id="conversionSummary" class="status" aria-live="polite"></p></section><section class="card" id="history"><div class="history-head"><div><strong>Recent conversions</strong><div class="muted" style="font-size:.85rem">Saved in this browser for ${category}</div></div><button class="small-button" id="clearHistory" type="button">Clear all</button></div><div id="historyList" class="history-list"></div></section><p class="muted" style="font-size:.8rem;text-align:center">Conversions stay in this browser. No data is uploaded.</p></div>`;
    window.setupConverterLayout();
    document.getElementById('history').insertAdjacentHTML('beforebegin', metricReference(category));
    const value = document.getElementById('valueInput'), from = document.getElementById('fromUnit'), to = document.getElementById('toUnit'), output = document.getElementById('conversionResult');
    from.innerHTML = entries.map(([unit]) => `<option value="${unit}">${unit.replaceAll('_',' ')}</option>`).join('');
    to.innerHTML = entries.map(([unit],i) => `<option value="${unit}" ${i===1?'selected':''}>${unit.replaceAll('_',' ')}</option>`).join('');
    const key = `simpletools-calculator-history-converter-${slug}`;
    function readHistory(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
    function renderHistory(){const target=document.getElementById('historyList'),rows=readHistory();target.replaceChildren();if(!rows.length){target.innerHTML='<p class="muted">No recent conversions yet.</p>';return}for(const row of rows){const el=document.createElement('div');el.className='history-row';const info=document.createElement('div');info.innerHTML=`<small>${escapeHtml(row.at)}</small><div>${escapeHtml(row.from)}</div><strong>${escapeHtml(row.result)}</strong>`;const remove=document.createElement('button');remove.textContent='Delete';remove.setAttribute('aria-label','Delete this conversion');remove.onclick=()=>{localStorage.setItem(key,JSON.stringify(readHistory().filter(x=>x.id!==row.id)));renderHistory()};el.append(info,remove);target.append(el)}}
    function escapeHtml(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
    function convert(){const n=Number(value.value);if(!Number.isFinite(n)){output.textContent='—';return null}let result;if(category==='Temperature'){const c=from.value==='Celsius'?n:from.value==='Fahrenheit'?(n-32)*5/9:n-273.15;result=to.value==='Celsius'?c:to.value==='Fahrenheit'?c*9/5+32:c+273.15}else result=n*units[from.value]/units[to.value];const formatted=Number(result).toLocaleString(undefined,{maximumSignificantDigits:12});output.textContent=formatted;document.getElementById('conversionSummary').textContent=`${n} ${from.value.replaceAll('_',' ')} = ${formatted} ${to.value.replaceAll('_',' ')}`;return formatted}
    let saveTimer;function update(){const result=convert();if(result===null)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{const row={id:Date.now()+Math.random(),from:`${value.value} ${from.value.replaceAll('_',' ')} → ${to.value.replaceAll('_',' ')}`,result:`${result} ${to.value.replaceAll('_',' ')}`,at:new Date().toLocaleString()};const rows=readHistory();if(rows[0]?.from===row.from&&rows[0]?.result===row.result)return;localStorage.setItem(key,JSON.stringify([row,...rows].slice(0,100)));renderHistory()},600)}
    [value,from,to].forEach(el=>el.addEventListener('input',update));from.onchange=update;to.onchange=update;
    document.getElementById('clearHistory').onclick=()=>{localStorage.removeItem(key);renderHistory()};renderHistory();convert();
  };
})();
