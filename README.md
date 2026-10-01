# NOUS Excellence

Sistema profissional de gestão para unidades de alimentação (ex.: Torquatu's).
Backend Express, banco **Postgres no Supabase** (via SDK), arquivos de documento no
**Supabase Storage**, autenticação real por papéis e frontend responsivo.

## Stack

- **Backend:** Node.js + Express — servidor local (dev) e função serverless (Vercel)
- **Banco + arquivos:** Supabase (Postgres + Storage), acessado via `@supabase/supabase-js` com a **secret key** (service role)
- **Auth:** JWT em cookie httpOnly + senhas com hash (bcryptjs)
- **Frontend:** HTML/CSS/JS estáticos, responsivos, consumindo a API

## Arquitetura (importante p/ Vercel)

- `server/api.js` — app Express com **somente a API** (`/api/*`). É o que roda na função serverless.
- `server/app.js` — app para **dev local**: envolve a API e serve os estáticos de `public/`.
- `api/index.js` — entrypoint serverless do Vercel (usa `server/api.js`).
- Na Vercel, os arquivos de `public/` são servidos pelo **CDN** (não pela função); só `/api/*` vai para a função. Isso está configurado em `vercel.json`.

## Papéis de acesso

| Papel | Acesso |
|-------|--------|
| **RT** (Nutricionista) | Total: cardápios, fichas técnicas, produção, funcionários, documentos, qualidade e custos |
| **Cozinha** | Operacional: cardápio de hoje, produção, temperaturas/amostras e apenas POPs; fichas sem valores financeiros |
| **Gestor** | Dashboard de resultado, consulta de cardápios/documentos e dados gerenciais do dia |

As regras de papel são aplicadas **no servidor** (middleware `requireRole`).

## Configuração

1. Crie as tabelas no Supabase (uma vez): **SQL Editor** → cole `supabase/schema.sql` → Run.
   (Garanta que a tabela `docs` tenha as colunas; o schema é idempotente.)
2. Copie `.env.example` para `.env` e preencha:
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_xxxxxxxx
   SUPABASE_DOCS_BUCKET=docs
   JWT_SECRET=<string longa e aleatoria>
   NODE_ENV=development
   ```
   A secret key está em Supabase > **Settings > API Keys > Secret keys**.
   O bucket de Storage `docs` é criado automaticamente no primeiro start.

## Rodar localmente

```bash
npm install
npm run seed:supabase   # popula a demonstracao (DESTRUTIVO: limpa e recria)
npm start               # http://localhost:3000  (mantenha o terminal aberto)
```

Dev com auto-reload: `npm run dev`.

> O servidor local só responde enquanto o processo (`npm start`) estiver rodando.
> Se o login mostrar `fetch failed`, o servidor não está no ar — rode `npm start`.

## Scripts úteis

| Script | O que faz |
|--------|-----------|
| `npm start` | Sobe o servidor local |
| `npm run dev` | Servidor local com `--watch` |
| `npm run seed:supabase` | Recria os dados de demonstração (destrutivo) |
| `npm run db:push:supabase` | Aplica `supabase/schema.sql` (precisa de `SUPABASE_DB_URL`) |
| `npm run db:check:supabase` | Verifica se as tabelas existem (usa a chave publishable) |

## Acessos de demonstração

| Papel | E-mail | Senha |
|-------|--------|-------|
| RT | rt@nous.com | rt123 |
| Cozinha | cozinha@nous.com | cozinha123 |
| Gestor | gestor@nous.com | gestor123 |

> Troque as senhas e o `JWT_SECRET` antes de qualquer uso real.

## Deploy no Vercel

1. Importe o repositório no Vercel (New Project).
2. Em **Settings > Environment Variables**, adicione (para Production e Preview):
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `SUPABASE_DOCS_BUCKET` = `docs`
   - `JWT_SECRET`
   - `NODE_ENV` = `production`
3. Deploy. O `vercel.json` serve `public/` pelo CDN e roteia `/api/*` para a função.

`NODE_ENV=production` ativa o cookie `secure` (HTTPS), que o Vercel já fornece.

## Estrutura

```
api/index.js        # entrypoint serverless (so API)
server/
  api.js            # app Express somente-API (serverless + base do dev)
  app.js            # app dev local = API + estaticos
  index.js          # entrypoint dev local (app.listen)
  db.js             # cliente @supabase/supabase-js + helpers (must/many/maybe/single/countOf)
  seed.js           # seed destrutivo + ensureSeeded (bootstrap se vazio) + bucket de storage
  auth.js           # JWT, hash, middlewares requireAuth/requireRole
  lib.js            # calculos de custo/resultado (consultas em lote, sem N+1)
  routes/           # auth, menus, sheets, production, docs, employees, quality, costs, daily
public/             # login.html, index.html, css/, js/ (frontend responsivo e estatico)
supabase/schema.sql # DDL de todas as tabelas (Postgres)
tests/validate.mjs  # harness de validacao end-to-end (37 checagens HTTP)
docs/               # piloto V5 original (referencia)
vercel.json         # builds (node + static) e rotas
```

## Lógica de resultado

`receita do dia − custo alimentar estimado − rateio diário dos custos operacionais = resultado operacional estimado`

O custo alimentar do dia atual é calculado dinamicamente (cardápio × produção × custo da ficha);
dias passados usam o custo alimentar já registrado.

## Notas de segurança

- Nunca commite o `.env` (está no `.gitignore`). A secret key dá acesso total ao banco/storage.
- Se a secret key vazar, rotacione em Supabase > Settings > API Keys e atualize `.env` e as env vars do Vercel.
- RLS está habilitado nas tabelas; o backend acessa com a secret key (service role), que ignora RLS server-side.
- Recomendações abertas: rate-limit no login e helmet para cabeçalhos de segurança.
