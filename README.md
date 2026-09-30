# NOUS Excellence

Sistema profissional de gestão para unidades de alimentação (ex.: Torquatu's).
Evolução do piloto V5 (arquivo único + localStorage) para uma aplicação full-stack
com backend, banco de dados e autenticação real por papéis.

## Stack

- **Backend:** Node.js + Express (API REST)
- **Banco:** SQLite via módulo nativo do Node (`node:sqlite`) — sem dependências nativas
- **Auth:** JWT em cookie httpOnly + senhas com hash (bcryptjs)
- **Upload:** multer (documentos gravados em disco em `uploads/`)
- **Frontend:** HTML/CSS/JS separados, consumindo a API

## Papéis de acesso

| Papel | Acesso |
|-------|--------|
| **RT** (Nutricionista) | Total: cardápios, fichas técnicas, produção, funcionários, documentos, qualidade e custos |
| **Cozinha** | Operacional: cardápio de hoje, produção, temperaturas/amostras e apenas POPs; fichas sem valores financeiros |
| **Gestor** | Dashboard de resultado, consulta de cardápios/documentos e dados gerenciais do dia |

As regras de papel são aplicadas **no servidor** (middleware `requireRole`), não só na interface.

## Como rodar

```bash
npm install          # instala dependências
cp .env.example .env # ajuste JWT_SECRET em produção
npm run seed         # popula dados de demonstração (opcional; roda automático se o banco estiver vazio)
npm start            # sobe em http://localhost:3000
```

Desenvolvimento com auto-reload: `npm run dev`.

## Acessos de demonstração

| Papel | E-mail | Senha |
|-------|--------|-------|
| RT | rt@nous.com | rt123 |
| Cozinha | cozinha@nous.com | cozinha123 |
| Gestor | gestor@nous.com | gestor123 |

> Troque as senhas e o `JWT_SECRET` antes de qualquer uso real.

## Estrutura

```
server/
  index.js          # app Express, monta rotas e serve o frontend
  db.js             # conexão SQLite + schema (migrate)
  seed.js           # dados de demonstração + ensureSeeded
  auth.js           # JWT, hash, middlewares requireAuth/requireRole
  lib.js            # cálculos de custo/resultado no servidor
  routes/           # auth, menus, sheets, production, docs, employees, quality, costs, daily
public/
  login.html        # tela de login
  index.html        # aplicação
  css/styles.css
  js/api.js         # cliente HTTP
  js/app.js         # lógica da interface
data/               # banco SQLite (gitignored)
uploads/            # arquivos de documentos (gitignored)
docs/               # piloto V5 original, guardado como referência
```

## Lógica de resultado

`receita do dia − custo alimentar estimado − rateio diário dos custos operacionais = resultado operacional estimado`

O custo alimentar do dia atual é calculado dinamicamente (cardápio × produção × custo da ficha);
dias passados usam o custo alimentar já registrado.

## Notas para produção

- Defina `JWT_SECRET` forte e `NODE_ENV=production` (ativa cookie `secure`).
- Sirva atrás de HTTPS.
- Faça backup do arquivo `data/nous.db` e da pasta `uploads/`.
- A data "de hoje" do sistema é `2026-09-18` por padrão (herdada do piloto); ajuste via `SYSTEM_TODAY` no `.env` quando for para uso real.
