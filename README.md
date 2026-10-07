# ResolveAi

Sistema web de gestão de ocorrências com cadastro de solicitantes, acompanhamento de status, comentários, avaliações e aprovação administrativa para acesso de gestores.

## Arquitetura

### Aplicação publicada no Render

```mermaid
flowchart LR
    B[ navegador ] --> F[Frontend React + Vite<br/>Render Static Site]
    B -->|HTTPS /api| A[API Express + TypeScript<br/>Render Web Service]
    F -->|requisições REST| A
    A --> M[Autenticação JWT e autorização por papel]
    M --> S[Controllers e services]
    S --> R[PostgresRepository]
    R --> N[(Neon PostgreSQL)]
    N --> U[users e ocorrências]
    N --> Q[pedidos de acesso a gestor]
```

O frontend e a API são serviços separados no Render. O navegador chama a URL pública da API; a API conecta-se ao Neon por `DATABASE_URL`. O banco não é incluído nas imagens Docker.

### Execução local com Docker Compose

```mermaid
flowchart LR
    B[ navegador ] -->|localhost:8080| W[Nginx<br/>React estático + proxy]
    W -->|/api| A[Express API<br/>porta interna 3333]
    W -->|/health| A
    A --> P[(Neon PostgreSQL<br/>externo)]
```

Nessa configuração, o Nginx serve o frontend e encaminha `/api` para a API pela rede privada do Compose. O serviço API usa a mesma `DATABASE_URL` do Neon.

## Funcionalidades

- Cadastro e autenticação com senha protegida por bcrypt e sessão JWT.
- Cadastro público sempre cria o papel `SOLICITANTE`.
- Criação e acompanhamento de ocorrências, filtros, comentários, histórico, avaliações e indicadores.
- Solicitantes podem pedir acesso de gestor; somente um usuário `ADMIN` pode aprovar ou recusar esses pedidos.
- Aprovar um pedido promove a conta para `GESTOR`; o fluxo não oferece promoção pública para `ADMIN`.

## Tecnologias

- Frontend: React, TypeScript, Vite e Lucide.
- Backend: Node.js, Express, TypeScript, bcrypt e JWT.
- Banco de dados: PostgreSQL gerenciado pelo Neon.
- Publicação atual: frontend estático e API separados no Render.
- Contêineres locais: Docker Compose, Nginx e API Node.

## Requisitos

- Node.js 22 ou superior e npm.
- Docker Desktop com Docker Compose, para a execução em contêineres.
- Projeto PostgreSQL no Neon e uma connection string válida.

## Banco de dados

Para um banco Neon novo, execute `database/02_schema.postgres.sql` no SQL Editor do Neon.

Para um banco existente que ainda não tem suporte ao fluxo de gestores, execute `database/03_manager_access_migration.sql`. A migração amplia os papéis permitidos e cria a tabela de solicitações. Não execute o schema SQL Server `database/01_schema.sql` no Neon.

O primeiro administrador deve ser promovido manualmente no Neon, depois que a conta tiver sido cadastrada e o endereço confirmado. Substitua o e-mail pelo da conta correta:

```sql
UPDATE users
SET role = 'ADMIN', updated_at = NOW()
WHERE lower(email) = lower('seu-email@exemplo.com')
RETURNING id, name, email, role;
```

Confira a linha retornada antes de continuar. Não compartilhe a `DATABASE_URL`, porque ela contém credenciais.

## Testes e builds

Os testes do backend verificam o cadastro público, regras dos pedidos de acesso e autorização administrativa:

```powershell
Set-Location backend
npm ci
npm test
npm run build
```

Para validar o frontend:

```powershell
Set-Location frontend
npm ci
npm run build
```

O build Docker da API executa `npm test` e `npm run build` antes de gerar a imagem de runtime.

## Desenvolvimento local sem Docker

Terminal 1, API:

```powershell
Set-Location backend
npm ci
$env:DATABASE_URL = "sua-connection-string-do-neon"
$env:JWT_SECRET = "um-segredo-local-longo-e-aleatorio"
npm run dev
```

Terminal 2, frontend:

```powershell
Set-Location frontend
npm ci
$env:VITE_API_URL = "http://localhost:3333/api"
npm run dev
```

Abra `http://localhost:5173`. O backend fica em `http://localhost:3333`; o health check é `http://localhost:3333/health`.

## Executar com Docker Compose

Na raiz do repositório, copie o modelo de ambiente e edite `.env` com os valores do seu Neon:

```powershell
Copy-Item .env.example .env
```

Preencha `DATABASE_URL` com a connection string do Neon e `JWT_SECRET` com um segredo aleatório forte. O arquivo `.env` é ignorado pelo Git e pelo Docker.

Suba os serviços:

```powershell
docker compose up --build -d
```

Acesse `http://localhost:8080`. Confirme a API em `http://localhost:8080/health` e o Nginx em `http://localhost:8080/healthz`.

Comandos úteis:

```powershell
docker compose ps
docker compose logs -f api web
docker compose down
```

Para construir imagens separadas manualmente:

```powershell
docker build --target api -t resolveai-api .
docker build --target web -t resolveai-web .
```

## Publicação no Render

### Backend

- Root Directory: `backend`
- Build Command: `npm ci --include=dev && npm test && npm run build`
- Start Command: `npm start`
- Variáveis: `DATABASE_URL`, `JWT_SECRET` e `NODE_ENV=production`

### Frontend

- Root Directory: `frontend`
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Variável de build `VITE_API_URL`: URL pública do backend terminando em `/api`, por exemplo `https://seu-backend.onrender.com/api`.

Depois de alterar variáveis Vite, faça um novo deploy do frontend. Valores `VITE_*` são incorporados ao bundle durante o build.

## Papéis

| Papel | Permissões |
|---|---|
| `SOLICITANTE` | Criar e acompanhar as próprias ocorrências; solicitar acesso de gestor. |
| `GESTOR` | Ver e atualizar ocorrências; usar indicadores. |
| `ADMIN` | Permissões de gestor e análise de pedidos de acesso. |

A autorização é aplicada pelo backend; ocultar opções no frontend não substitui as verificações nas rotas.
