import { readFile, writeFile, mkdir, rm, copyFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';
import { build } from 'esbuild';

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
const fence = md.renderer.rules.fence.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens,index,options,env,self) => {
  const token = tokens[index];
  if (token.info.trim() === 'mermaid') {
    const id = ++env.diagrams;
    return `<figure class="diagram"><div class="mermaid" data-diagram="${id}">${escape(token.content)}</div><details><summary>查看流程源码</summary><pre><code>${escape(token.content)}</code></pre></details></figure>`;
  }
  return `<div class="code-block"><button class="copy-code" type="button" aria-label="复制此段代码">复制代码</button>${fence(tokens,index,options,env,self)}</div>`;
};
function headingId(title, usedIds) {
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
async function readDocument(markdown, file, label, description) {
  const source = await readFile(`docs/${markdown}`, 'utf8');
  const tokens = md.parse(source, {});
  const title = tokens[1].content;
  const intro = {tokens: []};
  const sections = [];
  const usedIds = new Set();
  const sourceAnchors = new Map();
  const records = [{page: file, id: 'top', title, text: ''}];
  let group = intro;

  // Assign anchors, search records and chapter groups from the same token stream.
  for (let i = 3; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      const inline = tokens[i + 1];
      const heading = {id: headingId(inline.content, usedIds), title: inline.content};
      if (token.tag === 'h1') {
        group = {heading, tokens: []};
        sections.push(group);
      }
      const level = Number(token.tag.slice(1)) + (group === intro ? 0 : 1);
      token.tag = tokens[i + 2].tag = `h${Math.min(level, 6)}`;
      token.attrSet('id', heading.id);
      const anchor = new token.constructor('html_inline', '', 0);
      anchor.content = `<a class="heading-link" href="#${heading.id}" aria-label="链接到 ${escape(heading.title)}">#</a>`;
      inline.children.push(anchor);
      const sourceAnchor = heading.title.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replaceAll(' ', '-');
      sourceAnchors.set(sourceAnchor, heading.id);
      records.push({page: file, ...heading, text: ''});
      group.tokens.push(token, inline, tokens[i + 2]);
      i += 2;
      continue;
    }
    group.tokens.push(token);
    if (token.type === 'inline') {
      records.at(-1).text += ' ' + token.children.map(child => child.content).join('');
    } else if (token.type === 'fence' && token.info.trim() !== 'mermaid') {
      records.at(-1).text += ' ' + token.content;
    }
  }
  for (const record of records) record.text = record.text.replace(/\s+/g, ' ').trim() || record.title;
  return {markdown, file, label, description, title, source, sourceAnchors, sections, intro, records, diagrams: 0};
}

const [plan, design] = await Promise.all([
  readDocument('technical-plan.md', 'index.html', '技术方案', '1Panel v2 Cloudflare 控制面技术方案，涵盖 XC React、Go 功能迁移、节点协议与单租户 1 万节点验收基线。'),
  readDocument('technical-design.md', 'technical-design.html', '技术详细设计', '对照 1Panel 前端、core 与 agent 的源码入口，说明节点采样、命令执行与结果对账的实现边界，附注册、终端、制品与故障恢复验收场景。')
]);
const documents = [plan, design];
const searchRecords = documents.flatMap(doc => doc.records);

// Keep repository links usable in Markdown and resolve them to the reading pages in HTML.
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const [path, fragment] = token.attrGet('href').split('#');
  const target = documents.find(doc => doc.markdown === path);
  if (target) {
    const id = fragment && target.sourceAnchors.get(decodeURIComponent(fragment));
    if (fragment && !id) throw new Error(`Unknown source heading in ${path}#${fragment}`);
    token.attrSet('href', target.file + (id ? '#' + id : ''));
  }
  return self.renderToken(tokens, index, options);
};

function renderGroup(group, doc) {
  return md.renderer.render(group.tokens, md.options, doc)
    .replace(/<table>/g, '<div class="table-scroll" role="region" aria-label="可横向滚动的数据表" tabindex="0"><table>')
    .replace(/<\/table>/g, '</table></div>');
}

