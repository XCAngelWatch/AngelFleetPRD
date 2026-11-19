import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';

const manifest = JSON.parse(await readFile('dist/build-manifest.json','utf8'));
const siteMeta = JSON.parse(await readFile('docs/site-meta.json','utf8'));
const stateDefinition = JSON.parse(await readFile('docs/command-state.json','utf8'));
const builtStateDefinition = JSON.parse(await readFile('dist/command-state.json','utf8'));
const acceptanceRegistry = JSON.parse(await readFile('docs/acceptance-ids.json','utf8'));
const builtAcceptanceRegistry = JSON.parse(await readFile('dist/acceptance-ids.json','utf8'));
const sampleFiles = ['examples/go-agent-first-sample.json', 'examples/node-metric-read.v1.json'];
const supportingDocs = ['command-state.json', 'acceptance-ids.json', ...sampleFiles];
const site = 'https://xcangelwatch.github.io/AngelFleetPRD/';
const primaryPages = ['product-prd.html', 'technical-design.html', 'go-agent-interface-contract.html', 'operation-ledger.html', 'engineering-roadmap.html'];
const expectedDownloads = {
  'product-prd.html': 'product-prd.md',
  'technical-design.html': 'technical-design.md',
  'engineering-roadmap.html': 'engineering-roadmap.md',
  'technical-plan.html': 'technical-plan.md',
  'go-agent-interface-contract.html': 'go-agent-interface-contract.md',
  'go-agent-development-plan.html': 'go-agent-development-plan.md',
  'operation-ledger.html': 'operation-ledger.md',
  'review-2026-11-19.html': 'reviews/2026-11-19-online-audit.md',
  'platform-constraints.html': 'platform-constraints.md',
  'threat-model.html': 'angelfleetprd-threat-model.md',
  'implementation-review.html': 'spaces/implementation-review.md'
};
assert.deepEqual(manifest.primaryPages, primaryPages, 'Primary documents must follow the product, design and delivery reading order');
assert.deepEqual(manifest.readingPages.map(page => page.file).sort(), Object.keys(expectedDownloads).sort(), 'Unexpected publication routes');
const pages = await Promise.all(manifest.readingPages.map(async stats => {
  const {file, markdown: download} = stats;
  assert.equal(download, expectedDownloads[file], `Wrong source in manifest for ${file}`);
  const [source,html,downloaded] = await Promise.all([
    readFile(`docs/${download}`, 'utf8'), readFile(`dist/${file}`, 'utf8'), readFile(`dist/${download}`, 'utf8')
  ]);
  assert.equal(downloaded,source,`Download must match repository source for ${file}`);
  assert.equal(stats.sourceSha256,createHash('sha256').update(source).digest('hex'),`Outdated build of ${file}`);
  return {file, download, source, html, stats, canonical: site + file};
}));
const byFile = new Map(pages.map(page => [page.file, page]));
const {source} = byFile.get('technical-plan.html');
const home = {file: 'index.html', canonical: site, html: await readFile('dist/index.html', 'utf8')};
const publicationPages = [home, ...pages];
const contractHtml = byFile.get('go-agent-interface-contract.html').html;
const formerMap = await readFile('dist/1panel-feature-map.html', 'utf8');
const product = byFile.get('product-prd.html');
const mapSource = product.source.split('\n## 本期功能导图\n')[1]?.split('\n## ')[0] ?? '';
const featureDomains = [...mapSource.matchAll(/^#### (.+)$/gm)].map(match => match[1]);
const markdownSources = pages.map(page => page.source).join('\n\n');
function readSearchData(document) {
  return JSON.parse(document.match(/<script id="search-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1] ?? 'null');
}
const searchData = readSearchData(home.html);
assert(Array.isArray(searchData),'Expected a site-wide search index');
assert(featureDomains.length > 0, 'Missing scoped feature domains');
{
  const page = product;
  const targets = new Map(searchData.filter(record => record.page === page.file).map(record => [record.id, record.title]));
  const phases = [...page.html.matchAll(/<section class="feature-phase" data-phase="([^"]+)"/g)].map(match => match[1]);
  const domains = [...page.html.matchAll(/<details class="feature-domain"><summary id="([^"]+)">/g)].map(match => targets.get(match[1]));
  assert.deepEqual(phases, ['m1', 'follow', 'core', 'ops'], `Incorrect phase order in ${page.file}`);
  assert.deepEqual(domains, featureDomains, `Incorrect interactive feature list in ${page.file}`);
}
const featureMoves = JSON.parse(formerMap.match(/<script id="moved-sections" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.equal(featureMoves['1panel-上游功能'], 'product-prd.html#本期功能导图', 'Old map bookmark must reach the PRD');
assert(!formerMap.includes('class="feature-tree"') && !searchData.some(entry => entry.page === '1panel-feature-map.html'), 'The retired route must not republish the map');
assert.equal(manifest.sourceSha256,createHash('sha256').update(source).digest('hex'),'Build does not match current source');
const markdown = new MarkdownIt();
for (const page of pages) {
  const tokens = markdown.parse(page.source, {});
  const headings = tokens.flatMap((token, i) => token.type === 'heading_open' ? [{tag: token.tag, title: tokens[i + 1].content}] : []);
  assert.equal(headings.shift()?.tag, 'h1', `Missing document title in ${page.file}`);
  const chapterTag = headings.some(heading => heading.tag === 'h1') ? 'h1' : 'h2';
  const chapters = headings.filter(heading => heading.tag === chapterTag).map(heading => heading.title);
  assert(chapters.length > 0,`Missing chapters in ${page.file}`);
  assert.deepEqual(page.stats.chapters.map(chapter => chapter.title),chapters,`Chapter mismatch in ${page.file}`);
  assert.equal(page.stats.diagrams,(page.source.match(/^```mermaid$/gm) || []).length,`Diagram count mismatch in ${page.file}`);
}
const appendixCount = manifest.chapters.filter(chapter => chapter.title.startsWith('附录')).length;
assert.equal(manifest.bodyChapters, manifest.chapters.length - appendixCount, 'Incorrect body chapter count');
assert.equal(manifest.appendices, appendixCount, 'Incorrect appendix count');
for (const [file, stats] of [['technical-plan.html',manifest],['technical-design.html',manifest.technicalDesign],['go-agent-interface-contract.html',manifest.goAgentContract]]) {
  const published = byFile.get(file).stats;
  assert.equal(stats.sourceSha256, published.sourceSha256, `Manifest source mismatch for ${file}`);
  assert.deepEqual(stats.chapters, published.chapters, `Manifest chapters mismatch for ${file}`);
  assert.equal(stats.diagrams, published.diagrams, `Manifest diagrams mismatch for ${file}`);
}
for (const document of supportingDocs) assert.equal(await readFile(`dist/${document}`,'utf8'),await readFile(`docs/${document}`,'utf8'),`${document} download must match repository source`);
const sampleTexts = await Promise.all(sampleFiles.map(async file => {
  const sample = await readFile(`dist/${file}`, 'utf8');
  JSON.parse(sample);
  assert(contractHtml.match(/<a\b[^>]*>/g).some(link => link.includes(`href="${file}"`) && /\bdownload\b/.test(link)), `Contract must link to downloadable ${file}`);
  return sample;
}));
assert.deepEqual(builtStateDefinition,stateDefinition,'Command state fixture must match repository source');
assert.deepEqual(builtAcceptanceRegistry,acceptanceRegistry,'Acceptance ID registry must match repository source');
assert.equal(await readFile('dist/404.html','utf8'),home.html,'404 page must use the generated document index');
await stat('dist/assets/og-card.svg');
assert((await readFile('dist/robots.txt','utf8')).includes('Sitemap: https://xcangelwatch.github.io/AngelFleetPRD/sitemap.xml'),'robots.txt must advertise sitemap');
const sitemap = await readFile('dist/sitemap.xml','utf8');
assert.equal(manifest.version, siteMeta.version, 'Manifest must use the current design version');
assert.equal(manifest.status, siteMeta.status, 'Manifest must use the current publication status');
const pageIds = new Map();
for (const page of publicationPages) {
  assert.deepEqual(readSearchData(page.html),searchData,`Site-wide search index mismatch in ${page.file}`);
  const ids = [...page.html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const unique = new Set(ids);
  assert.equal(ids.length,unique.size,`Duplicate element IDs in ${page.file}`);
  pageIds.set(page.file,unique);
}
function destination(link) {
  return link.match(/\bhref="([^"]+)"/)?.[1];
}
for (const page of pages) {
  const switcher = page.html.match(/<nav\b[^>]*class="[^"]*\bpage-nav\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  const links = switcher.match(/<a\b[^>]*>/g) ?? [];
  assert.deepEqual(links.map(destination), primaryPages, `Primary navigation on ${page.file}`);
  const current = links.filter(link => link.includes('aria-current="page"')).map(destination);
  assert.deepEqual(current, primaryPages.filter(file => file === page.file), `Incorrect current primary document on ${page.file}`);
}
const directory = home.html.match(/<section\b[^>]*id="guides"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
const mainLinks = directory.match(/<a\b[^>]*class="guide-main"[^>]*>/g) ?? [];
assert.deepEqual(mainLinks.map(destination), primaryPages, 'The homepage directory must lead with the current topic documents');
const topicGroups = [...directory.matchAll(/<nav class="guide-topics"[^>]*>([\s\S]*?)<\/nav>/g)];
assert.equal(topicGroups.length, primaryPages.length, 'Each primary document must have chapter shortcuts');
for (const [i, [,group]] of topicGroups.entries()) {
  const links = (group.match(/<a\b[^>]*>/g) ?? []).map(destination);
  assert(links.length && links.every(link => link.startsWith(primaryPages[i] + '#')), 'Homepage shortcuts must open their associated primary document');
}
const archive = directory.match(/<details class="home-sources">([\s\S]*?)<\/details>/)?.[1] ?? '';
const referenceLinks = (archive.match(/<a\b[^>]*>/g) ?? []).map(destination);
assert.deepEqual(referenceLinks.sort(), Object.keys(expectedDownloads).filter(file => !primaryPages.includes(file)).sort(), 'Each reference must remain accessible in the source directory');
for (const page of publicationPages) {
  assert(sitemap.includes(`<loc>${page.canonical}</loc>`),`Sitemap missing ${page.file}`);
  assert(page.html.includes(`rel="canonical" href="${page.canonical}"`),`Incorrect canonical URL for ${page.file}`);
  const rendered = page.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  assert(rendered.includes(manifest.version) && rendered.includes(manifest.status), `Publication version and status must appear on ${page.file}`);
  assert(rendered.includes('property="og:image"') && rendered.includes('name="twitter:card"'), `Missing sharing metadata on ${page.file}`);
  assert(rendered.includes('lang="zh-CN"'), `Missing page language on ${page.file}`);
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
  for (const peer of publicationPages) assert(linkedFiles.has(peer.file),`Missing navigation from ${page.file} to ${peer.file}`);
  for (const path of linkedFiles) await stat(`dist/${path}`);
  const moved = JSON.parse(page.html.match(/<script id="moved-sections" type="application\/json">([\s\S]*?)<\/script>/)?.[1] ?? '{}');
  for (const [oldId, target] of Object.entries(moved)) {
    const url = new URL(target, site + page.file);
    const file = url.pathname.slice(new URL(site).pathname.length) || 'index.html';
    const fragment = decodeURIComponent(url.hash.slice(1));
    assert(url.href.startsWith(site) && pageIds.has(file) && (!fragment || pageIds.get(file).has(fragment)), `Invalid moved section on ${page.file}#${oldId}: ${target}`);
  }
  if (page === home) continue;
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
  ['product-prd.html', ['technical-design.html','engineering-roadmap.html','implementation-review.html']],
  ['technical-design.html', ['product-prd.html','engineering-roadmap.html','technical-plan.html']],
  ['engineering-roadmap.html', ['product-prd.html','technical-design.html','implementation-review.html']],
  ['go-agent-interface-contract.html', ['engineering-roadmap.html','implementation-review.html']],
  ['operation-ledger.html', ['technical-design.html','engineering-roadmap.html','implementation-review.html']],
  ['implementation-review.html', ['go-agent-development-plan.html']]
]) {
  const article = byFile.get(file).html.match(/<div class="intro">([\s\S]*?)<footer class="document-footer">/)?.[1];
  assert(article,`Missing document body in ${file}`);
  const destinations = new Set([...article.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(([,href]) => {
    const target = new URL(href, site + file);
    return target.href.split('#')[0];
  }));
  for (const peer of peers) {
    assert(destinations.has(site + peer),`Missing reading link in the text of ${file}: ${peer}`);
  }
}
const development = byFile.get('go-agent-development-plan.html');
const roadmap = byFile.get('engineering-roadmap.html');
const counts = {GA:11, FOLLOW:7, CORE:8, OPS:9};
function numberedIds(group, count, first = 1) {
  return Array.from({length:count}, (_, i) => group + '-' + String(first + i).padStart(2, '0'));
}
const currentIds = Object.entries(counts).flatMap(([group,count]) => numberedIds(group, count));
const retiredIds = numberedIds('GA', 8, 12);
const groupRoles = ['Go','控制台','测试'];

// Read Markdown tables, preserving cells with escaped separators or inline formatting.
function planningTables(source) {
  const tables = [];
  let table, row;
  for (const token of markdown.parse(source, {})) {
    if (token.type === 'table_open') { table = []; tables.push(table); }
    if (token.type === 'tr_open') { row = []; table.push(row); }
    if (token.type === 'inline' && row) row.push(token.content);
    if (token.type === 'tr_close') row = undefined;
  }
  return tables;
}
const planTables = planningTables(roadmap.source);
const rowsWith = (tables, header) => tables.filter(([columns]) => columns.includes(header)).flatMap(([, ...rows]) => rows);
const m1Rows = rowsWith(planTables, '工单、主责与人日');
const newPackages = rowsWith(planTables, '工单 · 人日');
const writeRows = rowsWith(planTables, 'GA-11 主责');
const historicalRows = rowsWith(planningTables(development.source), '历史工单');
const taskCode = label => label.match(/^(?:GA|FOLLOW|CORE|OPS)-\d+\b/)?.[0];
const dispatchIds = [...m1Rows, ...newPackages].map(([,label]) => taskCode(label));
assert.deepEqual([...dispatchIds, 'GA-11'].sort(), [...currentIds].sort(), 'Expected one dispatch item per current task');
assert.deepEqual(historicalRows.map(([label]) => taskCode(label)).sort(), retiredIds, 'The archive must contain GA-12 to GA-19');
assert(!searchData.some(record => record.page === development.file && currentIds.includes(record.id.toUpperCase())), 'Current tasks must only be indexed on the primary roadmap');
for (const [page,ids] of [[roadmap,currentIds],[development,retiredIds]]) {
  for (const id of ids) assert(searchData.some(record => record.page === page.file && record.id === id.toLowerCase()), `Missing task entry in ${page.file}: ${id}`);
}

const gantt = roadmap.html.match(/<table class="gantt-table">([\s\S]*?)<\/table>/)?.[1];
assert(gantt && !development.html.includes('<table class="gantt-table">'), 'Only the primary roadmap should publish the Gantt chart');
for (const id of numberedIds('GA', 9, 2)) assert(gantt.includes('href="#' + id.toLowerCase() + '"'), `Missing Gantt link for ${id}`);

const dependencies = new Map();
function recordDependencies(id, text, allowed) {
  assert(text.trim(), `Missing prerequisites for ${id}`);
  const refs = new Set(text.match(/(?:GA|FOLLOW|CORE|OPS)-\d+/g) ?? []);
  for (const [,group,first,last] of text.matchAll(/(GA|FOLLOW|CORE|OPS)-(\d+)\s*至\s*\1-(\d+)/g)) {
    assert(Number(first) <= Number(last), `Reversed dependency range for ${id}`);
    for (const ref of numberedIds(group, Number(last) - Number(first) + 1, Number(first))) refs.add(ref);
  }
  for (const ref of refs) assert(allowed.includes(ref), `Unknown or out-of-scope prerequisite for ${id}: ${ref}`);
  dependencies.set(id, refs);
}
for (const [,label,prerequisites,delivery] of [...m1Rows, ...newPackages]) {
  assert(delivery?.trim(), `Missing delivery criteria: ${label}`);
  recordDependencies(taskCode(label), prerequisites, currentIds);
}
recordDependencies('GA-11', writeRows.map(([, ,prerequisites]) => prerequisites).join(' '), currentIds);
for (const [label,prerequisites] of historicalRows) recordDependencies(taskCode(label), prerequisites, [...currentIds, ...retiredIds]);
const resolved = new Set();
while (resolved.size < dependencies.size) {
  const ready = [...dependencies].filter(([id,refs]) => !resolved.has(id) && [...refs].every(ref => resolved.has(ref)));
  assert(ready.length, 'Roadmap dependencies contain a cycle');
  for (const [id] of ready) resolved.add(id);
}
assert.equal(dependencies.get('GA-02').size, 0, 'Environment setup may begin on D1');
assert.deepEqual(dependencies.get('GA-10'), new Set(numberedIds('GA', 8, 2)), 'GA-10 must include all M1 prerequisites');

function effortRange(cell, label) {
  const match = /^(\d+)(?:\s*[–-]\s*(\d+))?$/.exec(cell.replaceAll('**', '').trim());
  assert(match, `Invalid person-day estimate for ${label}: ${cell}`);
  const low = Number(match[1]), high = Number(match[2] ?? match[1]);
  assert(Number.isSafeInteger(low) && Number.isSafeInteger(high) && low <= high, `Invalid estimate bounds for ${label}`);
  return [low,high];
}
function sumEffort(ranges) {
  return ranges.reduce(([a,b], [low,high]) => [a + low, b + high], [0,0]);
}
const roleRows = rowsWith(planTables, 'Go · 人日与交付物');
const packageIds = currentIds.filter(id => !id.startsWith('GA-'));
assert.deepEqual(roleRows.map(([id]) => id).sort(), [...packageIds].sort(), 'Each migration task needs exactly one role breakdown');
const assigned = new Map();
for (const [id,...cells] of roleRows) {
  assert.equal(cells.length, groupRoles.length, `Missing role assignment for ${id}`);
  const ranges = cells.map((cell,index) => {
    const parts = cell.match(/^(.+?)\s*·\s*(.+)$/);
    assert(parts, `Expected an estimate and deliverable for ${id} ${groupRoles[index]}`);
    return effortRange(parts[1], id);
  });
  assigned.set(id, ranges);
}
for (const [,label,,,permission] of newPackages) {
  assert(permission?.trim(), `Missing role and target scope for ${label}`);
  assert.deepEqual(effortRange(label.split('·').at(-1), label), sumEffort(assigned.get(taskCode(label))), `Role effort mismatch for ${label}`);
}

const m1RoleEffort = new Map(groupRoles.map(role => [role,[]]));
for (const [,label] of m1Rows.filter(([,label]) => taskCode(label) !== 'GA-01')) {
  const match = label.match(/·\s*(Go|控制面|前端|测试)[^\d]*(\d+(?:\s*[–-]\s*\d+)?)\s*(?:人日)?$/);
  assert(match, `Missing role estimate for ${label}`);
  const role = ['控制面','前端'].includes(match[1]) ? '控制台' : match[1];
  m1RoleEffort.get(role).push(effortRange(match[2], label));
}
const writeRoleEffort = new Map(writeRows.map(([label,estimate]) => [label.startsWith('控制面') ? '控制台' : label, effortRange(estimate, 'GA-11')]));
assert.deepEqual([...writeRoleEffort.keys()].sort(), [...groupRoles].sort(), 'GA-11 needs estimates for three roles');
const batches = new Map([
  ['GA-02', groupRoles.map(role => sumEffort(m1RoleEffort.get(role)))],
  ['GA-11', groupRoles.map(role => writeRoleEffort.get(role))]
]);
for (const group of ['FOLLOW','CORE','OPS']) {
  const tasks = numberedIds(group, counts[group]);
  batches.set(tasks[0], groupRoles.map((_,i) => sumEffort(tasks.map(id => assigned.get(id)[i]))));
}
const budget = rowsWith(planTables, '合计人日');
function confirmBudget(rows, byRole, label) {
  assert.equal(rows.length, 1, `Expected one budget row for ${label}`);
  const actual = rows[0].slice(1,5).map(cell => effortRange(cell, label));
  assert.deepEqual(actual, [...byRole, sumEffort(byRole)], `Task and role estimates must reconcile for ${label}`);
}
for (const [id,byRole] of batches) confirmBudget(budget.filter(([label]) => label.includes(id)), byRole, id);
const allRoles = groupRoles.map((_,i) => sumEffort([...batches.values()].map(batch => batch[i])));
confirmBudget(budget.filter(([label]) => label.includes('剩余合计')), allRoles, 'all selected work');

const pageContents = publicationPages.map(page => page.html).join('\n');
const publication = markdownSources + pageContents + sampleTexts.join('\n');
assert(!/\/Volumes\/|\/Users\/|visualize:|page_c8db|chatgpt\.com\/space/.test(publication),'Private source reference was published');
assert(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(publication),'Credential-like content detected');
for (const required of ['AngelFleetConsole','core/agent','UNCERTAIN','REVIEW_REQUIRED','REQ10','REQ11','REQ12','DEV08','CAP-01','NET','maxAuthorizationStaleness','managementMode','executionPrincipal','startGrant','first-primary','evidenceHandoff','synchronous=FULL','max_batch_timeout','OTA','Yocto']) assert(markdownSources.includes(required),`Required topic missing: ${required}`);
assert(/72\s*(?:h|小时)/i.test(markdownSources) && /冻结.{0,10}(?:阈值|参数)|(?:阈值|参数).{0,10}冻结/.test(markdownSources), 'Capacity acceptance must retain its endurance window and parameter freeze');
assert.equal(manifest.diagrams,manifest.diagramSources,'Manifest diagram count must match Mermaid sources');
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
for (const diagramType of ['flowchart','sequenceDiagram','stateDiagram-v2','erDiagram']) {
  assert(diagramBlocks.some(block => block.startsWith(diagramType)), `Missing ${diagramType} reference diagram`);
}
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
assert(/command-state\.json[^\n]{0,160}(?:权威|唯一)|(?:权威|唯一)[^\n]{0,160}command-state\.json/.test(source), 'State transition authority must be explicit');
assert(source.includes('IDEMPOTENCY_KEY_EXPIRED') && source.includes('IDEMPOTENCY_INTENT_MISMATCH'),'Idempotency mismatch outcomes must be explicit');
assert(source.includes('cancel_ineffective') && !source.match(/cancel_intent[^\n]*INEFFECTIVE/),'Cancellation ineffectiveness must have one persistence representation');
assert(/resource_version\s+TEXT NOT NULL/.test(source),'commands schema must persist resource_version');
assert(source.includes("side_effect_extent IN ('NONE', 'PARTIAL', 'FULL', 'UNKNOWN')"),'commands schema must represent unknown side effects');
assert(/last_error\s+TEXT/.test(source),'outbox schema must persist last_error');
const logicalSchemaRows = Object.fromEntries([...source.matchAll(/^\| (tenant_members|nodes|enrollments|commands|command_start_grants|idempotency_receipts|outbox|command_events|terminal_sessions|artifacts|audit_events) \| ([^\n]+) \|$/gm)].map(([,table,fields]) => [table,fields.split('；')[0]]));
const sqlSchema = Object.fromEntries([...source.matchAll(/CREATE TABLE ([a-z_]+) \(([\s\S]*?)\n\);/g)].map(([,table,body]) => [table,new Set(body.split('\n').map(line => line.trim().match(/^([a-z_][a-z0-9_]*)\s+/)?.[1]).filter(Boolean))]));
const schemaAliases = {evidenceRefs:'evidence_refs_json',capabilities:'capabilities_json',eventJson:'event_json',resolvedResource:'resolved_resource_json'};
const toSqlName = field => schemaAliases[field] ?? field.replace(/[A-Z]/g,letter => `_${letter.toLowerCase()}`);
for (const [table,fieldText] of Object.entries(logicalSchemaRows)) {
  if (!sqlSchema[table]) continue;
  for (const field of fieldText.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []) assert(sqlSchema[table].has(toSqlName(field)),`A.4 field ${table}.${field} is missing from C.1 SQL`);
}
const registrySection = byFile.get('operation-ledger.html').source.split('## 操作登记与执行边界')[1]?.split(/^## /m)[0] ?? '';
const operations = rowsWith(planningTables(registrySection), '操作与许可');
const requiredPermissions = {
  'node.inspect':'node.read', 'container.ensure':'container.manage', 'file.install':'file.write',
  'backup.restore':'backup.restore', 'host.reboot':'host.reboot', 'disk.format':'disk.destructive',
  'terminal.open':'terminal.open', 'service.restart':'service.manage'
};
assert.deepEqual(operations.map(([label]) => label.split('`')[1]).sort(), Object.keys(requiredPermissions).sort(), 'Every registered operation must have exactly one primary definition');
for (const [label, guard, recovery] of operations) {
  const [, operation, role, permission] = label.split('`');
  assert(role.trim() && permission === requiredPermissions[operation] && guard && recovery, `Missing permission, guard or recovery for ${operation}`);
}
assert(!/^\| (?:`)?node\.inspect(?:`)? \|/m.test(source), 'The technical appendix must not retain the operation registry');
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
const referencedAcceptanceIds = new Set([source, ...primaryPages.map(page => byFile.get(page).source)].join('\n').match(acceptancePattern) || []);
for (const id of new Set(markdownSources.match(acceptancePattern) || [])) assert(acceptanceIdSet.has(id),`Acceptance ID is not registered: ${id}`);
for (const id of acceptanceIds) if (acceptanceRegistry.ids[id].requiredUsage !== false) assert(referencedAcceptanceIds.has(id),`Registered acceptance ID is not referenced: ${id}`);
const externalUrls = [...markdownSources.matchAll(/https:\/\/[^)\s]+/g)].map(match => new URL(match[0]));
assert(externalUrls.every(url => url.protocol === 'https:'), 'External references must be valid HTTPS URLs');
for (const sourceRoot of ['https://developers.cloudflare.com/', 'https://github.com/1Panel-dev/1Panel/', 'https://github.com/XCAngelWatch/AngelFleetConsole/']) {
  assert(externalUrls.some(url => url.href.startsWith(sourceRoot)), `Missing primary references from ${sourceRoot}`);
}
assert(!/(?:href|src)="(?:http:\/\/(?:localhost|127\.0\.0\.1)|\/src\/)/.test(pageContents),'Preview-only resource URL was published');
const totalChapters = pages.reduce((count,page) => count + page.stats.chapters.length, 0);
console.log(`Verified ${pages.length} documents, ${totalChapters} chapters, ${searchData.length} search targets, local assets, public references and required scope.`);
