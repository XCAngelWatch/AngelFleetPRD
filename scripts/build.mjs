import { readFile, writeFile, mkdir, rm, copyFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';
import { build } from 'esbuild';

const source = await readFile('docs/technical-plan.md', 'utf8');
const siteMeta = JSON.parse(await readFile('docs/site-meta.json', 'utf8'));
const acceptanceIds = JSON.parse(await readFile('docs/acceptance-ids.json', 'utf8'));
async function removeAppleDoubleFiles(directory) {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const path = `${directory}/${entry.name}`;
    if (entry.name.startsWith('._')) await rm(path, {recursive:true, force:true});
    else if (entry.isDirectory()) await removeAppleDoubleFiles(path);
  }
}
const repo = 'https://github.com/XCAngelWatch/AngelFleetPRD';
const site = 'https://xcangelwatch.github.io/AngelFleetPRD/';
const escape = text => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
let diagramCount = 0;
const fence = md.renderer.rules.fence.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens,index,options,env,self) => {
  const token = tokens[index];
  if (token.info.trim() === 'mermaid') {
    const id = ++diagramCount;
    return `<figure class="diagram"><div class="mermaid" data-diagram="${id}">${escape(token.content)}</div><details><summary>查看流程源码</summary><pre><code>${escape(token.content)}</code></pre></details></figure>`;
  }
  return `<div class="code-block"><button class="copy-code" type="button" aria-label="复制此段代码">复制代码</button>${fence(tokens,index,options,env,self)}</div>`;
};
const headings = [];
const usedIds = new Set();
function headingId(title) {
  let id = title.match(/^([\d]+(?:\.[\d]+)*)[.\s]/)?.[1];
  if (id) id = `section-${id.replaceAll('.','-')}`;
  else if (/^附录 [A-E]/.test(title)) id = `appendix-${title.match(/^附录 ([A-E])/)[1].toLowerCase()}`;
  else if (/^[A-E]\.\d/.test(title)) id = `section-${title.match(/^([A-E](?:\.\d+)+)/)[1].toLowerCase().replaceAll('.','-')}`;
  else id = `heading-${createHash('sha256').update(title).digest('hex').slice(0,10)}`;
  const base = id;
  let suffix = 2;
  while (usedIds.has(id)) id = `${base}-${suffix++}`;
  usedIds.add(id);
  return id;
}
function render(content) {
  const tokens = md.parse(content, {});
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type !== 'heading_open') continue;
    const title = tokens[index+1].content;
    const originalLevel = Number(tokens[index].tag.slice(1));
    const id = headingId(title);
    tokens[index].tag = `h${Math.min(originalLevel+1,6)}`;
    tokens[index+2].tag = tokens[index].tag;
    tokens[index].attrSet('id', id);
    headings.push({title,id,level:originalLevel});
    const anchor = new tokens[index].constructor('html_inline', '', 0);
    anchor.content = `<a class="heading-link" href="#${id}" aria-label="链接到 ${escape(title)}">#</a>`;
    tokens[index+1].children.push(anchor);
  }
  return md.renderer.render(tokens,md.options,{}).replace(/<table>/g,'<div class="table-scroll" role="region" aria-label="可横向滚动的数据表" tabindex="0"><table>').replace(/<\/table>/g,'</table></div>');
}
const title = source.split('\n')[0].replace(/^# /,'');
const body = source.slice(source.indexOf('\n')+1).trim();
const firstChapter = body.indexOf('\n# 1.');
const intro = body.slice(0,firstChapter);
const sections = body.slice(firstChapter+1).split(/\n(?=# (?:\d+\.|附录 [A-E]))/);
const rendered = sections.map(section => {
  const before = headings.length;
  const html = render(section);
  const heading = headings[before];
  return {heading,html};
});
const introHtml = md.render(intro);
const searchRecords = [];
let current = {id:'top',title};
let headingCursor = 0;
let textParts = [];
function flushSearchRecord() {
  const text = textParts.join(' ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[`*#>|]/g,' ').replace(/\s+/g,' ').trim();
  if (text) searchRecords.push({id:current.id,title:current.title,text});
  textParts = [];
}
for (const token of md.parse(body, {})) {
  if (token.type === 'heading_open') {
    flushSearchRecord();
    current = headings[headingCursor++] ?? current;
  } else if (token.type === 'inline' || token.type === 'paragraph_open' || token.type === 'list_item_open') {
    if (token.type === 'inline') textParts.push(token.content);
  }
}
flushSearchRecord();
const navItems = rendered.map(({heading}) => {
  const isAppendix = heading.title.startsWith('附录');
  const number = isAppendix ? heading.title.match(/^附录 ([A-E])/)[1] : heading.title.match(/^\d+/)[0];
  const label = isAppendix ? heading.title.replace(/^附录 [A-E] · /,'') : heading.title.replace(/^\d+\. /,'');
  return {isAppendix, html:`<a href="#${heading.id}"><span class="section-number">${number}</span><span>${escape(label)}</span></a>`};
});
const mainNav = navItems.filter(item => !item.isAppendix).map(item => item.html);
const appendixNav = navItems.filter(item => item.isAppendix).map(item => item.html);
const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} · AngelFleet PRD</title>
<meta name="description" content="AngelFleet PRD：1Panel v2 Cloudflare 控制面详细技术方案。XC React 前端复用、Go 功能迁移、节点协议与单租户 1 万节点验收基线。">
<meta name="theme-color" content="#143b40"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="设计版本 ${escape(siteMeta.version)} · 完整功能迁移、产品生命周期与分阶段验收基线"><meta property="og:type" content="article"><meta property="og:url" content="${site}">
<meta property="og:image" content="${site}assets/og-card.svg"><meta property="og:image:type" content="image/svg+xml"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="设计版本 ${escape(siteMeta.version)} · 完整功能迁移与分阶段验收基线">
<link rel="canonical" href="${site}"><link rel="icon" type="image/svg+xml" href="assets/favicon.svg"><link rel="stylesheet" href="assets/site.css">
</head>
<body id="top">
<a class="skip-link" href="#main">跳转到正文</a>
<header class="masthead">
  <a href="#top" class="brand"><svg class="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 24 16 5l11 19H5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m10 19 6-10 6 10M10 19h12M16 19v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>AngelFleet PRD</a>
  <nav class="masthead-links" aria-label="文档操作"><span class="version">v${escape(siteMeta.version)}</span><a class="desktop-link" href="technical-plan.md" download>下载 Markdown</a><a class="desktop-link print-button" href="#">打印 / PDF</a><a href="${repo}">GitHub</a><button class="menu-toggle" aria-controls="contents" aria-expanded="false" type="button">目录</button></nav>
</header>
<button class="nav-backdrop" hidden type="button" aria-label="关闭目录"></button>
<div class="layout">
  <aside class="sidebar" id="contents" aria-label="章节目录">
    <button class="search-trigger" type="button">${searchIcon}<span>搜索方案</span><kbd>⌘ / Ctrl K</kbd></button>
    <h2 class="contents-title">技术方案</h2><nav class="toc" aria-label="主体章节">${mainNav.join('')}</nav>
    <h2 class="contents-title">参考附录</h2><nav class="toc" aria-label="附录">${appendixNav.join('')}</nav>
    <div class="sidebar-footer">设计基线 · ${escape(siteMeta.baselineDate)}<br>公开发布 · ${escape(siteMeta.publicationDate)}<br><a href="technical-plan.md" download>下载完整方案</a></div>
  </aside>
  <main class="article-wrap" id="main">
    <article class="document">
      <header class="document-header"><div class="breadcrumb"><a href="${repo}">AngelFleet</a> / 技术方案</div><h1>${escape(title)}</h1><div class="document-meta"><span>设计版本 ${escape(siteMeta.version)}</span><span>审查基线 ${escape(siteMeta.baselineDate)}</span><span class="design-status">${escape(siteMeta.status)}</span></div></header>
      <div class="intro">${introHtml}</div>
      <div class="publication-note">本页发布于 ${escape(siteMeta.publicationDate)}，保留 ${escape(siteMeta.baselineDate)} 的代码审查与设计基线。方案公开不代表平台功能、真实节点链路或单租户容量验收已完成。</div>
      ${rendered.map(({heading,html}) => `<section class="chapter" id="chapter-${heading.id}" aria-labelledby="${heading.id}">${html}</section>`).join('\n')}
      <footer class="document-footer"><span>AngelFleet PRD · 设计版本 ${escape(siteMeta.version)}</span><span><a href="technical-plan.md" download>下载 Markdown</a> · <a href="${repo}/blob/main/docs/technical-plan.md">查看源文档</a> · <a href="#top">返回文档开头</a></span></footer>
    </article>
  </main>
</div>
<button class="back-top" type="button" hidden>返回顶部</button>
<dialog class="search-dialog" aria-labelledby="search-label"><form class="search-form"><label id="search-label" for="search-input" hidden>搜索完整方案</label><input id="search-input" type="search" placeholder="搜索功能、协议或验收条件" autocomplete="off"><button class="close-search" type="button">关闭</button></form><p class="search-status" role="status">输入关键词查找章节、功能和协议。</p><ul class="search-results"></ul></dialog>
<script id="search-data" type="application/json">${JSON.stringify(searchRecords).replaceAll('<','\\u003c')}</script>
<script type="module" src="assets/site.js"></script>
</body></html>`;
await rm('dist',{recursive:true,force:true});
await mkdir('dist/assets',{recursive:true});
await writeFile('dist/index.html',html);
await writeFile('dist/.nojekyll','');
await copyFile('src/site.css','dist/assets/site.css');
await copyFile('docs/technical-plan.md','dist/technical-plan.md');
await copyFile('docs/operation-ledger.md','dist/operation-ledger.md');
await copyFile('docs/platform-constraints.md','dist/platform-constraints.md');
await copyFile('docs/angelfleetprd-threat-model.md','dist/angelfleetprd-threat-model.md');
await copyFile('docs/command-state.json','dist/command-state.json');
await copyFile('docs/acceptance-ids.json','dist/acceptance-ids.json');
await writeFile('dist/assets/favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#143b40"/><path d="M6 24 16 6l10 18H6Z" fill="none" stroke="#e7f4f4" stroke-width="2"/><path d="M11 18h10M16 18v9" stroke="#e7f4f4" stroke-width="2"/></svg>');
await writeFile('dist/assets/og-card.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#143b40"/><path d="M110 465 300 135l190 330H110Z" fill="none" stroke="#e7f4f4" stroke-width="18"/><path d="M205 370h190M300 370v110" stroke="#e7f4f4" stroke-width="18" stroke-linecap="round"/><text x="560" y="285" fill="#f4ffff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="64" font-weight="700">AngelFleet PRD</text><text x="560" y="370" fill="#b9d8da" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="34">1Panel v2 Cloudflare 控制面 · v${escape(siteMeta.version)}</text><text x="560" y="430" fill="#b9d8da" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="24">公开技术方案与分阶段验收基线</text></svg>`);
await writeFile('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`);
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}</loc><lastmod>${siteMeta.publicationDate}</lastmod></url></urlset>\n`);
await copyFile('dist/index.html','dist/404.html');
const bundle = await build({entryPoints:['src/site.js','src/mermaid.js'],outdir:'dist/assets',bundle:true,splitting:true,format:'esm',minify:true,target:'es2022',legalComments:'linked',chunkNames:'chunks/[name]-[hash]',logLevel:'warning',metafile:true});
await mkdir('dist/licenses',{recursive:true});
const packages = new Set(Object.keys(bundle.metafile.inputs).filter(path => path.startsWith('node_modules/')).map(path => {
  const pieces = path.slice('node_modules/'.length).split('/');
  return pieces[0].startsWith('@') ? pieces.slice(0,2).join('/') : pieces[0];
}));
const notices = ['# Third-party browser dependencies','', 'The following packages are included in the generated browser bundle. Their licenses and the bundled LEGAL.txt notices remain applicable.',''];
for (const name of [...packages].sort()) {
  const base = `node_modules/${name}`;
  const metadata = JSON.parse(await readFile(`${base}/package.json`,'utf8'));
  const licenses = (await readdir(base)).filter(file => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file));
  notices.push(`- ${name} ${metadata.version}: ${typeof metadata.license === 'string' ? metadata.license : 'see package notices'}`);
  for (const license of licenses) {
    const content = await readFile(`${base}/${license}`,'utf8').catch(() => null);
    if (content) await writeFile(`dist/licenses/${name.replaceAll('/','__')}__${license}`,content);
  }
}
await writeFile('dist/licenses/README.md',notices.join('\n')+'\n');
const manifest = {version:siteMeta.version,baselineDate:siteMeta.baselineDate,publicationDate:siteMeta.publicationDate,status:siteMeta.status,sourceSha256:createHash('sha256').update(source).digest('hex'),chapters:rendered.map(({heading}) => ({id:heading.id,title:heading.title})),bodyChapters:mainNav.length,appendices:appendixNav.length,headings:headings.length,diagrams:diagramCount,diagramSources:(source.match(/^```mermaid$/gm) || []).length,searchRecords:searchRecords.length,acceptanceIds:Object.keys(acceptanceIds.ids).length,supportingDocs:['platform-constraints.md','angelfleetprd-threat-model.md']};
await writeFile('dist/build-manifest.json',JSON.stringify(manifest,null,2)+'\n');
await removeAppleDoubleFiles('dist');
console.log(`Built ${rendered.length} chapters, ${headings.length} headings, ${diagramCount} diagrams and ${searchRecords.length} search sections.`);