function chapterLink({heading}) {
  const [, number, label] = heading.title.match(/^附录 ([A-E]) · (.+)$/) || heading.title.match(/^(\d+)\. (.+)$/);
  return `<a href="#${heading.id}"><span class="section-number">${number}</span><span>${escape(label)}</span></a>`;
}
const searchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
function renderPage(doc) {
  const {title, label, description, markdown} = doc;
  const canonical = doc === plan ? site : site + doc.file;
  const chapters = doc.sections.filter(({heading}) => !heading.title.startsWith('附录'));
  const appendices = doc.sections.filter(({heading}) => heading.title.startsWith('附录'));
  const pageNav = documents.map(page => `<a href="${page.file}"${page === doc ? ' aria-current="page"' : ''}>${page.label}</a>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} · AngelFleet PRD</title>
<meta name="description" content="${escape(description)}">
<meta name="theme-color" content="#143b40"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="article"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site}assets/og-card.svg"><meta property="og:image:type" content="image/svg+xml"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}">
<link rel="canonical" href="${canonical}"><link rel="icon" type="image/svg+xml" href="assets/favicon.svg"><link rel="stylesheet" href="assets/site.css">
</head>
<body id="top" data-page="${doc.file}">
<a class="skip-link" href="#main">跳转到正文</a>
<header class="masthead">
  <a href="#top" class="brand"><svg class="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 24 16 5l11 19H5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m10 19 6-10 6 10M10 19h12M16 19v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>AngelFleet PRD</a>
  <nav class="masthead-links" aria-label="文档操作"><span class="version">v${escape(siteMeta.version)}</span><a class="desktop-link" href="${markdown}" download>下载 Markdown</a><a class="desktop-link print-button" href="#">打印 / PDF</a><a href="${repo}">GitHub</a><button class="menu-toggle" aria-controls="contents" aria-expanded="false" type="button">目录</button></nav>
</header>
<button class="nav-backdrop" hidden type="button" aria-label="关闭目录"></button>
<div class="layout">
  <aside class="sidebar" id="contents" aria-label="章节目录">
    <button class="search-trigger" type="button">${searchIcon}<span>搜索方案</span><kbd>⌘ / Ctrl K</kbd></button>
    <nav class="page-nav" aria-label="文档切换">${pageNav}</nav>
    <h2 class="contents-title">本页章节</h2><nav class="toc" aria-label="主体章节">${chapters.map(chapterLink).join('')}</nav>
    ${appendices.length ? `<h2 class="contents-title">参考附录</h2><nav class="toc" aria-label="附录">${appendices.map(chapterLink).join('')}</nav>` : ''}
    <div class="sidebar-footer">设计版本 · ${escape(siteMeta.version)}<br>发布状态 · ${escape(siteMeta.status)}<br><a href="${markdown}" download>下载${label}</a></div>
  </aside>
  <main class="article-wrap" id="main">
    <article class="document">
      <header class="document-header"><div class="breadcrumb"><a href="index.html">AngelFleet PRD</a> / ${label}</div><h1>${escape(title)}</h1><div class="document-meta"><span>设计版本 ${escape(siteMeta.version)}</span><span class="design-status">${escape(siteMeta.status)}</span></div></header>
      <div class="intro">${renderGroup(doc.intro, doc)}</div>
      ${doc === plan ? `<div class="publication-note">这是公开设计方案，状态为“${escape(siteMeta.status)}”。方案公开不代表平台功能、真实节点链路或单租户容量验收已完成。</div>` : ''}
      ${doc.sections.map(section => `<section class="chapter" id="chapter-${section.heading.id}" aria-labelledby="${section.heading.id}">${renderGroup(section, doc)}</section>`).join('\n')}
      <footer class="document-footer"><span>AngelFleet PRD · 设计版本 ${escape(siteMeta.version)}</span><span><a href="${markdown}" download>下载 Markdown</a> · <a href="${repo}/blob/main/docs/${markdown}">查看源文档</a> · <a href="#top">返回文档开头</a></span></footer>
    </article>
  </main>
</div>
<button class="back-top" type="button" hidden>返回顶部</button>
<dialog class="search-dialog" aria-labelledby="search-label"><form class="search-form"><label id="search-label" for="search-input" hidden>搜索完整方案</label><input id="search-input" type="search" placeholder="搜索功能、协议或验收条件" autocomplete="off"><button class="close-search" type="button">关闭</button></form><p class="search-status" role="status">输入关键词查找章节、功能和协议。</p><ul class="search-results"></ul></dialog>
<script id="search-data" type="application/json">${JSON.stringify(searchRecords).replaceAll('<','\\u003c')}</script>
<script type="module" src="assets/site.js"></script>
</body></html>`;
}
await rm('dist',{recursive:true,force:true});
await mkdir('dist/assets',{recursive:true});
for (const doc of documents) {
  await writeFile(`dist/${doc.file}`, renderPage(doc));
  await copyFile(`docs/${doc.markdown}`, `dist/${doc.markdown}`);
}
await writeFile('dist/.nojekyll','');
await copyFile('src/site.css','dist/assets/site.css');
await copyFile('docs/operation-ledger.md','dist/operation-ledger.md');
await copyFile('docs/platform-constraints.md','dist/platform-constraints.md');
await copyFile('docs/angelfleetprd-threat-model.md','dist/angelfleetprd-threat-model.md');
await copyFile('docs/command-state.json','dist/command-state.json');
await copyFile('docs/acceptance-ids.json','dist/acceptance-ids.json');
await writeFile('dist/assets/favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#143b40"/><path d="M6 24 16 6l10 18H6Z" fill="none" stroke="#e7f4f4" stroke-width="2"/><path d="M11 18h10M16 18v9" stroke="#e7f4f4" stroke-width="2"/></svg>');
await writeFile('dist/assets/og-card.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#143b40"/><path d="M110 465 300 135l190 330H110Z" fill="none" stroke="#e7f4f4" stroke-width="18"/><path d="M205 370h190M300 370v110" stroke="#e7f4f4" stroke-width="18" stroke-linecap="round"/><text x="560" y="285" fill="#f4ffff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="64" font-weight="700">AngelFleet PRD</text><text x="560" y="370" fill="#b9d8da" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="34">1Panel v2 Cloudflare 控制面 · v${escape(siteMeta.version)}</text><text x="560" y="430" fill="#b9d8da" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="24">公开技术方案与分阶段验收基线</text></svg>`);
await writeFile('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`);
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}</loc></url><url><loc>${site}${design.file}</loc></url></urlset>\n`);
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
function documentStats(doc) {
  return {
    sourceSha256: createHash('sha256').update(doc.source).digest('hex'),
    chapters: doc.sections.map(section => section.heading),
    diagrams: doc.diagrams
  };
}
const manifest = {
  ...siteMeta, ...documentStats(plan),
  bodyChapters: plan.sections.filter(({heading}) => !heading.title.startsWith('附录')).length,
  appendices: plan.sections.filter(({heading}) => heading.title.startsWith('附录')).length,
  headings: plan.sections.reduce((sum, section) => sum + section.tokens.filter(token => token.type === 'heading_open').length, 0),
  diagramSources: (plan.source.match(/^```mermaid$/gm) || []).length,
  searchRecords: searchRecords.length,
  acceptanceIds: Object.keys(acceptanceIds.ids).length,
  supportingDocs: ['platform-constraints.md','angelfleetprd-threat-model.md'],
  technicalDesign: documentStats(design)
};
await writeFile('dist/build-manifest.json',JSON.stringify(manifest,null,2)+'\n');
await removeAppleDoubleFiles('dist');
console.log(`Built ${documents.length} pages and ${searchRecords.length} search records.`);
