import { api } from '/js/api.js';

const TODAY = '2026-09-18';
const DOC_TYPES = ['ART', 'Comprovante fornecedora PAT', 'Comprovante nutricionista PAT', 'Alvará de localização e funcionamento', 'Alvará sanitário', 'Alvará Corpo de Bombeiros', 'Cartão CNPJ', 'Contrato social', 'Laudo de dedetização', 'Laudo de limpeza da caixa d’água', 'Certificados', 'POP'];
const ROLE_LABEL = { rt: 'Nutricionista / RT', cozinha: 'Cozinha', gestor: 'Gestor / Proprietário' };

const NAVS = {
  rt: [['rtHome', 'Painel da RT'], ['menus', 'Cardápio mensal'], ['sheets', 'Fichas técnicas'], ['production', 'Produção do dia'], ['employees', 'Funcionários'], ['docs', 'Documentos'], ['quality', 'Qualidade'], ['costs', 'Custos / Resultado']],
  cozinha: [['kitchenHome', 'Início'], ['menus', 'Cardápio do mês'], ['production', 'Produção do dia'], ['quality', 'Temperaturas / Amostras'], ['docs', 'POPs']],
  gestor: [['managerHome', 'Dashboard'], ['menus', 'Cardápios'], ['docs', 'Documentos'], ['managerEdit', 'Dados do dia']],
};

let ME = null;

// ---------- utils ----------
const $ = (id) => document.getElementById(id);
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (d) => { if (!d) return '—'; const a = d.split('-'); return `${a[2]}/${a[1]}/${a[0]}`; };
function badge(s) {
  const c = ['Vigente', 'Completo', 'Publicado', 'Conforme'].includes(s) ? 'ok' : (s.includes('Venc') || s.includes('Não')) ? 'bad' : 'warn';
  return `<span class="badge ${c}">${s}</span>`;
}
function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (err ? ' err' : '');
  setTimeout(() => { t.className = 'toast'; }, 2600);
}
function esc(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

// ---------- navegacao ----------
function role() { return ME.role; }
function buildNav() {
  const n = $('nav'); n.innerHTML = '';
  NAVS[role()].forEach(([id, l]) => {
    const b = document.createElement('button');
    b.textContent = l; b.dataset.nav = id;
    b.onclick = () => go(id);
    n.appendChild(b);
  });
}
function go(id) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('on'));
  const el = $(id); if (el) el.classList.add('on');
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === id));
  const m = NAVS[role()].find(x => x[0] === id);
  $('title').textContent = m ? m[1] : 'NOUS Excellence';
  closeDrawer();
  render();
}

// ---------- drawer (mobile) ----------
function setDrawer(open) {
  const side = $('sidebar'), scrim = $('scrim'), btn = $('menuToggle');
  side.classList.toggle('open', open);
  scrim.classList.toggle('show', open);
  scrim.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}
function closeDrawer() { setDrawer(false); }
function toggleDrawer() { $('sidebar').classList.contains('open') ? setDrawer(false) : setDrawer(true); }

// ---------- render principal ----------
async function render() {
  document.querySelectorAll('.rtOnly').forEach(x => x.style.display = role() === 'rt' ? 'block' : 'none');
  const active = document.querySelector('.page.on');
  const id = active ? active.id : null;

  try {
    // Home da RT
    if (id === 'rtHome') await renderRtHome();
    if (id === 'kitchenHome') await renderKitchenHome();
    if (id === 'managerHome') await renderManagerHome();
    if (id === 'menus') await renderMenus();
    if (id === 'sheets') await renderSheets();
    if (id === 'production') await renderProduction();
    if (id === 'docs') await renderDocs();
    if (id === 'employees') await renderEmployees();
    if (id === 'quality') await renderQuality();
    if (id === 'costs') await renderCosts();
    if (id === 'managerEdit') { /* form apenas */ }
  } catch (e) {
    toast(e.message, true);
  }
}

