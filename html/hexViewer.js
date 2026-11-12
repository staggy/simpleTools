(() => {
  'use strict';
  const T = window.Toolbox, C = window.DataTools;
  document.querySelector('.content')?.classList.add('data-wide');
  T.setContent(`
    <section class="card" id="hexDrop">
      <h2>Open a file</h2>
      <label for="hexFile">Choose any file, or drop it here</label>
      <input id="hexFile" class="data-file" type="file">
      <p class="muted">Files stay in your browser. Edits replace existing bytes; the original file is never overwritten.</p>
      <div id="hexFileInfo" class="data-meta"></div>
    </section>
    <section class="card" id="hexWorkspace" hidden>
      <div class="data-toolbar">
        <div class="form-field"><label for="hexOffset">Jump to byte offset (decimal or 0x hex)</label><input id="hexOffset" type="text" value="0" spellcheck="false"></div>
        <button id="hexJump" class="small-button" type="button">Jump</button>
        <div class="form-field compact-field"><label for="hexPageSize">Bytes per page</label><select id="hexPageSize" class="field"><option>256</option><option>512</option><option>1024</option></select></div>
      </div>
      <div class="data-toolbar" style="margin-top:14px">
        <div class="form-field compact-field"><label for="hexSearchType">Search as</label><select id="hexSearchType" class="field"><option value="hex">Hex bytes</option><option value="text">UTF-8 text</option></select></div>
        <div class="form-field"><label for="hexSearch">Search file, including your edits</label><input id="hexSearch" type="text" placeholder="48 65 6C 6C 6F" spellcheck="false"></div>
        <button id="hexFind" class="small-button" type="button">Find next</button>
        <button id="hexCancel" class="small-button" type="button" hidden>Cancel search</button>
      </div>
      <div class="hex-scroll" tabindex="0" aria-label="Editable hexadecimal bytes and ASCII preview"><table class="hex-table"><thead><tr><th scope="col">Offset</th>${Array.from({ length: 16 }, (_, i) => `<th scope="col">${i.toString(16).toUpperCase()}</th>`).join('')}<th scope="col">ASCII</th></tr></thead><tbody id="hexBody"></tbody></table></div>
      <div id="hexSelection" class="hex-selected">Choose a byte to inspect or edit it.</div>
      <div class="action-row hex-page"><button id="hexPrevious" type="button" class="small-button">← Previous page</button><span id="hexPageInfo" class="muted"></span><button id="hexNext" type="button" class="small-button">Next page →</button></div>
      <div class="action-row"><button id="hexDownload" class="primary-button" type="button">Download file</button><button id="hexUndo" class="small-button" type="button">Undo last edit</button><button id="hexReset" class="small-button" type="button">Reset all edits</button><span id="hexEditCount" class="muted"></span></div>
    </section>
    <p id="hexStatus" class="status data-status" role="status" aria-live="polite">Open a file to begin. Only the current page is read into memory.</p>
  `);
  const $ = id => document.getElementById(id), status = $('hexStatus');
  let file, page = 0, selected = -1, original = new Uint8Array(), originalPage = 0, generation = 0, searchController, lastSearch;
  const edits = new Map(), undo = [];
  const pageSize = () => Number($('hexPageSize').value);
  const formatOffset = n => '0x' + n.toString(16).toUpperCase().padStart(8, '0');
  const formatByte = n => n.toString(16).toUpperCase().padStart(2, '0');
  function showMessage(message, error = false) { T.status(status, message, error); }
  function updateEdits() {
    $('hexEditCount').textContent = `${edits.size.toLocaleString()} byte${edits.size === 1 ? '' : 's'} modified`;
    $('hexUndo').disabled = !undo.length;
    $('hexReset').disabled = !edits.size;
  }
  function updateSelection() {
    document.querySelectorAll('.hex-byte,.hex-ascii').forEach(el => el.classList.toggle('selected', Number(el.dataset.offset) === selected));
    if (selected < 0 || !file || selected >= file.size) { $('hexSelection').textContent = 'This file contains no bytes.'; return; }
    const index = selected - page;
    if (index < 0 || index >= original.length) return;
    const value = edits.get(selected) ?? original[index];
    $('hexSelection').textContent = `Offset ${formatOffset(selected)} (${selected.toLocaleString()}) · HEX ${formatByte(value)} · Unsigned ${value} · Signed ${value > 127 ? value - 256 : value} · Binary ${value.toString(2).padStart(8, '0')}${value >= 32 && value <= 126 ? ` · ASCII ${String.fromCharCode(value)}` : ''}`;
  }
  async function render(focus = false) {
    if (!file) return;
    const mine = ++generation;
    const bytes = new Uint8Array(await file.slice(page, page + pageSize()).arrayBuffer());
    if (mine !== generation) return;
    original = bytes; originalPage = page;
    let html = '';
    for (let row = 0; row < bytes.length; row += 16) {
      html += `<tr><th scope="row">${formatOffset(page + row)}</th>`;
      let ascii = '';
      for (let col = 0; col < 16; col++) {
        const index = row + col, offset = page + index;
        if (index >= bytes.length) { html += '<td></td>'; continue; }
        const value = edits.get(offset) ?? bytes[index];
        html += `<td><input class="hex-byte${edits.has(offset) ? ' edited' : ''}" data-offset="${offset}" aria-label="Byte at ${formatOffset(offset)}" type="text" maxlength="2" value="${formatByte(value)}" spellcheck="false" autocomplete="off"></td>`;
        ascii += `<button type="button" class="hex-ascii" data-offset="${offset}" title="${formatOffset(offset)}" aria-label="Select byte ${formatOffset(offset)}">${T.escape(value >= 32 && value <= 126 ? String.fromCharCode(value) : '·')}</button>`;
      }
      html += `<td>${ascii}</td></tr>`;
    }
    $('hexBody').innerHTML = html || '<tr><td colspan="18">Empty file</td></tr>';
    $('hexPrevious').disabled = page === 0;
    $('hexNext').disabled = page + pageSize() >= file.size;
    $('hexPageInfo').textContent = file.size ? `Bytes ${page.toLocaleString()}–${(page + bytes.length - 1).toLocaleString()} of ${file.size.toLocaleString()}` : '0 bytes';
    updateEdits(); updateSelection();
    if (focus && selected >= 0) { const input = $('hexBody').querySelector(`input[data-offset="${selected}"]`); input?.focus(); input?.select(); }
  }
  async function openFile(nextFile) {
    if (!nextFile) return;
    searchController?.abort(); generation++;
    file = nextFile; page = 0; selected = file.size ? 0 : -1; edits.clear(); undo.length = 0; lastSearch = undefined;
    $('hexWorkspace').hidden = false;
    $('hexFileInfo').textContent = `${file.name} · ${T.bytes(file.size)} · ${file.size.toLocaleString()} bytes`;
    $('hexOffset').value = '0';
    showMessage('Type two hexadecimal digits to change a byte. Arrow keys move between bytes.');
    await render();
  }
  $('hexFile').addEventListener('change', event => openFile(event.target.files[0]));
  const drop = $('hexDrop');
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('drop-active'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drop-active'));
  drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('drop-active'); openFile(event.dataTransfer.files[0]); });
  $('hexBody').addEventListener('focusin', event => {
    if (!event.target.matches('.hex-byte')) return;
    selected = Number(event.target.dataset.offset); updateSelection(); event.target.select();
  });
  function commit(input) {
    if (!input.matches('.hex-byte')) return true;
    const offset = Number(input.dataset.offset), previous = edits.get(offset), base = original[offset - originalPage];
    if (base === undefined) return false;
    if (!/^[\da-f]{2}$/i.test(input.value)) {
      input.value = formatByte(previous ?? base);
      showMessage('A byte must contain exactly two hexadecimal digits (00–FF).', true); return false;
    }
    const next = parseInt(input.value, 16);
    if (next !== (previous ?? base)) {
      undo.push({ offset, previous });
      if (next === base) edits.delete(offset); else edits.set(offset, next);
      input.classList.toggle('edited', edits.has(offset));
      const ascii = $('hexBody').querySelector(`button[data-offset="${offset}"]`);
      if (ascii) ascii.textContent = next >= 32 && next <= 126 ? String.fromCharCode(next) : '·';
      updateEdits(); updateSelection();
      showMessage(`Updated byte ${formatOffset(offset)}. Download to save your changes.`);
    }
    input.value = formatByte(next); return true;
  }
  $('hexBody').addEventListener('change', event => commit(event.target));
  $('hexBody').addEventListener('click', event => {
    if (!event.target.matches('.hex-ascii')) return;
    const input = $('hexBody').querySelector(`input[data-offset="${event.target.dataset.offset}"]`);
    input?.focus(); input?.select();
  });
  $('hexBody').addEventListener('keydown', async event => {
    if (!event.target.matches('.hex-byte')) return;
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 16, ArrowUp: -16, Enter: 1 };
    if (!(event.key in moves)) return;
    event.preventDefault(); if (!commit(event.target)) return;
    const next = Number(event.target.dataset.offset) + moves[event.key];
    if (next < 0 || next >= file.size) return;
    selected = next;
    if (next < page || next >= page + pageSize()) { page = Math.floor(next / pageSize()) * pageSize(); await render(true); }
    else { const input = $('hexBody').querySelector(`input[data-offset="${next}"]`); input?.focus(); input?.select(); }
  });
  async function jump() {
    try {
      const offset = C.parseOffset($('hexOffset').value);
      if (offset >= file.size) throw new Error(file.size ? `Offset must be between 0 and ${file.size - 1}.` : 'This file is empty.');
      selected = offset; page = Math.floor(offset / pageSize()) * pageSize(); await render(true);
    } catch (error) { showMessage(error.message, true); }
  }
  $('hexJump').addEventListener('click', jump);
  $('hexOffset').addEventListener('keydown', event => { if (event.key === 'Enter') jump(); });
  $('hexPrevious').addEventListener('click', () => { page = Math.max(0, page - pageSize()); selected = page; render(); });
  $('hexNext').addEventListener('click', () => { page += pageSize(); selected = page; render(); });
  $('hexPageSize').addEventListener('change', () => { page = Math.floor(Math.max(0, selected) / pageSize()) * pageSize(); render(); });
  $('hexUndo').addEventListener('click', () => {
    const change = undo.pop(); if (!change) return;
    if (change.previous === undefined) edits.delete(change.offset); else edits.set(change.offset, change.previous);
    selected = change.offset; page = Math.floor(selected / pageSize()) * pageSize(); render(); showMessage('Last edit undone.');
  });
  $('hexReset').addEventListener('click', () => { edits.clear(); undo.length = 0; render(); showMessage('All edits reset.'); });
  $('hexDownload').addEventListener('click', () => {
    const name = file.name.replace(/(\.[^.]+)?$/, '.modified$1');
    T.download(C.modifiedBlob(file, edits), name); showMessage(`Downloaded ${name} with ${edits.size} modified bytes.`);
  });
  $('hexSearchType').addEventListener('change', () => { $('hexSearch').placeholder = $('hexSearchType').value === 'hex' ? '48 65 6C 6C 6F' : 'Text to find'; });
  async function search() {
    try {
      const pattern = $('hexSearchType').value === 'hex' ? C.parseHex($('hexSearch').value) : new TextEncoder().encode($('hexSearch').value);
      if (!pattern.length) throw new Error('Enter something to search for.');
      if (pattern.length > 1048576) throw new Error('Search patterns are limited to 1 MiB.');
      searchController?.abort();
      const controller = new AbortController(); searchController = controller;
      $('hexFind').disabled = true; $('hexCancel').hidden = false; showMessage('Searching file…');
      const signature = $('hexSearchType').value + ':' + $('hexSearch').value;
      const from = lastSearch?.signature === signature && lastSearch.offset === selected ? selected + 1 : Math.max(0, selected);
      const found = await C.findBytes(file, pattern, from, edits, controller.signal);
      if (controller.signal.aborted) return;
      if (found < 0) showMessage('No match found.');
      else { lastSearch = { signature, offset: found }; selected = found; page = Math.floor(found / pageSize()) * pageSize(); await render(true); showMessage(`Match at ${formatOffset(found)} (${found.toLocaleString()}). Search wraps at the end of the file.`); }
    } catch (error) { showMessage(error.message, true); }
    finally { $('hexFind').disabled = false; $('hexCancel').hidden = true; }
  }
  $('hexFind').addEventListener('click', search);
  $('hexSearch').addEventListener('keydown', event => { if (event.key === 'Enter' && !$('hexFind').disabled) search(); });
  $('hexCancel').addEventListener('click', () => { searchController?.abort(); showMessage('Search cancelled.'); });
})();
