(() => {
  'use strict';
  const T = window.Toolbox, C = window.DataTools;
  document.querySelector('.content')?.classList.add('data-wide');
  T.setContent(`
    <section class="card">
      <h2>Compare two texts</h2>
      <div class="diff-inputs">
        <div class="form-field"><div class="diff-source-head"><label for="diffLeft">Original</label><button id="diffLoadLeft" class="small-button" type="button">Open text file</button></div><input id="diffFileLeft" type="file" hidden><textarea id="diffLeft" class="field text-input" spellcheck="false" placeholder="Paste the original text…"></textarea></div>
        <div class="form-field"><div class="diff-source-head"><label for="diffRight">Modified</label><button id="diffLoadRight" class="small-button" type="button">Open text file</button></div><input id="diffFileRight" type="file" hidden><textarea id="diffRight" class="field text-input" spellcheck="false" placeholder="Paste the modified text…"></textarea></div>
      </div>
      <div class="action-row data-checks"><label><input id="diffWhitespace" type="checkbox">Ignore whitespace</label><label><input id="diffCase" type="checkbox">Ignore letter case</label><label><input id="diffSync" type="checkbox" checked>Synchronize scrolling</label></div>
      <div class="action-row"><button id="diffCompare" class="primary-button" type="button">Compare texts</button><button id="diffSwap" class="small-button" type="button">Swap sides</button><button id="diffSample" class="small-button" type="button">Try an example</button><button id="diffClear" class="small-button" type="button">Clear</button></div>
      <p id="diffStatus" class="status data-status" role="status" aria-live="polite">Paste text or open UTF-8 files. Nothing is uploaded or saved.</p>
    </section>
    <section class="card" id="diffResult" hidden aria-label="Side-by-side comparison">
      <div class="results-heading"><h2>Comparison</h2><div class="data-checks"><button id="diffPrev" class="small-button" type="button">↑ Previous change</button><span id="diffPosition" class="muted"></span><button id="diffNext" class="small-button" type="button">↓ Next change</button></div></div>
      <div class="diff-legend"><span style="--legend:#eab308">Changed</span><span style="--legend:#ef4444">Removed</span><span style="--legend:#22c55e">Added</span><span style="--legend:var(--line)">Striped gaps align the other side</span></div>
      <div class="diff-columns"><div><p class="diff-title" id="diffLeftTitle">Original</p><div class="diff-pane" id="diffPaneLeft" tabindex="0" aria-label="Original text comparison"><table class="diff-table"><tbody id="diffRowsLeft"></tbody></table></div></div><div><p class="diff-title" id="diffRightTitle">Modified</p><div class="diff-pane" id="diffPaneRight" tabindex="0" aria-label="Modified text comparison"><table class="diff-table"><tbody id="diffRowsRight"></tbody></table></div></div></div>
      <p class="muted" style="font-size:.82rem">Line endings are normalized for comparison. A final empty line represents a trailing newline. Scroll sideways to read long lines.</p>
    </section>
  `);
  const $ = id => document.getElementById(id), status = $('diffStatus');
  let changeRows = [], current = -1;
  function message(text, error = false) { T.status(status, text, error); }
  function clearResult() { $('diffResult').hidden = true; changeRows = []; current = -1; }
  function inline(a, b) {
    const left = Array.from(a), right = Array.from(b);
    let start = 0, end = 0;
    while (start < left.length && start < right.length && left[start] === right[start]) start++;
    while (end < left.length - start && end < right.length - start && left[left.length - end - 1] === right[right.length - end - 1]) end++;
    const highlighted = chars => T.escape(chars.slice(0, start).join('')) + (chars.length - start - end > 0 ? `<mark>${T.escape(chars.slice(start, chars.length - end).join(''))}</mark>` : '') + T.escape(end ? chars.slice(-end).join('') : '');
    return [highlighted(left), highlighted(right)];
  }
  function rowMarkup(index, line, text, type) {
    return `<tr data-row="${index}" class="${type}"><td class="diff-number">${line === undefined ? '' : line + 1}</td><td class="diff-code">${text || ' '}</td></tr>`;
  }
  function compare() {
    try {
      const left = $('diffLeft').value, right = $('diffRight').value;
      if (left.length > 5 * 1024 * 1024 || right.length > 5 * 1024 * 1024) throw new Error('Each side supports up to 5 MiB of text.');
      if (left.split('\n').length > 20000 || right.split('\n').length > 20000) throw new Error('Each side supports up to 20,000 lines for responsive browser comparison.');
      const result = C.lineDiff(left, right, { ignoreWhitespace: $('diffWhitespace').checked, ignoreCase: $('diffCase').checked });
      const leftHtml = [], rightHtml = [];
      let added = 0, removed = 0, changed = 0;
      changeRows = []; current = -1;
      result.rows.forEach((row, index) => {
        let a = row.left === undefined ? '' : result.left[row.left], b = row.right === undefined ? '' : result.right[row.right];
        let leftText = T.escape(a), rightText = T.escape(b);
        if (row.type === 'change') { [leftText, rightText] = inline(a, b); changed++; }
        if (row.type === 'delete') removed++;
        if (row.type === 'insert') added++;
        if (row.type !== 'same' && (index === 0 || result.rows[index - 1].type === 'same')) changeRows.push(index);
        const className = row.type === 'change' ? 'diff-changed' : row.type === 'delete' ? 'diff-removed' : row.type === 'insert' ? 'diff-added' : '';
        leftHtml.push(rowMarkup(index, row.left, leftText, row.left === undefined ? 'diff-placeholder' : className));
        rightHtml.push(rowMarkup(index, row.right, rightText, row.right === undefined ? 'diff-placeholder' : className));
      });
      $('diffRowsLeft').innerHTML = leftHtml.join(''); $('diffRowsRight').innerHTML = rightHtml.join('');
      $('diffResult').hidden = false;
      $('diffPaneLeft').scrollTop = $('diffPaneRight').scrollTop = 0;
      $('diffPaneLeft').scrollLeft = $('diffPaneRight').scrollLeft = 0;
      $('diffPrev').disabled = $('diffNext').disabled = !changeRows.length;
      $('diffPosition').textContent = changeRows.length ? `${changeRows.length} change group${changeRows.length === 1 ? '' : 's'}` : 'Identical';
      const notes = [];
      if ($('diffWhitespace').checked) notes.push('ignoring whitespace');
      if ($('diffCase').checked) notes.push('ignoring letter case');
      message(`${changed} changed, ${added} added, ${removed} removed line${changed + added + removed === 1 ? '' : 's'}${notes.length ? ` (${notes.join(', ')})` : ''}.${result.coarse ? ' Large sections without unique matching lines are shown as replacement blocks.' : ''}`);
    } catch (error) { clearResult(); message(error.message, true); }
  }
  function navigate(direction) {
    if (!changeRows.length) return;
    current = current < 0 ? (direction > 0 ? 0 : changeRows.length - 1) : (current + direction + changeRows.length) % changeRows.length;
    const row = changeRows[current];
    document.querySelectorAll('.diff-current').forEach(el => el.classList.remove('diff-current'));
    for (const side of ['Left', 'Right']) {
      const element = $(`diffRows${side}`).querySelector(`[data-row="${row}"]`);
      element.classList.add('diff-current');
      $(`diffPane${side}`).scrollTop = Math.max(0, element.offsetTop - $(`diffRows${side}`).offsetTop - 40);
    }
    $('diffPosition').textContent = `${current + 1} / ${changeRows.length}`;
  }
  for (const side of ['Left', 'Right']) {
    $(`diffLoad${side}`).addEventListener('click', () => $(`diffFile${side}`).click());
    $(`diffFile${side}`).addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error('Choose a UTF-8 text file of 5 MiB or less.');
        $(`diff${side}`).value = await file.text();
        $(`diff${side}Title`).textContent = file.name;
        clearResult(); message(`Loaded ${file.name}. Compare texts to see changes.`);
      } catch (error) { message(error.message, true); }
      event.target.value = '';
    });
    $(`diff${side}`).addEventListener('input', () => { clearResult(); message('Text changed. Compare texts to refresh the results.'); });
  }
  let syncing = false;
  for (const side of ['Left', 'Right']) $(`diffPane${side}`).addEventListener('scroll', () => {
    if (!$('diffSync').checked || syncing) return;
    syncing = true;
    const source = $(`diffPane${side}`), target = $(`diffPane${side === 'Left' ? 'Right' : 'Left'}`);
    target.scrollTop = source.scrollTop; target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => { syncing = false; });
  });
  $('diffCompare').addEventListener('click', compare);
  $('diffPrev').addEventListener('click', () => navigate(-1));
  $('diffNext').addEventListener('click', () => navigate(1));
  $('diffSwap').addEventListener('click', () => { [$('diffLeft').value, $('diffRight').value] = [$('diffRight').value, $('diffLeft').value]; [$('diffLeftTitle').textContent, $('diffRightTitle').textContent] = [$('diffRightTitle').textContent, $('diffLeftTitle').textContent]; compare(); });
  $('diffSample').addEventListener('click', () => { $('diffLeft').value = 'Simple Tools\nConvert images locally\nView binary files\nCompare text\nKeep your files private\n'; $('diffRight').value = 'Simple Tools\nConvert and resize images locally\nView and edit binary files\nRead photo metadata\nCompare text\nKeep your files private\n'; $('diffLeftTitle').textContent = 'Original'; $('diffRightTitle').textContent = 'Modified'; compare(); });
  $('diffClear').addEventListener('click', () => { $('diffLeft').value = $('diffRight').value = ''; $('diffLeftTitle').textContent = 'Original'; $('diffRightTitle').textContent = 'Modified'; clearResult(); message('Paste text or open UTF-8 files. Nothing is uploaded or saved.'); });
  for (const id of ['diffWhitespace', 'diffCase']) $(id).addEventListener('change', () => { if (!$('diffResult').hidden) compare(); });
})();
