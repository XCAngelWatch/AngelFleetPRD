import { readFile, writeFile, mkdir, rm, copyFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname } from 'node:path';
import MarkdownIt from 'markdown-it';
import {createSiteLayout, searchIcon, escape} from './site-layout.mjs';
import { build } from 'esbuild';
import {documentMoves} from './document-moves.mjs';

const siteMeta = JSON.parse(await readFile('docs/site-meta.json', 'utf8'));
const acceptanceIds = JSON.parse(await readFile('docs/acceptance-ids.json', 'utf8'));
const stylesheet = await readFile('src/site.css');
const stylesheetVersion = createHash('sha256').update(stylesheet).digest('hex').slice(0, 12);
async function removeAppleDoubleFiles(directory) {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const path = `${directory}/${entry.name}`;
    if (entry.name.startsWith('._')) await rm(path, {recursive:true, force:true});
    else if (entry.isDirectory()) await removeAppleDoubleFiles(path);
  }
}
const repo = 'https://github.com/XCAngelWatch/AngelFleetPRD';
const site = 'https://xcangelwatch.github.io/AngelFleetPRD/';
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
function markdownAnchor(title) {
  return title.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replaceAll(' ', '-');
}
function headingId(title, usedIds, useTitle) {
  let id = title.match(/^([\d]+(?:\.[\d]+)*)[.\s]/)?.[1];
  if (id) id = `section-${id.replaceAll('.','-')}`;
  else if (/^(?:FOLLOW|CORE|OPS)-\d{2}\s/.test(title) || title === 'GA-11 可靠写入') id = title.split(' ')[0].toLowerCase();
  else if (/^附录 [A-E]/.test(title)) id = `appendix-${title.match(/^附录 ([A-E])/)[1].toLowerCase()}`;
  else if (/^[A-E]\.\d/.test(title)) id = `section-${title.match(/^([A-E](?:\.\d+)+)/)[1].toLowerCase().replaceAll('.','-')}`;
  else id = useTitle ? markdownAnchor(title) : `heading-${createHash('sha256').update(title).digest('hex').slice(0,10)}`;
  const base = id;
  let suffix = 2;
  while (usedIds.has(id)) id = `${base}-${suffix++}`;
  usedIds.add(id);
  return id;
}
function linkTaskId(cell, key) {
  const first = cell.children[0];
  const open = new cell.constructor('link_open', 'a', 1);
  open.attrSet('href', '#' + key.toLowerCase());
  const label = new cell.constructor('text', '', 0);
  label.content = key;
  first.content = first.content.slice(key.length);
  cell.children.unshift(open, label, new cell.constructor('link_close', 'a', -1));
}
function indexWorkItems(tokens, page, primary) {
  const records = [];
  let task;
  let taskColumn = -1;
  let assignments = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'table_open') {
      const headers = [];
      for (let j = i + 1; tokens[j].type !== 'thead_close'; j++) {
        if (tokens[j].type === 'inline') headers.push(tokens[j].content);
      }
      taskColumn = primary ? headers.findIndex(title => title === '工单、主责与人日' || title === '工单 · 人日') : 0;
      assignments = primary && headers[1] === 'Go · 人日与交付物';
      if (assignments) taskColumn = 0;
      if (token.attrGet('class') === 'gantt-table') taskColumn = -1;
    }
    if (token.type === 'tr_close') task = undefined;
    if (token.type === 'tr_open' && taskColumn >= 0 && tokens[i + 1].type === 'td_open') {
      // Each Markdown table cell consists of an open, inline and close token.
      const cell = tokens[i + 2 + 3 * taskColumn];
      const first = cell?.children?.[0];
      const key = first?.type === 'text' && first.content.match(/^(?:GA|FOLLOW|CORE|OPS)-\d{2}(?=\s|$)/)?.[0];
      if (!key) continue;
      const id = (assignments ? 'roles-' : '') + key.toLowerCase();
      token.attrSet('id', id);
      linkTaskId(cell, key);
      if (assignments) {
        ['Go', '控制台', '测试'].forEach((role, j) => tokens[i + 4 + 3 * j].attrSet('data-role', role));
      }
      if (primary && !assignments && !key.startsWith('GA-')) {
        const roles = new token.constructor('html_inline', '', 0);
        roles.content = ` <a class="task-role-link" href="#roles-${id}" aria-label="${key} 分工与人日">分工与人日</a>`;
        cell.children.push(roles);
      }
      const title = assignments ? key + ' 分工与人日' : primary && !key.startsWith('GA-') ? key + ' ' + tokens[i + 2].content : cell.content;
      task = {page, id, title, text:''};
      records.push(task);
    }
    if (task && token.type === 'inline') task.text += ' ' + token.content;
  }
  return records;
}
function formatGantt(tokens, start) {
  tokens[start].attrSet('class', 'gantt-table');
  let column = 0;
  for (let i = start + 1; tokens[i].type !== 'table_close'; i++) {
    if (tokens[i].type === 'tr_open') {
      column = 0;
      if (tokens[i + 2]?.content === '验收里程碑') tokens[i].attrSet('class', 'gantt-milestones');
    }
    if (tokens[i].type !== 'td_open') continue;
    const week = column++;
    if (!week) {
      const cell = tokens[i + 1];
      const key = cell.content.match(/^GA-\d{2}\b/)?.[0];
      if (key) linkTaskId(cell, key);
      continue;
    }
    const range = tokens[i + 1].content.match(/^\*\*D(\d+)(?:–D(\d+))?\*\*$/);
    if (!range) continue;
    const first = Number(range[1]);
    const last = Number(range[2] ?? range[1]);
    const offset = first - (week - 1) * 5 - 1;
    if (offset < 0 || last < first || last > week * 5) throw new Error(`Invalid schedule span in week ${week}: ${range[0]}`);
    tokens[i].attrSet('class', 'gantt-workdays');
    tokens[i].attrSet('style', `--offset:${offset * 20}%;--duration:${(last - first + 1) * 20}%`);
  }
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
  const sectionTag = tokens.slice(3).some(token => token.type === 'heading_open' && token.tag === 'h1') ? 'h1' : 'h2';
  let group = intro;
  let ganttPending = true;

  // Assign anchors, search records and chapter groups from the same token stream.
  for (let i = 3; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      const inline = tokens[i + 1];
      const heading = {id: headingId(inline.content, usedIds, sectionTag === 'h2'), title: inline.content};
      if (token.tag === sectionTag) {
        group = {heading, tokens: []};
        sections.push(group);
      }
      const level = Number(token.tag.slice(1)) + (group !== intro && sectionTag === 'h1' ? 1 : 0);
      token.tag = tokens[i + 2].tag = `h${Math.min(level, 6)}`;
      token.attrSet('id', heading.id);
      const anchor = new token.constructor('html_inline', '', 0);
      anchor.content = `<a class="heading-link" href="#${heading.id}" aria-label="链接到 ${escape(heading.title)}">#</a>`;
      inline.children.push(anchor);
      sourceAnchors.set(markdownAnchor(heading.title), heading.id);
      records.push({page: file, ...heading, text: ''});
      group.tokens.push(token, inline, tokens[i + 2]);
      i += 2;
      continue;
    }
    if (ganttPending && group.heading?.title === 'M1 排期与甘特图' && token.type === 'table_open') {
      formatGantt(tokens, i);
      ganttPending = false;
    }
    group.tokens.push(token);
    if (token.type === 'inline') {
      records.at(-1).text += ' ' + token.children.map(child => child.content).join('');
    } else if (token.type === 'fence' && token.info.trim() !== 'mermaid') {
      records.at(-1).text += ' ' + token.content;
    }
  }
  if (markdown === 'go-agent-development-plan.md' || markdown === 'engineering-roadmap.md') {
    records.push(...indexWorkItems(tokens, file, markdown === 'engineering-roadmap.md'));
  }
  for (const record of records) record.text = record.text.replace(/\s+/g, ' ').trim() || record.title;
  return {markdown, file, label, description, title, source, sourceAnchors, sections, intro, records, diagrams: 0};
}

