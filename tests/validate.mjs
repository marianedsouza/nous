// Harness de validacao end-to-end do NOUS Excellence.
// Usa fetch nativo (Node 18+). Captura o cookie de sessao manualmente por papel.
// Uso: node tests/validate.mjs   (com o servidor rodando em BASE)

const BASE = process.env.BASE || 'http://localhost:3000';

let pass = 0, fail = 0;
const fails = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; fails.push(name + (extra ? ` — ${extra}` : '')); console.log(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
}
function section(t) { console.log(`\n== ${t} ==`); }

// ---- cliente com cookie ----
function makeClient() {
  let cookie = '';
  return {
    async req(method, url, body, isForm = false) {
      const headers = {};
      if (cookie) headers.Cookie = cookie;
      let payload;
      if (body != null) {
        if (isForm) { payload = body; }
        else { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
      }
      const res = await fetch(BASE + url, { method, headers, body: payload });
      const setc = res.headers.get('set-cookie');
      if (setc) cookie = setc.split(';')[0];
      let data = null;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) data = await res.json();
      else data = await res.text();
      return { status: res.status, data, headers: res.headers };
    },
    get(u) { return this.req('GET', u); },
    post(u, b) { return this.req('POST', u, b); },
    put(u, b) { return this.req('PUT', u, b); },
    patch(u, b) { return this.req('PATCH', u, b); },
    del(u) { return this.req('DELETE', u); },
    clearCookie() { cookie = ''; },
  };
}

async function login(client, email, password) {
  return client.post('/api/auth/login', { email, password });
}

const round = (n) => Math.round(Number(n) * 100) / 100;

