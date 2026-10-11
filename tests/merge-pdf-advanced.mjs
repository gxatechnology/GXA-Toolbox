import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import { createEditPdfFixtures } from './fixtures/edit-pdf-fixtures.mjs';
const source = await readFile(new URL('../public_html/assets/app.js', import.meta.url), 'utf8');
const functions = ['parsePdfPageSelection','runPDFMerge'];
const parts = functions.map(name => {
  const start=source.search(new RegExp(`^(?:async )?function ${name}\\(`,'m')); assert.ok(start>=0);
  const tail=source.slice(start), next=tail.slice(1).search(/^(?:async )?function \w+\(/m);
  return next<0 ? tail : tail.slice(0,next+1);
});
const appState={ activeFiles:[],activeToolOptions:{} };
const {runPDFMerge}=new Function('PDFLib','appState','Blob',parts.join('\n')+'\nreturn {runPDFMerge};')(PDFLib,appState,Blob);
const fixtures=await createEditPdfFixtures();
const doc=await PDFLib.PDFDocument.create();
for(let i=0;i<3;i++){const page=doc.addPage([301+i,400]);page.drawText(`SOURCE ${i+1}`);page.setRotation(PDFLib.degrees(i===1?90:0));}
const file=Object.assign(new Blob([await doc.save()],{type:'application/pdf'}),{name:'source.pdf'});
const second=await PDFLib.PDFDocument.create();second.addPage([401,500]);second.addPage([402,500]);
const other=Object.assign(new Blob([await second.save()],{type:'application/pdf'}),{name:'source.pdf'});
appState.activeFiles=[file,other];
const selections=[{range:'3,1,1',rotation:90},{range:'2',rotation:180}];
const reopen=async plans=>{const blob=await runPDFMerge(plans);assert.equal(blob.type,'application/pdf');return PDFLib.PDFDocument.load(await blob.arrayBuffer());};
let result=await reopen(selections);
assert.deepEqual(result.getPages().map(p=>p.getWidth()),[303,301,301,402]);
assert.deepEqual(result.getPages().map(p=>p.getRotation().angle),[90,90,90,180]);
appState.activeToolOptions.reverse=true;
result=await reopen(selections);
assert.deepEqual(result.getPages().map(p=>p.getWidth()),[402,303,301,301]);
assert.deepEqual(result.getPages().map(p=>p.getRotation().angle),[180,90,90,90]);
appState.activeToolOptions.reverse=false;
result=await reopen([{range:'2',rotation:270},{range:'',rotation:0}]);
assert.equal(result.getPage(0).getRotation().angle,0,'Rotation is relative to the source');
assert.deepEqual((await reopen()).getPages().map(p=>p.getWidth()),[301,302,303,401,402]);
for(const bad of [{range:'9'},{range:'1,'},{range:'3-1'},{range:'x'},{range:'1',rotation:45},{range:[]},{range:'1'.repeat(2001)}])await assert.rejects(runPDFMerge([bad,{}]));
await assert.rejects(runPDFMerge([{}]));
await assert.rejects(runPDFMerge({}));
appState.activeFiles=[];await assert.rejects(runPDFMerge(),/Choose at least/);
for(const name of ['fillable-form.pdf','xfa-form.pdf','encrypted.pdf','corrupt.pdf','empty.pdf']){
  appState.activeFiles=[new Blob([fixtures[name]],{type:'application/pdf'})];
  await assert.rejects(runPDFMerge(),name.includes('form')?/form fields/:/could not be opened/);
}
appState.activeFiles=[file];
await assert.rejects(runPDFMerge([{range:Array(999).fill('1-3').join(',')}]),/quarter-turn/);
// An existing long document is bounded by output pages, not only range text length.
const long=await PDFLib.PDFDocument.create();for(let i=0;i<2001;i++)long.addPage([100,100]);
appState.activeFiles=[new Blob([await long.save()])];await assert.rejects(runPDFMerge(),/2,000/);
console.log('Advanced Merge PDF passed: selected/repeated/omitted pages, relative rotations, reverse order with file-bound selections, unchanged all-pages default, MIME/reopen, invalid ranges, corrupt/encrypted/live forms and 2,000-page memory guard.');
