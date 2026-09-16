/* Container inventory and lossless, block-level metadata removal. */
(function (root) {
  const ascii = (b, s, e) => new TextDecoder('latin1').decode(b.subarray(s, e));
  const u32 = (b, p, le = false) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(p, le);
  const fail = () => { throw new Error('Malformed or truncated image container'); };
  function removeRanges(bytes, ranges) {
    const ordered = [...ranges].sort((a, b) => a.start - b.start);
    const output = new Uint8Array(bytes.length - ordered.reduce((n, r) => n + r.end - r.start, 0));
    let source = 0, target = 0;
    for (const r of ordered) {
      output.set(bytes.subarray(source, r.start), target);
      target += r.start - source;
      source = r.end;
    }
    output.set(bytes.subarray(source), target);
    return output;
  }
  function scan(bytes) {
    const found = [], structure = [];
    let format, width, height;
    function add(start, end, label, type, kind = 'private', removable = true, payload = start) {
      const block = {id: `${start}:${end}`, start, end, label, type, kind, removable, payload,
        detail: `${end - start} bytes`, selected: removable && kind === 'private'};
      found.push(block);
      return block;
    }
    function trailing(p) {
      if (p < bytes.length) add(p, bytes.length, 'Trailing data', 'trailing');
    }
    if (bytes[0] === 255 && bytes[1] === 216) {
      format = 'JPEG';
      let p = 2, ended = false;
      while (p < bytes.length) {
        const start = p;
        if (bytes[p++] !== 255) fail();
        while (bytes[p] === 255) p++;
        const marker = bytes[p++];
        if (marker === 217) { ended = true; trailing(p); break; }
        if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
        if (p + 2 > bytes.length) fail();
        const length = (bytes[p] << 8) | bytes[p + 1], end = p + length, payload = p + 2;
        if (length < 2 || end > bytes.length) fail();
        const prefix = ascii(bytes, payload, Math.min(end, payload + 80));
        if ((marker >= 224 && marker <= 239) || marker === 254) {
          let label = `Unknown JPEG APP${marker - 224} data`, kind = 'private', removable = true;
          if (marker === 254) label = 'JPEG comment';
          else if (marker === 225 && prefix.startsWith('Exif\0\0')) label = 'EXIF camera, GPS & thumbnail data';
          else if (marker === 225 && /ns.adobe.com\/(xap|xmp)/.test(prefix)) label = 'XMP metadata';
          else if (marker === 237) label = 'IPTC / Photoshop resources';
          else if (marker === 226 && prefix.startsWith('ICC_PROFILE')) { label = 'ICC color profile'; kind = 'appearance'; }
          else if (marker === 224 && prefix.startsWith('JFIF\0')) { label = 'JFIF density & thumbnail'; kind = 'appearance'; }
          else if (marker === 224 && prefix.startsWith('JFXX\0')) label = 'JFIF extended thumbnail';
          else if (marker === 238 && prefix.startsWith('Adobe')) { label = 'Adobe color transform'; kind = 'appearance'; removable = false; }
          else if (marker === 235 && prefix.startsWith('JP')) { label = 'JUMBF / Content Credentials'; kind = 'provenance'; }
          const block = add(start, end, label, `APP${marker - 224}`, kind, removable, payload);
          if (marker === 254) block.type = 'comment';
        } else {
          structure.push({type: `JPEG marker 0x${marker.toString(16)}`, bytes: end - start});
          if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 8) {
            height = (bytes[payload + 1] << 8) | bytes[payload + 2];
            width = (bytes[payload + 3] << 8) | bytes[payload + 4];
          }
        }
        p = end;
        if (marker === 218) {
          // Walk entropy data to the next real marker, including progressive scans.
          while (p < bytes.length) {
            if (bytes[p] !== 255) { p++; continue; }
            let q = p + 1;
            while (bytes[q] === 255) q++;
            if (bytes[q] === 0 || (bytes[q] >= 208 && bytes[q] <= 215)) { p = q + 1; continue; }
            break;
          }
        }
      }
      if (!ended) fail();
    } else if (bytes[0] === 137 && ascii(bytes, 1, 8) === 'PNG\r\n\x1a\n') {
      format = 'PNG';
      let p = 8, ended = false;
      const required = new Set(['IHDR','PLTE','IDAT','IEND','tRNS','acTL','fcTL','fdAT']);
      const appearance = new Set(['iCCP','sRGB','gAMA','cHRM','sBIT','bKGD','pHYs','cICP','mDCV','cLLI','sTER']);
      const labels = {eXIf:'EXIF camera, GPS & thumbnail data',tEXt:'PNG text',zTXt:'Compressed PNG text',iTXt:'International PNG text',tIME:'Modification time',iCCP:'ICC color profile',pHYs:'Pixel density',caBX:'Content Credentials'};
      while (p + 12 <= bytes.length) {
        const length = u32(bytes, p), type = ascii(bytes, p + 4, p + 8), end = p + 12 + length;
        if (end > bytes.length || !/^[A-Za-z]{4}$/.test(type)) fail();
        if (type === 'IHDR') { if (length !== 13) fail(); width = u32(bytes,p+8); height = u32(bytes,p+12); }
        if (required.has(type) || type[0] === type[0].toUpperCase()) structure.push({type, bytes:end-p});
        else add(p, end, labels[type] || `${type} ancillary data`, type, type === 'caBX' ? 'provenance' : appearance.has(type) ? 'appearance' : 'private', true, p + 8);
        p = end;
        if (type === 'IEND') { ended = true; trailing(p); break; }
      }
      if (!ended || !width || !height) fail();
    } else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
      format = 'WebP';
      const limit = u32(bytes,4,true) + 8;
      if (limit > bytes.length || limit < 12) fail();
      let p = 12;
      while (p + 8 <= limit) {
        const type = ascii(bytes,p,p+4), length = u32(bytes,p+4,true), end = p + 8 + length + (length % 2);
        if (end > limit) fail();
        if (['VP8X','VP8 ','VP8L','ALPH','ANIM','ANMF'].includes(type)) {
          structure.push({type,bytes:end-p});
          if (type === 'VP8 ' && !width && length >= 10) {
            width = (bytes[p+14] | bytes[p+15]<<8) & 16383; height = (bytes[p+16] | bytes[p+17]<<8) & 16383;
          }
          if (type === 'VP8L' && !width && length >= 5) {
            const dimensions = u32(bytes,p+9,true); width = (dimensions & 16383)+1; height = ((dimensions >>> 14) & 16383)+1;
          }
          if (type === 'VP8X') {
            if (length !== 10) fail();
            width = 1 + bytes[p+12] + (bytes[p+13]<<8) + (bytes[p+14]<<16);
            height = 1 + bytes[p+15] + (bytes[p+16]<<8) + (bytes[p+17]<<16);
          }
        } else add(p,end,{EXIF:'EXIF camera, GPS & thumbnail data','XMP ':'XMP metadata',ICCP:'ICC color profile',C2PA:'Content Credentials'}[type] || `${type} unknown data`,type,type === 'ICCP' ? 'appearance' : type === 'C2PA' ? 'provenance' : 'private',true,p+8);
        p = end;
      }
      if (p !== limit) fail();
      trailing(limit);
    } else throw new Error('Choose a JPEG, PNG, or WebP image.');
    return {format,width,height,found,structure,clean(selected = new Set(found.filter(x=>x.selected).map(x=>x.id))) {
      const removed = found.filter(x=>x.removable && selected.has(x.id));
      const output = removeRanges(bytes,removed);
      if (format === 'WebP') {
        const oldLimit = u32(bytes,4,true)+8;
        const newLimit = oldLimit - removed.filter(x=>x.start<oldLimit).reduce((n,x)=>n+x.end-x.start,0);
        new DataView(output.buffer).setUint32(4,newLimit-8,true);
        for (let p=12; p+8<=newLimit;) {
          const type = ascii(output,p,p+4), length = u32(output,p+4,true);
          if (type === 'VP8X') {
            if (removed.some(x=>x.type==='EXIF') && !found.some(x=>x.type==='EXIF' && !selected.has(x.id))) output[p+8] &= ~8;
            if (removed.some(x=>x.type==='XMP ') && !found.some(x=>x.type==='XMP ' && !selected.has(x.id))) output[p+8] &= ~4;
            if (removed.some(x=>x.type==='ICCP') && !found.some(x=>x.type==='ICCP' && !selected.has(x.id))) output[p+8] &= ~32;
          }
          p += 8 + length + length%2;
        }
      }
      return output;
    }};
  }
  async function decode(bytes, report, parser) {
    const details = {}, warnings = [];
    if (parser) {
      try {
        Object.assign(details, await parser.parse(bytes, {tiff:true,xmp:true,icc:true,iptc:true,jfif:true,ihdr:true,ifd0:true,ifd1:true,exif:true,gps:true,interop:true,makerNote:true,userComment:true,mergeOutput:false,chunked:false}));
      } catch { warnings.push('Some photo tags could not be decoded; the metadata block inventory is still available.'); }
    } else warnings.push('Photo tag decoder is unavailable; the metadata block inventory is still available.');
    for (const block of report.found) {
      const end = report.format === 'PNG' ? block.end-4 : report.format === 'WebP' && block.type !== 'trailing' ? block.payload+u32(bytes,block.start+4,true) : block.end;
      const data = bytes.subarray(block.payload,end);
      block.rawPreview = Array.from(data.subarray(0,128), byte=>byte.toString(16).padStart(2,'0')).join(' ') + (data.length>128 ? `\nFirst 128 of ${data.length} payload bytes shown.` : '');
      if (block.label.startsWith('EXIF') && parser) {
        try { details[block.id + ' EXIF'] = await parser.parse(data.subarray(ascii(data,0,6)==='Exif\0\0'?6:0),true); } catch { /* Raw block remains inventoried. */ }
      }
      if (block.type === 'tEXt' || block.type === 'comment' || block.label === 'XMP metadata') {
        block.value = new TextDecoder().decode(data).replace(/\0/g,' · ');
      }
      if (block.type === 'iTXt' || block.type === 'zTXt') {
        try {
          const zero = data.indexOf(0);
          if (zero < 0) throw new Error();
          const keyword = new TextDecoder().decode(data.subarray(0,zero));
          let start = zero+2, compressed = true;
          if (block.type === 'iTXt') {
            compressed = data[zero+1] === 1;
            start = zero+3;
            for (let n=0;n<2;n++) { const z=data.indexOf(0,start); if(z<0)throw new Error(); start=z+1; }
          }
          let text = data.subarray(start);
          if (compressed) {
            // Bound decompression output to avoid expanding malicious metadata indefinitely.
            const reader = new Blob([text]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
            const parts = []; let size = 0;
            while (true) { const {value,done}=await reader.read(); if(done)break; size+=value.length; if(size>4*1024*1024){await reader.cancel();throw new Error();} parts.push(value); }
            text = new Uint8Array(await new Blob(parts).arrayBuffer());
          }
          block.value = keyword + ': ' + new TextDecoder().decode(text);
        } catch { block.value = 'Compressed or malformed text could not be decoded. The entire block can still be removed.'; }
      }
      if (block.type === 'tIME' && data.length === 7) block.value = `${(data[0]<<8)|data[1]}-${data[2]}-${data[3]} ${data[4]}:${data[5]}:${data[6]} UTC`;
      if (block.value && /c2pa:|c2pa\.org|contentauthenticity\.org/i.test(block.value)) {
        block.kind = 'provenance'; block.selected = false;
        block.label += ' (provenance reference)';
      }
    }
    return {details,warnings};
  }
  root.ClearFrameMetadata = {scan,decode};
  if (typeof module !== 'undefined') module.exports = root.ClearFrameMetadata;
})(typeof globalThis !== 'undefined' ? globalThis : window);