const documents = await Promise.all([
  readDocument('product-prd.md', 'product-prd.html', '产品 PRD', '确定首批用户怎么用、11 个功能域分几批开放，以及每项功能怎样验收。'),
  readDocument('technical-design.md', 'technical-design.html', '技术方案', '确定控制台、云端与节点的职责，核对存储、命令、容量与恢复方案。'),
  readDocument('engineering-roadmap.md', 'engineering-roadmap.html', '研发计划', '按角色领取工单，核对人日、前置依赖、交付物和放行证据。'),
  readDocument('technical-plan.md', 'technical-plan.html', '技术规格与验收附录', '查阅协议、数据约束、源码迁移矩阵、容量门禁与验收编号的详细定义。'),
  readDocument('go-agent-interface-contract.md', 'go-agent-interface-contract.html', '节点接入与接口契约', '按报文联调注册、WSS 与首采，复现逐指标冷读并核对错误响应。'),
  readDocument('operation-ledger.md', 'operation-ledger.html', '节点操作与权限', '按操作核对角色、目标资源、Go 执行入口、取消边界与实际结果。'),
  readDocument('go-agent-development-plan.md', 'go-agent-development-plan.html', '历史工单与源码基线', '追溯已退出本轮的任务、原始范围和源码版本。'),
  readDocument('spaces/implementation-review.md', 'implementation-review.html', '联调实测与历史记录', '核对样例运行、真机证据栏与旧场景记录。'),
  readDocument('platform-constraints.md', 'platform-constraints.html', '平台约束快照', '按平台服务查阅约束、官方来源与部署前需复核的参数。'),
  readDocument('angelfleetprd-threat-model.md', 'threat-model.html', '威胁评估记录', '核对风险评级、资产范围和发布响应头的观测证据。'),
  readDocument('reviews/2026-11-19-online-audit.md', 'review-2026-11-19.html', '线上文档核查记录', '查阅 2026-11-19 线上基线、覆盖范围与当日发现。')
]);
const [product, design, roadmap, plan, contract, ledger, development, review, constraints, threats, audit] = documents;
const guides = [
  {doc: product, icon: 'book', references: [], topics: [
    ['首批用户流程', '首批做什么'], ['11 个功能域', '哪些-1panel-功能分批迁移'], ['开放条件', '当前验收状态']
  ]},
  {doc: design, icon: 'layers', references: [plan, constraints, threats], topics: [
    ['部署与接口兼容', '云端部署与接口兼容'], ['命令与对账', '命令投递执行与对账'], ['容量与恢复', '部署容量与恢复']
  ]},
  {doc: contract, icon: 'connect', references: [], topics: [
    ['注册与绑定', 'section-3'], ['连接握手', 'section-4'], ['冷启动读数', 'section-5-3']
  ]},
  {doc: ledger, icon: 'operations', references: [], topics: [
    ['操作及权限', '操作登记与执行边界'], ['首个写入与恢复', '工单与操作登记'], ['源码依据', '源码核验记录']
  ]},
  {doc: roadmap, icon: 'timeline', references: [development, review, audit], topics: [
    ['M1 派工与交接', 'm1-排期与交接'], ['后续工作包', '后续工作包与估算'], ['发布条件', '整版路线与发布条件']
  ]}
];
const moves = documentMoves(product, roadmap);
const sampleFiles = ['examples/go-agent-first-sample.json', 'examples/node-metric-read.v1.json'];
const supportingDocs = ['command-state.json', 'acceptance-ids.json', ...sampleFiles];
const searchRecords = documents.flatMap(doc => doc.records.map(record => ({...record, label:doc.label, primary:guides.some(guide => guide.doc === doc)})));

