# NOUS Excellence

Sistema profissional de gestão para unidades de alimentação (ex.: Torquatu's).
Backend Express (serverless-ready), banco Postgres no Supabase, autenticação real
por papéis e frontend em arquivos separados consumindo a API.

## Stack

- **Backend:** Node.js + Express — roda como servidor local (dev) ou função serverless (Vercel)
- **Banco:** Postgres no Supabase (driver `pg`)
- **Auth:** JWT em cookie httpOnly + senhas com hash (bcryptjs)
- **Uploads:** arquivos de documento gravados como `bytea` no Postgres (sem disco — compatível com serverless)
- **Frontend:** HTML/CSS/JS separados, responsivo, consumindo a API

## Papéis de acesso

| Papel | Acesso |
|-------|--------|
| **RT** (Nutricionista) | Total: cardápios, fichas técnicas, produção, funcionários, documentos, qualidade e custos |
| **Cozinha** | Operacional: cardápio de hoje, produção, temperaturas/amostras e apenas POPs; fichas sem valores financeiros |
| **Gestor** | Dashboard de resultado, consulta de cardápios/documentos e dados gerenciais do dia |

As regras de papel são aplicadas **no servidor** (middleware `requireRole`).

## Configuração

1. Crie as tabelas no Supabase (uma vez):
   - **SQL Editor:** cole `supabase/schema.sql` e rode; ou
   - **Script:** com `SUPABASE_DB_URL` no `.env`, rode `npm run db:push:supabase`.
2. Copie `.env.example` para `.env` e preencha:
   ```
   SUPABASE_DB_URL=postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:6543/postgres
   JWT_SECRET=<string longa e aleatoria>
   NODE_ENV=development
   ```
   A `SUPABASE_DB_URL` está em Supabase > Project Settings > Database > Connection string (URI).
   Para serverless (Vercel), prefira a porta **6543** (pooler em modo Transaction).

## Rodar localmente

```bash
npm install
npm run seed:supabase   # popula a demonstracao (DESTRUTIVO: limpa e recria)
npm start               # http://localhost:3000
```

Dev com auto-reload: `npm run dev`.

Se o banco estiver vazio no primeiro acesso, o app faz um **bootstrap não-destrutivo**
inserindo a demonstração automaticamente.

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

1. Importe o repositório no Vercel.
2. Em **Settings > Environment Variables**, adicione:
   - `SUPABASE_DB_URL` (connection string, porta 6543)
   - `JWT_SECRET`
   - `NODE_ENV=production`
3. Deploy. O `vercel.json` roteia todas as requisições para a função `api/index.js`,
   que reaproveita o mesmo app Express (`server/app.js`).

O `NODE_ENV=production` ativa o cookie `secure` (HTTPS), que o Vercel já fornece.

## Estrutura

```
api/
  index.js          # entrypoint serverless do Vercel (embrulha o app Express)
server/
  app.js            # app Express (API + estatico + bootstrap) — usado por dev e Vercel
  index.js          # entrypoint de dev local (app.listen)
  db.js             # pool pg + helpers (q, q1, exec, tx) + type parsers
  seed.js           # seed destrutivo (manual) + ensureSeeded (bootstrap se vazio)
  auth.js           # JWT, hash, middlewares requireAuth/requireRole
  lib.js            # cálculos de custo/resultado (async)
  routes/           # auth, menus, sheets, production, docs, employees, quality, costs, daily
public/             # login.html, index.html, css/, js/ (frontend responsivo)
scripts/            # supabase-migrate.mjs, supabase-check.mjs
supabase/schema.sql # DDL de todas as tabelas (Postgres)
tests/validate.mjs  # harness de validacao end-to-end (HTTP)
docs/               # piloto V5 original (referencia)
vercel.json         # config de deploy
```

## Lógica de resultado

`receita do dia − custo alimentar estimado − rateio diário dos custos operacionais = resultado operacional estimado`

O custo alimentar do dia atual é calculado dinamicamente (cardápio × produção × custo da ficha);
dias passados usam o custo alimentar já registrado.

## Notas de segurança

- Nunca commite o `.env` (já está no `.gitignore`). A `SUPABASE_DB_URL` e a `service_role key` dão acesso total ao banco.
- RLS está habilitado nas tabelas; o backend acessa via connection string (não pela chave publishable).
- Recomendações abertas: rate-limit no login e helmet para cabeçalhos de segurança.
