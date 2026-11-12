(function (root) {
  'use strict';

  function parseHex(text) {
    const clean = text.trim().replace(/0x/gi, '').replace(/\s+/g, '');
    if (!clean || clean.length % 2 || !/^[\da-f]+$/i.test(clean)) throw new Error('Enter complete hexadecimal bytes, for example 48 65 6C 6C 6F.');
    return Uint8Array.from(clean.match(/../g), value => parseInt(value, 16));
  }

  function parseOffset(text) {
    const value = text.trim();
    if (!/^(?:0x[\da-f]+|\d+)$/i.test(value)) throw new Error('Enter a decimal offset or a hexadecimal offset beginning with 0x.');
    const offset = Number(value);
    if (!Number.isSafeInteger(offset)) throw new Error('That offset is too large.');
    return offset;
  }

  function applyEdits(bytes, offset, edits) {
    for (let i = 0; i < bytes.length; i++) if (edits.has(offset + i)) bytes[i] = edits.get(offset + i);
    return bytes;
  }

  function modifiedBlob(file, edits) {
    const ordered = [...edits.entries()].sort((a, b) => a[0] - b[0]);
    const parts = [];
    let cursor = 0;
    for (let i = 0; i < ordered.length;) {
      const start = ordered[i][0];
      if (!Number.isSafeInteger(start) || start < cursor || start >= file.size) throw new Error('Invalid byte edit.');
      if (start > cursor) parts.push(file.slice(cursor, start));
      const values = [];
      let end = start;
      while (i < ordered.length && ordered[i][0] === end) {
        const value = ordered[i++][1];
        if (!Number.isInteger(value) || value < 0 || value > 255 || end >= file.size) throw new Error('Invalid byte value.');
        values.push(value);
        end++;
      }
      parts.push(Uint8Array.from(values));
      cursor = end;
    }
    if (cursor < file.size) parts.push(file.slice(cursor));
    return new Blob(parts, { type: file.type || 'application/octet-stream' });
  }

  async function findBytes(file, pattern, start = 0, edits = new Map(), signal) {
    if (!pattern.length) throw new Error('Enter something to search for.');
    const prefix = new Uint32Array(pattern.length);
    for (let i = 1, j = 0; i < pattern.length; i++) {
      while (j && pattern[i] !== pattern[j]) j = prefix[j - 1];
      if (pattern[i] === pattern[j]) j++;
      prefix[i] = j;
    }
    async function scan(from, to) {
      let matched = 0;
      for (let offset = from; offset < to; offset += 1048576) {
        if (signal?.aborted) throw new Error('Search cancelled.');
        const data = applyEdits(new Uint8Array(await file.slice(offset, Math.min(to, offset + 1048576)).arrayBuffer()), offset, edits);
        for (let i = 0; i < data.length; i++) {
          while (matched && data[i] !== pattern[matched]) matched = prefix[matched - 1];
          if (data[i] === pattern[matched]) matched++;
          if (matched === pattern.length) return offset + i - pattern.length + 1;
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      return -1;
    }
    start = Math.max(0, Math.min(file.size, start));
    const found = await scan(start, file.size);
    return found >= 0 || start === 0 ? found : scan(0, Math.min(file.size, start + pattern.length - 1));
  }

  function lineDiff(left, right, options = {}) {
    const normalize = value => {
      if (options.ignoreWhitespace) value = value.replace(/\s+/g, ' ').trim();
      return options.ignoreCase ? value.toLocaleLowerCase() : value;
    };
    const a = left.replace(/\r\n?/g, '\n').split('\n');
    const b = right.replace(/\r\n?/g, '\n').split('\n');
    const ak = a.map(normalize), bk = b.map(normalize);
    let coarse = false;
    function compare(a0, a1, b0, b1, depth = 0) {
      const before = [], after = [];
      while (a0 < a1 && b0 < b1 && ak[a0] === bk[b0]) before.push({ type: 'same', left: a0++, right: b0++ });
      while (a0 < a1 && b0 < b1 && ak[a1 - 1] === bk[b1 - 1]) after.push({ type: 'same', left: --a1, right: --b1 });
      let middle = [];
      const n = a1 - a0, m = b1 - b0;
      if (!n || !m) {
        for (let i = a0; i < a1; i++) middle.push({ type: 'delete', left: i });
        for (let j = b0; j < b1; j++) middle.push({ type: 'insert', right: j });
      } else if (n * m <= 1000000) {
        const matrix = new Uint32Array((n + 1) * (m + 1));
        const width = m + 1;
        for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) matrix[i * width + j] = ak[a0 + i] === bk[b0 + j] ? matrix[(i + 1) * width + j + 1] + 1 : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
        let i = 0, j = 0;
        while (i < n || j < m) {
          if (i < n && j < m && ak[a0 + i] === bk[b0 + j]) middle.push({ type: 'same', left: a0 + i++, right: b0 + j++ });
          else if (i < n && (j === m || matrix[(i + 1) * width + j] >= matrix[i * width + j + 1])) middle.push({ type: 'delete', left: a0 + i++ });
          else middle.push({ type: 'insert', right: b0 + j++ });
        }
      } else {
        const leftUnique = new Map(), rightUnique = new Map();
        for (let i = a0; i < a1; i++) leftUnique.set(ak[i], leftUnique.has(ak[i]) ? -1 : i);
        for (let j = b0; j < b1; j++) rightUnique.set(bk[j], rightUnique.has(bk[j]) ? -1 : j);
        const pairs = [];
        for (const [key, i] of leftUnique) if (i >= 0 && rightUnique.has(key) && rightUnique.get(key) >= 0) pairs.push([i, rightUnique.get(key)]);
        const tails = [], parents = new Int32Array(pairs.length).fill(-1);
        for (let i = 0; i < pairs.length; i++) {
          let lo = 0, hi = tails.length;
          while (lo < hi) { const mid = (lo + hi) >>> 1; if (pairs[tails[mid]][1] < pairs[i][1]) lo = mid + 1; else hi = mid; }
          if (lo) parents[i] = tails[lo - 1];
          tails[lo] = i;
        }
        const anchors = [];
        for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = parents[i]) anchors.push(pairs[i]);
        anchors.reverse();
        if (anchors.length && depth < 64) {
          let ai = a0, bi = b0;
          for (const [i, j] of anchors) { middle.push(...compare(ai, i, bi, j, depth + 1)); middle.push({ type: 'same', left: i, right: j }); ai = i + 1; bi = j + 1; }
          middle.push(...compare(ai, a1, bi, b1, depth + 1));
        } else {
          coarse = true;
          for (let i = a0; i < a1; i++) middle.push({ type: 'delete', left: i });
          for (let j = b0; j < b1; j++) middle.push({ type: 'insert', right: j });
        }
      }
      return before.concat(middle, after.reverse());
    }
    const changes = compare(0, a.length, 0, b.length), rows = [];
    for (let i = 0; i < changes.length;) {
      if (changes[i].type === 'same') { rows.push(changes[i++]); continue; }
      const removed = [], added = [];
      while (i < changes.length && changes[i].type !== 'same') { const change = changes[i++]; (change.type === 'delete' ? removed : added).push(change); }
      for (let j = 0; j < Math.max(removed.length, added.length); j++) rows.push({ type: removed[j] && added[j] ? 'change' : removed[j] ? 'delete' : 'insert', left: removed[j]?.left, right: added[j]?.right });
    }
    return { left: a, right: b, rows, coarse };
  }

  function parseJSON(source) {
    const tokens = [], duplicates = [];
    let pos = 0;
    function fail(message, at = pos) {
      const prefix = source.slice(0, at), lines = prefix.split('\n');
      const error = new SyntaxError(`${message} at line ${lines.length}, column ${lines[lines.length - 1].length + 1}.`);
      error.position = at; error.line = lines.length; error.column = lines[lines.length - 1].length + 1;
      throw error;
    }
    function ws() { while (/[\x20\t\r\n]/.test(source[pos] || '\0')) pos++; }
    function token(type, start, end) { tokens.push({ type, raw: source.slice(start, end), start }); }
    function string() {
      const start = pos++;
      while (pos < source.length) {
        const code = source.charCodeAt(pos++);
        if (code === 34) { token('string', start, pos); return JSON.parse(source.slice(start, pos)); }
        if (code < 32) fail('Unescaped control character in string', pos - 1);
        if (code === 92) {
          const escaped = source[pos++];
          if (escaped === 'u') { if (!/^[\da-fA-F]{4}$/.test(source.slice(pos, pos + 4))) fail('Expected four hexadecimal digits after \\u', pos); pos += 4; }
          else if (!escaped || !'"\\/bfnrt'.includes(escaped)) fail('Invalid string escape', pos - 1);
        }
      }
      fail('Unterminated string', start);
    }
    function punctuation(expected) {
      ws();
      if (source[pos] !== expected) fail(`Expected '${expected}'`);
      token(expected, pos, ++pos);
    }
    function value(depth) {
      ws();
      if (depth > 512) fail('JSON nesting exceeds the supported depth of 512');
      const char = source[pos];
      if (char === '"') { string(); return; }
      if (char === '{') {
        punctuation('{'); ws();
        const keys = new Set();
        if (source[pos] !== '}') while (true) {
          ws();
          if (source[pos] !== '"') fail('Expected a double-quoted property name');
          const keyPos = pos, key = string();
          if (keys.has(key)) duplicates.push({ key, position: keyPos });
          keys.add(key);
          punctuation(':'); value(depth + 1); ws();
          if (source[pos] !== ',') break;
          punctuation(',');
        }
        punctuation('}'); return;
      }
      if (char === '[') {
        punctuation('['); ws();
        if (source[pos] !== ']') while (true) { value(depth + 1); ws(); if (source[pos] !== ',') break; punctuation(','); }
        punctuation(']'); return;
      }
      const start = pos;
      const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(pos));
      if (!match) fail(pos === source.length ? 'Expected a JSON value; reached the end of input' : 'Expected a JSON value');
      pos += match[0].length;
      token('value', start, pos);
    }
    value(0); ws();
    if (pos !== source.length) fail('Unexpected content after the JSON value');
    return { tokens, duplicates };
  }

  function formatJSON(source, indent = '  ') {
    const parsed = parseJSON(source);
    if (!indent) return { ...parsed, text: parsed.tokens.map(t => t.raw).join('') };
    let depth = 0, output = '';
    parsed.tokens.forEach((item, index) => {
      const next = parsed.tokens[index + 1]?.type, previous = parsed.tokens[index - 1]?.type;
      if (item.type === '{' || item.type === '[') { output += item.raw; depth++; if (next !== '}' && next !== ']') output += '\n' + indent.repeat(depth); }
      else if (item.type === '}' || item.type === ']') { depth--; if (previous !== '{' && previous !== '[') output += '\n' + indent.repeat(depth); output += item.raw; }
      else if (item.type === ',') output += ',\n' + indent.repeat(depth);
      else if (item.type === ':') output += ': ';
      else output += item.raw;
    });
    return { ...parsed, text: output };
  }

  const api = { parseHex, parseOffset, applyEdits, modifiedBlob, findBytes, lineDiff, parseJSON, formatJSON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DataTools = api;
})(typeof window !== 'undefined' ? window : globalThis);