async function main() {
  const rt = makeClient();
  const coz = makeClient();
  const ges = makeClient();
  const anon = makeClient();

  section('Saude e autenticacao');
  check('health responde ok', (await anon.get('/api/health')).data?.ok === true);
  check('login senha errada -> 401', (await login(anon, 'rt@nous.com', 'errada')).status === 401);
  check('login sem corpo -> 400', (await anon.post('/api/auth/login', {})).status === 400);
  check('acesso sem sessao -> 401', (await anon.get('/api/menus')).status === 401);

  const lr = await login(rt, 'rt@nous.com', 'rt123');
  check('login RT -> 200', lr.status === 200 && lr.data?.user?.role === 'rt');
  check('login Cozinha -> 200', (await login(coz, 'cozinha@nous.com', 'cozinha123')).status === 200);
  check('login Gestor -> 200', (await login(ges, 'gestor@nous.com', 'gestor123')).status === 200);
  check('me RT retorna papel rt', (await rt.get('/api/auth/me')).data?.user?.role === 'rt');

  section('Autorizacao por papel');
  check('Cozinha NAO publica cardapio -> 403', (await coz.post('/api/menus/publish')).status === 403);
  check('Gestor NAO cria ficha -> 403', (await ges.post('/api/sheets', { prep: 'X', ingredients: 'a', yield: '1', method: 'm', cost: 1 })).status === 403);
  check('Cozinha NAO atualiza custos fixos -> 403', (await coz.put('/api/costs/fixed', { labor: 1 })).status === 403);
  check('Cozinha NAO cria documento -> 403', (await coz.post('/api/docs', { type: 'POP' })).status === 403);
  check('Cozinha PODE registrar temperatura -> 201', (await coz.post('/api/quality/temps', { type: 'Equipamento', place: 'Teste', value: 4, status: 'Conforme' })).status === 201);
  check('Gestor PODE salvar dados do dia -> 201', (await ges.post('/api/daily', { date: '2026-09-18', clients: 142, price: 39.9, otherRevenue: 0 })).status === 201);

  section('Fichas: cozinha nao ve custo');
  const sheetsCoz = (await coz.get('/api/sheets')).data;
  check('cozinha recebe fichas', Array.isArray(sheetsCoz) && sheetsCoz.length > 0);
  check('cozinha: custo nulo em todas as fichas', sheetsCoz.every(s => s.cost === null));
  const sheetsRt = (await rt.get('/api/sheets')).data;
  check('RT: custo presente nas fichas', sheetsRt.every(s => typeof s.cost === 'number'));

  section('Documentos: cozinha so ve POP');
  const docsCoz = (await coz.get('/api/docs')).data;
  check('cozinha ve apenas POP', docsCoz.every(d => d.type === 'POP'));
  const docsRt = (await rt.get('/api/docs')).data;
  check('RT ve mais tipos que a cozinha', docsRt.length >= docsCoz.length && docsRt.some(d => d.type !== 'POP'));

  section('FLUXO: producao -> custo alimentar -> resultado do dia');
  // Estado base do dia de hoje
  let today = (await rt.get('/api/daily/today')).data;
  const foodBase = today.result.food;
  const resBase = today.result.res;
  check('custo alimentar de hoje > 0 (vem da producao)', foodBase > 0, `food=${round(foodBase)}`);
  // Zera producao do Frango assado (custo 238,40) e confere queda no custo alimentar
  await rt.put('/api/production/2026-09-18/Frango%20assado', { qty: 0 });
  today = (await rt.get('/api/daily/today')).data;
  const foodAfter = today.result.food;
  check('zerar producao do frango reduz custo alimentar em ~238,40',
    round(foodBase - foodAfter) === 238.40, `antes=${round(foodBase)} depois=${round(foodAfter)}`);
  check('resultado do dia sobe quando custo cai',
    round(today.result.res - resBase) === round(foodBase - foodAfter), `deltaRes=${round(today.result.res - resBase)}`);
  // Dobrar producao do arroz (56,50 -> +56,50)
  await rt.put('/api/production/2026-09-18/Arroz%20branco', { qty: 2 });
  const today2 = (await rt.get('/api/daily/today')).data;
  check('dobrar arroz aumenta custo alimentar em ~56,50',
    round(today2.result.food - foodAfter) === 56.50, `delta=${round(today2.result.food - foodAfter)}`);
  // Restaura producao
  await rt.put('/api/production/2026-09-18/Frango%20assado', { qty: 1 });
  await rt.put('/api/production/2026-09-18/Arroz%20branco', { qty: 1 });

  section('FLUXO: custos fixos -> rateio diario');
  const fixed0 = (await rt.get('/api/costs/fixed')).data;
  const rateio0 = (await rt.get('/api/daily/today')).data.result.op;
  const totalFix = fixed0.labor + fixed0.rent + fixed0.utilities + fixed0.taxes + fixed0.other;
  check('rateio diario = total fixo / dias', round(rateio0) === round(totalFix / fixed0.days), `rateio=${round(rateio0)}`);
  await rt.put('/api/costs/fixed', { days: fixed0.days * 2 });
  const rateio1 = (await rt.get('/api/daily/today')).data.result.op;
  check('dobrar dias operacionais reduz rateio pela metade', round(rateio1) === round(rateio0 / 2), `rateio1=${round(rateio1)}`);
  await rt.put('/api/costs/fixed', { days: fixed0.days }); // restaura

  section('FLUXO: publicar / rascunho de cardapio');
  await rt.post('/api/menus', { date: '2026-09-25', items: ['Teste A', 'Teste B'] });
  check('adicionar dia derruba publicacao (rascunho)', (await rt.get('/api/menus')).data.published === false);
  await rt.post('/api/menus/publish');
  check('publicar restaura published=true', (await rt.get('/api/menus')).data.published === true);
  // Cozinha ve o novo dia publicado
  const cozMenus = (await coz.get('/api/menus')).data;
  check('cozinha enxerga cardapio publicado', cozMenus.published === true && cozMenus.menus.some(m => m.date === '2026-09-25'));
  // Exclui o dia de teste
  const del = (await rt.get('/api/menus')).data.menus.find(m => m.date === '2026-09-25');
  check('excluir dia de teste -> ok', (await rt.del('/api/menus/' + del.id)).data?.ok === true);

  section('FLUXO: documento upload -> download -> delete');
  const fd = new FormData();
  const bytes = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], { type: 'application/pdf' }); // "%PDF-1.4"
  fd.append('type', 'Certificados');
  fd.append('expiry', '2027-01-01');
  fd.append('file', bytes, 'teste.pdf');
  const up = await rt.req('POST', '/api/docs', fd, true);
  check('upload de PDF -> 201 com arquivo (hasFile)', up.status === 201 && up.data?.hasFile === true, `status=${up.status}`);
  const newId = up.data?.id;
  const fileRes = await rt.req('GET', `/api/docs/${newId}/file`);
  check('download do arquivo -> 200', fileRes.status === 200);
  check('cozinha NAO baixa doc que nao e POP -> 403', (await coz.req('GET', `/api/docs/${newId}/file`)).status === 403);
  // upload de tipo nao permitido
  const fd2 = new FormData();
  fd2.append('type', 'Certificados');
  fd2.append('file', new Blob(['<html>'], { type: 'text/html' }), 'x.html');
  const upBad = await rt.req('POST', '/api/docs', fd2, true);
  check('upload de tipo nao permitido -> rejeitado (>=400)', upBad.status >= 400, `status=${upBad.status}`);
  check('excluir documento -> ok', (await rt.del('/api/docs/' + newId)).data?.ok === true);

  section('FLUXO: funcionarios toggle');
  const emp0 = (await rt.get('/api/employees')).data[0];
  const before = emp0.course;
  const emp1 = (await rt.patch('/api/employees/' + emp0.id, { course: !before })).data;
  check('alternar treinamento de higiene persiste', emp1.course === !before);
  await rt.patch('/api/employees/' + emp0.id, { course: before }); // restaura

  section('BUG esperado: dia passado novo fica com custo alimentar 0');
  const addPast = await ges.post('/api/daily', { date: '2026-09-10', clients: 100, price: 40, otherRevenue: 0 });
  const results = (await rt.get('/api/costs/results')).data;
  const past = results.find(r => r.date === '2026-09-10');
  check('(diagnostico) dia passado recem-criado tem food=0', past && round(past.food) === 0,
    `food=${past ? round(past.food) : 'n/a'} — confirma limitacao: nao ha como informar custo alimentar de dias != hoje`);

  section('Logout');
  check('logout -> ok', (await rt.post('/api/auth/logout')).data?.ok === true);

  console.log(`\n=========================================`);
  console.log(`RESULTADO: ${pass} PASS / ${fail} FAIL`);
  if (fails.length) { console.log('Falhas:'); fails.forEach(f => console.log('  - ' + f)); }
  console.log(`=========================================`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('ERRO no harness:', e); process.exit(2); });
