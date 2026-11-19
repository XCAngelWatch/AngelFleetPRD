import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const manifest = JSON.parse(await readFile('dist/build-manifest.json','utf8'));
const siteMeta = JSON.parse(await readFile('docs/site-meta.json','utf8'));
const stateDefinition = JSON.parse(await readFile('docs/command-state.json','utf8'));
const builtStateDefinition = JSON.parse(await readFile('dist/command-state.json','utf8'));
const acceptanceRegistry = JSON.parse(await readFile('docs/acceptance-ids.json','utf8'));
const builtAcceptanceRegistry = JSON.parse(await readFile('dist/acceptance-ids.json','utf8'));
const sampleFile = 'examples/go-agent-first-sample.json';
const supportingDocs = ['platform-constraints.md','angelfleetprd-threat-model.md','go-agent-development-plan.md','spaces/implementation-review.md',sampleFile];
const site = 'https://xcangelwatch.github.io/AngelFleetPRD/';
const expectedDownloads = {
  'index.html': 'technical-plan.md',
  'technical-design.html': 'technical-design.md',
  'go-agent-interface-contract.html': 'go-agent-interface-contract.md',
  'go-agent-development-plan.html': 'go-agent-development-plan.md',
  'operation-ledger.html': 'operation-ledger.md',
  'implementation-review.html': 'spaces/implementation-review.md'
};
assert.deepEqual(manifest.readingPages.map(page => page.file).sort(), Object.keys(expectedDownloads).sort(), 'Unexpected publication routes');
const pages = await Promise.all(manifest.readingPages.map(async stats => {
  const {file, markdown: download} = stats;
  assert.equal(download, expectedDownloads[file], `Wrong source in manifest for ${file}`);
  const [source,html,downloaded] = await Promise.all([
    readFile(`docs/${download}`, 'utf8'), readFile(`dist/${file}`, 'utf8'), readFile(`dist/${download}`, 'utf8')
  ]);
  assert.equal(downloaded,source,`Download must match repository source for ${file}`);
  assert.equal(stats.sourceSha256,createHash('sha256').update(source).digest('hex'),`Outdated build of ${file}`);
  return {file, download, source, html, stats, canonical: file === 'index.html' ? site : site + file};
}));
const byFile = new Map(pages.map(page => [page.file, page]));
const {source,html} = byFile.get('index.html');
const contractHtml = byFile.get('go-agent-interface-contract.html').html;
const markdownSources = pages.map(page => page.source).join('\n\n');
function readSearchData(document) {
  return JSON.parse(document.match(/<script id="search-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1] ?? 'null');
}
const searchData = readSearchData(html);
assert(Array.isArray(searchData),'Expected a site-wide search index');
const bodyChapterCount = (source.match(/^# \d+\./gm) || []).length;
const appendixCount = (source.match(/^# 附录 [A-E]/gm) || []).length;
assert.equal(manifest.chapters.length,bodyChapterCount + appendixCount,'Manifest chapter count must follow source headings');
assert.equal(manifest.bodyChapters,bodyChapterCount,'Manifest body chapter count must follow source headings');
assert.equal(manifest.appendices,appendixCount,'Manifest appendix count must follow source headings');
assert.equal(manifest.sourceSha256,createHash('sha256').update(source).digest('hex'),'Build does not match current source');
for (const page of pages) {
  const chapterPattern = ['index.html','technical-design.html','go-agent-interface-contract.html'].includes(page.file)
    ? /^# (\d+\..+|附录 [A-E] · .+)$/gm : /^## (.+)$/gm;
  const chapters = [...page.source.matchAll(chapterPattern)].map(match => match[1]);
  assert(chapters.length > 0,`Missing chapters in ${page.file}`);
  assert.deepEqual(page.stats.chapters.map(chapter => chapter.title),chapters,`Chapter mismatch in ${page.file}`);
  assert.equal(page.stats.diagrams,(page.source.match(/^```mermaid$/gm) || []).length,`Diagram count mismatch in ${page.file}`);
}
for (const [file, stats] of [['index.html',manifest],['technical-design.html',manifest.technicalDesign],['go-agent-interface-contract.html',manifest.goAgentContract]]) {
  const published = byFile.get(file).stats;
  assert.equal(stats.sourceSha256, published.sourceSha256, `Manifest source mismatch for ${file}`);
  assert.deepEqual(stats.chapters, published.chapters, `Manifest chapters mismatch for ${file}`);
  assert.equal(stats.diagrams, published.diagrams, `Manifest diagrams mismatch for ${file}`);
}
for (const document of supportingDocs) assert.equal(await readFile(`dist/${document}`,'utf8'),await readFile(`docs/${document}`,'utf8'),`${document} download must match repository source`);
const sampleText = await readFile(`dist/${sampleFile}`, 'utf8');
JSON.parse(sampleText);
assert(contractHtml.match(/<a\b[^>]*>/g).some(link => link.includes(`href="${sampleFile}"`) && /\bdownload\b/.test(link)),'Contract must link to the downloadable JSON examples');
assert.deepEqual(builtStateDefinition,stateDefinition,'Command state fixture must match repository source');
assert.deepEqual(builtAcceptanceRegistry,acceptanceRegistry,'Acceptance ID registry must match repository source');
assert.equal(await readFile('dist/404.html','utf8'),html,'404 page must use the generated document shell');
await stat('dist/assets/og-card.svg');
assert((await readFile('dist/robots.txt','utf8')).includes('Sitemap: https://xcangelwatch.github.io/AngelFleetPRD/sitemap.xml'),'robots.txt must advertise sitemap');
const sitemap = await readFile('dist/sitemap.xml','utf8');
assert(source.includes(`设计版本 ${siteMeta.version} · 实施状态：实施设计，待 P0–P6 分阶段验收`),'Document header must use site metadata version and final status');
const pageIds = new Map();
for (const page of pages) {
  assert.deepEqual(readSearchData(page.html),searchData,`Site-wide search index mismatch in ${page.file}`);
  const switcher = page.html.match(/<nav class="page-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  const destinations = [...switcher.matchAll(/<a href="([^"]+)"([^>]*)>/g)];
  assert.deepEqual(destinations.map(([,href]) => href).sort(), Object.keys(expectedDownloads).sort(), `Document switcher on ${page.file}`);
  assert.deepEqual(destinations.filter(([, ,attrs]) => attrs.includes('aria-current="page"')).map(([,href]) => href), [page.file], 'Expected exactly one current document');
  const ids = [...page.html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const unique = new Set(ids);
  assert.equal(ids.length,unique.size,`Duplicate element IDs in ${page.file}`);
  pageIds.set(page.file,unique);
}
for (const page of pages) {
  assert(sitemap.includes(`<loc>${page.canonical}</loc>`),`Sitemap missing ${page.file}`);
  assert(page.html.includes(`rel="canonical" href="${page.canonical}"`),`Incorrect canonical URL for ${page.file}`);
  const linkedFiles = new Set();
  for (const [,ref] of page.html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:)/.test(ref) && !ref.startsWith(site)) continue;
    const url = new URL(ref,site+page.file);
    assert(url.href.startsWith(site),`Link outside Pages deployment path in ${page.file}: ${ref}`);
    const target = decodeURIComponent(url.pathname.slice(new URL(site).pathname.length)) || 'index.html';
    linkedFiles.add(target);
    if (url.hash && pageIds.has(target)) {
      assert(pageIds.get(target).has(decodeURIComponent(url.hash.slice(1))),`Missing anchor in ${page.file}: ${ref}`);
    }
  }
  for (const peer of pages) assert(linkedFiles.has(peer.file),`Missing navigation from ${page.file} to ${peer.file}`);
  for (const path of linkedFiles) await stat(`dist/${path}`);
  const anchors = page.html.match(/<a\b[^>]*>/g) ?? [];
  assert(anchors.some(link => link.includes(`href="${page.download}"`) && /\bdownload\b/.test(link)),`Missing Markdown download on ${page.file}`);
  const pageRecords = searchData.filter(record => record.page === page.file);
  assert(pageRecords.every(record => record.label === page.stats.label),`Search label mismatch in ${page.file}`);
  const searchIds = new Set(pageRecords.map(record => record.id));
  assert(searchIds.has('top'),`Search is missing ${page.file}`);
  for (const chapter of page.stats.chapters) assert(searchIds.has(chapter.id),`Search is missing ${page.file}#${chapter.id}`);
}
// Check links in the actual planning and acceptance text independently of the shared navigation.
for (const [file, peers] of [
  ['go-agent-development-plan.html', ['index.html','technical-design.html','operation-ledger.html','implementation-review.html']],
  ['implementation-review.html', ['go-agent-development-plan.html']]
]) {
  const article = byFile.get(file).html.match(/<div class="intro">([\s\S]*?)<footer class="document-footer">/)?.[1];
  assert(article,`Missing document body in ${file}`);
  const destinations = new Set([...article.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(([,href]) => {
    const target = new URL(href, site + file);
    return target.href.split('#')[0];
  }));
  for (const peer of peers) {
    const linked = destinations.has(site + peer) || (peer === 'index.html' && destinations.has(site));
    assert(linked,`Missing reading link in the text of ${file}: ${peer}`);
  }
}
const development = byFile.get('go-agent-development-plan.html');
const taskRows = [...development.source.matchAll(/^\| (GA-\d+) [^|]+\| ([^|]+) \|/gm)];
const taskIds = taskRows.map(([,id]) => id);
const gaId = number => 'GA-' + String(number).padStart(2, '0');
assert.deepEqual(taskIds, Array.from({length:19}, (_, i) => gaId(i + 1)), 'Expected one dispatch row for each GA-01 through GA-19');
const dependencies = new Map(taskRows.map(([,id,prerequisites]) => {
  const refs = new Set(prerequisites.match(/GA-\d+/g) ?? []);
  for (const [,first,last] of prerequisites.matchAll(/GA-(\d+) 至 GA-(\d+)/g)) {
    assert(Number(first) <= Number(last), `Reversed dependency range for ${id}`);
    for (let n = Number(first); n <= Number(last); n++) refs.add(gaId(n));
  }
  for (const ref of refs) assert(taskIds.includes(ref), `Unknown prerequisite for ${id}: ${ref}`);
  return [id, refs];
}));
const resolved = new Set();
while (resolved.size < dependencies.size) {
  const ready = taskIds.filter(id => !resolved.has(id) && [...dependencies.get(id)].every(ref => resolved.has(ref)));
  assert(ready.length, 'Go Agent task dependencies contain a cycle');
  ready.forEach(id => resolved.add(id));
}
for (const taskId of taskIds) {
  const anchor = taskId.toLowerCase();
  assert(pageIds.get(development.file).has(anchor),`Missing shareable task anchor: ${taskId}`);
  assert(searchData.some(record => record.page === development.file && record.id === anchor),`Missing searchable task: ${taskId}`);
}
const pageContents = pages.map(page => page.html).join('\n');
const publication = markdownSources + pageContents + sampleText;
assert(!/\/Volumes\/|\/Users\/|visualize:|page_c8db|chatgpt\.com\/space/.test(publication),'Private source reference was published');
assert(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(publication),'Credential-like content detected');
for (const required of ['AngelFleetConsole','core/agent','72h','UNCERTAIN','REVIEW_REQUIRED','REQ10','REQ11','REQ12','DEV08','CAP-01','NET','maxAuthorizationStaleness','managementMode','max_batch_timeout','参数冻结表','可选系统 OTA']) assert(source.includes(required),`Required topic missing: ${required}`);
assert.equal(manifest.diagrams,manifest.diagramSources,'Manifest diagram count must match Mermaid sources');
assert(manifest.diagrams >= 8,'Expected the baseline diagrams plus the public flow diagrams');
assert.equal(manifest.searchRecords,searchData.length,'Search manifest count must match embedded index');
assert.equal(manifest.acceptanceIds,Object.keys(acceptanceRegistry.ids).length,'Manifest acceptance ID count must match registry');
assert.deepEqual(manifest.supportingDocs,supportingDocs,'Manifest supporting documents must match the publication set');
for (const record of searchData) {
  assert(pageIds.get(record.page)?.has(record.id),`Search target does not exist: ${record.page}#${record.id}`);
  assert(record.label && record.title && record.text,`Empty search entry: ${record.page}#${record.id}`);
}
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
for (const line of markdownSources.split('\n')) {
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
const ledger = byFile.get('operation-ledger.html').source;
const ledgerOperations = [...ledger.matchAll(/^\| `([a-z][\w.]+)` \|/gm)].map(([,operation]) => operation).sort();
assert.deepEqual(ledgerOperations,registryOperations,'Operation ledger must match C.2 registry');
const acceptanceIds = Object.keys(acceptanceRegistry.ids).sort();
assert(acceptanceIds.length > 0,'Acceptance ID registry must not be empty');
assert.equal(new Set(acceptanceIds).size,acceptanceIds.length,'Acceptance ID registry contains duplicate IDs');
const acceptanceIdSet = new Set(acceptanceIds);
const acceptancePattern = /\b(?:AC|FI|CAP|NET)-[A-Z0-9]+\b|\bP\d+-AC\b|\bDEV\d+\b/g;
const requirementMatrix = source.split('## D.3 ')[1]?.split(/^##? /m)[0] ?? '';
const mappedEvidence = new Set();
const requirementRows = [...requirementMatrix.matchAll(/^\| (REQ\d+) [^\n]+/gm)];
assert.deepEqual(requirementRows.map(([,id]) => id), reqNumbers.map(n => 'REQ' + String(n).padStart(2,'0')), 'The traceability matrix must cover every requirement once');
for (const [row, id] of requirementRows) {
  const evidenceColumn = row.trim().split('|').at(-2);
  const evidence = evidenceColumn.match(acceptancePattern) ?? [];
  assert(evidence.length, `Missing acceptance evidence in matrix row ${id}`);
  evidence.forEach(ref => mappedEvidence.add(ref));
}
for (const [id, entry] of Object.entries(acceptanceRegistry.ids)) {
  if (['AC','FI','CAP','NET'].includes(entry.family)) assert(mappedEvidence.has(id), `No requirement mapped to ${id} in D.3`);
}
const referencedAcceptanceIds = new Set(source.match(acceptancePattern) || []);
for (const id of new Set(markdownSources.match(acceptancePattern) || [])) assert(acceptanceIdSet.has(id),`Acceptance ID is not registered: ${id}`);
for (const id of acceptanceIds) if (acceptanceRegistry.ids[id].requiredUsage !== false) assert(referencedAcceptanceIds.has(id),`Registered acceptance ID is not referenced: ${id}`);
const externalUrls = [...source.matchAll(/https:\/\/[^)\s]+/g)].map(match => match[0]);
assert(externalUrls.length > 100 && externalUrls.every(url => { try { return new URL(url).protocol === 'https:'; } catch { return false; } }),'External references must be valid HTTPS URLs');
assert(html.includes(`v${manifest.version}`));
assert(html.includes(manifest.status));
assert(html.includes(`设计版本 ${manifest.version}`) && html.includes(manifest.status));
assert(html.includes('property="og:image"') && html.includes('name="twitter:card"'));
assert(html.includes('lang="zh-CN"'));
assert(!/(?:href|src)="(?:http:\/\/(?:localhost|127\.0\.0\.1)|\/src\/)/.test(pageContents),'Preview-only resource URL was published');
const totalChapters = pages.reduce((count,page) => count + page.stats.chapters.length, 0);
console.log(`Verified ${pages.length} documents, ${totalChapters} chapters, ${searchData.length} search targets, local assets, public references and required scope.`);
