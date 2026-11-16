import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const source = await readFile('docs/technical-plan.md','utf8');
const html = await readFile('dist/index.html','utf8');
const manifest = JSON.parse(await readFile('dist/build-manifest.json','utf8'));
const bodyChapterCount = (source.match(/^# \d+\./gm) || []).length;
const appendixCount = (source.match(/^# 附录 [A-E]/gm) || []).length;
assert.equal(manifest.chapters.length,bodyChapterCount + appendixCount,'Manifest chapter count must follow source headings');
assert.equal(manifest.bodyChapters,bodyChapterCount,'Manifest body chapter count must follow source headings');
assert.equal(manifest.appendices,appendixCount,'Manifest appendix count must follow source headings');
assert.equal(manifest.sourceSha256,createHash('sha256').update(source).digest('hex'),'Build does not match current source');
assert.equal(await readFile('dist/technical-plan.md','utf8'),source,'Download must match repository source');
assert.equal(await readFile('dist/operation-ledger.md','utf8'),await readFile('docs/operation-ledger.md','utf8'),'Operation ledger download must match repository source');
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
assert(html.includes(`v${manifest.version}`));
assert(html.includes(manifest.status));
assert(html.includes(manifest.baselineDate) && html.includes(manifest.publicationDate));
assert(html.includes('lang="zh-CN"'));
assert(!/(?:href|src)="(?:http:\/\/(?:localhost|127\.0\.0\.1)|\/src\/)/.test(html),'Preview-only resource URL was published');
console.log(`Verified source fidelity, ${manifest.chapters.length} chapters, ${ids.length} unique anchors, local assets, public references and required scope.`);
