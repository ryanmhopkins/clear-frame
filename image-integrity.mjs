// Hash every TIFF strip/tile/embedded JPEG without decoding or changing pixels.
// Unlike tag-derived hashes this also covers JPEG-compressed TIFF images.
export async function tiffImageHash(bytes) {
  const le=bytes[0]===73&&bytes[1]===73;
  if(!le && !(bytes[0]===77&&bytes[1]===77))return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const fail=()=>{throw new Error('The TIFF image layout could not be verified.');};
  function u16(p){if(p<0||p+2>bytes.length)fail();return view.getUint16(p,le);}
  function u32(p){if(p<0||p+4>bytes.length)fail();return view.getUint32(p,le);}
  if(u16(2)!==42)throw new Error('BigTIFF and nonstandard TIFF headers are not supported.');
  const pending=[u32(4)],seen=new Set(),ranges=[];
  if(bytes[8]===67&&bytes[9]===82&&bytes[10]===2)pending.push(u32(12));
  while(pending.length){
    const offset=pending.shift();if(!offset||seen.has(offset))continue;
    if(seen.size>=256)fail();seen.add(offset);
    const count=u16(offset);if(offset+2+12*count+4>bytes.length)fail();
    const tags=new Map();
    for(let i=0;i<count;i++){
      const p=offset+2+12*i,tag=u16(p),type=u16(p+2),n=u32(p+4);
      if(![273,279,324,325,513,514,330,347].includes(tag))continue;
      const size={1:1,3:2,4:4,7:1,13:4}[type];if(!size || n>1000000)fail();
      const start=n*size<=4?p+8:u32(p+8);if(start+n*size>bytes.length)fail();
      if(tag===347){ranges.push([start,n*size]);continue;}
      const values=Array.from({length:n},(_,j)=>size===1?bytes[start+j]:size===2?u16(start+j*2):u32(start+j*4));tags.set(tag,values);
    }
    for(const [offsetTag,sizeTag] of [[273,279],[324,325],[513,514]]){
      if(!tags.has(offsetTag))continue;
      const starts=tags.get(offsetTag),lengths=tags.get(sizeTag);if(!lengths||starts.length!==lengths.length)fail();
      starts.forEach((start,i)=>{const length=lengths[i];if(!length||!start||start+length>bytes.length)fail();ranges.push([start,length]);});
    }
    pending.push(...(tags.get(330)||[]),u32(offset+2+12*count));
  }
  if(!ranges.length)fail();
  const length=ranges.reduce((n,r)=>n+r[1],0);if(length>bytes.length*2)fail();
  const pixels=new Uint8Array(length);let p=0;
  for(const [start,n] of ranges){pixels.set(bytes.subarray(start,start+n),p);p+=n;}
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels)),b=>b.toString(16).padStart(2,'0')).join('');
}
