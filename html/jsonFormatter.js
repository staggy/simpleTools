(() => {
  'use strict';
  const T = window.Toolbox, C = window.DataTools;
  document.querySelector('.content')?.classList.add('data-wide');
  T.setContent(`
    <section class="card">
      <h2>Validate and format JSON</h2>
      <div class="data-toolbar"><div class="form-field"><label for="jsonFile">Open a JSON or text file</label><input id="jsonFile" type="file" accept=".json,.txt,application/json,text/plain" class="data-file"></div><div class="form-field compact-field"><label for="jsonIndent">Indentation</label><select id="jsonIndent" class="field"><option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tabs</option></select></div></div>
      <div class="action-row"><button id="jsonFormat" class="primary-button" type="button">Format JSON</button><button id="jsonValidate" class="small-button" type="button">Validate</button><button id="jsonMinify" class="small-button" type="button">Minify</button><button id="jsonSample" class="small-button" type="button">Try an example</button><button id="jsonClear" class="small-button" type="button">Clear</button></div>
      <p id="jsonStatus" class="status data-status" role="status" aria-live="polite">Paste JSON to validate its syntax. Your data stays in this browser.</p>
      <p id="jsonWarning" class="json-warning" hidden></p>
      <div class="json-editors"><div class="form-field"><label for="jsonInput">Input</label><textarea id="jsonInput" class="field text-input" spellcheck="false" placeholder='{"hello": "world"}'></textarea></div><div class="form-field"><label for="jsonOutput">Result</label><textarea id="jsonOutput" class="field text-input" spellcheck="false" readonly placeholder="Formatted or minified JSON will appear here…"></textarea></div></div>
      <div class="action-row"><button id="jsonCopy" class="small-button" type="button" disabled>Copy result</button><button id="jsonDownload" class="small-button" type="button" disabled>Download JSON</button><span id="jsonStats" class="muted"></span></div>
      <p class="muted" style="font-size:.82rem">Strict JSON syntax validation. Numbers, duplicate properties, and string escapes are preserved exactly during formatting. Supports files up to 10 MiB and nesting up to 512 levels.</p>
    </section>
  `);
  const $ = id => document.getElementById(id), input = $('jsonInput'), output = $('jsonOutput'), status = $('jsonStatus');
  let filename = 'formatted.json';
  function message(text, error = false) { T.status(status, text, error); status.classList.toggle('json-error', error); }
  function resetOutput() { output.value = ''; $('jsonCopy').disabled = $('jsonDownload').disabled = true; $('jsonStats').textContent = ''; $('jsonWarning').hidden = true; }
  function checkSize() { if (input.value.length > 10 * 1024 * 1024) throw new Error('JSON input is limited to 10 MiB of text.'); }
  function validate(mode) {
    try {
      checkSize();
      const indent = $('jsonIndent').value === 'tab' ? '\t' : ' '.repeat(Number($('jsonIndent').value));
      const result = mode === 'validate' ? C.parseJSON(input.value) : C.formatJSON(input.value, mode === 'minify' ? '' : indent);
      $('jsonWarning').hidden = !result.duplicates.length;
      if (result.duplicates.length) {
        const keys = [...new Set(result.duplicates.map(item => item.key))];
        $('jsonWarning').textContent = `Duplicate property name${keys.length === 1 ? '' : 's'}: ${keys.slice(0, 8).map(key => JSON.stringify(key)).join(', ')}${keys.length > 8 ? ', …' : ''}. Valid JSON syntax, but applications may keep only the last value. Formatting preserves every property.`;
      }
      if (mode !== 'validate') {
        output.value = result.text; $('jsonCopy').disabled = $('jsonDownload').disabled = false;
        $('jsonStats').textContent = `${T.bytes(new TextEncoder().encode(input.value).length)} input → ${T.bytes(new TextEncoder().encode(output.value).length)} result`;
      }
      message(mode === 'validate' ? 'Valid JSON syntax.' : mode === 'minify' ? 'Valid JSON. Minified without changing numeric precision or property order.' : 'Valid JSON. Formatted without changing numeric precision or property order.');
    } catch (error) {
      resetOutput(); message(error.message, true);
      if (Number.isInteger(error.position)) { input.focus(); input.setSelectionRange(error.position, Math.min(input.value.length, error.position + 1)); }
    }
  }
  $('jsonFormat').addEventListener('click', () => validate('format'));
  $('jsonValidate').addEventListener('click', () => validate('validate'));
  $('jsonMinify').addEventListener('click', () => validate('minify'));
  $('jsonCopy').addEventListener('click', async () => { try { await T.copy(output.value); message('Result copied.'); } catch (error) { message(error.message, true); } });
  $('jsonDownload').addEventListener('click', () => { T.download(new Blob([output.value], { type: 'application/json;charset=utf-8' }), filename); message(`Downloaded ${filename}.`); });
  input.addEventListener('input', () => { resetOutput(); message('Input changed. Validate or format to refresh the result.'); });
  $('jsonFile').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file of 10 MiB or less.');
      input.value = (await file.text()).replace(/^\uFEFF/, '');
      filename = file.name.replace(/\.[^.]*$/, '') + '.formatted.json';
      resetOutput(); validate('format');
    } catch (error) { message(error.message, true); }
    event.target.value = '';
  });
  $('jsonSample').addEventListener('click', () => { input.value = '{"project":"Simple Tools","local":true,"tools":["Images","Hex","JSON"],"largeInteger":900719925474099312345,"settings":{"theme":"dark","optional":null}}'; filename = 'formatted.json'; validate('format'); });
  $('jsonClear').addEventListener('click', () => { input.value = ''; filename = 'formatted.json'; resetOutput(); message('Paste JSON to validate its syntax. Your data stays in this browser.'); input.focus(); });
  input.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); validate('format'); } });
})();
