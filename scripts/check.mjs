import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const source = await readFile('docs/technical-plan.md','utf8');
const html = await readFile('dist/index.html','utf8');
const manifest = JSON.parse(await readFile('dist/build-manifest.json','utf8'));
const siteMeta = JSON.parse(await readFile('docs/site-meta.json','utf8'));
const stateDefinition = JSON.parse(await readFile('docs/command-state.json','utf8'));
const builtStateDefinition = JSON.parse(await readFile('dist/command-state.json','utf8'));
const acceptanceRegistry = JSON.parse(await readFile('docs/acceptance-ids.json','utf8'));
const builtAcceptanceRegistry = JSON.parse(await readFile('dist/acceptance-ids.json','utf8'));
const supportingDocs = ['platform-constraints.md','angelfleetprd-threat-model.md'];
const searchData = JSON.parse(html.match(/<script id="search-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1] ?? 'null');
const bodyChapterCount = (source.match(/^# \d+\./gm) || []).length;
const appendixCount = (source.match(/^# 附录 [A-E]/gm) || []).length;
assert.equal(manifest.chapters.length,bodyChapterCount + appendixCount,'Manifest chapter count must follow source headings');
assert.equal(manifest.bodyChapters,bodyChapterCount,'Manifest body chapter count must follow source headings');
assert.equal(manifest.appendices,appendixCount,'Manifest appendix count must follow source headings');
assert.equal(manifest.sourceSha256,createHash('sha256').update(source).digest('hex'),'Build does not match current source');
assert.equal(await readFile('dist/technical-plan.md','utf8'),source,'Download must match repository source');
assert.equal(await readFile('dist/operation-ledger.md','utf8'),await readFile('docs/operation-ledger.md','utf8'),'Operation ledger download must match repository source');
for (const document of supportingDocs) assert.equal(await readFile(`dist/${document}`,'utf8'),await readFile(`docs/${document}`,'utf8'),`${document} download must match repository source`);
assert.deepEqual(builtStateDefinition,stateDefinition,'Command state fixture must match repository source');
assert.deepEqual(builtAcceptanceRegistry,acceptanceRegistry,'Acceptance ID registry must match repository source');
assert.equal(await readFile('dist/404.html','utf8'),html,'404 page must use the generated document shell');
await stat('dist/assets/og-card.svg');
assert((await readFile('dist/robots.txt','utf8')).includes('Sitemap: https://xcangelwatch.github.io/AngelFleetPRD/sitemap.xml'),'robots.txt must advertise sitemap');
assert((await readFile('dist/sitemap.xml','utf8')).includes('<loc>https://xcangelwatch.github.io/AngelFleetPRD/</loc>'),'sitemap must include canonical site');
assert(source.includes(`设计版本 ${siteMeta.version} · 审查基线 ${siteMeta.baselineDate}`),'Document header must use site metadata values');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate element IDs');
for (const [,hash] of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(hash),`Missing anchor: ${hash}`);
for (const [,path] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
  if (/^(https?:|mailto:)/.test(path)) continue;
  await stat(`dist/${path}`);
}
assert(!/\/Volumes\/|\/Users\/|visualize:|page_c8db|chatgpt\.com\/space/.test(source+html),'Private source reference was published');
assert(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source+html),'Credential-like content detected');
for (const required of ['XCtechResource','core/agent','72h','UNCERTAIN','REVIEW_REQUIRED','REQ10','REQ11','REQ12','DEV08','CAP-01','NET','maxAuthorizationStaleness','managementMode','max_batch_timeout','参数冻结表','可选系统 OTA']) assert(source.includes(required),`Required topic missing: ${required}`);
assert.equal(manifest.diagrams,manifest.diagramSources,'Manifest diagram count must match Mermaid sources');
assert(manifest.diagrams >= 8,'Expected the baseline diagrams plus the public flow diagrams');
assert.equal(manifest.searchRecords,searchData.length,'Search manifest count must match embedded index');
assert.equal(manifest.acceptanceIds,Object.keys(acceptanceRegistry.ids).length,'Manifest acceptance ID count must match registry');
assert.deepEqual(manifest.supportingDocs,supportingDocs,'Manifest supporting documents must match the publication set');
assert(searchData.every(record => ids.includes(record.id)),'Search index contains an unknown anchor');
const diagramBlocks = [...source.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)].map(match => match[1].trim());
assert.equal(diagramBlocks.length,manifest.diagramSources,'Every Mermaid source must be counted');
assert(diagramBlocks.every(block => /^(flowchart|sequenceDiagram|stateDiagram-v2|erDiagram)\b/.test(block)),'Mermaid sources must declare a supported diagram type');
const stateBlock = diagramBlocks.find(block => block.startsWith('stateDiagram-v2')) ?? '';
const stateEdges = [...stateBlock.matchAll(/^\s*([A-Z_*]+) --> ([A-Z_*]+):/gm)].map(([,from,to]) => `${from}->${to}`).sort();
const fixtureEdges = stateDefinition.transitions.map(({from,to}) => `${from}->${to}`).sort();
assert.deepEqual(stateEdges,fixtureEdges,'State diagram must match command-state.json');
const tableGroups = [];
let table = [];
let inFence = false;
for (const line of source.split('\n')) {
  if (/^```/.test(line.trim())) { inFence = !inFence; if (inFence && table.length) { tableGroups.push(table); table=[]; } continue; }
  if (!inFence && /^\s*\|/.test(line)) table.push(line);
  else if (table.length) { tableGroups.push(table); table=[]; }
}
if (table.length) tableGroups.push(table);
for (const rows of tableGroups) {
  const widths = rows.map(row => row.trim().replace(/^\||\|$/g,'').split('|').length);
  assert(widths.every(width => width === widths[0]),`Markdown table column mismatch: ${rows[0]}`);
}
const reqNumbers = [...new Set([...source.matchAll(/\bREQ(\d{2})\b/g)].map(([,number]) => Number(number)))].sort((a,b) => a-b);
assert.deepEqual(reqNumbers,Array.from({length:12},(_,index) => index+1),'REQ identifiers must be continuous from REQ01 to REQ12');
assert.equal(acceptanceRegistry.schemaVersion,1,'Acceptance registry schema version must be supported');
assert.equal(acceptanceRegistry.documentVersion,siteMeta.version,'Acceptance registry version must match site metadata');
assert(source.includes('异常与竞争事件索引') && source.includes('command-state.json') && source.includes('唯一机器可读权威'),'State transition authority must be explicit');
assert(source.includes('IDEMPOTENCY_KEY_EXPIRED') && source.includes('IDEMPOTENCY_INTENT_MISMATCH'),'Idempotency mismatch outcomes must be explicit');
assert(source.includes('cancel_ineffective') && !source.match(/cancel_intent[^\n]*INEFFECTIVE/),'Cancellation ineffectiveness must have one persistence representation');
assert(/resource_version\s+TEXT NOT NULL/.test(source),'commands schema must persist resource_version');
assert(/last_error\s+TEXT/.test(source),'outbox schema must persist last_error');
const logicalSchemaRows = Object.fromEntries([...source.matchAll(/^\| (tenant_members|nodes|enrollments|commands|idempotency_receipts|outbox|command_events|terminal_sessions|artifacts|audit_events) \| ([^\n]+) \|$/gm)].map(([,table,fields]) => [table,fields.split('；')[0]]));
const sqlSchema = Object.fromEntries([...source.matchAll(/CREATE TABLE ([a-z_]+) \(([\s\S]*?)\n\);/g)].map(([,table,body]) => [table,new Set(body.split('\n').map(line => line.trim().match(/^([a-z_][a-z0-9_]*)\s+/)?.[1]).filter(Boolean))]));
const schemaAliases = {evidenceRefs:'evidence_refs_json',capabilities:'capabilities_json',eventJson:'event_json'};
const toSqlName = field => schemaAliases[field] ?? field.replace(/[A-Z]/g,letter => `_${letter.toLowerCase()}`);
for (const [table,fieldText] of Object.entries(logicalSchemaRows)) {
  if (!sqlSchema[table]) continue;
  for (const field of fieldText.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []) assert(sqlSchema[table].has(toSqlName(field)),`A.4 field ${table}.${field} is missing from C.1 SQL`);
}
const registrySection = source.split('## C.2 operation registry 初始示例')[1]?.split('## C.3')[0] ?? '';
const registryOperations = [...registrySection.matchAll(/^\| ([a-z][\w.]+) \|/gm)].map(([,operation]) => operation).filter(operation => operation !== 'operation').sort();
const ledger = await readFile('docs/operation-ledger.md','utf8');
const ledgerOperations = [...ledger.matchAll(/^\| `([a-z][\w.]+)` \|/gm)].map(([,operation]) => operation).sort();
assert.deepEqual(ledgerOperations,registryOperations,'Operation ledger must match C.2 registry');
const acceptanceIds = Object.keys(acceptanceRegistry.ids).sort();
assert(acceptanceIds.length > 0,'Acceptance ID registry must not be empty');
assert.equal(new Set(acceptanceIds).size,acceptanceIds.length,'Acceptance ID registry contains duplicate IDs');
const acceptanceIdSet = new Set(acceptanceIds);
const referencedAcceptanceIds = new Set((source.match(/\b(?:AC|FI|CAP|NET)-[A-Z0-9]+\b|\bP6-AC\b|\bDEV0[1-8]\b/g) || []));
for (const id of referencedAcceptanceIds) assert(acceptanceIdSet.has(id),`Acceptance ID is not registered: ${id}`);
for (const id of acceptanceIds) if (acceptanceRegistry.ids[id].requiredUsage !== false) assert(referencedAcceptanceIds.has(id),`Registered acceptance ID is not referenced: ${id}`);
const externalUrls = [...source.matchAll(/https:\/\/[^)\s]+/g)].map(match => match[0]);
assert(externalUrls.length > 100 && externalUrls.every(url => { try { return new URL(url).protocol === 'https:'; } catch { return false; } }),'External references must be valid HTTPS URLs');
assert(html.includes(`v${manifest.version}`));
assert(html.includes(manifest.status));
assert(html.includes(manifest.baselineDate) && html.includes(manifest.publicationDate));
assert(html.includes('property="og:image"') && html.includes('name="twitter:card"'));
assert(html.includes('lang="zh-CN"'));
assert(!/(?:href|src)="(?:http:\/\/(?:localhost|127\.0\.0\.1)|\/src\/)/.test(html),'Preview-only resource URL was published');
console.log(`Verified source fidelity, ${manifest.chapters.length} chapters, ${ids.length} unique anchors, local assets, public references and required scope.`);
