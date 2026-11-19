export const escape = text => text.replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  book: '<path d="M4 4.5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4zM12 5.5v14"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  connect: '<path d="m8 8 4-4a4 4 0 0 1 6 6l-3 3m1 3-4 4a4 4 0 0 1-6-6l3-3m0 4 6-6"/>',
  operations: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m5 0h5"/>',
  timeline: '<path d="M4 5h16M4 12h16M4 19h16"/><path d="M5 3h4v4H5zM11 10h5v4h-5zM16 17h4v4h-4z" fill="currentColor"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  external: '<path d="M7 17 18 6M9 6h9v9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${paths[name]}</svg>`;
}
export const searchIcon = icon('search');
const brand = '<svg class="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 24 16 5l11 19H5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m10 19 6-10 6 10M10 19h12M16 19v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const previousDesignSections = {
  'section-1': '命令投递执行与对账', 'section-2': '命令投递执行与对账', 'section-3': '命令投递执行与对账',
  'section-4': '数据归属与租户隔离', 'section-4-1': '系统架构与代码边界', 'section-4-2': '逐指标读取与乱序合并',
  'section-5': '节点注册与可信采样', 'section-5-1': '节点注册与可信采样', 'section-5-2': '终端制品与长任务', 'section-5-3': '终端制品与长任务',
  'section-6': '部署容量与恢复', 'section-7': '系统架构与代码边界', 'section-7-1': '系统架构与代码边界', 'section-7-2': '逐指标读取与乱序合并',
  'section-7-3': 'operation-ledger.html', 'section-7-4': 'operation-ledger.html', 'section-8': '命令投递执行与对账',
  'section-8-1': '命令投递执行与对账', 'section-8-2': '部署容量与恢复'
};

