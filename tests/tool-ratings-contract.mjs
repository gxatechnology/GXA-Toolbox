import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setDatabaseClientForTests } from '../netlify/functions/_database.mjs';
import handler from '../netlify/functions/tool-ratings.mjs';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';

process.env.NODE_ENV='test';
const migration=await readFile(new URL('../netlify/database/migrations/0009_create_tool_ratings.sql',import.meta.url),'utf8');
for(const token of ['public.tool_ratings','tool_rating_aggregates','rating BETWEEN 1 AND 5','moderation_status','tool_ratings_daily_submission_unique']) assert.ok(migration.includes(token),token);
assert.doesNotMatch(migration.replace(/^--.*$/gm,''),/\b(?:DROP|TRUNCATE|DELETE)\b/i);
const tools=await loadToolRegistry();
assert.equal(tools.length,95);

const aggregate={rating_count:2,average_rating:'4.50',one_star:0,two_star:0,three_star:0,four_star:1,five_star:1,last_updated_at:'2026-10-24T00:00:00Z'};
let inserted=[];
let duplicate=false;
setDatabaseClientForTests({sql:async(strings,...values)=>{
  const query=strings.join('$');
  if(query.includes('FROM public.tool_rating_aggregates')) return [aggregate];
  if(query.includes('INSERT INTO public.tool_ratings')){inserted=values;return duplicate?[]:[{id:'1'}];}
  if(query.includes('INSERT INTO public.system_events')) return [];
  throw new Error(`Unexpected rating query: ${query}`);
}});

const make=(method,path,body,extra={})=>new Request(`https://gxatoolbox.in${path}`,{method,headers:{Origin:'https://gxatoolbox.in','Content-Type':'application/json','User-Agent':'GXA rating test','x-nf-client-connection-ip':'127.0.0.1',...extra},...(body?{body:JSON.stringify(body)}:{})});
delete process.env.TOOL_RATINGS_ENABLED;
assert.equal((await handler(make('GET','/api/tool-ratings?toolId=merge-pdf'))).status,503);
process.env.TOOL_RATINGS_ENABLED='true';
process.env.RATING_ABUSE_SECRET='local-rating-contract-secret-at-least-32-characters';
const read=await handler(make('GET','/api/tool-ratings?toolId=merge-pdf'));
assert.equal(read.status,200);
assert.deepEqual((await read.json()).aggregate,{average:4.5,count:2,distribution:{1:0,2:0,3:0,4:1,5:1},updated_at:'2026-10-24T00:00:00Z'});
assert.equal((await handler(make('GET','/api/tool-ratings?toolId=not-a-tool'))).status,400);
assert.equal((await handler(make('POST','/api/tool-ratings',{tool_id:'merge-pdf',rating:0,review:''}))).status,400);
assert.equal((await handler(make('POST','/api/tool-ratings',{tool_id:'merge-pdf',rating:5,review:'x'.repeat(1001)}))).status,400);
assert.equal((await handler(make('POST','/api/tool-ratings',{tool_id:'merge-pdf',rating:5,review:''},{Origin:'https://evil.invalid'}))).status,403);
const saved=await handler(make('POST','/api/tool-ratings',{tool_id:'merge-pdf',rating:1,review:'Critical but legitimate feedback.'}));
assert.equal(saved.status,201);
assert.equal(inserted[0],'merge-pdf');
assert.equal(inserted[1],1);
assert.equal(inserted[2],'Critical but legitimate feedback.');
assert.equal(inserted[3],'pending');
assert.match(inserted[4],/^[a-f0-9]{64}$/);
assert.doesNotMatch(JSON.stringify(inserted),/127\.0\.0\.1|GXA rating test/);
duplicate=true;
assert.equal((await handler(make('POST','/api/tool-ratings',{tool_id:'merge-pdf',rating:4,review:''}))).status,409);
delete process.env.RATING_ABUSE_SECRET;
duplicate=false;
assert.equal((await handler(make('POST','/api/tool-ratings',{tool_id:'crop-image',rating:4,review:''}))).status,503);
setDatabaseClientForTests(null);

const [client,app,style,admin,bg]=await Promise.all([
  readFile(new URL('../public_html/assets/tool-ratings.js',import.meta.url),'utf8'),
  readFile(new URL('../public_html/assets/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public_html/assets/style.css',import.meta.url),'utf8'),
  readFile(new URL('../public_html/admin/admin.js',import.meta.url),'utf8'),
  readFile(new URL('../background-remover-app/src/components/ToolRating.tsx',import.meta.url),'utf8')
]);
assert.match(client,/role="radiogroup"/);assert.match(client,/aria-checked/);assert.match(client,/Optional review/);assert.match(client,/updateStructuredData/);
assert.match(client,/data-rating-mode/);assert.match(app,/toolId === 'ppt-to-pdf'/);assert.match(style,/prefers-reduced-motion/);assert.match(app,/GXA Technologies/);
assert.match(admin,/Tool Ratings \/ Reviews/);assert.match(bg,/background-remover/);
for(const forbidden of ['Trusted by Millions',"World's #1","India's No. 1"]) assert.ok(!`${client}${app}${style}`.includes(forbidden));
console.log('Tool ratings contract passed: 95 stable tools, additive schema, gated persistence, validation, privacy-safe dedupe, admin moderation, real-only schema and accessible UI.');
