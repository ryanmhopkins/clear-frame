const $=s=>document.querySelector(s);const drop=$('#dropzone'),input=$('#fileInput'),results=$('#results');let batch=[],activeId=null;
const TYPES={jpg:'image/jpeg',png:'image/png',webp:'image/webp'};
const human=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
function renderList(el,items,empty){
  el.replaceChildren();
  if(!items.length){const p=document.createElement('p');p.className='empty-finding';p.textContent=empty;el.append(p);return}
  const entry=getActive();
  items.forEach(x=>{
    const row=document.createElement('div');row.className='finding-item metadata-item';
    const label=document.createElement('label');label.className='metadata-choice';
    const check=document.createElement('input');check.type='checkbox';check.checked=entry.selected.has(x.id);check.disabled=!x.removable;
    check.dataset.metadataId=x.id;check.setAttribute('aria-label',`Remove ${x.label}`);
    check.onchange=()=>{check.checked?entry.selected.add(x.id):entry.selected.delete(x.id);visual.setAttribute('aria-checked',String(check.checked));updateSelection();renderBatch()};
    const control=document.createElement('span');control.className='check-control';
    const visual=document.createElement('span');visual.className='t-check';visual.setAttribute('aria-hidden','true');visual.setAttribute('aria-checked',String(check.checked));
    visual.innerHTML='<svg viewBox="0 0 10.1668 10.1668"><path d="M1 5.52L3.92 9.17L9.17 1"/></svg>';
    // Length of the two straight path segments, used when geometry APIs are unavailable.
    visual.style.setProperty('--check-len',String(Math.ceil(Math.hypot(2.92,3.65)+Math.hypot(5.25,8.17))));
    control.append(check,visual);
    const content=document.createElement('span');
    const title=document.createElement('strong');title.textContent=x.label;
    const description=document.createElement('small');description.textContent=`${x.detail} · ${x.removable?'Select to remove':'Required for correct display'}`;
    content.append(title,description);label.append(control,content);row.append(label);
    if(x.value || x.rawPreview){const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent=x.value?'View embedded value':'View raw metadata bytes';const pre=document.createElement('pre');pre.textContent=x.value || x.rawPreview;detail.append(summary,pre);row.append(detail)}
    el.append(row);const path=visual.querySelector('path');if(path.getTotalLength)visual.style.setProperty('--check-len',Math.ceil(path.getTotalLength()));
  });
}
function updateSelection(){
  const entry=getActive();if(!entry)return;
  const count=entry.selected.size,total=entry.report.found.filter(x=>x.removable).length;
  $('#selectionCount').textContent=`${count} of ${total} items selected`;
  $('#selectAll').disabled=count===total;$('#deselectAll').disabled=count===0;
  $('#cleanDescription').textContent=count?`${count} ${count===1?'item':'items'} will be removed.`:'Nothing selected. Your copy will be unchanged.';
  $('#cleanBtn span').textContent=count?'Download clean copy':'Download unchanged';
}
function setSelection(all){const entry=getActive();if(!entry)return;entry.selected=new Set(all?entry.report.found.filter(x=>x.removable).map(x=>x.id):[]);document.querySelectorAll('.metadata-choice input').forEach(check=>{check.checked=entry.selected.has(check.dataset.metadataId);check.nextElementSibling.setAttribute('aria-checked',String(check.checked))});updateSelection();renderBatch()}
function renderPhotoData(entry){
  const data={File:{name:entry.file.name,format:entry.report.format,bytes:entry.file.size,lastModified:new Date(entry.file.lastModified).toISOString(),width:entry.report.width,height:entry.report.height},...entry.decoded.details};
  $('#photoData').textContent=JSON.stringify(data,(key,value)=>ArrayBuffer.isView(value)?`Binary data (${value.byteLength} bytes)`:value,2);
  $('#scanWarnings').textContent=entry.decoded.warnings.join(' ');
  $('#structureData').textContent=entry.report.structure.map(x=>`${x.type}: ${human(x.bytes)} (kept)`).join('\n');
  const properties=[['File name',entry.file.name],['Format',entry.report.format],['File size',human(entry.file.size)],['Dimensions',entry.report.width?`${entry.report.width} × ${entry.report.height}`:'Not available'],['Metadata blocks',String(entry.report.found.length)]];
  const seen=new Set();
  function collect(value,depth=0){
    if(!value || typeof value!=='object' || depth>5 || ArrayBuffer.isView(value))return;
    for(const [key,item] of Object.entries(value)){
      if(['Make','Model','LensModel','DateTimeOriginal','ExposureTime','FNumber','ISO','latitude','longitude','Artist','Copyright','Software','Orientation'].includes(key) && !seen.has(key)){
        seen.add(key);properties.push([key.replace(/([a-z])([A-Z])/g,'$1 $2'),item instanceof Date?item.toLocaleString():String(item)]);
      }else if(item && typeof item==='object')collect(item,depth+1);
    }
  }
  collect(entry.decoded.details);
  const list=document.createElement('dl');
  for(const [key,value] of properties){const row=document.createElement('div');row.className='property-row';const label=document.createElement('dt'),content=document.createElement('dd');label.textContent=key;content.textContent=value;row.append(label,content);list.append(row)}
  $('#photoProperties').replaceChildren(list);

}
const escapeHTML=s=>s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function getActive(){return batch.find(x=>x.id===activeId)}
function cleanName(file){const base=file.name.replace(/\.[^.]+$/,'');return`${base}-clean.${file.name.split('.').pop()}`}
function renderBatch(){
  $('#batchCount').textContent=batch.length;$('#batchNoun').textContent=batch.length===1?'photo':'photos';
  const list=$('#batchList');list.innerHTML='';
  batch.forEach(entry=>{const button=document.createElement('button');button.type='button';button.className='batch-item'+(entry.id===activeId?' active':'');button.setAttribute('aria-pressed',entry.id===activeId?'true':'false');button.innerHTML=`<img src="${entry.url}" alt=""><span><b>${escapeHTML(entry.file.name)}</b><small>${entry.selected.size} selected · ${human(entry.file.size)}</small></span><i>${entry.id===activeId?'•':''}</i>`;button.onclick=()=>select(entry.id);list.appendChild(button)});
}
function select(id){
  activeId=id;const entry=getActive();if(!entry)return;renderBatch();
  const {file,report}=entry;$('#preview').src=entry.url;$('#fileName').textContent=file.name;
  $('#fileDetails').textContent=`${human(file.size)} · ${report.format}${report.width?` · ${report.width} × ${report.height}`:''}`;
  const priv=report.found.filter(x=>x.kind==='private'),prov=report.found.filter(x=>x.kind==='provenance'),appearance=report.found.filter(x=>x.kind==='appearance');
  renderList($('#privacyFindings'),priv,'No other metadata blocks detected');
  renderList($('#provenanceFindings'),prov,'No credential containers detected');
  renderList($('#appearanceFindings'),appearance,'No display metadata blocks detected');
  $('#privacyCount').textContent=priv.length;$('#provCount').textContent=prov.length;$('#appearanceCount').textContent=appearance.length;
  $('#summaryTitle').textContent=report.found.length?'Metadata found':'No metadata found';
  $('#summaryCopy').textContent='Checked items will be removed. Everything else stays.';
  renderPhotoData(entry);updateSelection();
}
async function handleFiles(files){const valid=[...files].filter(file=>Object.values(TYPES).includes(file.type));if(!valid.length){toast('Choose JPEG, PNG, or WebP images');return}if(valid.length!==files.length)toast(`${files.length-valid.length} unsupported ${files.length-valid.length===1?'file was':'files were'} skipped`);const fresh=[];for(const file of valid){try{const b=new Uint8Array(await file.arrayBuffer()),report=ClearFrameMetadata.scan(b),decoded=await ClearFrameMetadata.decode(b,report,window.exifr);fresh.push({id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,file,b,report,decoded,selected:new Set(report.found.filter(x=>x.selected).map(x=>x.id)),url:URL.createObjectURL(file)})}catch(e){toast(`${file.name} could not be scanned`)}}if(!fresh.length)return;batch.push(...fresh);activeId=fresh[0].id;results.hidden=false;$('.workspace').hidden=true;document.body.classList.add('has-results');showReview('clean');renderBatch();select(activeId);results.scrollIntoView({behavior:'smooth',block:'start'})}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
function clean(){const entry=getActive();if(!entry)return;const cleaned=entry.report.clean(entry.selected);downloadBlob(new Blob([cleaned],{type:entry.file.type}),cleanName(entry.file));toast(`Clean copy ready · ${human(cleaned.length)}`)}
async function cleanAll(){if(!batch.length)return;if(!window.JSZip){toast('ZIP tools are still loading. Try again.');return}const button=$('#cleanAllBtn');button.disabled=true;button.innerHTML='<span>Packaging</span><b>···</b>';try{const zip=new JSZip();batch.forEach((entry,index)=>zip.file(`${String(index+1).padStart(3,'0')}-${cleanName(entry.file)}`,entry.report.clean(entry.selected)));const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},meta=>{button.querySelector('b').textContent=`${Math.round(meta.percent)}%`});downloadBlob(blob,'clearframe-clean-images.zip');toast(`${batch.length} clean images ready`)}catch(e){toast('Could not create the ZIP file')}finally{button.disabled=false;button.innerHTML='<span>Download all</span><b>ZIP ↓</b>'}}
function reset(){batch.forEach(x=>URL.revokeObjectURL(x.url));batch=[];activeId=null;input.value='';results.hidden=true;$('.workspace').hidden=false;document.body.classList.remove('has-results');showReview('clean');window.scrollTo({top:0,behavior:'smooth'})}function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('is-open');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('is-open'),2800)}
$('#browseBtn').onclick=e=>{e.stopPropagation();input.click()};$('#addMore').onclick=()=>input.click();drop.onclick=e=>{if(e.target.tagName!=='BUTTON')input.click()};drop.onkeydown=e=>{if(e.target!==drop)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};input.onchange=()=>{handleFiles(input.files);input.value=''};['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('dragging')}));['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('dragging')}));drop.ondrop=e=>handleFiles(e.dataTransfer.files);$('#selectAll').onclick=()=>setSelection(true);$('#deselectAll').onclick=()=>setSelection(false);$('#cleanBtn').onclick=clean;$('#cleanAllBtn').onclick=cleanAll;$('#startOver').onclick=reset;
try{const ctx=document.modelContext;if(ctx?.registerTool){ctx.registerTool({name:'open_image_picker',title:'Choose images',description:'Open the device file picker to select images for a local metadata scan.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(){input.click();return{status:'picker_opened'}}});ctx.registerTool({name:'get_scan_summary',title:'Read scan summary',description:'Return metadata scan summaries for the current image batch.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(){if(!batch.length)throw new Error('No images are currently selected');return{images:batch.map(x=>({file:x.file.name,privacy_findings:x.report.found.filter(y=>y.kind==='private').map(y=>y.label),provenance_findings:x.report.found.filter(y=>y.kind==='provenance').map(y=>y.label)}))}}})}}catch(e){}

function showReview(view){
  const details=view==='details';
  $('#cleanView').hidden=details;$('#detailsView').hidden=!details;
  for(const id of ['clean','details']){const tab=$('#'+id+'Tab'),active=id===view;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1}
  window.ClearFrameMotion?.moveTab();
}
for(const id of ['clean','details']){
  $('#'+id+'Tab').onclick=()=>showReview(id);
  $('#'+id+'Tab').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=e.key==='Home'?'clean':e.key==='End'?'details':id==='clean'?'details':'clean';showReview(target);$('#'+target+'Tab').focus()}};
}
