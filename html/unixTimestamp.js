(() => {
  'use strict';
  const T = Toolbox, localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  T.setContent(`<section class="card"><h2>Time zone</h2><div class="inline-field"><div class="form-field"><label for="timeZone">World time zone</label><input id="timeZone" type="text" list="timeZoneOptions" autocomplete="off" value="${T.escape(localZone)}"><datalist id="timeZoneOptions"></datalist></div><button id="localZone" class="small-button" type="button">Local time</button><button id="utcZone" class="small-button" type="button">UTC</button><button id="timestampNow" class="primary-button" type="button">Use current time</button></div><p class="help">Defaults to your local zone: ${T.escape(localZone)}. Changing the zone keeps the same instant and updates its displayed date.</p></section><div class="tool-grid" style="margin-bottom:18px"><section class="card"><h2>Timestamp → date</h2><div class="tool-stack"><div class="form-field"><label for="unixInput">Unix timestamp</label><input id="unixInput" type="text" inputmode="decimal" class="mono" placeholder="1700000000"></div><div class="form-field"><label for="unixUnit">Input unit</label><select id="unixUnit"><option value="auto">Auto detect</option><option value="seconds">Seconds</option><option value="milliseconds">Milliseconds</option></select></div><button id="fromUnix" class="primary-button" type="button">Convert timestamp</button></div><p class="help">Auto treats absolute values ≥ 100,000,000,000 as milliseconds. Choose a unit explicitly for older dates. Fractional seconds are supported to millisecond precision.</p></section><section class="card"><h2>Date → timestamp</h2><div class="tool-stack"><div class="form-field"><label for="wallDate">Date and time in the selected zone</label><input id="wallDate" type="datetime-local" step="0.001"></div><div class="form-field"><label for="dstOccurrence">When a clock change repeats a time</label><select id="dstOccurrence"><option value="earlier">Use the earlier occurrence</option><option value="later">Use the later occurrence</option></select></div><button id="fromDate" class="primary-button" type="button">Convert date</button></div><p class="help">Times skipped by daylight saving are rejected. Repeated times use the occurrence you select.</p></section></div><p id="timestampStatus" class="status" role="status" aria-live="polite"></p><section class="card"><h2>Converted time</h2><div id="timestampResults" class="result-list"></div></section><p class="tool-note">Dates and conversions stay in this browser.</p>`);
  const $ = id => document.getElementById(id);
  let instant = null, latest = [];
  const pad = (n, len = 2) => String(n).padStart(len,'0');
  function civilMillis(p) { const d=new Date(0); d.setUTCFullYear(p.year,p.month-1,p.day); d.setUTCHours(p.hour||0,p.minute||0,p.second||0,p.millisecond||0); return d.getTime(); }
  function dateParts(ms,zone) {
    const parts = new Intl.DateTimeFormat('en-GB-u-ca-iso8601-nu-latn',{timeZone:zone,era:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
    const p=Object.fromEntries(parts.filter(p=>p.type!=='literal'&&p.type!=='era').map(p=>[p.type,Number(p.value)])); if(parts.find(p=>p.type==='era')?.value==='BC')p.year=1-p.year; p.millisecond=((ms%1000)+1000)%1000; return p;
  }
  function parseWall(value) {
    const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
    if(!m) throw new Error('Enter a complete date and time.');
    const p={year:+m[1],month:+m[2],day:+m[3],hour:+m[4],minute:+m[5],second:+(m[6]||0),millisecond:+(m[7]||'').padEnd(3,'0')};
    const d=new Date(civilMillis(p));
    if(p.year<1||p.year>9999||p.month<1||p.month>12||p.day<1||p.hour>23||p.minute>59||p.second>59||d.getUTCFullYear()!==p.year||d.getUTCMonth()+1!==p.month||d.getUTCDate()!==p.day) throw new Error('Enter a valid calendar date between years 0001 and 9999.');
    return p;
  }
  function wallToInstant(value,zone,occurrence='earlier') {
    const p=parseWall(value), target=civilMillis(p), offsets=new Set();
    for(let hours=-48;hours<=48;hours+=6){const at=target+hours*3600000;offsets.add(civilMillis(dateParts(at,zone))-at);}
    const matches=[...offsets].map(offset=>target-offset).filter(at=>{const q=dateParts(at,zone);return ['year','month','day','hour','minute','second','millisecond'].every(key=>q[key]===p[key]);}).sort((a,b)=>a-b);
    if(!matches.length) throw new Error('That local time does not exist in this zone because the clock moved forward. Choose another time.');
    return {ms:occurrence==='later'?matches[matches.length-1]:matches[0],ambiguous:matches.length>1};
  }
  function parseUnix(value,unit) {
    const s=value.trim();if(!/^-?\d+(?:\.\d+)?$/.test(s))throw new Error('Enter a numeric Unix timestamp.');
    const used=unit==='auto'?(Math.abs(Number(s))>=1e11?'milliseconds':'seconds'):unit;
    if(!['seconds','milliseconds'].includes(used))throw new Error('Choose seconds or milliseconds.');
    const negative=s.startsWith('-'),[whole,fraction='']=s.replace(/^-/,'').split('.');
    const absolute=BigInt(whole)*(used==='seconds'?1000n:1n)+(used==='seconds'?BigInt(fraction.slice(0,3).padEnd(3,'0')):0n);
    if(absolute>8640000000000000n)throw new Error('Timestamp is outside the supported date range.');
    const ms=Number(negative?-absolute:absolute),year=new Date(ms).getUTCFullYear();
    if(year<1||year>9999)throw new Error('Choose a timestamp between calendar years 0001 and 9999.');
    return {ms,unit:used};
  }
  function zone() { const value=$('timeZone').value.trim();new Intl.DateTimeFormat('en',{timeZone:value}).format();return value; }
  function show(ms) {
    const z=zone(), date=new Date(ms), p=dateParts(ms,z), wall=`${pad(p.year,4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}.${pad(p.millisecond,3)}`;
    instant=ms;
    $('wallDate').value=p.year>=1&&p.year<=9999?wall:'';
    const delta=civilMillis(p)-ms, sign=delta<0?'-':'+';
    const offset=`UTC${sign}${pad(Math.floor(Math.abs(delta)/3600000))}:${pad(Math.floor(Math.abs(delta)/60000)%60)}${Math.abs(delta)%60000?':'+pad(Math.floor(Math.abs(delta)/1000)%60):''}`;
    latest=[['Unix seconds',String(ms/1000)],['Unix milliseconds',String(ms)],['Selected zone',`${wall.replace('T',' ')} (${z}, ${offset})`],['UTC / ISO 8601',date.toISOString()],['UTC / RFC 1123',date.toUTCString()],['Local time',new Intl.DateTimeFormat(undefined,{dateStyle:'full',timeStyle:'long',timeZone:localZone}).format(date)]];
    $('timestampResults').innerHTML=latest.map(([name,value],i)=>`<div class="result-row"><strong>${T.escape(name)}</strong><code>${T.escape(value)}</code><button class="small-button" type="button" data-timestamp-copy="${i}" aria-label="Copy ${T.escape(name)}">Copy</button></div>`).join('');
  }
  function run(fn) {try{fn();}catch(e){T.status('timestampStatus',e instanceof RangeError?'Enter a valid IANA time zone, such as America/New_York or Europe/London.':e.message,true);}}
  $('fromUnix').onclick=()=>run(()=>{const parsed=parseUnix($('unixInput').value,$('unixUnit').value);show(parsed.ms);T.status('timestampStatus',`Converted as ${parsed.unit}.`);});
  $('fromDate').onclick=()=>run(()=>{const parsed=wallToInstant($('wallDate').value,zone(),$('dstOccurrence').value);show(parsed.ms);$('unixInput').value=String(parsed.ms/1000);$('unixUnit').value='seconds';T.status('timestampStatus',parsed.ambiguous?`This time occurs twice; used the ${$('dstOccurrence').value} occurrence.`:'Date converted.');});
  $('timestampNow').onclick=()=>run(()=>{const now=Date.now();$('unixInput').value=String(now);$('unixUnit').value='milliseconds';show(now);T.status('timestampStatus','Current time captured.');});
  function changeZone(){run(()=>{zone();if(instant!==null)show(instant);T.status('timestampStatus','Time zone updated.');});}
  $('timeZone').addEventListener('change',changeZone);
  $('localZone').onclick=()=>{$('timeZone').value=localZone;changeZone();};
  $('utcZone').onclick=()=>{$('timeZone').value='UTC';changeZone();};
  $('unixInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('fromUnix').click();});
  $('timestampResults').addEventListener('click',async e=>{const b=e.target.closest('[data-timestamp-copy]');if(!b)return;try{await T.copy(latest[+b.dataset.timestampCopy][1]);T.status('timestampStatus','Copied.');}catch(e){T.status('timestampStatus',e.message,true);}});
  const zones=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('timeZone'):['America/New_York','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Tokyo','Asia/Kolkata','Australia/Sydney','Pacific/Auckland'];
  $('timeZoneOptions').innerHTML=[...new Set(['UTC',localZone,...zones])].map(z=>`<option value="${T.escape(z)}"></option>`).join('');
  window.UnixTimestamp={parseUnix,parseWall,wallToInstant,dateParts};
  $('timestampNow').click();
})();