export function createSiteLayout({repo, site, siteMeta, guides, product, design, roadmap, spec, moves, searchRecords, stylesheetVersion}) {
  const references = guides.flatMap(guide => guide.references);
  const version = escape(siteMeta.version);
  const state = escape(siteMeta.status);
  const index = JSON.stringify(searchRecords).replaceAll('<', '\\u003c');
  const link = (doc, current) => `<a href="${doc.file}"${doc === current ? ' aria-current="page"' : ''}>${escape(doc.label)}</a>`;
  function shell({title, description, file, body, hasMenu = false, aliases = {}, canonicalFile = file, scriptVersion}) {
    const canonical = canonicalFile === 'index.html' ? site : site + canonicalFile;
    return `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${canonicalFile !== file ? '<meta name="robots" content="noindex">' : ''}<title>${escape(title)} · AngelFleet</title><meta name="description" content="${escape(description)}">
<meta name="theme-color" content="#143b40"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="${hasMenu ? 'article' : 'website'}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site}assets/og-card.svg"><meta name="twitter:card" content="summary">
<link rel="canonical" href="${canonical}"><link rel="icon" type="image/svg+xml" href="assets/favicon.svg"><link rel="stylesheet" href="assets/site.css?v=${stylesheetVersion}">
</head><body id="top" data-page="${file}">
<a class="skip-link" href="#main">跳转到正文</a>
<header class="masthead"><div class="masthead-inner">
  <a class="brand" href="index.html">${brand}AngelFleet<span>项目文档</span></a>
  <div class="masthead-links"><button class="search-trigger" type="button" aria-label="搜索全部文档">${searchIcon}<span>搜索文档</span><kbd>⌘ / Ctrl K</kbd></button><a class="repo-link" href="${repo}">GitHub ${icon('external')}</a>${hasMenu ? `<button class="menu-toggle" aria-controls="contents" aria-expanded="false" type="button">${icon('menu')}目录</button>` : ''}</div>
</div></header>
${body}
<button class="back-top" type="button" hidden>返回顶部</button>
<dialog class="search-dialog" aria-labelledby="search-label"><form class="search-form"><label id="search-label" for="search-input" hidden>搜索全部文档</label>${searchIcon}<input id="search-input" type="search" placeholder="搜索功能、协议、工单或验收编号" autocomplete="off"><button class="close-search" type="button">关闭</button></form><p class="search-status" role="status">输入关键词查找文档与工单。</p><ul class="search-results"></ul></dialog>
<script id="search-data" type="application/json">${index}</script>
<script id="moved-sections" type="application/json">${JSON.stringify(aliases)}</script>
<script type="module" src="assets/site.js?v=${scriptVersion}"></script>
</body></html>`;
  }
  function article(doc, body, chapters, appendices, scriptVersion) {
    const group = guides.find(guide => doc === guide.doc || guide.references.includes(doc));
    const isReference = group.doc !== doc;
    const breadcrumb = isReference ? `<a href="${group.doc.file}">${escape(group.doc.label)}</a> / 参考资料` : '主文档';
    const primaryNav = guides.map(({doc: main, icon: glyph}) =>
      `<a href="${main.file}"${doc === main ? ' aria-current="page"' : ''}>${icon(glyph)}${main.label}</a>`).join('');
    const referenceNav = references.map(ref => link(ref, doc)).join('');
    const aliases = doc === design ? Object.fromEntries(Object.entries(previousDesignSections).map(([key, value]) => [key, value.includes('.html') ? value : '#' + value])) : {};
    Object.assign(aliases, moves[doc.file]);
    return shell({...doc, hasMenu: true, aliases, scriptVersion, body: `
<button class="nav-backdrop" hidden type="button" aria-label="关闭目录"></button>
<div class="layout">
  <aside class="sidebar" id="contents" aria-label="阅读目录">
    <h2 class="contents-title">主文档</h2><nav class="page-nav" aria-label="主文档">${primaryNav}</nav>
    <h2 class="contents-title">本页章节</h2><nav class="toc" aria-label="主体章节">${chapters}</nav>
    ${appendices ? `<h2 class="contents-title">附录</h2><nav class="toc" aria-label="附录">${appendices}</nav>` : ''}
    <details class="reference-nav"${isReference ? ' open' : ''}><summary>参考资料与原始记录</summary><nav aria-label="参考资料与原始记录">${referenceNav}</nav></details>
  </aside>
  <main class="article-wrap" id="main"><article class="document">
    <header class="document-header"><div class="breadcrumb"><a href="index.html">文档首页</a> / ${breadcrumb}</div>
    <h1>${escape(doc.title)}</h1><div class="document-meta"><span>设计版本 ${version}</span><span class="design-status">${state}</span><span class="article-actions"><a href="${doc.markdown}" download>下载 Markdown</a><button class="print-button" type="button">打印 / PDF</button></span></div></header>
    ${body}
    <footer class="document-footer"><span>AngelFleet · ${escape(doc.label)}</span><span><a href="${doc.markdown}" download>下载 Markdown</a> · <a href="${repo}/blob/main/docs/${doc.markdown}">GitHub 当前版本</a> · <a href="#top">返回顶部</a></span></footer>
  </article></main>
</div>`});
  }
  function home(scriptVersion) {
    const aliases = Object.fromEntries(spec.records.filter(record => record.id !== 'top').map(({id}) => [id, spec.file + '#' + id]));
    Object.assign(aliases, moves[spec.file], {
      'heading-52b97d249d': product.file,
      'heading-91abf6bd7b': design.file + '#系统架构与代码边界',
      'heading-dc63aeac81': design.file + '#系统架构与代码边界',
      'heading-9cc524d90e': '#guides',
      'section-1': design.file + '#系统架构与代码边界',
      'section-2': spec.file + '#section-b-1-1',
      'section-3': design.file + '#系统架构与代码边界',
      'section-5': spec.file + '#section-15',
      'section-7': design.file + '#节点注册与可信采样',
      'section-7-1': design.file + '#节点注册与可信采样',
      'section-7-2': design.file + '#命令投递执行与对账',
      'section-7-3': spec.file + '#section-a-8',
      'section-13-2': product.file + '#哪些-1panel-功能分批迁移',
      'section-13-3': spec.file + '#section-b-1-1',
      'section-13-5': design.file + '#命令投递执行与对账',
      'section-14': roadmap.file + '#整版路线与发布条件',
      'section-d-1': product.file + '#首批做什么',
      'section-d-2': product.file + '#谁可以访问节点'
    });
    const rows = guides.map(({doc, icon: glyph, topics}) => `<div class="guide-row">
      <a class="guide-main" href="${doc.file}"><span class="guide-icon">${icon(glyph)}</span><span><strong>${doc.label}</strong><span class="guide-description">${escape(doc.description)}</span></span>${icon('arrow')}</a>
      <nav class="guide-topics" aria-label="${doc.label}常用章节">${topics.map(([name, id]) => `<a href="${doc.file}#${id}">${escape(name)}</a>`).join('')}</nav>
    </div>`).join('');
    const sources = guides.filter(guide => guide.references.length).map(({doc, references: refs}) => `<div><dt>${doc.label}</dt><dd>${refs.map(ref => link(ref)).join('')}</dd></div>`).join('');
    return shell({title: '1Panel 运维控制面文档', description: 'AngelFleet 产品范围、技术方案、研发计划与试点验收资料。', file: 'index.html', aliases, scriptVersion, body: `
<main class="home" id="main">
  <section class="home-intro" aria-labelledby="home-title"><div class="home-intro-inner">
    <div class="home-heading"><h1 id="home-title">1Panel 运维控制面</h1>
    <p>在 AngelFleetConsole 集中管理 Linux 节点。首批计划交付节点接入、CPU 与内存概览和访问审计。</p>
    <div class="home-meta"><span>设计版本 ${version}</span><span>${siteMeta.publicationDate}</span><span>${state}</span></div></div>
    <figure class="system-path"><figcaption>首版系统分工</figcaption>
    <dl><div><dt>控制台</dt><dd>AngelFleetConsole</dd></div><div><dt>云端授权与任务</dt><dd>Cloudflare</dd></div><div><dt>节点执行</dt><dd>1Panel Go core/agent</dd></div></dl></figure>
  </div></section>
  <div class="home-body"><section id="guides" aria-labelledby="guides-title"><h2 id="guides-title">文档目录</h2>
    <div class="guide-list">${rows}</div>
    <details class="home-sources"><summary>参考资料与原始记录</summary><dl>${sources}</dl></details></section>
  <aside class="evidence" aria-labelledby="evidence-title"><h2 id="evidence-title">验收进展</h2>
    <dl><div><dt><a href="go-agent-interface-contract.html">GA-01 · 节点接口契约</a></dt><dd>契约与公开样例已验证</dd></div>
    <div><dt><a href="${roadmap.file}#ga-10-如何判断通过">GA-10 · 双租户真机联调</a></dt><dd>待两台 Linux 节点实测</dd></div>
    <div><dt><a href="${design.file}#部署容量与恢复">CAP-01 · 单租户容量</a></dt><dd>待 10,000 节点连续 72 小时验证</dd></div></dl>
  </aside></div>
</main>
<footer class="home-footer"><span>AngelFleet 项目文档</span><a href="${repo}">查看源仓库 ${icon('external')}</a></footer>`});
  }
  function movedPage(file, scriptVersion) {
    const aliases = moves[file];
    return shell({title:'本期功能导图', description:'产品 PRD 功能导图入口。', file, canonicalFile:product.file, aliases, scriptVersion,
      body:`<main class="home" id="main"><div class="home-body"><div><h1>本期功能导图</h1><a href="${aliases['']}">在产品 PRD 中查看功能导图</a></div></div></main>`});
  }
  return {article, home, movedPage};
}
