import assert from 'node:assert/strict';
import * as lib from 'pdf-lib';
import '../public_html/assets/pdf-edit-core.js';
import '../public_html/assets/pdf-text-core.js';
const core=globalThis.GxaPdfEditCore, text=globalThis.GxaPdfTextCore;
const doc=await lib.PDFDocument.create();
const font=await doc.embedFont(lib.StandardFonts.Helvetica);
for(let i=0;i<3;i++){
  const page=doc.addPage([400,500]);
  page.drawText(`Original ${i}`,{x:40,y:400,font,size:20,color:lib.rgb(.1,.2,.4),rotate:lib.degrees(i===1?90:0)});
  page.drawText(`Untouched ${i}`,{x:200,y:120,font,size:12});
}
const bytes=await doc.save();
const runs=await text.inspect(bytes,lib);
assert.equal(runs[0].length,2);
assert.equal(runs[1][0].fontSize,20);
assert.ok(Math.abs(runs[1][0].matrix[1]-1)<1e-9);
const edits=[{pageIndex:0,key:runs[0][0].key,original:'Original 0',text:'Changed 0'},{pageIndex:1,key:runs[1][0].key,original:'Original 1',text:'Rotated new'}];
const output=await core.exportPdf(bytes,{nativeEdits:edits},lib);
const result=await text.inspect(output,lib), reopened=await lib.PDFDocument.load(output);
assert.equal(reopened.getPageCount(),3);
assert.equal(result[0][0].text,'Changed 0');assert.equal(result[1][0].text,'Rotated new');
for(let i=0;i<3;i++) {assert.equal(result[i][1].text,`Untouched ${i}`);assert.deepEqual(reopened.getPage(i).getSize(),{width:400,height:500});}
assert.deepEqual(result[1][0].matrix,runs[1][0].matrix);
for(let i=0;i<2;i++){assert.equal(result[i][0].font,runs[i][0].font);assert.equal(result[i][0].fontSize,runs[i][0].fontSize);}
const streams=(pdf,i)=>pdf.getPage(i).node.Contents().asArray().map(ref=>Buffer.from(lib.decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString('latin1')).join('\n');
const original=await lib.PDFDocument.load(bytes);
for(let i=0;i<2;i++){
  const sourceStream=streams(original,i),run=runs[i][0];
  const hex=Buffer.from(edits[i].text,'ascii').toString('hex');
  assert.equal(streams(reopened,i),sourceStream.slice(0,run.start)+`<${hex}>`+sourceStream.slice(run.end),'Only the selected text token changes: colors, rotation and untouched operators are identical');
}
assert.equal((await text.inspect(bytes,lib))[0][0].text,'Original 0','Source is immutable');
await assert.rejects(core.exportPdf(bytes,{nativeEdits:[{...edits[0],original:'not the source'}]},lib));
await assert.rejects(core.exportPdf(bytes,{nativeEdits:[{...edits[0],text:'Unicode हिन्दी'}]},lib));
await assert.rejects(core.exportPdf(bytes,{nativeEdits:[edits[0],edits[0]]},lib));
// A cloned page must not accidentally change another page sharing a stream.
const duplicate=await core.exportPdf(bytes,{pagePlan:[{sourceIndex:0},{sourceIndex:0}]},lib);
const dupRuns=await text.inspect(duplicate,lib);
const editedDuplicate=await core.exportPdf(duplicate,{nativeEdits:[{pageIndex:0,key:dupRuns[0][0].key,original:'Original 0',text:'Only first'}]},lib);
assert.equal((await text.inspect(editedDuplicate,lib))[1][0].text,'Original 0');
// Unsupported text state and subset markers fail closed, not guessed.
const unsupported=await lib.PDFDocument.load(bytes);
const p=unsupported.getPage(0), old=p.node.Contents().asArray();
p.node.set(lib.PDFName.of('Contents'),unsupported.context.obj([unsupported.context.register(unsupported.context.flateStream('2 Tc\n')),...old]));
assert.equal((await text.inspect(await unsupported.save(),lib))[0].length,0);
for(const op of ['2 Tw','2 Tz','2 Ts','1 Tr','1 0 0 1 20 0 cm','/GS gs']){
  const unsafe=await lib.PDFDocument.load(bytes),page=unsafe.getPage(0);
  page.node.set(lib.PDFName.of('Contents'),unsafe.context.obj([unsafe.context.register(unsafe.context.flateStream(op+'\n')),...page.node.Contents().asArray()]));
  assert.equal((await text.inspect(await unsafe.save(),lib))[0].length,0,`Unsafe text/graphics state ${op} must decline native editing`);
}
const twoEdits=await core.exportPdf(bytes,{nativeEdits:[edits[0],{pageIndex:0,key:runs[0][1].key,original:'Untouched 0',text:'Second change'}]},lib);
assert.deepEqual((await text.inspect(twoEdits,lib))[0].map(run=>run.text),['Changed 0','Second change']);
const planned=await core.exportPdf(bytes,{pagePlan:[{sourceIndex:1,rotation:90},{sourceIndex:0}],nativeEdits:[{...edits[0],pageIndex:1}]},lib);
assert.equal((await text.inspect(planned,lib))[1][0].text,'Changed 0');
assert.equal((await lib.PDFDocument.load(planned)).getPage(0).getRotation().angle,90);
const masked=await core.exportPdf(bytes,{overlays:[{id:'visual',type:'text',pageIndex:0,x:40,y:80,width:200,height:50,text:'Visual new',font:'Helvetica',fontSize:20,color:'#000000',align:'left',mask:{x:38,y:78,width:120,height:28,color:'#ffffff'}}]},lib);
assert.equal((await lib.PDFDocument.load(masked)).getPageCount(),3);
const formDoc=await lib.PDFDocument.load(bytes),field=formDoc.getForm().createTextField('Answer');
field.addToPage(formDoc.getPage(0),{x:40,y:200,width:200,height:40});
const formBytes=await formDoc.save(),formRun=(await text.inspect(formBytes,lib))[0][0];
const filled=await core.exportPdf(formBytes,{nativeEdits:[{pageIndex:0,key:formRun.key,original:formRun.text,text:'Native and form'}],fieldValues:{Answer:'Filled field'},flatten:true},lib);
const filledDoc=await lib.PDFDocument.load(filled);assert.equal(filledDoc.getForm().getFields().length,0);
assert.ok(streams(filledDoc,0).includes(Buffer.from('Native and form').toString('hex')),'Native replacement must coexist with flattening supported fields');
console.log('PDF text core passed: native replacement/reopen, original fonts/matrices, rotation, untouched pages, shared streams, unsafe input rejection and visual mask export.');
