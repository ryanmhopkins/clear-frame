const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deflateSync}=require('node:zlib');
const {scan,decode}=require('../metadata.js');
const exifr=require('../vendor/exifr.js');
const join=(...parts)=>new Uint8Array(Buffer.concat(parts.map(p=>Buffer.from(p))));
const text=s=>Buffer.from(s,'latin1');
const segment=(marker,data)=>join([255,marker,(data.length+2)>>8,(data.length+2)&255],data);
const pngChunk=(type,data=[])=>{const header=Buffer.alloc(4);header.writeUInt32BE(data.length);return join(header,text(type),data,[0,0,0,0])};
const png=(...chunks)=>join([137,80,78,71,13,10,26,10],pngChunk('IHDR',[0,0,0,1,0,0,0,1,8,2,0,0,0]),...chunks,pngChunk('IDAT',[1,2,3]),pngChunk('IEND'));
const webpChunk=(type,data)=>{const header=Buffer.alloc(4);header.writeUInt32LE(data.length);return join(text(type),header,data,data.length%2?[0]:[])};
const webp=(...chunks)=>{const body=join(text('WEBP'),...chunks),header=Buffer.alloc(4);header.writeUInt32LE(body.length);return join(text('RIFF'),header,body)};
const tiff=join(text('II'),[42,0,8,0,0,0,1,0,15,1,2,0,6,0,0,0,26,0,0,0,0,0,0,0],text('Canon\0'));
test('JPEG inventories metadata between progressive scans and trailing bytes; selectively preserves payload',()=>{
 const comment=segment(254,text('keep this')),unknown=segment(227,text('custom'));
 const b=join([255,216],segment(225,join(text('Exif\0\0'),tiff)),segment(218,[]),[1,255,0,2,255,208,3],comment,segment(218,[]),[5,6],unknown,[255,217],text('trailer'));
 const r=scan(b);assert.equal(r.found.length,4);
 assert.deepEqual(r.clean(new Set()),b);
 const cleaned=r.clean(new Set(r.found.filter(x=>x.type!=='comment').map(x=>x.id)));
 assert.deepEqual(scan(cleaned).found.map(x=>x.type),['comment']);
 assert.deepEqual(cleaned,join([255,216],segment(218,[]),[1,255,0,2,255,208,3],comment,segment(218,[]),[5,6],[255,217]));
});
test('PNG detects unknown, appearance and credential blocks and retains animation and transparency',()=>{
 const b=png(pngChunk('tEXt',text('Author\0Alice')),pngChunk('vpAg',[1]),pngChunk('iCCP',[2]),pngChunk('caBX',[3]),pngChunk('acTL',[0,0,0,1,0,0,0,0]),pngChunk('tRNS',[0,0,0,0,0,0]));
 const r=scan(b);assert.equal(r.found.length,4);assert.equal(r.width,1);
 assert.deepEqual(r.clean(new Set()),b);
 const defaults=scan(r.clean());assert.deepEqual(defaults.found.map(x=>x.type),['iCCP','caBX']);
 const all=scan(r.clean(new Set(r.found.map(x=>x.id))));assert.equal(all.found.length,0);
 assert.ok(all.structure.some(x=>x.type==='acTL'));assert.ok(all.structure.some(x=>x.type==='tRNS'));
});
test('WebP fixes RIFF size and only selected VP8X feature bits; leaves encoded image intact',()=>{
 const b=webp(webpChunk('VP8X',[62,0,0,0,0,0,0,0,0,0]),webpChunk('ICCP',[1,2]),webpChunk('EXIF',tiff),webpChunk('XMP ',text('odd')),webpChunk('VP8 ',[7,8,9,10]),webpChunk('ZZZZ',[1]));
 const r=scan(b);assert.equal(r.found.length,4);assert.deepEqual(r.clean(new Set()),b);
 const cleaned=r.clean(new Set(r.found.filter(x=>x.type==='EXIF').map(x=>x.id)));
 assert.equal(cleaned[20],54);assert.equal(Buffer.from(cleaned).readUInt32LE(4),cleaned.length-8);
 assert.deepEqual(scan(cleaned).found.map(x=>x.type),['ICCP','XMP ','ZZZZ']);
 assert.ok(Buffer.from(cleaned).includes(Buffer.from(webpChunk('VP8 ',[7,8,9,10]))));
});
test('WebP preserves trailing bytes outside RIFF when deselected',()=>{
 const b=join(webp(webpChunk('VP8 ',[1,2])),[99,100]);const r=scan(b);
 assert.deepEqual(r.clean(new Set()),b);assert.equal(r.clean().length,b.length-2);
});
test('malformed containers are rejected',()=>{
 for(const b of [join([255,216,255,225,0,40],[1]),png().slice(0,-1),webp(webpChunk('EXIF',[1])).slice(0,-1)])assert.throws(()=>scan(b),/Malformed/);
});
test('decodes actual EXIF tag values and compressed PNG text',async()=>{
 const b=png(pngChunk('eXIf',tiff),pngChunk('zTXt',join(text('Author\0'),[0],deflateSync(text('Alice')))));
 const r=scan(b),decoded=await decode(b,r,exifr);
 assert.match(JSON.stringify(decoded.details),/Canon/);assert.equal(r.found[1].value,'Author: Alice');
});
test('XMP provenance references beyond 512 bytes are recognized and kept by default',async()=>{
 const b=join([255,216],segment(225,text('http://ns.adobe.com/xap/1.0/\0'+' '.repeat(700)+'<c2pa:manifest>credential</c2pa:manifest>')),[255,217]);
 const r=scan(b);await decode(b,r,exifr);assert.equal(r.found[0].kind,'provenance');assert.equal(r.found[0].selected,false);assert.deepEqual(r.clean(),b);
});
test('EXIF data in WebP is decoded separately from its unsupported container',async()=>{
 const r=scan(webp(webpChunk('EXIF',tiff)));const d=await decode(webp(webpChunk('EXIF',tiff)),r,exifr);assert.match(JSON.stringify(d.details),/Canon/);
});
