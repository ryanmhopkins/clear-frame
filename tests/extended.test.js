const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const native=require('../metadata.js');
const dir=path.join(__dirname,'fixtures/extended');
const engineFetch=async()=>new Response(fs.readFileSync(path.join(__dirname,'../vendor/exiftool/zeroperl-mqcadjqm.wasm')));

test('extended formats: selected removal, keep choices, unchanged copies and intact image data',async t=>{
 const {inspect}=await import('../extended-metadata.mjs');
 for(const [name,format]of [['QuickTime.heic','HEIF'],['image.avif','AVIF'],['image.tiff','TIFF'],['CanonRaw.cr2','CR2'],['DNG.dng','DNG'],['Camera.dng','DNG'],['Nikon.nef','NEF'],['Sony.arw','ARW']]){
  await t.test(name,async()=>{
   const data=new Uint8Array(fs.readFileSync(path.join(dir,name))),entry=await inspect({name,data},engineFetch);
   assert.equal(entry.report.format,format);
   assert.deepEqual(await entry.clean([]),data,'deselect all preserves every byte');
   assert.ok(entry.report.found.some(b=>b.id==='GPS:all'));
   assert.ok(entry.report.found.some(b=>b.id==='XMP:all'));
   const gpsOnly=await entry.clean(['GPS:all']);
   const retained=await inspect({name,data:gpsOnly},engineFetch);
   assert.ok(!retained.report.found.some(b=>b.id==='GPS:all'));
   assert.equal(retained.report.found.find(b=>b.id==='XMP:all').value,entry.report.found.find(b=>b.id==='XMP:all').value);
   const selected=entry.report.found.filter(b=>b.removable).map(b=>b.id);
   const cleaned=await entry.clean(selected); // also verifies every image payload and protected tag
   const again=await inspect({name,data:cleaned},engineFetch);
   assert.equal(again.report.found.length,0);
   assert.equal(again.report.width,entry.report.width);
   assert.equal(again.report.height,entry.report.height);
   await assert.rejects(entry.clean(['EXIF:all']),/Invalid metadata selection/);
  });
 }
});

test('malformed and unsupported extended files fail without an export',async()=>{
 const {inspect}=await import('../extended-metadata.mjs');
 await assert.rejects(inspect({name:'bad.heic',data:new Uint8Array([0,1,2])},engineFetch));
 const data=new Uint8Array(fs.readFileSync(path.join(dir,'image.tiff'))).subarray(0,80);
 await assert.rejects(inspect({name:'broken.tiff',data},engineFetch));
});

test('GIF keeps animation, palettes, transparency and image bytes while removing selected extensions',()=>{
 // Two valid 1x1 GIF frames, a looping extension, frame control blocks and a comment.
 const header=Buffer.from('47494638396101000100800000000000ffffff','hex');
 const loop=Buffer.from('21ff0b4e45545343415045322e300301000000','hex');
 const frame=Buffer.from('21f904090a0000002c0000000001000100000202440100','hex');
 const comment=Buffer.from('21fe05416c69636500','hex');
 const bytes=new Uint8Array(Buffer.concat([header,loop,comment,frame,frame,Buffer.from([59])]));
 const scan=native.scan(bytes);assert.equal(scan.format,'GIF');assert.equal(scan.width,1);
 assert.equal(scan.found.length,1);assert.equal(scan.found[0].label,'GIF comment');
 assert.deepEqual(scan.clean(new Set()),bytes);
 const clean=scan.clean();
 assert.deepEqual(clean,new Uint8Array(Buffer.concat([header,loop,frame,frame,Buffer.from([59])])));
 assert.equal(native.scan(clean).found.length,0);
 assert.throws(()=>native.scan(bytes.subarray(0,bytes.length-2)),/Malformed/);
 const actual=native.scan(new Uint8Array(fs.readFileSync(path.join(dir,'GIF.gif'))));
 assert.ok(actual.found.some(b=>b.label==='ICC color profile'));
 assert.ok(native.scan(actual.clean()).found.some(b=>b.label==='ICC color profile'),'color profile kept by default');
});

test('TIFF integrity rejects out-of-bounds image pointers',async()=>{
 const {tiffImageHash}=await import('../image-integrity.mjs');
 const b=new Uint8Array(fs.readFileSync(path.join(dir,'image.tiff')));
 const v=new DataView(b.buffer),le=b[0]===73,ifd=v.getUint32(4,le),n=v.getUint16(ifd,le);
 for(let i=0;i<n;i++){const p=ifd+2+i*12;if(v.getUint16(p,le)===273)v.setUint32(p+8,0xffffff00,le);}
 await assert.rejects(tiffImageHash(b),/could not be verified/);
});