async function renderRtHome() {
  const [docs, emps, quality, daily] = await Promise.all([
    api.get('/api/docs'), api.get('/api/employees'), api.get('/api/quality'), api.get('/api/daily/today'),
  ]);
  const sheets = await api.get('/api/sheets');
  const fcost = daily.result.food;
  $('rtKpi').innerHTML =
    kpi('Documentos', docs.length, 'controlados') +
    kpi('Funcionários', emps.length, 'cadastros') +
    kpi('Qualidade', quality.attention, 'registro(s) para atenção') +
    kpi('Custo alimentar hoje', money(fcost), '');
  const menusInfo = await api.get('/api/menus');
  $('rtAlerts').innerHTML =
    `<p>${quality.attention ? badge('Requer análise') : 'Sem alertas de temperatura'}</p>` +
    `<p>${menusInfo.published ? badge('Publicado') : 'Cardápio mensal ainda não publicado'}</p>` +
    `<p><b>${sheets.length}</b> ficha(s) técnica(s) cadastrada(s).</p>`;
}
function kpi(label, val, sub) {
  return `<div class="card kpi"><span>${label}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
}

async function renderKitchenHome() {
  const menusInfo = await api.get('/api/menus');
  const m = menusInfo.menus.find(x => x.date === TODAY);
  let sheets = await api.get('/api/sheets');
  const has = (p) => sheets.some(s => s.prep.toLowerCase() === p.toLowerCase());
  $('kToday').innerHTML = (m && menusInfo.published)
    ? `<div class="day today"><b>${fmt(m.date)} • HOJE</b>${m.items.map(p => `<div class="row"><span>${esc(p)}</span><span>${has(p) ? '✓ ficha disponível' : 'ficha pendente'}</span></div>`).join('')}</div>`
    : '<div class="notice">Cardápio não publicado.</div>';
}

async function renderManagerHome() {
  const [{ today, result }, results] = await Promise.all([
    api.get('/api/daily/today'), api.get('/api/costs/results'),
  ]);
  $('mgrKpi').innerHTML =
    kpi('Preço médio/refeição', money(today.price), '') +
    kpi('Custo total/refeição', money(result.costClient), '') +
    kpi('Resultado estimado hoje', money(result.res), '') +
    kpi('Margem estimada', result.margin.toFixed(1).replace('.', ',') + '%', '');
  $('mgrSummary').innerHTML =
    `<p>Refeições hoje: <b>${today.clients}</b></p>` +
    `<p>Receita estimada: <b>${money(result.rev)}</b></p>` +
    `<p>Custo alimentar: <b>${money(result.food)}</b></p>` +
    `<p>Rateio operacional: <b>${money(result.op)}</b></p>` +
    `<p class="small">Resultado operacional estimado; não é automaticamente lucro líquido.</p>`;
  $('dayResults').innerHTML = results.slice().reverse().map(r => {
    const pct = Math.max(5, Math.min(100, (r.res / 3500) * 100));
    return `<div style="margin-bottom:12px"><div class="row"><span>${fmt(r.date)}</span><b>${money(r.res)}</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');
}

async function renderMenus() {
  const info = await api.get('/api/menus');
  $('menuStatus').innerHTML = info.published ? badge('Publicado') : badge('Rascunho');
  $('menuList').innerHTML = info.menus.map(x =>
    `<div class="day ${x.date === TODAY ? 'today' : ''}"><b>${fmt(x.date)} ${x.date === TODAY ? '• HOJE' : ''}</b>` +
    `<div class="small" style="white-space:pre-line;margin-top:7px">${x.items.map(esc).join('\n')}</div>` +
    `${role() === 'rt' ? `<button class="mini" data-delmenu="${x.id}">Excluir dia</button>` : ''}</div>`
  ).join('');
  $('menuList').querySelectorAll('[data-delmenu]').forEach(b =>
    b.onclick = async () => { await api.del('/api/menus/' + b.dataset.delmenu); toast('Dia removido'); render(); });
}

