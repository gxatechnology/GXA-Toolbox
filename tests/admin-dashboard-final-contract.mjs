import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { loadToolRegistry } from '../scripts/tool-registry.mjs';
import { ADMIN_PRODUCT_SNAPSHOT } from '../netlify/functions/_admin-product-snapshot.mjs';
import { buildToolAnalytics, safeRecentEvents, toolMetrics } from '../netlify/functions/_admin-tool-analytics.mjs';
import { loadInternalData } from '../netlify/functions/admin-data.mjs';
import { createAdminSessionToken, verifyAdminSessionToken, readAdminSession, readAdminJson, adminErrorResponse } from '../netlify/functions/_admin-auth.mjs';
import toolEventHandler from '../netlify/functions/tool-event.mjs';
import { setDatabaseClientForTests } from '../netlify/functions/_database.mjs';

process.env.NODE_ENV='test';
process.env.ADMIN_SESSION_SECRET='local-admin-contract-only-secret-at-least-32-characters';
const tools=await loadToolRegistry();
assert.deepEqual(ADMIN_PRODUCT_SNAPSHOT.tools,tools.map(({id,name,category})=>({id,name,category})));
const empty=buildToolAnalytics([]);
assert.equal(empty.rows.length,tools.length);
assert.equal(new Set(empty.rows.map(row=>row.tool_id)).size,tools.length);
assert.ok(empty.rows.every(row=>row.opens===0 && row.starts===0 && row.conversion_rate===null && !row.attention));
assert.ok(buildToolAnalytics([],false).rows.every(row=>row.opens===null && row.starts===null));
for (const id of ['edit-pdf','compress-pdf','ppt-to-pdf','image-converter','gps-map-camera']) assert.ok(empty.rows.some(row=>row.tool_id===id),id);
const mapped=buildToolAnalytics([{tool_id:tools[0].id,tool_name:'Untrusted name',category:'wrong',opens:30,starts:20,successful_jobs:10,failed_jobs:5,downloads:12},{tool_id:'historical-tool',opens:2,starts:0}]);
assert.equal(mapped.rows[0].tool_name,tools[0].name);
assert.equal(mapped.rows[0].category,tools[0].category);
assert.equal(mapped.rows[0].conversion_rate,50);
assert.equal(mapped.rows[0].failure_rate,25);
assert.equal(mapped.rows[0].download_rate,120);
assert.equal(mapped.rows[0].attention,true);
assert.equal(mapped.historical.length,1);
assert.equal(mapped.rows.length,tools.length);
assert.equal(mapped.categories.reduce((sum,row)=>sum+row.opens,0),30);
assert.equal(toolMetrics({starts:1,successful_jobs:0,failed_jobs:1}).attention,false);
assert.equal(toolMetrics({starts:0,downloads:3}).conversion_rate,null);
assert.doesNotMatch(JSON.stringify(mapped),/NaN|Infinity/);
assert.deepEqual(safeRecentEvents([{tool_id:tools[0].id,event_type:'tool_complete',occurred_at:'2026-08-16',file_name:'private.pdf',status:'private message'},{event_type:'secret',tool_id:'x'}]),[{tool_name:tools[0].name,category:tools[0].category,event_type:'tool_complete',occurred_at:'2026-08-16'}]);

const queries=[];
const sql=async(strings,...values)=>{const query=strings.join('$param');queries.push({query,values});return [];};
const result=await loadInternalData(sql,'2026-08-01T00:00:00Z','2026-09-01T00:00:00Z');
assert.equal(queries.length,12);
for(const {query,values} of queries){assert.match(query,/SELECT/);assert.doesNotMatch(query,/INSERT|UPDATE|DELETE|DROP/);if(!query.includes("to_regclass('public.tool_ratings')")){assert.ok(values.includes('2026-08-01T00:00:00Z'));assert.ok(values.includes('2026-09-01T00:00:00Z'));}}
assert.equal(result.ratings.available,false);
assert.equal(result.ratings.reason,'migration_required');
assert.equal(result.toolAnalytics.rows.length,tools.length);
assert.match(queries.find(item=>item.query.includes('AS total_count')).query,/SUM\(COUNT\(\*\)\) OVER/);
assert.match(queries.find(item=>item.query.includes('SELECT tool_id, event_type')).query,/LIMIT 50/);
assert.ok(queries.some(item=>item.query.includes("AT TIME ZONE 'UTC'")));