// Keep repository links usable in Markdown and resolve them to the reading pages in HTML.
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const href = token.attrGet('href');
  const url = new URL(href, site + env.markdown);
  const repoDocs = repo + '/blob/main/docs/';
  const isRepositoryLink = url.href.startsWith(repoDocs);
  if (!isRepositoryLink && !url.href.startsWith(site)) return self.renderToken(tokens, index, options);
  // HTML pages live at the site root; Markdown downloads retain their source directories.
  const prefix = isRepositoryLink ? repoDocs : site;
  const path = decodeURIComponent(url.pathname.slice(new URL(prefix).pathname.length));
  let target = documents.find(doc => doc.markdown === path || doc.file === (path || 'index.html'));
  let fragment = decodeURIComponent(url.hash.slice(1));
  const page = path === '1panel-feature-map.md' ? '1panel-feature-map.html' : target?.file ?? path;
  const aliases = moves[page];
  if (aliases && Object.hasOwn(aliases, fragment)) {
    const moved = new URL(aliases[fragment], site + page);
    target = documents.find(doc => doc.file === moved.pathname.split('/').pop());
    fragment = decodeURIComponent(moved.hash.slice(1));
  }
  if (target) {
    const id = target.sourceAnchors.get(fragment) ?? fragment;
    if (id && !target.records.some(record => record.id === id)) throw new Error(`Unknown heading in ${env.markdown}: ${href}`);
    const file = href.startsWith('#') && target === env ? '' : target.file;
    token.attrSet('href', file + url.search + (id ? '#' + id : ''));
  } else if (!isRepositoryLink) {
    token.attrSet('href', url.pathname.slice(new URL(site).pathname.length) + url.search + url.hash);
  }
  if (sampleFiles.includes(path)) token.attrSet('download', basename(path));
  return self.renderToken(tokens, index, options);
};

