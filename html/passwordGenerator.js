(() => {
  'use strict';
  const T=Toolbox;
  const cities=[['New York',40.71,-74.01],['Vancouver',49.28,-123.12],['Mexico City',19.43,-99.13],['Havana',23.11,-82.37],['Bogotá',4.71,-74.07],['Lima',-12.05,-77.04],['São Paulo',-23.55,-46.63],['Buenos Aires',-34.60,-58.38],['Santiago',-33.45,-70.67],['Reykjavík',64.15,-21.94],['London',51.51,-.13],['Lisbon',38.72,-9.14],['Paris',48.86,2.35],['Berlin',52.52,13.41],['Oslo',59.91,10.75],['Helsinki',60.17,24.94],['Athens',37.98,23.73],['Istanbul',41.01,28.98],['Cairo',30.04,31.24],['Accra',5.56,-.20],['Lagos',6.52,3.38],['Nairobi',-1.29,36.82],['Cape Town',-33.93,18.42],['Antananarivo',-18.88,47.51],['Dubai',25.20,55.27],['Mumbai',19.08,72.88],['Delhi',28.61,77.21],['Dhaka',23.81,90.41],['Kathmandu',27.72,85.32],['Bangkok',13.76,100.50],['Singapore',1.35,103.82],['Jakarta',-6.21,106.85],['Manila',14.60,120.98],['Hong Kong',22.32,114.17],['Beijing',39.90,116.41],['Seoul',37.57,126.98],['Tokyo',35.68,139.69],['Ulaanbaatar',47.92,106.92],['Perth',-31.95,115.86],['Sydney',-33.87,151.21],['Auckland',-36.85,174.76],['Suva',-18.14,178.44],['Honolulu',21.31,-157.86],['Anchorage',61.22,-149.90]];
  T.setContent(`<section class="card"><h2>Password options</h2><div class="form-grid"><div class="form-field"><label for="passwordLength">Length (4–256 characters)</label><input id="passwordLength" type="number" min="4" max="256" value="20"></div><div class="form-field"><label for="passwordCount">Number of passwords (1–100)</label><input id="passwordCount" type="number" min="1" max="100" value="1"></div></div><div class="check-row" style="margin-top:18px"><label><input id="useLower" type="checkbox" checked>Lowercase a–z</label><label><input id="useUpper" type="checkbox" checked>Uppercase A–Z</label><label><input id="useDigits" type="checkbox" checked>Digits 0–9</label><label><input id="useSymbols" type="checkbox" checked>Symbols</label></div><div class="check-row" style="margin-top:14px"><label><input id="excludeAmbiguous" type="checkbox">Exclude ambiguous characters (O, 0, I, l, 1, |)</label><label><input id="requireEach" type="checkbox" checked>Include every selected character group</label></div><div class="form-field" style="margin-top:16px"><label for="excludeCharacters">Additional characters to exclude</label><input id="excludeCharacters" type="text" autocomplete="off" spellcheck="false" placeholder="Optional"></div><div class="check-row" style="margin-top:18px"><label><input id="useWeather" type="checkbox" checked>Mix in weather from a randomly selected world city</label></div><p class="help">Browser cryptographic randomness is always used. Weather is public supplemental input, and is not counted as secret entropy. If weather is unavailable, passwords are generated securely offline. Weather requests contain only the chosen city’s coordinates; passwords are never sent.</p><div class="action-row"><button id="generatePasswords" class="primary-button" type="button">Generate passwords</button><button id="clearPasswords" class="small-button" type="button">Clear</button></div><p id="passwordStatus" class="status" role="status" aria-live="polite">Choose your options and generate a password.</p><div id="weatherDetails" class="help"></div></section><section class="card"><div class="results-heading"><h2>Generated passwords</h2><div class="check-row"><button id="copyPasswords" class="small-button" type="button" disabled>Copy all</button><button id="downloadPasswords" class="small-button" type="button" disabled>Download text</button></div></div><label class="sr-only" for="passwordOutput">Generated passwords, one per line</label><textarea id="passwordOutput" class="field mono" rows="6" readonly autocomplete="off" spellcheck="false" style="width:100%;font-size:1.05rem" placeholder="Your passwords will appear here"></textarea><p id="passwordStrength" class="help"></p></section><p class="tool-note">Passwords are kept only in this page’s memory. Weather data: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>).</p>`);
  const $=id=>document.getElementById(id);
  let weatherController=null, generation=0;
  function secureSource(mask=new Uint8Array()) {
    if(!globalThis.crypto?.getRandomValues)throw new Error('Secure browser randomness is unavailable. Password generation is disabled.');
    const words=new Uint32Array(256), raw=new Uint8Array(words.buffer);let index=words.length,cycle=0;
    function next(){if(index>=words.length){crypto.getRandomValues(words);if(mask.length)for(let i=0;i<raw.length;i++)raw[i]^=mask[(cycle+i)%mask.length];cycle+=raw.length;index=0;}return words[index++];}
    return limit=>{if(!Number.isInteger(limit)||limit<1||limit>0x100000000)throw new Error('Invalid random range.');const bound=Math.floor(0x100000000/limit)*limit;let value;do{value=next();}while(value>=bound);return value%limit;};
  }
  function options(){
    const length=Number($('passwordLength').value),count=Number($('passwordCount').value);
    if(!Number.isInteger(length)||length<4||length>256)throw new Error('Length must be a whole number between 4 and 256.');
    if(!Number.isInteger(count)||count<1||count>100)throw new Error('Count must be a whole number between 1 and 100.');
    const excluded=new Set($('excludeCharacters').value+($('excludeAmbiguous').checked?'O0Il1|':''));
    const base=[['useLower','abcdefghijklmnopqrstuvwxyz'],['useUpper','ABCDEFGHIJKLMNOPQRSTUVWXYZ'],['useDigits','0123456789'],['useSymbols','!@#$%^&*()-_=+[]{};:,.<>?/\\|~`\'"']];
    const groups=base.filter(([id])=>$(id).checked).map(([,chars])=>[...chars].filter(c=>!excluded.has(c)).join(''));
    if(!groups.length)throw new Error('Select at least one character group.');
    if(groups.some(g=>!g.length))throw new Error('Your exclusions remove an entire selected character group. Adjust your selections.');
    return {length,count,groups,alphabet:groups.join(''),requireEach:$('requireEach').checked,weather:$('useWeather').checked};
  }
  function makePasswords(opts,random){const output=[];for(let n=0;n<opts.count;n++){let password,attempts=0;do{if(++attempts>100000)throw new Error('Could not satisfy those character rules. Try a longer password.');password=Array.from({length:opts.length},()=>opts.alphabet[random(opts.alphabet.length)]).join('');}while(opts.requireEach&&!opts.groups.every(g=>[...password].some(c=>g.includes(c))));output.push(password);}return output;}
  function entropy(opts){let total=0n;const n=opts.groups.length;if(!opts.requireEach)total=BigInt(opts.alphabet.length)**BigInt(opts.length);else for(let mask=0;mask<(1<<n);mask++){let excluded=0,bits=0;for(let j=0;j<n;j++)if(mask&(1<<j)){excluded+=opts.groups[j].length;bits++;}const term=BigInt(opts.alphabet.length-excluded)**BigInt(opts.length);total+=bits%2?-term:term;}if(total<=0n)return 0;const bin=total.toString(2),take=bin.slice(0,52);return Math.log2(parseInt(take,2))+bin.length-take.length;}
  async function weather(random,signal){
    const [name,latitude,longitude]=cities[random(cities.length)];
    const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),current:'temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m',timezone:'UTC'});
    const response=await fetch(url,{signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error('Weather service unavailable.');
    const data=await response.json(),c=data.current;
    if(!c||!['temperature_2m','relative_humidity_2m','surface_pressure','wind_speed_10m'].every(k=>Number.isFinite(c[k])))throw new Error('Incomplete weather response.');
    return {name,current:c,bytes:new TextEncoder().encode(JSON.stringify({name,latitude,longitude,current:c}))};
  }
  $('generatePasswords').onclick=async()=>{
    const id=++generation;let opts;
    try{opts=options();secureSource();}catch(e){T.status('passwordStatus',e.message,true);return;}
    $('generatePasswords').disabled=true;$('weatherDetails').textContent='';
    let mask=new Uint8Array(),weatherMessage=opts.weather?'Weather unavailable; used secure browser randomness only.':'Weather mixing off; used secure browser randomness only.';
    try{
      if(opts.weather){T.status('passwordStatus','Fetching a random city’s weather…');const controller=new AbortController();weatherController=controller;const timer=setTimeout(()=>controller.abort(),4000);try{const result=await weather(secureSource(),controller.signal);mask=result.bytes;weatherMessage=`Weather mixed in from ${result.name}.`;if(id===generation)$('weatherDetails').textContent=`${result.name}: ${result.current.temperature_2m} °C · humidity ${result.current.relative_humidity_2m}% · pressure ${result.current.surface_pressure} hPa · wind ${result.current.wind_speed_10m} km/h · ${result.current.time} UTC`;}catch{weatherMessage='Weather unavailable; used secure browser randomness only.';}finally{clearTimeout(timer);if(weatherController===controller)weatherController=null;}}
      if(id!==generation)return;
      const passwords=makePasswords(opts,secureSource(mask));$('passwordOutput').value=passwords.join('\n');
      $('copyPasswords').disabled=false;$('downloadPasswords').disabled=false;
      $('passwordStrength').textContent=`${opts.length} characters · ${opts.alphabet.length} available characters · approximately ${entropy(opts).toFixed(1)} bits of entropy per password under the selected rules. Weather contributes no claimed entropy.`;
      T.status('passwordStatus',`${passwords.length} password${passwords.length===1?'':'s'} generated. ${weatherMessage}`);
    }catch(e){T.status('passwordStatus',e.message,true);}finally{if(id===generation)$('generatePasswords').disabled=false;}
  };
  $('clearPasswords').onclick=()=>{generation++;weatherController?.abort();weatherController=null;$('generatePasswords').disabled=false;$('passwordOutput').value='';$('passwordStrength').textContent='';$('weatherDetails').textContent='';$('copyPasswords').disabled=true;$('downloadPasswords').disabled=true;T.status('passwordStatus','Passwords cleared.');};
  $('copyPasswords').onclick=async()=>{try{await T.copy($('passwordOutput').value);T.status('passwordStatus','Passwords copied.');}catch(e){T.status('passwordStatus',e.message,true);}};
  $('downloadPasswords').onclick=()=>T.download(new Blob([$('passwordOutput').value+'\n'],{type:'text/plain;charset=utf-8'}),'passwords.txt');
  window.PasswordGenerator={secureSource,makePasswords,entropy,cities};
})();