async function renderSheets() {
  const sheets = await api.get('/api/sheets');
  $('sheetCards').innerHTML = sheets.map(s =>
    `<div class="card"><b>${esc(s.prep)}</b><div class="small">${esc(s.cat || '—')} • Rev. ${esc(s.rev || '—')}</div>` +
    `<p><b>Rendimento:</b> ${esc(s.yield)}</p>` +
    `<div class="docactions"><button class="mini" data-viewsheet="${s.id}">👁 Ver ficha</button>` +
    `${role() === 'rt' ? `<button class="mini" data-delsheet="${s.id}">Excluir</button>` : ''}</div></div>`
  ).join('');
  $('sheetCards').querySelectorAll('[data-viewsheet]').forEach(b => b.onclick = () => viewSheet(b.dataset.viewsheet));
  $('sheetCards').querySelectorAll('[data-delsheet]').forEach(b =>
    b.onclick = async () => { await api.del('/api/sheets/' + b.dataset.delsheet); toast('Ficha removida'); render(); });
}

async function viewSheet(id) {
  const s = await api.get('/api/sheets/' + id);
  const financial = s.cost != null;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Ficha Técnica - ${esc(s.prep)}</title><style>body{font-family:Arial;max-width:850px;margin:35px auto;color:#302a24}h1{color:#574126;border-bottom:3px solid #dda543;padding-bottom:10px}pre{white-space:pre-wrap;background:#f7f4ee;padding:15px}.box{border:1px solid #ddd;padding:14px;margin:10px 0}</style></head><body><h1>NOUS Excellence • Ficha Técnica</h1><h2>${esc(s.prep)}</h2><div class=box><b>Categoria:</b> ${esc(s.cat || '—')} &nbsp; <b>Revisão:</b> ${esc(s.rev || '—')}<br><b>Rendimento padrão:</b> ${esc(s.yield)}</div><h3>Ingredientes / quantidades</h3><pre>${esc(s.ingredients)}</pre><h3>Modo de preparo</h3><p>${esc(s.method)}</p>${financial ? `<div class=box><b>Custo total da receita:</b> ${money(s.cost)}</div>` : ''}<p><b>Observações:</b> ${esc(s.obs || '—')}</p><button onclick="print()">Imprimir / Salvar PDF</button></body></html>`);
  w.document.close();
}

async function renderProduction() {
  const prod = await api.get('/api/production/' + TODAY);
  if (!prod.items.length) { $('prodList').innerHTML = 'Sem cardápio.'; return; }
  const opts = [0, .5, 1, 1.5, 2, 3];
  $('prodList').innerHTML = prod.items.map(it =>
    `<div class="row"><div><b>${esc(it.prep)}</b><div class="small">${it.hasSheet ? `Ficha padrão disponível • ${esc(it.yield)}` : '⚠ ficha técnica pendente'}</div>` +
    `${it.hasSheet ? `<button class="mini" data-viewsheet="${it.sheetId}">Consultar ficha ${role() === 'cozinha' ? 'operacional' : ''}</button>` : ''}</div>` +
    `<div style="min-width:190px"><label>Receitas/lotes</label><select data-prod="${esc(it.prep)}">${opts.map(v => `<option value="${v}" ${it.qty === v ? 'selected' : ''}>${v === 0 ? 'Não produzido' : v + ' receita/lote'}</option>`).join('')}</select></div></div>`
  ).join('');
  $('prodList').querySelectorAll('[data-viewsheet]').forEach(b => b.onclick = () => viewSheet(b.dataset.viewsheet));
  $('prodList').querySelectorAll('[data-prod]').forEach(sel =>
    sel.onchange = async () => {
      await api.put(`/api/production/${TODAY}/${encodeURIComponent(sel.dataset.prod)}`, { qty: Number(sel.value) });
      toast('Produção atualizada');
    });
}

async function renderDocs() {
  const docs = await api.get('/api/docs');
  $('docCards').innerHTML = docs.map(d =>
    `<div class="card"><div style="font-size:24px">📄</div><b>${esc(d.type)}</b>` +
    `<div class="small">${d.expiry ? 'Validade: ' + fmt(d.expiry) : 'Sem validade'}</div>` +
    `<div class="docactions"><button class="mini" data-viewdoc="${d.id}" ${d.hasFile ? '' : 'disabled'}>👁 Visualizar</button>` +
    `<button class="mini" data-dldoc="${d.id}" ${d.hasFile ? '' : 'disabled'}>⬇ Download</button>` +
    `${role() === 'rt' ? `<button class="mini" data-deldoc="${d.id}">Excluir</button>` : ''}</div></div>`
  ).join('');
  $('docCards').querySelectorAll('[data-viewdoc]').forEach(b => b.onclick = () => window.open(`/api/docs/${b.dataset.viewdoc}/file`, '_blank'));
  $('docCards').querySelectorAll('[data-dldoc]').forEach(b => b.onclick = () => window.open(`/api/docs/${b.dataset.dldoc}/file?download=1`, '_blank'));
  $('docCards').querySelectorAll('[data-deldoc]').forEach(b =>
    b.onclick = async () => { await api.del('/api/docs/' + b.dataset.deldoc); toast('Documento removido'); render(); });
}

async function renderEmployees() {
  const emps = await api.get('/api/employees');
  $('empCards').innerHTML = emps.map(e =>
    `<div class="card"><b>${esc(e.name)}</b><div class="small">${esc(e.job)} • Admissão ${fmt(e.admission)}</div>` +
    `<p>Treinamento higiene: ${e.course ? badge('Completo') : badge('Pendente')}</p>` +
    `<p>Carteira sanitária: ${e.health ? badge('Completo') : badge('Pendente')}</p>` +
    `<button class="mini" data-emp="${e.id}" data-k="course">Alternar curso</button> ` +
    `<button class="mini" data-emp="${e.id}" data-k="health">Alternar carteira</button></div>`
  ).join('');
  $('empCards').querySelectorAll('[data-emp]').forEach(b =>
    b.onclick = async () => {
      const cur = emps.find(x => x.id === Number(b.dataset.emp));
      await api.patch('/api/employees/' + b.dataset.emp, { [b.dataset.k]: !cur[b.dataset.k] });
      toast('Atualizado'); render();
    });
}

async function renderQuality() {
  const q = await api.get('/api/quality');
  $('qualityList').innerHTML =
    q.temps.map(t => `<div class="day"><b>${esc(t.place)}</b> • ${t.value}°C ${badge(t.status === 'Conforme' ? 'Conforme' : 'Requer análise')}<div class="small">${esc(t.dt)} • ${esc(t.type)}</div></div>`).join('') +
    q.samples.map(s => `<div class="day"><b>Amostra: ${esc(s.prep)}</b><div class="small">${esc(s.date)} • ${esc(s.time)}</div></div>`).join('');
}

async function renderCosts() {
  const [fixed, results] = await Promise.all([api.get('/api/costs/fixed'), api.get('/api/costs/results')]);
  const ff = $('fixedForm');
  ['labor', 'rent', 'utilities', 'taxes', 'other', 'days'].forEach(k => { if (ff[k]) ff[k].value = fixed[k]; });
  const cols = ['Data', 'Clientes', 'Receita', 'Alimentos', 'Rateio operacional', 'Custo/refeição', 'Resultado estimado', 'Margem'];
  $('costTable').innerHTML = `<div class="tw"><table class="resp"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
    results.map(r => `<tr>` +
      `<td data-label="Data">${fmt(r.date)}</td>` +
      `<td data-label="Clientes">${r.clients}</td>` +
      `<td data-label="Receita">${money(r.rev)}</td>` +
      `<td data-label="Alimentos">${money(r.food)}</td>` +
      `<td data-label="Rateio operacional">${money(r.op)}</td>` +
      `<td data-label="Custo/refeição">${money(r.costClient)}</td>` +
      `<td data-label="Resultado estimado"><b>${money(r.res)}</b></td>` +
      `<td data-label="Margem">${r.margin.toFixed(1).replace('.', ',')}%</td>` +
      `</tr>`).join('') +
    `</tbody></table></div>`;
}

// ---------- forms ----------
function bindForm(id, handler) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await handler(new FormData(el), el); render(); }
    catch (ex) { toast(ex.message, true); }
  });
}

function setupForms() {
  bindForm('menuForm', async (f, el) => {
    await api.post('/api/menus', { date: f.get('date'), items: f.get('items').split('\n') });
    toast('Dia adicionado ao mês'); el.reset();
  });
  $('publishBtn').onclick = async () => { await api.post('/api/menus/publish'); toast('Cardápio mensal publicado'); render(); };

  bindForm('sheetForm', async (f, el) => {
    await api.post('/api/sheets', {
      prep: f.get('prep'), cat: f.get('cat'), ingredients: f.get('ingredients'),
      yield: f.get('yield'), cost: f.get('cost'), method: f.get('method'), rev: f.get('rev'), obs: f.get('obs'),
    });
    toast('Ficha salva'); el.reset();
  });

  bindForm('empForm', async (f, el) => {
    await api.post('/api/employees', { name: f.get('name'), job: f.get('job'), admission: f.get('admission') });
    toast('Funcionário cadastrado'); el.reset();
  });

  bindForm('tempForm', async (f, el) => {
    await api.post('/api/quality/temps', { type: f.get('type'), place: f.get('place'), value: f.get('value'), status: f.get('status') });
    toast('Temperatura registrada'); el.reset();
  });

  bindForm('sampleForm', async (f, el) => {
    await api.post('/api/quality/samples', { prep: f.get('prep'), time: f.get('time') });
    toast('Amostra registrada'); el.reset();
  });

  bindForm('fixedForm', async (f) => {
    await api.put('/api/costs/fixed', {
      labor: f.get('labor'), rent: f.get('rent'), utilities: f.get('utilities'),
      taxes: f.get('taxes'), other: f.get('other'), days: f.get('days'),
    });
    toast('Custos atualizados');
  });

  bindForm('dailyForm', async (f) => {
    await api.post('/api/daily', {
      date: f.get('date'), clients: f.get('clients'), price: f.get('price'), otherRevenue: f.get('otherRevenue'),
    });
    toast('Dados do dia salvos');
  });

  // botoes "quick" de navegacao
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));

  // select de tipos de documento
  $('docType').innerHTML = DOC_TYPES.map(x => `<option>${x}</option>`).join('');

  // upload de documento via FormData
  $('docForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const el = e.target;
    const fd = new FormData(el);
    try { await api.postForm('/api/docs', fd); toast('Documento anexado'); el.reset(); render(); }
    catch (ex) { toast(ex.message, true); }
  });
}

// ---------- bootstrap ----------
async function boot() {
  try {
    const { user } = await api.get('/api/auth/me');
    ME = user;
  } catch {
    location.href = '/login';
    return;
  }
  $('userName').textContent = ME.name;
  $('userRole').textContent = ROLE_LABEL[ME.role] || ME.role;
  $('logoutBtn').onclick = async () => { await api.post('/api/auth/logout'); location.href = '/login'; };

  // drawer mobile
  $('menuToggle').onclick = toggleDrawer;
  $('scrim').onclick = closeDrawer;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  // fecha o drawer ao voltar para desktop
  window.matchMedia('(min-width:901px)').addEventListener('change', (ev) => { if (ev.matches) closeDrawer(); });

  setupForms();
  buildNav();
  go(role() === 'rt' ? 'rtHome' : role() === 'cozinha' ? 'kitchenHome' : 'managerHome');
}

boot();