function renderFeatureTree(group, doc) {
  const headings = (tokens, tag) => tokens.flatMap((token, index) => token.type === 'heading_open' && token.tag === tag ? [index] : []);
  const render = tokens => md.renderer.render(tokens, md.options, doc);
  const phases = headings(group.tokens, 'h3');
  const sides = phases.map((start, index) => {
    const id = group.tokens[start].attrGet('id');
    const [code, ...name] = group.tokens[start + 1].content.split(' ');
    const phaseTokens = group.tokens.slice(start + 3, phases[index + 1]);
    const domains = headings(phaseTokens, 'h4');
    const details = domains.map((position, domain) => {
      const anchor = phaseTokens[position].attrGet('id');
      const title = phaseTokens[position + 1].content;
      const body = render(phaseTokens.slice(position + 3, domains[domain + 1]));
      return `<details class="feature-domain"><summary id="${anchor}">${escape(title)}</summary><div class="feature-operations">${body}</div></details>`;
    }).join('\n');
    return `<section class="feature-phase" data-phase="${escape(code.toLowerCase())}" aria-labelledby="${id}"><h3 class="feature-phase-title" id="${id}"><strong>${escape(code)}</strong> ${escape(name.join(' '))}</h3><div class="feature-domains">${details}</div></section>`;
  });
  const midpoint = Math.ceil(sides.length / 2);
  return `<span class="feature-legacy-anchor" id="1panel-上游功能" aria-hidden="true"></span>${render(group.tokens.slice(0, phases[0]))}
    <div class="feature-tree">
      <div class="feature-tools" hidden>
        <div class="feature-search-field">${searchIcon}<input type="search" id="feature-filter" aria-label="查找本期功能" placeholder="查找功能，如 Docker、备份"></div>
        <button class="feature-toggle" type="button">全部展开</button>
      </div>
      <p class="feature-status" role="status"></p>
      <div class="feature-canvas">
        <svg class="feature-links" aria-hidden="true" focusable="false"></svg>
        <div class="feature-root"><strong>AngelFleet</strong><span>本期迁移</span></div>
        <div class="feature-side feature-side-left">${sides.slice(0, midpoint).join('\n')}</div>
        <div class="feature-side feature-side-right">${sides.slice(midpoint).join('\n')}</div>
      </div>
    </div>`;
}

function renderGroup(group, doc) {
  if (group.heading?.id === '本期功能导图') return renderFeatureTree(group, doc);
  return md.renderer.render(group.tokens, md.options, doc)
    .replace(/<h4 id="([^"]+分工)">([^<]+)<a class="heading-link"[^\n]+<\/h4>\n(<table>[\s\S]*?<\/table>)/g,
      '<details class="role-table"><summary id="$1">$2 · Go、控制台、测试</summary>$3</details>')
    .replace(/<table(?: class="(gantt-table)")?>/g, (tag, gantt) => `<div class="table-scroll${gantt ? ' gantt-scroll' : ''}" role="region" aria-label="${gantt ? 'M1 甘特图，可横向滚动' : '可横向滚动的数据表'}" tabindex="0">${tag}`)
    .replace(/<\/table>/g, '</table></div>');
}

