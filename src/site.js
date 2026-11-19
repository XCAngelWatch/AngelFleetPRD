const sidebar = document.querySelector('.sidebar');
const menuButton = document.querySelector('.menu-toggle');
const backdrop = document.querySelector('.nav-backdrop');
const dialog = document.querySelector('.search-dialog');
const searchInput = document.querySelector('#search-input');
const results = document.querySelector('.search-results');
const status = document.querySelector('.search-status');
const records = JSON.parse(document.querySelector('#search-data').textContent);
const escapeHtml = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
let previousFocus;

function setMenu(open) {
  sidebar.classList.toggle('is-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  backdrop.hidden = !open;
  if (open) sidebar.querySelector('button').focus();
}
menuButton.addEventListener('click', () => setMenu(!sidebar.classList.contains('is-open')));
backdrop.addEventListener('click', () => setMenu(false));
sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && sidebar.classList.contains('is-open')) { setMenu(false); menuButton.focus(); }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
});

function openSearch() {
  if (dialog.open) return;
  previousFocus = sidebar.classList.contains('is-open') ? menuButton : document.activeElement;
  setMenu(false);
  dialog.showModal();
  searchInput.focus();
}
document.querySelectorAll('.search-trigger').forEach(button => button.addEventListener('click', openSearch));
document.querySelector('.close-search').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => previousFocus?.focus({preventScroll:true}));
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
document.querySelector('.search-form').addEventListener('submit', event => event.preventDefault());

function highlight(text, query) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0,index)) + '<mark>' + escapeHtml(text.slice(index,index + query.length)) + '</mark>' + escapeHtml(text.slice(index + query.length));
}
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  if (!query) { results.replaceChildren(); status.textContent = '输入关键词查找章节、功能和协议。'; return; }
  const needle = query.toLowerCase();
  const matches = records.filter(record => (record.title + ' ' + record.text).toLowerCase().includes(needle));
  matches.sort((a,b) => Number(b.title.toLowerCase().includes(needle)) - Number(a.title.toLowerCase().includes(needle)));
  status.textContent = matches.length ? `找到 ${matches.length} 个相关段落${matches.length > 30 ? '，显示前 30 个' : ''}` : '没有找到匹配内容，试试“Go”“租约”或“10000”。';
  results.innerHTML = matches.slice(0,30).map(record => {
    const hit = record.text.toLowerCase().indexOf(needle);
    const start = Math.max(0, hit - 40);
    const preview = (start ? '…' : '') + record.text.slice(start, start + 145) + (record.text.length > start + 145 ? '…' : '');
    const path = record.page === document.body.dataset.page ? '' : record.page;
    const href = escapeHtml(`${path}#${record.id}`);
    return `<li><a href="${href}"><span class="result-page">${escapeHtml(record.label ?? record.page)}</span><span class="result-title">${highlight(record.title,query)}</span><span class="result-preview">${highlight(preview,query)}</span></a></li>`;
  }).join('');
});
results.addEventListener('click', event => { if (event.target.closest('a')) dialog.close(); });

const chapterLinks = new Map([...document.querySelectorAll('.toc a')].map(link => [link.hash.slice(1),link]));
const headings = [...document.querySelectorAll('.chapter')];
let scrollPending = false;
function updateLocation() {
  let active = headings[0];
  for (const section of headings) { if (section.getBoundingClientRect().top <= 150) active = section; else break; }
  chapterLinks.forEach(link => link.removeAttribute('aria-current'));
  if (active) chapterLinks.get(active.id.replace(/^chapter-/,''))?.setAttribute('aria-current','location');
  document.querySelector('.back-top').hidden = window.scrollY < 600;
  scrollPending = false;
}
window.addEventListener('scroll', () => { if (!scrollPending) { requestAnimationFrame(updateLocation); scrollPending = true; } }, {passive:true});
updateLocation();
document.querySelector('.back-top').addEventListener('click', () => { window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); });
document.querySelector('.print-button').addEventListener('click', event => { event.preventDefault(); window.print(); });

document.querySelectorAll('.copy-code').forEach(button => button.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(button.parentElement.querySelector('code').textContent);
    button.textContent = '已复制';
  } catch {
    button.textContent = '请选中代码复制';
  }
  setTimeout(() => { button.textContent = '复制代码'; },2200);
}));

async function renderDiagrams() {
  const nodes = [...document.querySelectorAll('.mermaid')];
  if (!nodes.length) return;
  try {
    const {default: mermaid} = await import('./mermaid.js');
    mermaid.initialize({startOnLoad:false, securityLevel:'strict', theme:'base', fontFamily:'-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif', themeVariables:{primaryColor:'#e4f0f1',primaryTextColor:'#173b40',primaryBorderColor:'#85a9ad',lineColor:'#48767b',secondaryColor:'#eef4f4',tertiaryColor:'#f7f8f3'}, flowchart:{useMaxWidth:true,htmlLabels:false}, sequence:{useMaxWidth:true,wrap:true}});
    for (const node of nodes) {
      try {
        const source = node.textContent;
        const {svg} = await mermaid.render(`diagram-${node.dataset.diagram}`, source);
        node.innerHTML = svg;
        node.closest('figure').querySelector('details').open = false;
      } catch {
        node.innerHTML = '<p class="diagram-error">图形暂时无法显示，可展开下方流程源码阅读。</p>';
        const figure = node.closest('figure');
        figure.classList.add('diagram-failed');
        figure.querySelector('details').open = true;
      }
    }
  } catch {
    nodes.forEach(node => { node.innerHTML = '<p class="diagram-error">图形资源未加载，可展开下方流程源码阅读。</p>'; const figure = node.closest('figure'); figure.classList.add('diagram-failed'); figure.querySelector('details').open = true; });
  }
}
renderDiagrams();
