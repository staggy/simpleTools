/* All codecs are loaded from the local vendor directory. File bytes never leave this page. */
(function (root) {
  'use strict';
  const MAX_PIXELS = 64000000;
  const MAX_DIMENSION = 16384;
  const MAX_FILE_BYTES = 128 * 1024 * 1024;
  const formats = {
    png: { name: 'PNG', mime: 'image/png', extension: 'png' },
    jpeg: { name: 'JPEG', mime: 'image/jpeg', extension: 'jpg' },
    webp: { name: 'WebP', mime: 'image/webp', extension: 'webp' },
    gif: { name: 'GIF', mime: 'image/gif', extension: 'gif' },
    tiff: { name: 'TIFF', mime: 'image/tiff', extension: 'tif' },
    bmp: { name: 'BMP', mime: 'image/bmp', extension: 'bmp' }
  };

  function checkDimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Image dimensions must be positive whole numbers.');
    if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) throw new Error('This image exceeds the limit of 64 megapixels or 16,384 pixels per side. Try a smaller image.');
    return { width, height };
  }

  function validateSettings(settings) {
    if (!settings || !['original', 'percent', 'dimensions'].includes(settings.mode)) throw new Error('Choose a supported resize mode.');
    const normalized = { ...settings };
    if (settings.mode === 'percent') {
      const percent = Number(settings.percent);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 1000) throw new Error('Enter a resize percentage above 0 and at most 1000.');
      normalized.percent = percent;
    } else if (settings.mode === 'dimensions') {
      const requestedW = settings.width === '' || settings.width == null ? null : Number(settings.width);
      const requestedH = settings.height === '' || settings.height == null ? null : Number(settings.height);
      if (requestedW === null && requestedH === null) throw new Error('Enter a width or height for resizing.');
      if ([requestedW, requestedH].some(n => n !== null && (!Number.isSafeInteger(n) || n < 1))) throw new Error('Width and height must be positive whole numbers.');
      normalized.width = requestedW; normalized.height = requestedH;
    }
    return normalized;
  }

  function computeDimensions(width, height, settings) {
    settings = validateSettings(settings);
    let w = width, h = height;
    if (settings.mode === 'percent') {
      w = Math.max(1, Math.round(width * settings.percent / 100));
      h = Math.max(1, Math.round(height * settings.percent / 100));
    } else if (settings.mode === 'dimensions') {
      const requestedW = settings.width, requestedH = settings.height;
      if (settings.lockAspect || requestedW === null || requestedH === null) {
        const scale = Math.min(requestedW === null ? Infinity : requestedW / width, requestedH === null ? Infinity : requestedH / height);
        w = Math.max(1, Math.round(width * scale)); h = Math.max(1, Math.round(height * scale));
      } else { w = requestedW; h = requestedH; }
    }
    if (settings.noUpscale && (w > width || h > height)) {
      const scale = Math.min(1, width / w, height / h);
      w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
    }
    return checkDimensions(w, h);
  }

  function sniffFormat(bytes, name = '') {
    const ascii = (offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
    if (ascii(0, 4) === '\x89PNG') return 'png';
    if (ascii(0, 3) === 'GIF') return 'gif';
    if (ascii(0, 4) === 'II*\x00' || ascii(0, 4) === 'MM\x00*') return 'tiff';
    if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
    if (ascii(0, 2) === 'BM') return 'bmp';
    if (ascii(4, 4) === 'ftyp') {
      const brands = ascii(8, Math.min(bytes.length - 8, 56));
      if (/avif|avis/.test(brands)) return 'avif';
      if (/heic|heix|hevc|hevx|mif1|msf1/.test(brands)) return 'heic';
    }
    const ext = name.split('.').pop().toLowerCase();
    return ({ tif: 'tiff', tiff: 'tiff', heif: 'heic', heic: 'heic' })[ext] || 'native';
  }

  function makeCanvas(width, height) {
    checkDimensions(width, height);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    if (!canvas.getContext('2d')) throw new Error('A 2D canvas is unavailable in this browser.');
    return canvas;
  }

  function orientCanvas(canvas, orientation) {
    if (!Number.isInteger(orientation) || orientation < 2 || orientation > 8) return canvas;
    const swap = orientation >= 5;
    const result = makeCanvas(swap ? canvas.height : canvas.width, swap ? canvas.width : canvas.height);
    const ctx = result.getContext('2d'), w = canvas.width, h = canvas.height;
    const transforms = { 2: [-1,0,0,1,w,0], 3: [-1,0,0,-1,w,h], 4: [1,0,0,-1,0,h], 5: [0,1,1,0,0,0], 6: [0,1,-1,0,h,0], 7: [0,-1,-1,0,h,w], 8: [0,-1,1,0,0,w] };
    ctx.setTransform(...transforms[orientation]); ctx.drawImage(canvas, 0, 0);
    canvas.width = canvas.height = 1;
    return result;
  }

  async function nativeImage(blob) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (_) { /* Browser image fallback. */ }
    }
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('This browser cannot decode this image format, or the file is damaged.'));
        image.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
  }

  async function loadTiff() {
    await Toolbox.loadScript('vendor/image/pako-1.0.11.min.js');
    await Toolbox.loadScript('vendor/image/UTIF-3.1.0.js');
  }

  async function decode(file) {
    if (file.size > MAX_FILE_BYTES) throw new Error('Choose an image smaller than 128 MiB.');
    const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const format = sniffFormat(header, file.name || '');
    if (format === 'tiff') {
      await loadTiff();
      const buffer = await file.arrayBuffer();
      const pages = UTIF.decode(buffer);
      const page = pages.find(ifd => ifd.t256 && ifd.t257);
      if (!page) throw new Error('No image page was found in this TIFF.');
      checkDimensions(Number(page.t256[0]), Number(page.t257[0]));
      UTIF.decodeImage(buffer, page);
      const canvas = makeCanvas(page.width, page.height);
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(page)), page.width, page.height), 0, 0);
      return { image: orientCanvas(canvas, page.t274 ? page.t274[0] : 1), format, note: pages.filter(p => p.t256 && p.t257).length > 1 ? 'First TIFF page only.' : '', close() { this.image.width = this.image.height = 1; } };
    }
    if (format === 'gif') {
      await Toolbox.loadScript('vendor/image/omggif-1.0.10.js');
      const reader = new GifReader(new Uint8Array(await file.arrayBuffer()));
      checkDimensions(reader.width, reader.height);
      const rgba = new Uint8Array(reader.width * reader.height * 4);
      reader.decodeAndBlitFrameRGBA(0, rgba);
      const canvas = makeCanvas(reader.width, reader.height);
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), reader.width, reader.height), 0, 0);
      return { image: canvas, format, note: reader.numFrames() > 1 ? 'First GIF frame only; animation is flattened.' : '', close() { this.image.width = this.image.height = 1; } };
    }
    if (format === 'heic') {
      await Toolbox.loadScript('vendor/image/heic-to-1.6.7.js');
      const image = await HeicTo({ blob: file, type: 'bitmap' });
      try { checkDimensions(image.width, image.height); } catch (error) { image.close(); throw error; }
      return { image, format, note: 'Primary HEIC/HEIF image only.', close() { image.close(); } };
    }
    const image = await nativeImage(file);
    try { checkDimensions(image.width || image.naturalWidth, image.height || image.naturalHeight); } catch (error) { if (image.close) image.close(); throw error; }
    return { image, format, note: '', close() { if (image.close) image.close(); } };
  }

  // Adaptive median-cut palette, with one palette entry reserved for GIF transparency.
  function gifPalette(rgba) {
    const bins = new Map();
    let transparent = false;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] < 128) { transparent = true; continue; }
      const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
      let bin = bins.get(key);
      if (!bin) { bin = [0,0,0,0,key]; bins.set(key, bin); }
      bin[0] += rgba[i]; bin[1] += rgba[i + 1]; bin[2] += rgba[i + 2]; bin[3]++;
    }
    const colors = [...bins.values()].map(b => [b[0]/b[3], b[1]/b[3], b[2]/b[3], b[3], b[4]]);
    const boxes = colors.length ? [colors] : [];
    const limit = transparent ? 255 : 256;
    const range = box => [0,1,2].map(c => {
      let low = Infinity, high = -Infinity;
      for (const color of box) { low = Math.min(low,color[c]); high = Math.max(high,color[c]); }
      return high - low;
    });
    while (boxes.length < limit) {
      let best = -1, bestRange = -1, channel = 0;
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].length < 2) continue;
        const spans = range(boxes[i]); const span = Math.max(...spans);
        if (span > bestRange) { best = i; bestRange = span; channel = spans.indexOf(span); }
      }
      if (best < 0) break;
      const box = boxes[best].sort((a,b) => a[channel]-b[channel]);
      const total = box.reduce((n,c) => n+c[3],0);
      let count = 0, split = 1;
      for (; split < box.length; split++) { count += box[split-1][3]; if (count >= total/2) break; }
      split = Math.min(split, box.length - 1);
      boxes.splice(best, 1, box.slice(0,split), box.slice(split));
    }
    const palette = transparent ? [0] : [];
    const cache = new Map();
    for (const box of boxes) {
      let r=0,g=0,b=0,total=0;
      for (const color of box) { r+=color[0]*color[3]; g+=color[1]*color[3]; b+=color[2]*color[3]; total+=color[3]; }
      palette.push((Math.round(r/total)<<16)|(Math.round(g/total)<<8)|Math.round(b/total));
    }
    if (!palette.length) palette.push(0);
    const actualLength = palette.length;
    while (palette.length < 2 || (palette.length & (palette.length-1))) palette.push(0);
    const pixels = new Uint8Array(rgba.length/4);
    for (let i=0,j=0; i<rgba.length; i+=4,j++) {
      if (rgba[i+3]<128) { pixels[j]=0; continue; }
      const key=((rgba[i]>>3)<<10)|((rgba[i+1]>>3)<<5)|(rgba[i+2]>>3);
      if (cache.has(key)) { pixels[j]=cache.get(key); continue; }
      let best=transparent ? 1 : 0, distance=Infinity;
      for (let p=transparent?1:0;p<actualLength;p++) {
        const color=palette[p];
        const d=(rgba[i]-(color>>16))**2+(rgba[i+1]-((color>>8)&255))**2+(rgba[i+2]-(color&255))**2;
        if(d<distance){distance=d;best=p;}
      }
      cache.set(key,best); pixels[j]=best;
    }
    return { palette, pixels, transparent: transparent ? 0 : null };
  }

  function encodeBmp(rgba, width, height) {
    const stride = Math.ceil(width*3/4)*4, size = 54 + stride*height;
    const data = new Uint8Array(size), view = new DataView(data.buffer);
    data[0]=66; data[1]=77; view.setUint32(2,size,true); view.setUint32(10,54,true); view.setUint32(14,40,true);
    view.setInt32(18,width,true); view.setInt32(22,height,true); view.setUint16(26,1,true); view.setUint16(28,24,true); view.setUint32(34,stride*height,true);
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const source=(y*width+x)*4, dest=54+(height-1-y)*stride+x*3;
      data[dest]=rgba[source+2];data[dest+1]=rgba[source+1];data[dest+2]=rgba[source];
    }
    return data;
  }

  async function encodeCanvas(canvas, format, quality = .9) {
    const info = formats[format];
    if (!info) throw new Error('Choose a supported output format.');
    if (format === 'tiff') {
      await loadTiff();
      const rgba = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      return new Blob([UTIF.encodeImage(rgba.buffer,canvas.width,canvas.height,{t305:['Simple Tools (UTIF.js)'],t338:[2]})], {type:info.mime});
    }
    if (format === 'gif') {
      await Toolbox.loadScript('vendor/image/omggif-1.0.10.js');
      const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      const mapped=gifPalette(rgba), output=new Uint8Array(canvas.width*canvas.height*2+65536);
      const writer=new GifWriter(output,canvas.width,canvas.height,{palette:mapped.palette});
      const options=mapped.transparent===null?{}:{transparent:mapped.transparent};
      writer.addFrame(0,0,canvas.width,canvas.height,mapped.pixels,options);
      return new Blob([output.subarray(0,writer.end())],{type:info.mime});
    }
    if (format === 'bmp') {
      const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      return new Blob([encodeBmp(rgba,canvas.width,canvas.height)],{type:info.mime});
    }
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('The image could not be encoded. Try smaller dimensions.')),info.mime,quality));
    if(blob.type!==info.mime) throw new Error(`${info.name} output is not supported by this browser. Choose PNG or JPEG.`);
    return blob;
  }

  const crcTable = new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c;}
  function crc32(data){let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
  async function createZip(files) {
    const parts=[], central=[];let offset=0,centralLength=0;
    for(const file of files){
      const name=new TextEncoder().encode(file.name),size=file.blob.size;
      if(size>0xffffffff || offset+size>0xffffffff)throw new Error('The ZIP exceeds the 4 GiB limit. Download files individually.');
      const checksum=crc32(new Uint8Array(await file.blob.arrayBuffer()));
      const header=new Uint8Array(30),view=new DataView(header.buffer);
      view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint16(12,33,true);
      view.setUint32(14,checksum,true);view.setUint32(18,size,true);view.setUint32(22,size,true);view.setUint16(26,name.length,true);
      parts.push(header,name,file.blob);
      const entry=new Uint8Array(46),entryView=new DataView(entry.buffer);
      entryView.setUint32(0,0x02014b50,true);entryView.setUint16(4,20,true);entryView.setUint16(6,20,true);entryView.setUint16(8,0x800,true);entryView.setUint16(14,33,true);
      entryView.setUint32(16,checksum,true);entryView.setUint32(20,size,true);entryView.setUint32(24,size,true);entryView.setUint16(28,name.length,true);entryView.setUint32(42,offset,true);
      central.push(entry,name);centralLength+=46+name.length;offset+=30+name.length+size;
    }
    const end=new Uint8Array(22),view=new DataView(end.buffer);
    view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,centralLength,true);view.setUint32(16,offset,true);
    return new Blob([...parts,...central,end],{type:'application/zip'});
  }

  root.ImageConverter = { validateSettings, computeDimensions, sniffFormat, checkDimensions, gifPalette, encodeBmp, crc32, createZip, decode, encodeCanvas };
  if (typeof document === 'undefined') return;

  Toolbox.setContent(`
    <section class="card" aria-labelledby="images-heading">
      <h2 id="images-heading">Choose your images</h2>
      <label id="imageDrop" for="imageFiles" class="drop-zone"><strong>Drop images here or click to browse</strong><small>JPEG, PNG, WebP, GIF, TIFF, HEIC/HEIF, BMP, and browser-supported AVIF</small><small>Up to 100 files · 128 MiB per file</small></label>
      <input id="imageFiles" type="file" multiple accept="image/*,.heic,.heif,.tif,.tiff" class="sr-only">
    </section>
    <section class="card" aria-labelledby="image-settings-heading">
      <h2 id="image-settings-heading">Conversion and resizing</h2>
      <div class="image-settings">
        <div class="form-field"><label for="imageFormat">Output format</label><select id="imageFormat" class="field">${Object.entries(formats).map(([key,f])=>`<option value="${key}">${f.name}</option>`).join('')}</select><p id="imageFormatHint" class="image-help">Lossless compression with transparency.</p></div>
        <div class="form-field"><label for="imageResizeMode">Resize</label><select id="imageResizeMode" class="field"><option value="original">Keep original size</option><option value="dimensions">Width / height in pixels</option><option value="percent">Percentage</option></select></div>
        <div class="form-field" id="imageQualityField"><label for="imageQuality">Quality: <output id="imageQualityLabel">90%</output></label><input id="imageQuality" type="range" min="1" max="100" value="90"><p class="image-help">Used for JPEG and WebP output.</p></div>
        <div class="form-field" id="imageDimensionsField" hidden><div class="image-size-inputs"><div class="form-field"><label for="imageWidth">Width (px)</label><input id="imageWidth" type="number" min="1" max="16384" step="1" placeholder="Auto"></div><div class="form-field"><label for="imageHeight">Height (px)</label><input id="imageHeight" type="number" min="1" max="16384" step="1" placeholder="Auto"></div></div><label class="image-check"><input id="imageAspect" type="checkbox" checked> Keep aspect ratio</label><p class="image-help">With both dimensions set, fit inside that box. Leave one blank to calculate it.</p></div>
        <div class="form-field" id="imagePercentField" hidden><label for="imagePercent">Scale (%)</label><input id="imagePercent" type="number" min="0.01" max="1000" value="100" step="any"></div>
        <div class="form-field"><label for="imageBackground">Background color</label><input id="imageBackground" type="color" value="#ffffff"><label class="image-check"><input id="imageTransparency" type="checkbox" checked> Keep transparency where supported</label><p class="image-help">JPEG and BMP always use the background color.</p></div>
        <div class="form-field"><label class="image-check"><input id="imageNoUpscale" type="checkbox" checked> Only make images smaller</label><p class="image-help">Protect smaller images from accidental enlargement.</p></div>
      </div>
      <div class="action-row"><button id="imageConvert" class="primary-button" type="button" disabled>Convert images</button><button id="imageCancel" class="small-button" type="button" hidden>Stop after current image</button><button id="imageClear" class="small-button" type="button" disabled>Clear</button><button id="imageDownloadAll" class="small-button" type="button" disabled>Download all (ZIP)</button></div>
      <p id="imageStatus" class="status" role="status" aria-live="polite">Choose one or more images to begin.</p>
      <progress id="imageProgress" class="image-progress" value="0" max="1" hidden aria-label="Conversion progress"></progress>
      <p class="image-help image-converter-note">Conversions create still images and remove source metadata. Animated images use the first frame; TIFF uses the first page and HEIC/HEIF uses the primary image. HEIC output is not available. TIFF output is uncompressed; GIF is limited to 256 colors and binary transparency.</p>
    </section>
    <section id="imageResults" class="card" aria-labelledby="image-results-heading" hidden><h2 id="image-results-heading">Images</h2><ul id="imageFileList" class="image-file-list"></ul></section>
    <p class="tool-note">Images stay in this browser. The HEIC, TIFF, and GIF codecs are bundled with this site; no conversion service is contacted. <a href="vendor/image/README.md">Codec licenses and source</a></p>
  `);

  const $=id=>document.getElementById(id);
  let queue=[],busy=false,cancelled=false,nextId=0;
  const formatHints={png:'Lossless compression with transparency.',jpeg:'Smaller photo files; transparency is filled with your background color.',webp:'Adjustable compression with transparency, where supported by your browser.',gif:'Single-frame GIF with an adaptive palette of up to 256 colors.',tiff:'Uncompressed 8-bit RGBA TIFF. Output files can be large.',bmp:'Uncompressed 24-bit BMP; transparency is filled with your background color.'};

  function updateSettings(){
    $('imageDimensionsField').hidden=$('imageResizeMode').value!=='dimensions';
    $('imagePercentField').hidden=$('imageResizeMode').value!=='percent';
    $('imageQuality').disabled=!['jpeg','webp'].includes($('imageFormat').value)||busy;
    $('imageQualityLabel').textContent=`${$('imageQuality').value}%`;
    $('imageFormatHint').textContent=formatHints[$('imageFormat').value];
    $('imageTransparency').disabled=['jpeg','bmp'].includes($('imageFormat').value)||busy;
  }
  function setBusy(value){
    busy=value;
    for(const element of document.querySelectorAll('.image-settings input,.image-settings select'))element.disabled=value;
    $('imageFiles').disabled=value;$('imageConvert').disabled=value||!queue.length;$('imageClear').disabled=value||!queue.length;$('imageCancel').hidden=!value;
    $('imageDownloadAll').disabled=value||!queue.some(item=>item.result);
    updateSettings();
  }
  function renderItem(item){
    const li=document.createElement('li');li.className='image-file';li.dataset.id=item.id;
    li.innerHTML=`<div class="image-file-thumb" aria-hidden="true">▧</div><div><div class="image-file-title">${Toolbox.escape(item.file.name)}</div><small>${Toolbox.bytes(item.file.size)}</small><div class="image-file-status">Ready to convert</div></div><button type="button" class="small-button" hidden>Download</button>`;
    li.querySelector('button').addEventListener('click',()=>{if(item.result)Toolbox.download(item.result.blob,item.result.name);});
    $('imageFileList').append(li);item.element=li;
  }
  function addFiles(files){
    if(busy)return;
    let added=0,rejected=0;
    for(const file of files){
      if(queue.length>=100){rejected++;continue;}
      if(file.size>MAX_FILE_BYTES){rejected++;continue;}
      const item={id:++nextId,file,result:null,url:null};queue.push(item);renderItem(item);added++;
    }
    $('imageResults').hidden=!queue.length;setBusy(false);
    Toolbox.status($('imageStatus'),`${added} image${added===1?'':'s'} added. ${queue.length} in the queue.${rejected?' Some files were skipped (100-file or 128 MiB limit).':''}`,!!rejected);
    $('imageFiles').value='';
  }
  $('imageFiles').addEventListener('change',event=>addFiles(event.target.files));
  const drop=$('imageDrop');
  for(const type of ['dragenter','dragover'])drop.addEventListener(type,event=>{event.preventDefault();if(!busy)drop.classList.add('drop-active');});
  for(const type of ['dragleave','drop'])drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('drop-active');});
  drop.addEventListener('drop',event=>addFiles(event.dataTransfer.files));
  for(const id of ['imageResizeMode','imageFormat','imageQuality'])$(id).addEventListener('input',updateSettings);
  $('imageCancel').addEventListener('click',()=>{cancelled=true;$('imageCancel').disabled=true;$('imageCancel').textContent='Stopping after current image…';});
  $('imageClear').addEventListener('click',()=>{
    for(const item of queue)if(item.url)URL.revokeObjectURL(item.url);
    queue=[];$('imageFileList').replaceChildren();$('imageResults').hidden=true;$('imageProgress').hidden=true;setBusy(false);Toolbox.status($('imageStatus'),'Choose one or more images to begin.');
  });

  $('imageConvert').addEventListener('click',async()=>{
    if(busy||!queue.length)return;
    const settings={mode:$('imageResizeMode').value,width:$('imageWidth').value,height:$('imageHeight').value,percent:$('imagePercent').value,lockAspect:$('imageAspect').checked,noUpscale:$('imageNoUpscale').checked};
    const format=$('imageFormat').value,quality=Number($('imageQuality').value)/100,background=$('imageBackground').value,keepTransparency=$('imageTransparency').checked;
    try{validateSettings(settings);}catch(error){Toolbox.status($('imageStatus'),error.message,true);return;}
    // Each run starts a new result set; stopping must never mix in older downloads.
    for(const item of queue){
      if(item.url)URL.revokeObjectURL(item.url);
      item.url=null;item.result=null;
      item.element.querySelector('button').hidden=true;
      item.element.querySelector('.image-file-thumb').textContent='▧';
      const state=item.element.querySelector('.image-file-status');state.textContent='Waiting to convert';state.classList.remove('no-match');
    }
    setBusy(true);cancelled=false;$('imageCancel').disabled=false;$('imageCancel').textContent='Stop after current image';
    $('imageProgress').hidden=false;$('imageProgress').max=queue.length;$('imageProgress').value=0;
    let completed=0,failed=0;
    const names=new Map();
    for(let index=0;index<queue.length;index++){
      if(cancelled)break;
      const item=queue[index],row=item.element,state=row.querySelector('.image-file-status');
      if(item.url){URL.revokeObjectURL(item.url);item.url=null;}
      item.result=null;row.querySelector('button').hidden=true;row.querySelector('.image-file-thumb').textContent='▧';
      state.textContent='Converting…';state.classList.remove('no-match');
      Toolbox.status($('imageStatus'),`Converting ${index+1} of ${queue.length}: ${item.file.name}`);
      let decoded,canvas;
      await new Promise(resolve=>setTimeout(resolve,0));
      try{
        decoded=await decode(item.file);
        const sourceW=decoded.image.width||decoded.image.naturalWidth,sourceH=decoded.image.height||decoded.image.naturalHeight;
        const dimensions=computeDimensions(sourceW,sourceH,settings);
        canvas=makeCanvas(dimensions.width,dimensions.height);
        const ctx=canvas.getContext('2d');
        if(!keepTransparency||format==='jpeg'||format==='bmp'){ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);}
        ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(decoded.image,0,0,canvas.width,canvas.height);
        const blob=await encodeCanvas(canvas,format,quality);
        const base=(item.file.name.replace(/\.[^.]+$/,'')||'image')+`-${dimensions.width}x${dimensions.height}`;
        const key=base.toLowerCase(),count=(names.get(key)||0)+1;names.set(key,count);
        const name=`${base}${count>1?'-'+count:''}.${formats[format].extension}`;
        item.result={blob,name};
        const thumbnail=makeCanvas(Math.max(1,Math.round(canvas.width*Math.min(1,136/canvas.width,136/canvas.height))),Math.max(1,Math.round(canvas.height*Math.min(1,136/canvas.width,136/canvas.height))));
        thumbnail.getContext('2d').drawImage(canvas,0,0,thumbnail.width,thumbnail.height);
        const thumbBlob=await new Promise(resolve=>thumbnail.toBlob(resolve,'image/png'));thumbnail.width=thumbnail.height=1;
        if(thumbBlob){item.url=URL.createObjectURL(thumbBlob);const image=document.createElement('img');image.src=item.url;image.alt='';row.querySelector('.image-file-thumb').replaceChildren(image);}
        state.textContent=`${sourceW} × ${sourceH} → ${dimensions.width} × ${dimensions.height} · ${Toolbox.bytes(blob.size)} · ${formats[format].name}${decoded.note?' · '+decoded.note:''}`;
        row.querySelector('button').hidden=false;completed++;
      }catch(error){state.textContent=typeof error==='string'?error:((error&&error.message)||'Unable to convert this image.');state.classList.add('no-match');failed++;}
      finally{if(decoded)decoded.close();if(canvas)canvas.width=canvas.height=1;}
      $('imageProgress').value=index+1;
    }
    setBusy(false);
    if(cancelled)for(const item of queue)if(!item.result&&item.element.querySelector('.image-file-status').textContent==='Waiting to convert')item.element.querySelector('.image-file-status').textContent='Not converted in this run.';
    Toolbox.status($('imageStatus'),`${cancelled?'Stopped. ':''}${completed} converted${failed?`, ${failed} failed`:''}. Download files individually or together as a ZIP.`,!!failed);
  });

  $('imageDownloadAll').addEventListener('click',async()=>{
    const files=queue.filter(item=>item.result).map(item=>item.result);if(!files.length)return;
    $('imageDownloadAll').disabled=true;
    try{Toolbox.status($('imageStatus'),'Preparing ZIP…');Toolbox.download(await createZip(files),'converted-images.zip');Toolbox.status($('imageStatus'),`ZIP ready with ${files.length} image${files.length===1?'':'s'}.`);}
    catch(error){Toolbox.status($('imageStatus'),error.message,true);}
    finally{$('imageDownloadAll').disabled=busy||!queue.some(item=>item.result);}
  });
  window.addEventListener('beforeunload',()=>{for(const item of queue)if(item.url)URL.revokeObjectURL(item.url);});
  updateSettings();
})(globalThis);