function chapterLink({heading}) {
  const parts = heading.title.match(/^附录 ([A-E]) · (.+)$/) || heading.title.match(/^(\d+)\. (.+)$/);
  if (!parts) return `<a href="#${heading.id}">${escape(heading.title)}</a>`;
  const [, number, label] = parts;
  return `<a href="#${heading.id}"><span class="section-number">${number}</span><span>${escape(label)}</span></a>`;
}
const siteLayout = createSiteLayout({repo, site, siteMeta, guides, product, design, roadmap, spec:plan, moves, searchRecords, stylesheetVersion});

await rm('dist',{recursive:true,force:true});
await mkdir('dist/assets',{recursive:true});
const bundle = await build({entryPoints:['src/site.js','src/mermaid.js'],outdir:'dist/assets',bundle:true,splitting:true,format:'esm',minify:true,target:'es2022',legalComments:'linked',chunkNames:'chunks/[name]-[hash]',logLevel:'warning',metafile:true});
const siteScriptVersion = createHash('sha256').update(await readFile('dist/assets/site.js')).digest('hex').slice(0, 12);
for (const doc of documents) {
  const chapters = doc.sections.filter(({heading}) => !heading.title.startsWith('附录'));
  const appendices = doc.sections.filter(({heading}) => heading.title.startsWith('附录'));
  const toc = list => list.map(chapterLink).join('');
  const body = `<div class="intro">${renderGroup(doc.intro, doc)}</div>
    ${doc.sections.map(section => `<section class="chapter" id="chapter-${section.heading.id}" aria-labelledby="${section.heading.id}">${renderGroup(section, doc)}</section>`).join('\n')}`;
  const html = siteLayout.article(doc, body, toc(chapters), toc(appendices), siteScriptVersion);
  await writeFile(`dist/${doc.file}`, html);
}
await writeFile('dist/index.html', siteLayout.home(siteScriptVersion));
await writeFile('dist/1panel-feature-map.html', siteLayout.movedPage('1panel-feature-map.html', siteScriptVersion));
await writeFile('dist/.nojekyll','');
await writeFile('dist/assets/site.css',stylesheet);
const downloads = new Set([...documents.map(doc => doc.markdown), ...supportingDocs, '1panel-feature-map.md']);
for (const document of downloads) {
  const destination = `dist/${document}`;
  await mkdir(dirname(destination), {recursive:true});
  await copyFile(`docs/${document}`, destination);
}
await writeFile('dist/assets/favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#143b40"/><path d="M6 24 16 6l10 18H6Z" fill="none" stroke="#e7f4f4" stroke-width="2"/><path d="M11 18h10M16 18v9" stroke="#e7f4f4" stroke-width="2"/></svg>');
await writeFile('dist/assets/og-card.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#143b40"/><path d="M110 465 300 135l190 330H110Z" fill="none" stroke="#e7f4f4" stroke-width="18"/><path d="M205 370h190M300 370v110" stroke="#e7f4f4" stroke-width="18" stroke-linecap="round"/><text x="560" y="285" fill="#f4ffff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="64" font-weight="700">AngelFleet PRD</text><text x="560" y="370" fill="#b9d8da" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="34">1Panel v2 Cloudflare 控制面 · v${escape(siteMeta.version)}</text><text x="560" y="430" fill="#b9d8da" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif" font-size="24">公开技术方案与分阶段验收基线</text></svg>`);
await writeFile('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`);
const sitemapEntries = [site, ...documents.map(doc => site + doc.file)].map(url => `<url><loc>${url}</loc></url>`).join('');
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapEntries}</urlset>\n`);
await copyFile('dist/index.html','dist/404.html');
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
  supportingDocs,
  primaryPages: guides.map(({doc}) => doc.file),
  readingPages: documents.map(doc => ({file:doc.file, markdown:doc.markdown, label:doc.label, ...documentStats(doc)})),
  technicalDesign: documentStats(design),
  goAgentContract: documentStats(contract)
};
await writeFile('dist/build-manifest.json',JSON.stringify(manifest,null,2)+'\n');
await removeAppleDoubleFiles('dist');
console.log(`Built ${documents.length} pages and ${searchRecords.length} search records.`);