const token=createAdminSessionToken();
assert.ok(verifyAdminSessionToken(token));
assert.equal(verifyAdminSessionToken(token,Date.now()+19*60*60*1000),null);
assert.equal(verifyAdminSessionToken(token+'.extra'),null);
assert.equal(verifyAdminSessionToken(token+'bad'),null);
assert.equal(readAdminSession(new Request('http://localhost',{headers:{Cookie:'gxa_admin_session=%invalid'}})),null);
await assert.rejects(readAdminJson(new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:'x'.repeat(5000)})})),error=>error.status===413);
const sanitized=await adminErrorResponse({status:500,message:'secret database password /internal/path'}).text();
assert.doesNotMatch(sanitized,/secret|password|internal\/path/);

// Execute the actual public analytics bridge in an isolated VM; nothing is sent externally.
const bridge=await readFile(new URL('../public_html/assets/gxa-analytics.js',import.meta.url),'utf8');
const captured=[];
const window={location:{pathname:'/crop-image/'},dataLayer:[],fetch:async(url,options)=>{captured.push(JSON.parse(options.body));return {ok:true};}};
const context={window,document:{visibilityState:'visible'},navigator:{},URL,Date,Set,Map,JSON,console,fetch:window.fetch};
vm.runInNewContext(bridge,context);
const representatives=['merge-pdf','crop-image','calculator','json-tool','barcode-generator','image-converter','gps-map-camera'].map(id=>tools.find(tool=>tool.id===id));
assert.ok(representatives.every(Boolean),'Representative IDs must come from the current registry.');
const eventTypes=['tool_open','tool_start','tool_complete','tool_download','tool_fail'];
for(const tool of representatives) for(const type of eventTypes) assert.equal(window.GxaAnalytics.track(type,tool,{status:'completed',file_name:'never-send.pdf',gps:{lat:1}}),true);
assert.equal(captured.length,representatives.length*5);
assert.equal(window.dataLayer.length,captured.length);
assert.doesNotMatch(JSON.stringify(captured),/never-send|file_name|gps"|lat"/);
const stored=[];
setDatabaseClientForTests({sql:async(strings,...values)=>{assert.match(strings.join(''),/INSERT INTO public.tool_analytics_events/);stored.push(values);return [];}});
for(const body of captured) assert.equal((await toolEventHandler(new Request('https://gxatoolbox.in/.netlify/functions/tool-event',{method:'POST',headers:{Origin:'https://gxatoolbox.in','Content-Type':'application/json'},body:JSON.stringify(body)}))).status,202);
const rows=representatives.map(tool=>({tool_id:tool.id,...Object.fromEntries([['opens','tool_open'],['starts','tool_start'],['successful_jobs','tool_complete'],['failed_jobs','tool_fail'],['downloads','tool_download']].map(([key,event])=>[key,stored.filter(values=>values[0]===event&&values[1]===tool.id).length]))}));
const roundTrip=buildToolAnalytics(rows);
for(const tool of representatives){const row=roundTrip.rows.find(item=>item.tool_id===tool.id);assert.equal(row.starts,1);assert.equal(row.successful_jobs,1);assert.equal(row.downloads,1);assert.equal(row.failed_jobs,1);}
setDatabaseClientForTests(null);
console.log(`Admin final contract passed: ${tools.length} canonical tools, historical mapping, rates, bounded queries, privacy, and session hardening.`);
