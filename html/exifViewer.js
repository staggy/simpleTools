/* Local, lossless image-container metadata inspection and selective scrubbing. */
'use strict';
const SimpleMetadata = (() => {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const names = {
    0x010e:'Image description',0x010f:'Camera make',0x0110:'Camera model',0x0112:'Orientation',
    0x011a:'X resolution',0x011b:'Y resolution',0x0128:'Resolution unit',0x0131:'Software',
    0x0132:'Modified date/time',0x013b:'Artist',0x013c:'Host computer',0x014a:'Sub-image directories',
    0x02bc:'XMP',0x4746:'Rating',0x4749:'Rating percent',0x8298:'Copyright',
    0x829a:'Exposure time',0x829d:'F number',0x83bb:'IPTC',0x8649:'Photoshop resources',
    0x8769:'Exif directory',0x8773:'ICC color profile',0x8822:'Exposure program',0x8824:'Spectral sensitivity',
    0x8825:'GPS directory',0x8827:'ISO sensitivity',0x8830:'Sensitivity type',0x8832:'Recommended exposure index',
    0x9000:'Exif version',0x9003:'Date taken',0x9004:'Date digitized',0x9010:'UTC offset',
    0x9011:'Date taken UTC offset',0x9012:'Date digitized UTC offset',0x9101:'Component configuration',
    0x9102:'Compressed bits per pixel',0x9201:'Shutter speed',0x9202:'Aperture',0x9203:'Brightness',
    0x9204:'Exposure bias',0x9205:'Maximum aperture',0x9206:'Subject distance',0x9207:'Metering mode',
    0x9208:'Light source',0x9209:'Flash',0x920a:'Focal length',0x9214:'Subject area',
    0x927c:'Maker notes',0x9286:'User comment',0x9290:'Subsecond time',0x9291:'Date taken subseconds',
    0x9292:'Date digitized subseconds',0x9400:'Temperature',0x9401:'Humidity',0x9402:'Pressure',
    0x9c9b:'Windows title',0x9c9c:'Windows comment',0x9c9d:'Windows author',0x9c9e:'Windows keywords',
    0x9c9f:'Windows subject',0xa000:'Flashpix version',0xa001:'Color space',0xa002:'Pixel width',
    0xa003:'Pixel height',0xa004:'Related sound file',0xa005:'Interoperability directory',
    0xa20b:'Flash energy',0xa20e:'Focal-plane X resolution',0xa20f:'Focal-plane Y resolution',
    0xa210:'Focal-plane resolution unit',0xa214:'Subject location',0xa215:'Exposure index',
    0xa217:'Sensing method',0xa300:'File source',0xa301:'Scene type',0xa302:'CFA pattern',
    0xa401:'Custom rendering',0xa402:'Exposure mode',0xa403:'White balance',0xa404:'Digital zoom',
    0xa405:'35 mm focal length',0xa406:'Scene capture type',0xa407:'Gain control',0xa408:'Contrast',
    0xa409:'Saturation',0xa40a:'Sharpness',0xa40c:'Subject distance range',0xa420:'Unique image ID',
    0xa430:'Camera owner',0xa431:'Camera serial number',0xa432:'Lens specification',
    0xa433:'Lens make',0xa434:'Lens model',0xa435:'Lens serial number',0xa500:'Gamma'
  };
  const gpsNames = ['GPS version','Latitude reference','Latitude','Longitude reference','Longitude',
    'Altitude reference','Altitude','GPS timestamp','Satellites','GPS status','Measurement mode',
    'DOP','Speed reference','Speed','Track reference','Track','Image direction reference','Image direction',
    'Map datum','Destination latitude reference','Destination latitude','Destination longitude reference',
    'Destination longitude','Destination bearing reference','Destination bearing','Destination distance reference',
    'Destination distance','Processing method','Area information','GPS date','Differential correction','Horizontal accuracy'];
  const typeSize = {1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8,13:4};
  // Image layout tags cannot be removed without re-encoding the pixels.
  const structural = new Set([0x00fe,0x00ff,0x0100,0x0101,0x0102,0x0103,0x0106,0x010a,
    0x0111,0x0115,0x0116,0x0117,0x011c,0x0122,0x0123,0x0124,0x0125,0x0129,0x012d,
    0x013d,0x013e,0x013f,0x0140,0x0142,0x0143,0x0144,0x0145,0x014a,0x014c,0x0152,
    0x0153,0x0154,0x0155,0x0156,0x0157,0x0158,0x0159,0x015a,0x015b,0x0200,0x0201,
    0x0202,0x0203,0x0205,0x0206,0x0207,0x0208,0x0209,0x0211,0x0212,0x0213,0x0214]);
  const text = (b,a=0,z=b.length) => decoder.decode(b.subarray(a,z)).replace(/\0+$/g,'');
  const ascii = (b,p,n) => String.fromCharCode(...b.subarray(p,p+n));
  function check(b,p,n) { if (!Number.isSafeInteger(p)||!Number.isSafeInteger(n)||p<0||n<0||p+n>b.length) throw new Error('Invalid or truncated metadata offsets.'); }
  function u16(b,p,le=false) {check(b,p,2);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint16(p,le);}
  function u32(b,p,le=false) {check(b,p,4);return new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(p,le);}
  function put16(b,p,n,le=false) {check(b,p,2);new DataView(b.buffer,b.byteOffset,b.byteLength).setUint16(p,n,le);}
  function put32(b,p,n,le=false) {check(b,p,4);new DataView(b.buffer,b.byteOffset,b.byteLength).setUint32(p,n,le);}
  function join(parts) {const out=new Uint8Array(parts.reduce((n,b)=>n+b.length,0));let p=0;for(const b of parts){out.set(b,p);p+=b.length;}return out;}
  function number(b,p,n) {check(b,p,n);let v=0;for(let i=0;i<n;i++)v=v*256+b[p+i];if(!Number.isSafeInteger(v))throw new Error('Metadata offset is too large.');return v;}
  function crc32(b) {let c=0xffffffff;for(const v of b){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  function inspect(input) {
    const bytes=input instanceof Uint8Array?new Uint8Array(input):new Uint8Array(input);
    const result={bytes,format:'',records:[],blocks:[],tiffs:[],warnings:[]};
    const add=(label,value,category,action,sensitive=true) => {
      const record={id:'m'+result.records.length,label,value:String(value).slice(0,12000),category,action,sensitive};result.records.push(record);return record;
    };
    const block=(label,category,start,end,dataStart=start,dataEnd=end,kind='remove') => {
      check(bytes,start,end-start);const b={start,end,dataStart,dataEnd,kind,id:result.blocks.length};result.blocks.push(b);
      add(label,text(bytes,dataStart,Math.min(dataEnd,dataStart+12000)),category,{block:b.id});return b;
    };
    function parseTiff(data,offset,mapping,owner=null,standalone=false) {
      check(data,offset,8);const endian=ascii(data,offset,2);if(!['II','MM'].includes(endian)||u16(data,offset+2,endian==='II')!==42)throw new Error('Unsupported TIFF header (BigTIFF is not supported).');
      const le=endian==='II',base=offset,t={data,base,le,mapping,owner,standalone,dirs:[],entries:[],valid:false,unsupportedTypes:false,id:result.tiffs.length};result.tiffs.push(t);
      const seen=new Set();let total=0;
      function value(e) {
        const b=data,p=e.valueStart,n=e.count,v=new DataView(b.buffer,b.byteOffset,b.byteLength);
        if(e.type===2)return text(b,p,p+e.size).replace(/\0/g,' · ');
        if(e.tag>=0x9c9b&&e.tag<=0x9c9f){try{return new TextDecoder('utf-16le').decode(b.subarray(p,p+e.size)).replace(/\0/g,'');}catch{}}
        if(e.type===7||e.type===1){const a=b.subarray(p,p+Math.min(e.size,256));const str=text(a).replace(/[^\x20-\x7e\n\r\t\u00a0-\uffff]/g,'');return str.length>a.length*.65?str:Array.from(a,x=>x.toString(16).padStart(2,'0')).join(' ')+(e.size>256?' …':'');}
        const values=[];for(let j=0;j<Math.min(n,50);j++){const x=p+j*typeSize[e.type];let z;
          if(e.type===3)z=v.getUint16(x,le);else if(e.type===4||e.type===13)z=v.getUint32(x,le);
          else if(e.type===8)z=v.getInt16(x,le);else if(e.type===9)z=v.getInt32(x,le);
          else if(e.type===5||e.type===10){const a=e.type===5?v.getUint32(x,le):v.getInt32(x,le),d=e.type===5?v.getUint32(x+4,le):v.getInt32(x+4,le);z=d?`${a}/${d} (${+(a/d).toFixed(6)})`:`${a}/0`;}
          else if(e.type===11)z=v.getFloat32(x,le);else if(e.type===12)z=v.getFloat64(x,le);else z=v.getInt8(x);values.push(z);
        }return values.join(', ')+(n>50?' …':'');
      }
      function dir(relative,path,pointerPos=null,depth=0) {
        if(!relative||depth>12)return;if(seen.has(relative))return;seen.add(relative);if(seen.size>128)throw new Error('Too many TIFF directories.');
        const p=base+relative,count=u16(data,p,le);if(count>4096||total+count>20000)throw new Error('Too many TIFF entries.');check(data,p,2+count*12+4);total+=count;
        const d={p,count,path,pointerPos,entries:[],nextPos:p+2+count*12};t.dirs.push(d);
        for(let i=0;i<count;i++){
          const pos=p+2+i*12,tag=u16(data,pos,le),type=u16(data,pos+2,le),count=u32(data,pos+4,le),size=count*(typeSize[type]||0);
          if(!typeSize[type]||!Number.isSafeInteger(size)||size>data.length){t.unsupportedTypes=true;continue;}
          const valueStart=size>4?base+u32(data,pos+8,le):pos+8;check(data,valueStart,size);
          const e={pos,tag,type,count,size,valueStart,path,dir:d,child:null,id:t.entries.length};t.entries.push(e);d.entries.push(e);
          if([0x8769,0x8825,0xa005].includes(tag)&&count===1){const childPath=tag===0x8825?'GPS':tag===0x8769?'Exif':'Interoperability';e.child=u32(data,pos+8,le);dir(e.child,childPath,pos+8,depth+1);continue;}
          if(tag===0x014a){for(let j=0;j<Math.min(count,32);j++)dir(u32(data,valueStart+j*4,le),`${path}/image ${j+1}`,null,depth+1);continue;}
          if(standalone&&structural.has(tag))continue;
          const label=path==='GPS'?(gpsNames[tag]||`GPS tag 0x${tag.toString(16)}`):(names[tag]||`Tag 0x${tag.toString(16).padStart(4,'0')}`);
          const category=path==='GPS'?'GPS / location':tag===0x8773?'Color profile':tag===0x02bc?'XMP':tag===0x83bb||tag===0x8649?'IPTC / Photoshop':`Exif / ${path}`;
          // Image-data offsets in embedded Exif are handled together with the thumbnail.
          if(!standalone&&[0x0201,0x0202,0x0111,0x0117].includes(tag))continue;
          add(label,value(e),category,{tiff:t.id,entry:e.id},tag!==0x0112&&tag!==0x8773);
        }
        const next=u32(data,d.nextPos,le);if(next)dir(next,`${path}/image ${t.dirs.length}`,d.nextPos,depth+1);
      }
      dir(u32(data,base+4,le),'Image',base+4);
      // Thumbnail pixel data can itself disclose information and is a separate selectable item.
      if(!standalone)for(const d of t.dirs){const start=d.entries.find(e=>e.tag===0x0201),len=d.entries.find(e=>e.tag===0x0202);if(start&&len){const a=base+u32(data,start.valueStart,le),n=u32(data,len.valueStart,le);check(data,a,n);add('Embedded thumbnail',`${n.toLocaleString()} bytes`,'Thumbnail',{tiff:t.id,thumbnail:{a,n,dir:t.dirs.indexOf(d)}});}}
      // TIFF-relative pointers inside an Exif block must stay within that block.
      // An invalid pointer must never let a tag edit reach neighboring image data.
      const last=mapping.reduce((n,m)=>Math.max(n,m.local+m.length),0);
      if(base+8>last||t.dirs.some(d=>d.p<base||d.nextPos+4>last)||t.entries.some(e=>e.valueStart<base||e.valueStart+e.size>last)||result.records.some(r=>r.action.tiff===t.id&&r.action.thumbnail&&(r.action.thumbnail.a<base||r.action.thumbnail.a+r.action.thumbnail.n>last)))throw new Error('TIFF metadata points outside its own container.');
      t.valid=true;
      return t;
    }
    const tiffBlock=(b,start,data=bytes,mapping=null) => {
      try{parseTiff(data,start,mapping||[{local:b.dataStart,original:b.dataStart,length:b.dataEnd-b.dataStart}],b.id);}catch(e){result.warnings.push(`Some Exif tags could not be parsed: ${e.message}`);}
    };
    if(bytes[0]===0xff&&bytes[1]===0xd8){
      result.format='JPEG';let p=2;
      while(p<bytes.length){if(bytes[p]!==0xff)throw new Error('Invalid JPEG segment.');const start=p;while(bytes[p]===0xff)p++;const marker=bytes[p++];if(marker===0xda||marker===0xd9)break;if(marker===1||(marker>=0xd0&&marker<=0xd7))continue;const n=u16(bytes,p);if(n<2)throw new Error('Invalid JPEG segment length.');const end=p+n;check(bytes,p,n);const data=p+2;
        if(marker===0xe0&&ascii(bytes,data,5)==='JFIF\0'&&end-data>=14){const width=bytes[data+12],height=bytes[data+13],length=width*height*3;if(length){if(data+14+length>end)throw new Error('Truncated JFIF thumbnail.');add('JFIF embedded thumbnail',`${width} × ${height} pixels`,'Thumbnail',{jfif:{start:data+14,end:data+14+length,dimensions:data+12,lengthPos:p,newLength:n-length}});}}
        else if(marker===0xe0&&ascii(bytes,data,5)==='JFXX\0')block('JFXX embedded thumbnail','Thumbnail',start,end,data,end);
        else if(marker===0xe1&&ascii(bytes,data,6)==='Exif\0\0'){const b=block('All Exif metadata','Exif block',start,end,data+6,end);tiffBlock(b,data+6);}
        else if(marker===0xe1)block(ascii(bytes,data,29).startsWith('http://ns.adobe.com')?'XMP metadata':'Application metadata (APP1)','XMP',start,end,data,end);
        else if(marker===0xed)block('IPTC / Photoshop metadata','IPTC / Photoshop',start,end,data,end);
        else if(marker===0xe2&&ascii(bytes,data,11)==='ICC_PROFILE'){block('ICC color profile','Color profile',start,end,data,end);result.records.at(-1).sensitive=false;}
        else if(marker===0xfe)block('JPEG comment','Comment',start,end,data,end);
        else if(marker>=0xe3&&marker<=0xef)block(`Application metadata (APP${marker-0xe0})`,'Application metadata',start,end,data,end);
        p=end;
      }
    }else if(ascii(bytes,0,8)==='\x89PNG\r\n\x1a\n'){
      result.format='PNG';let p=8;
      while(p<bytes.length){const n=u32(bytes,p),type=ascii(bytes,p+4,4),end=p+12+n;check(bytes,p,12+n);
        if(type==='eXIf'){const b=block('All Exif metadata','Exif block',p,end,p+8,p+8+n);b.crc=p+8+n;tiffBlock(b,p+8);}
        else if(['tEXt','zTXt','iTXt','tIME','iCCP','dSIG'].includes(type)){const key=text(bytes,p+8,p+8+n).split('\0')[0];const category=type==='iCCP'?'Color profile':key.includes('XML:com.adobe.xmp')?'XMP':type==='tIME'?'Date/time':'Text / comment';block(`${type}: ${key.slice(0,100)}`,category,p,end,p+8,p+8+n);if(type==='iCCP')result.records.at(-1).sensitive=false;}
        p=end;if(type==='IEND')break;
      }
    }else if(ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,4)==='WEBP'){
      result.format='WebP';let p=12;while(p+8<=bytes.length){const type=ascii(bytes,p,4),n=u32(bytes,p+4,true),end=p+8+n+(n%2);check(bytes,p,end-p);
        if(['EXIF','XMP ','ICCP'].includes(type)){const b=block(type==='EXIF'?'All Exif metadata':type==='ICCP'?'ICC color profile':'XMP metadata',type==='EXIF'?'Exif block':type==='ICCP'?'Color profile':'XMP',p,end,p+8,p+8+n);if(type==='EXIF')tiffBlock(b,p+8+(ascii(bytes,p+8,6)==='Exif\0\0'?6:0));if(type==='ICCP')result.records.at(-1).sensitive=false;}
        p=end;
      }
    }else if(['GIF87a','GIF89a'].includes(ascii(bytes,0,6))){
      result.format='GIF';check(bytes,0,13);let p=13+((bytes[10]&128)?3*(1<<((bytes[10]&7)+1)):0);
      while(p<bytes.length){const start=p,b=bytes[p++];if(b===0x3b)break;if(b===0x2c){check(bytes,p,9);const flags=bytes[p+8];p+=9+((flags&128)?3*(1<<((flags&7)+1)):0);check(bytes,p,1);p++;while(true){check(bytes,p,1);const n=bytes[p++];if(!n)break;check(bytes,p,n);p+=n;}continue;}
        if(b!==0x21)throw new Error('Unsupported or damaged GIF block.');check(bytes,p,1);const type=bytes[p++];let first='',payload=[];while(true){check(bytes,p,1);const n=bytes[p++];if(!n)break;check(bytes,p,n);if(!first)first=ascii(bytes,p,n);payload.push(bytes.subarray(p,p+n));p+=n;}
        if(type===0xfe||type===0xff&&!['NETSCAPE2.0','ANIMEXTS1.0'].includes(first)){const category=type===0xfe?'Comment':first.includes('ICCRGB')?'Color profile':first.includes('XMP')?'XMP':'Application metadata';block(type===0xfe?'GIF comment':`GIF application: ${first}`,category,start,p);result.records.at(-1).value=text(join(payload));if(category==='Color profile')result.records.at(-1).sensitive=false;}
      }
    }else if(['II','MM'].includes(ascii(bytes,0,2))){result.format='TIFF';parseTiff(bytes,0,[{local:0,original:0,length:bytes.length}],null,true);}
    else if(ascii(bytes,4,4)==='ftyp'){
      result.format=/avif|avis/.test(ascii(bytes,8,32))?'AVIF':'HEIC / HEIF';
      function boxes(a,z){const list=[];while(a+8<=z){let n=u32(bytes,a),head=8;const type=ascii(bytes,a+4,4);if(n===1){n=number(bytes,a+8,8);head=16;}if(n===0)n=z-a;if(n<head||a+n>z)throw new Error('Invalid HEIF box size.');list.push({type,p:a,data:a+head,end:a+n});a+=n;}return list;}
      const top=boxes(0,bytes.length),meta=top.find(x=>x.type==='meta');if(!meta)throw new Error('No HEIF metadata item table found.');const child=boxes(meta.data+4,meta.end),iinf=child.find(x=>x.type==='iinf'),iloc=child.find(x=>x.type==='iloc'),idat=child.find(x=>x.type==='idat');
      if(!iinf||!iloc)return result;const items=new Map();const infStart=iinf.data+4+(bytes[iinf.data]===0?2:4);
      for(const inf of boxes(infStart,iinf.end)){if(inf.type!=='infe')continue;const v=bytes[inf.data];if(v!==2&&v!==3)continue;let p=inf.data+4;const id=number(bytes,p,v===2?2:4);p+=v===2?2:4;p+=2;const type=ascii(bytes,p,4);p+=4;let nameEnd=p;while(nameEnd<inf.end&&bytes[nameEnd])nameEnd++;const name=text(bytes,p,nameEnd);p=nameEnd+1;let contentEnd=p;while(contentEnd<inf.end&&bytes[contentEnd])contentEnd++;const content=text(bytes,p,contentEnd);items.set(id,{type,name,content});}
      const itemRanges=[],heifBlockStart=result.blocks.length;
      let p=iloc.data,v=bytes[p];if(v>2)throw new Error('Unsupported HEIF item-location version.');p+=4;const offsetSize=bytes[p]>>4,lengthSize=bytes[p++]&15,baseSize=bytes[p]>>4,indexSize=(v===1||v===2)?bytes[p]&15:0;p++;const count=number(bytes,p,v<2?2:4);p+=v<2?2:4;if(count>10000)throw new Error('Too many HEIF items.');
      for(let i=0;i<count;i++){const id=number(bytes,p,v<2?2:4);p+=v<2?2:4;let method=0;if(v===1||v===2){method=u16(bytes,p)&15;p+=2;}const dataRef=u16(bytes,p);p+=2;const base=number(bytes,p,baseSize);p+=baseSize;const extents=u16(bytes,p);p+=2;const item=items.get(id),segments=[];let local=0;
        for(let j=0;j<extents;j++){if((v===1||v===2)&&indexSize)p+=indexSize;const off=number(bytes,p,offsetSize);p+=offsetSize;const len=number(bytes,p,lengthSize);p+=lengthSize;const original=(method===1?(idat?.data??-1):0)+base+off;if(!dataRef&&method<=1)itemRanges.push({id,original,length:len});if(item&&(item.type==='Exif'||/rdf\+xml|xml/.test(item.content))){if(dataRef||method>1||method===1&&!idat)throw new Error('Externally referenced HEIF metadata is unsupported.');check(bytes,original,len);const domains=method===1?[idat]:top.filter(x=>x.type==='mdat');if(!domains.some(x=>original>=x.data&&original+len<=x.end))throw new Error('HEIF metadata points outside its data box.');segments.push({local,original,length:len});local+=len;}}
        if(!segments.length)continue;for(let a=0;a<segments.length;a++)for(let b=a+1;b<segments.length;b++)if(segments[a].original<segments[b].original+segments[b].length&&segments[b].original<segments[a].original+segments[a].length)throw new Error('Overlapping HEIF metadata extents cannot be safely edited.');const data=join(segments.map(s=>bytes.subarray(s.original,s.original+s.length)));const b={id:result.blocks.length,itemId:id,kind:'heif',mapping:segments,data,start:0,end:0,dataStart:0,dataEnd:data.length};result.blocks.push(b);
        if(item.type==='Exif'){add('All Exif metadata','HEIF Exif item','Exif block',{block:b.id});const start=4+u32(data,0);tiffBlock(b,start,data,segments);}
        else add('XMP metadata',text(data),'XMP',{block:b.id});
      }
      for(const b of result.blocks.slice(heifBlockStart))for(const s of b.mapping)if(itemRanges.some(r=>r.id!==b.itemId&&s.original<r.original+r.length&&r.original<s.original+s.length))throw new Error('Overlapping HEIF image and metadata items cannot be safely edited.');
      if(!result.records.length)result.warnings.push('No supported Exif or XMP items were found. HEIF container properties and image tracks are preserved.');
    }else throw new Error('Choose a JPEG, PNG, WebP, GIF, TIFF, HEIC/HEIF or AVIF image.');
    if(result.format==='TIFF')result.warnings.push('TIFF image-layout tags are protected. Selected metadata is overwritten in place so pixel offsets stay intact. BigTIFF is unsupported.');
    if(result.format==='HEIC / HEIF'||result.format==='AVIF')result.warnings.push('Exif and XMP contents are overwritten in place. Empty metadata items remain so image offsets stay valid. Image pixels, container properties, and color properties are preserved.');
    return result;
  }
  function scrub(model,ids) {
    const chosen=new Set(ids),out=new Uint8Array(model.bytes),removedBlocks=new Set(),actions=model.records.filter(r=>chosen.has(r.id)).map(r=>r.action);
    for(const a of actions)if(a.block!==undefined)removedBlocks.add(a.block);
    const tiffChanges=new Map();
    function changed(t){if(!tiffChanges.has(t.id))tiffChanges.set(t.id,new Uint8Array(t.data));return tiffChanges.get(t.id);}
    function eraseEntry(t,b,e,deleted){deleted.add(e.id);if(e.size>4)b.fill(0,e.valueStart,e.valueStart+e.size);}
    const overlaps=(a,b)=>a.start<b.end&&b.start<a.end;
    function verifyTiffEdits(t,deleted,selected){
      const unsafe=reason=>{throw new Error(`Cannot safely remove the selected TIFF/Exif fields: ${reason}. Choose an entire Exif block where available, or use the image converter to create a fresh image.`);};
      if(!t.valid)unsafe('the metadata contains invalid offsets');
      if(t.unsupportedTypes)unsafe('an unsupported entry type prevents checking shared byte ranges');
      const tables=[{start:t.base,end:t.base+8},...t.dirs.map(d=>({start:d.p,end:d.nextPos+4}))];
      for(let i=0;i<tables.length;i++)for(let j=i+1;j<tables.length;j++)if(overlaps(tables[i],tables[j]))unsafe('directory tables overlap');
      const values=t.entries.filter(e=>e.size>4).map(e=>({start:e.valueStart,end:e.valueStart+e.size,entry:e}));
      const removed=values.filter(r=>deleted.has(r.entry.id)),retained=values.filter(r=>!deleted.has(r.entry.id));
      for(const a of removed){if(tables.some(b=>overlaps(a,b)))unsafe('a selected value overlaps a directory table');if(retained.some(b=>overlaps(a,b)))unsafe('a selected value shares bytes with retained metadata');}
      const changingTables=t.dirs.filter(d=>d.entries.some(e=>deleted.has(e.id))).map(d=>({start:d.p,end:d.nextPos+4}));
      for(const a of selected.filter(a=>a.thumbnail)){const pos=t.dirs[a.thumbnail.dir].pointerPos;if(pos!==null)changingTables.push({start:pos,end:pos+4});}
      for(const table of changingTables)if(retained.some(value=>overlaps(table,value)))unsafe('a directory table shares bytes with retained metadata');
      function integers(e){const a=[];if(!e||![1,3,4,13].includes(e.type))unsafe('an image-data offset uses an unsupported representation');for(let i=0;i<e.count;i++){const p=e.valueStart+i*typeSize[e.type];a.push(e.type===1?t.data[p]:e.type===3?u16(t.data,p,t.le):u32(t.data,p,t.le));}return a;}
      const pixelRanges=[];
      for(const d of t.dirs){for(const [offsetTag,countTag]of [[0x0111,0x0117],[0x0144,0x0145],[0x0201,0x0202]]){
          const off=d.entries.find(e=>e.tag===offsetTag),len=d.entries.find(e=>e.tag===countTag);if(!off&&!len)continue;if(!off||!len)unsafe('image-data offsets and byte counts do not match');
          const offsets=integers(off),lengths=integers(len);if(offsets.length!==lengths.length)unsafe('image-data offsets and byte counts do not match');
          for(let i=0;i<offsets.length;i++){const start=t.base+offsets[i],end=start+lengths[i];check(t.data,start,lengths[i]);const removedThumbnail=selected.some(a=>a.thumbnail&&a.thumbnail.a===start&&a.thumbnail.n===lengths[i]&&a.thumbnail.dir===t.dirs.indexOf(d));pixelRanges.push({start,end,removed:removedThumbnail});}
        }
        // Old-style JPEG-in-TIFF stores coding tables behind additional pointers.
        for(const tag of [0x0207,0x0208,0x0209]){const e=d.entries.find(e=>e.tag===tag);if(!e)continue;for(const offset of integers(e)){const start=t.base+offset;let size=64;if(tag!==0x0207){check(t.data,start,16);size=16+t.data.subarray(start,start+16).reduce((a,b)=>a+b,0);}check(t.data,start,size);pixelRanges.push({start,end:start+size,removed:false});}}
      }
      const erasedPixels=selected.filter(a=>a.thumbnail).map(a=>({start:a.thumbnail.a,end:a.thumbnail.a+a.thumbnail.n}));
      for(const value of erasedPixels){if(tables.some(b=>overlaps(value,b))||retained.some(b=>overlaps(value,b)))unsafe('a selected thumbnail shares bytes with retained metadata');}
      for(const pixel of pixelRanges.filter(p=>!p.removed))if([...removed,...changingTables,...erasedPixels].some(a=>overlaps(a,pixel)))unsafe('selected metadata shares bytes with image pixels or coding tables');
    }
    for(const t of model.tiffs){if(t.owner!==null&&removedBlocks.has(t.owner))continue;const selected=actions.filter(a=>a.tiff===t.id);if(!selected.length)continue;const b=changed(t),deleted=new Set();
      for(const a of selected){if(a.entry!==undefined)eraseEntry(t,b,t.entries[a.entry],deleted);if(a.thumbnail){const d=t.dirs[a.thumbnail.dir];b.fill(0,a.thumbnail.a,a.thumbnail.a+a.thumbnail.n);for(const e of d.entries)eraseEntry(t,b,e,deleted);if(d.pointerPos!==null)put32(b,d.pointerPos,0,t.le);}}
      // Empty nested directories are disconnected; their entries and payloads are scrubbed.
      for(let pass=0;pass<4;pass++)for(const e of t.entries){if(!e.child)continue;const d=t.dirs.find(x=>x.p===t.base+e.child);if(d&&d.count>0&&d.entries.length===d.count&&!u32(t.data,d.nextPos,t.le)&&d.entries.every(x=>deleted.has(x.id))){eraseEntry(t,b,e,deleted);b.fill(0,d.p,d.nextPos+4);}}
      verifyTiffEdits(t,deleted,selected);
      for(const d of t.dirs){const keep=d.entries.filter(e=>!deleted.has(e.id));if(keep.length===d.entries.length)continue;
        // Preserve unrecognized entries, which were intentionally not exposed as removable.
        const originalEntries=[];for(let i=0;i<d.count;i++){const pos=d.p+2+i*12;if(!d.entries.some(e=>e.pos===pos&&deleted.has(e.id)))originalEntries.push(t.data.slice(pos,pos+12));}
        const next=u32(b,d.nextPos,t.le);b.fill(0,d.p+2,d.nextPos+4);put16(b,d.p,originalEntries.length,t.le);originalEntries.forEach((e,i)=>b.set(e,d.p+2+i*12));put32(b,d.p+2+originalEntries.length*12,next,t.le);
      }
      // Opaque MakerNote/XMP payloads are erased as complete values when selected.
      for(const map of t.mapping)out.set(b.subarray(map.local,map.local+map.length),map.original);
    }
    const ranges=[];
    for(const a of actions)if(a.jfif){out[a.jfif.dimensions]=0;out[a.jfif.dimensions+1]=0;put16(out,a.jfif.lengthPos,a.jfif.newLength);ranges.push([a.jfif.start,a.jfif.end]);}
    for(const id of removedBlocks){const block=model.blocks[id];if(block.kind==='heif'){
        const data=new Uint8Array(block.data.length);const t=model.tiffs.find(x=>x.owner===id);
        if(t){if(t.base+14>data.length)throw new Error('Exif item is too small to safely scrub.');put32(data,0,t.base-4);data[t.base]=73;data[t.base+1]=73;put16(data,t.base+2,42,true);put32(data,t.base+4,8,true);}
        else {const empty=new TextEncoder().encode('<x:xmpmeta xmlns:x="adobe:ns:meta/"/>');if(empty.length<=data.length){data.fill(32);data.set(empty);}}
        for(const map of block.mapping)out.set(data.subarray(map.local,map.local+map.length),map.original);
      }else ranges.push([block.start,block.end]);
    }
    if(model.format==='PNG')for(const b of model.blocks){if(b.crc!==undefined&&!removedBlocks.has(b.id)){put32(out,b.crc,crc32(out.subarray(b.start+4,b.crc)));}}
    let final=out;if(ranges.length){ranges.sort((a,b)=>a[0]-b[0]);const parts=[];let p=0;for(const [a,z]of ranges){if(a<p)continue;parts.push(out.subarray(p,a));p=z;}parts.push(out.subarray(p));final=join(parts);}
    if(model.format==='WebP'){
      put32(final,4,final.length-8,true);let p=12,flagsPos=-1,flags=0;while(p+8<=final.length){const type=ascii(final,p,4),n=u32(final,p+4,true);if(type==='VP8X')flagsPos=p+8;if(type==='ICCP')flags|=32;if(type==='EXIF')flags|=8;if(type==='XMP ')flags|=4;p+=8+n+(n%2);}if(flagsPos>=0)final[flagsPos]=(final[flagsPos]&~44)|flags;
    }
    return final;
  }
  return {inspect,scrub,crc32};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=SimpleMetadata;
if(typeof window!=='undefined')window.SimpleMetadata=SimpleMetadata;

if(typeof document!=='undefined')(() => {
  const T=window.Toolbox;if(!T)return;
  T.setContent(`<section class="card"><h2>Choose an image</h2><label class="drop-zone" id="metaDrop" for="metaFile"><strong>Drop an image here or click to browse</strong><small>JPEG, PNG, WebP, GIF, TIFF, HEIC/HEIF and AVIF · files stay on this device</small></label><input class="sr-only" type="file" id="metaFile" accept="image/*,.heic,.heif,.tif,.tiff,.avif"><p id="metaStatus" class="status" role="status" aria-live="polite"></p></section><section id="metaResults" class="card" hidden><h2 class="metadata-filename" id="metaName"></h2><div class="metadata-summary" id="metaSummary"></div><p class="metadata-warning">Select the metadata you want to remove. Choosing <strong>All Exif metadata</strong> also removes its camera settings, GPS, dates, orientation and embedded thumbnail. Removing orientation can change how a photo displays; removing a color profile can change its colors. Pixel data is preserved.</p><div class="metadata-warning" id="metaWarnings" hidden></div><div class="metadata-controls"><input type="search" class="field metadata-filter" id="metaFilter" placeholder="Filter metadata…" aria-label="Filter metadata"><button class="small-button" id="metaSensitive">Select personal metadata</button><button class="small-button" id="metaAll">Select all</button><button class="small-button" id="metaNone">Clear selection</button></div><div class="metadata-table-wrap"><table class="metadata-table"><thead><tr><th class="metadata-select">Remove</th><th>Metadata</th><th>Value</th></tr></thead><tbody id="metaRows"></tbody></table></div><div class="action-row"><button class="primary-button" id="metaDownload" disabled>Download cleaned image</button><button class="small-button" id="metaJson">Export metadata JSON</button><span class="metadata-count muted" id="metaCount"></span></div><p id="metaCleanStatus" class="status" role="status" aria-live="polite"></p></section>`);
  const $=id=>document.getElementById(id);let model=null,file=null,selected=new Set(),loadId=0;
  const esc=T.escape;
  function count(){const n=selected.size;$('metaCount').textContent=`${n} of ${model?.records.length||0} items selected`;$('metaDownload').disabled=!n;}
  function render(){const filter=$('metaFilter').value.toLowerCase();$('metaRows').innerHTML=model.records.filter(r=>`${r.label} ${r.category} ${r.value}`.toLowerCase().includes(filter)).map(r=>`<tr><td><input type="checkbox" data-id="${r.id}" aria-label="Remove ${esc(r.label)}" ${selected.has(r.id)?'checked':''}></td><td><strong>${esc(r.label)}</strong><div class="metadata-category">${esc(r.category)}</div></td><td>${esc(r.value||'(empty)')}</td></tr>`).join('')||'<tr><td colspan="3">No matching metadata found.</td></tr>';count();}
  async function load(f){if(!f)return;const id=++loadId;model=null;file=null;selected.clear();$('metaResults').hidden=true;T.status($('metaStatus'),'Reading image metadata…');try{if(f.size>256*1024*1024)throw new Error('Choose an image smaller than 256 MiB.');const m=SimpleMetadata.inspect(await f.arrayBuffer());if(id!==loadId)return;model=m;file=f;$('metaName').textContent=f.name;$('metaSummary').textContent=`${m.format} · ${T.bytes(f.size)} · ${m.records.length} metadata items`;$('metaWarnings').hidden=!m.warnings.length;$('metaWarnings').textContent=m.warnings.join(' ');$('metaFilter').value='';$('metaResults').hidden=false;$('metaCleanStatus').textContent='';render();T.status($('metaStatus'),m.records.length?'Choose individual fields or metadata blocks below.':'No supported removable metadata was found. Image layout and rendering properties are kept.');}catch(e){if(id===loadId)T.status($('metaStatus'),e.message,true);}}
  $('metaFile').addEventListener('change',()=>load($('metaFile').files[0]));
  $('metaDrop').addEventListener('dragover',e=>{e.preventDefault();$('metaDrop').classList.add('drop-active');});
  $('metaDrop').addEventListener('dragleave',()=>$('metaDrop').classList.remove('drop-active'));
  $('metaDrop').addEventListener('drop',e=>{e.preventDefault();$('metaDrop').classList.remove('drop-active');load(e.dataTransfer.files[0]);});
  $('metaFilter').addEventListener('input',()=>model&&render());
  $('metaRows').addEventListener('change',e=>{const id=e.target.dataset.id;if(!id)return;if(e.target.checked)selected.add(id);else selected.delete(id);count();});
  $('metaSensitive').addEventListener('click',()=>{selected=new Set(model.records.filter(r=>r.sensitive&&r.category!=='Exif block').map(r=>r.id));render();});
  $('metaAll').addEventListener('click',()=>{selected=new Set(model.records.map(r=>r.id));render();});
  $('metaNone').addEventListener('click',()=>{selected.clear();render();});
  $('metaJson').addEventListener('click',()=>{if(model)T.download(new Blob([JSON.stringify({file:file.name,format:model.format,metadata:model.records.map(({label,value,category})=>({label,value,category}))},null,2)],{type:'application/json'}),file.name+'.metadata.json');});
  $('metaDownload').addEventListener('click',()=>{if(!model||!selected.size)return;try{const output=SimpleMetadata.scrub(model,selected);SimpleMetadata.inspect(output);const ext=file.name.lastIndexOf('.'),name=ext>0?file.name.slice(0,ext)+'-clean'+file.name.slice(ext):file.name+'-clean';T.download(new Blob([output],{type:file.type||'application/octet-stream'}),name);T.status($('metaCleanStatus'),`Cleaned copy ready. ${selected.size} selected metadata items removed; original file unchanged.`);}catch(e){T.status($('metaCleanStatus'),`Could not safely clean this image: ${e.message}`,true);}});
})();
