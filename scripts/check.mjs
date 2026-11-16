import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const source = await readFile('docs/technical-plan.md','utf8');
const html = await readFile('dist/index.html','utf8');
const manifest = JSON.parse(await readFile('dist/build-manifest.json','utf8'));
assert.equal(manifest.chapters.length,20,'Expected all 15 chapters and 5 appendices');
assert.equal(manifest.sourceSha256,createHash('sha256').update(source).digest('hex'),'Build does not match current source');
assert.equal(await readFile('dist/technical-plan.md','utf8'),source,'Download must match repository source');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate element IDs');
for (const [,hash] of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(hash),`Missing anchor: ${hash}`);
for (const [,path] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
  if (/^(https?:|mailto:)/.test(path)) continue;
  await stat(`dist/${path}`);
}
assert(!/\/Volumes\/|\/Users\/|visualize:|page_c8db|chatgpt\.com\/space/.test(source+html),'Private source reference was published');
assert(!/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source+html),'Credential-like content detected');
for (const required of ['XCtechResource','core/agent','72h','UNCERTAIN','REVIEW_REQUIRED','REQ10','DEV08','可选系统 OTA']) assert(source.includes(required),`Required topic missing: ${required}`);
assert.equal(manifest.diagrams,8,'Expected original 5 plus 3 public flow diagrams');
assert(html.includes('实施设计 · 待分阶段验收'));
assert(html.includes('2026-11-12') && html.includes('2026-11-16'));
assert(html.includes('lang="zh-CN"'));
assert(!/(?:href|src)="(?:http:\/\/(?:localhost|127\.0\.0\.1)|\/src\/)/.test(html),'Preview-only resource URL was published');
console.log(`Verified source fidelity, ${manifest.chapters.length} chapters, ${ids.length} unique anchors, local assets, public references and required scope.`);
