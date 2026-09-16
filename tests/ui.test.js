const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const metadata=require('../metadata.js');
function setup(){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'http://localhost'});
 const w=dom.window;
 w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;w.Blob=Blob;
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.scrollTo=()=>{};
 w.eval(fs.readFileSync('metadata.js','utf8'));w.eval(fs.readFileSync('app.js','utf8'));
 return {dom,w,query:s=>w.document.querySelector(s)};
}
const jpeg=new Uint8Array([255,216,255,254,0,7,65,108,105,99,101,255,227,0,4,1,2,255,217]);
const file=name=>({name,type:'image/jpeg',size:jpeg.length,lastModified:0,arrayBuffer:async()=>jpeg.buffer});
test('select/deselect all, individual choice, per-image persistence, download and ZIP selections',async()=>{
 const {dom,w,query}=setup();
 try{
  await w.handleFiles([file('same.jpg'),file('same.jpg')]);
  assert.match(query('#selectionCount').textContent,/2 of 2/);
  query('#deselectAll').click();assert.match(query('#selectionCount').textContent,/0 of 2/);
  assert.equal(query('#cleanBtn span').textContent,'Download unchanged');
  let check=query('#privacyFindings input');check.click();
  assert.match(query('#selectionCount').textContent,/1 of 2/);
  w.document.querySelectorAll('.batch-item')[1].click();assert.match(query('#selectionCount').textContent,/2 of 2/);
  w.document.querySelectorAll('.batch-item')[0].click();assert.match(query('#selectionCount').textContent,/1 of 2/);
  const downloads=[];w.downloadBlob=(blob,name)=>downloads.push({blob,name});
  query('#cleanBtn').click();
  const exported=new Uint8Array(await downloads[0].blob.arrayBuffer());
  assert.deepEqual(metadata.scan(exported).found.map(x=>x.type),['APP3']);
  const packaged=[];
  w.JSZip=class {file(name,data){packaged.push({name,data})}async generateAsync(options,progress){progress({percent:100});return new Blob(['zip'])}};
  await w.cleanAll();assert.equal(packaged.length,2);assert.notEqual(packaged[0].name,packaged[1].name);
  assert.equal(metadata.scan(packaged[0].data).found.length,1);assert.equal(metadata.scan(packaged[1].data).found.length,0);
  query('#selectAll').click();assert.match(query('#selectionCount').textContent,/2 of 2/);
  query('#deselectAll').click();query('#cleanBtn').click();
  assert.deepEqual(new Uint8Array(await downloads.at(-1).blob.arrayBuffer()),jpeg);
  query('#startOver').click();assert.equal(query('#results').hidden,true);
 }finally{dom.window.close()}
});
test('metadata and filenames render as text, including markup-like content',async()=>{
 const {dom,w,query}=setup();try{
  const content=Buffer.from('<img src=x onerror=alert(1)>');
  const bytes=new Uint8Array(Buffer.concat([Buffer.from([255,216,255,254,0,content.length+2]),content,Buffer.from([255,217])]));
  await w.handleFiles([{...file('<script>evil</script>.jpg'),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}]);
  assert.equal(query('#privacyFindings img'),null);assert.match(query('#privacyFindings pre').textContent,/<img/);
  assert.equal(query('#batchList script'),null);assert.match(query('#fileName').textContent,/<script>/);
 }finally{dom.window.close()}
});

test('photo detail tabs support keyboard navigation and show readable properties',async()=>{
 const {dom,w,query}=setup();try{
  await w.handleFiles([file('photo.jpg')]);
  assert.equal(w.document.body.classList.contains('has-results'),true);
  query('#detailsTab').click();assert.equal(query('#detailsView').hidden,false);assert.equal(query('#cleanView').hidden,true);
  assert.equal(query('#detailsTab').getAttribute('aria-selected'),'true');
  assert.match(query('#photoProperties').textContent,/photo.jpg/);
  query('#detailsTab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
  assert.equal(query('#cleanView').hidden,false);assert.equal(w.document.activeElement.id,'cleanTab');
  query('#startOver').click();assert.equal(w.document.body.classList.contains('has-results'),false);
 }finally{dom.window.close()}
});
