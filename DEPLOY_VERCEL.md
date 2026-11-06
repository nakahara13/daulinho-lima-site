# Publicar na Vercel

O projeto oferece duas saídas: o Worker original para Sites/Cloudflare e uma função Node.js para Vercel. O build para Vercel cria `public/` com CSS, JavaScript e favicon. As páginas HTML e a API são atendidas por `api/site.js`.

## Corrigir o erro de diretório de saída

1. Envie os arquivos atualizados deste projeto para o repositório GitHub, incluindo `vercel.json`, `api/`, `server/`, os scripts novos, `package.json` e `package-lock.json`.
2. Nas configurações do projeto na Vercel, selecione a pasta que contém `package.json` e `vercel.json` como **Root Directory**. Se esses arquivos estão na raiz do repositório, mantenha o campo vazio.
3. Confira as configurações de build:
   - **Framework Preset:** Other.
   - **Build Command:** `npm run build:vercel`.
   - **Output Directory:** `public`.
   - **Install Command:** padrão (`npm install`).
   - **Node.js:** 22.x ou 24.x.
4. Faça um novo deploy com o commit atualizado. O `vercel.json` já declara o comando de build, diretório de saída e rotas.

Também é possível validar a saída localmente:

```sh
npm install
npm run build:vercel
npm test
```

Não defina `dist/server` como diretório público: ele contém código de servidor, não uma página HTML estática.

## Ativar o blog e o painel

A Vercel não mantém o SQLite local entre execuções. Nesta versão, posts, comentários e imagens de capa são persistidos em um banco remoto libSQL/Turso. As capas ficam no próprio banco, com limite de 3 MB por imagem, sem outro serviço de arquivos.

Crie um banco libSQL no Turso, copie sua URL e gere um token de acesso. Cadastre em **Settings → Environment Variables** na Vercel, para os ambientes que for utilizar:

| Variável | Valor |
| --- | --- |
| `TURSO_DATABASE_URL` | URL do banco, no formato `libsql://...turso.io`. |
| `TURSO_AUTH_TOKEN` | Token de acesso ao banco. |
| `ADMIN_USERNAME` | Usuário do painel; padrão: `admin`. |
| `ADMIN_PASSWORD` | Senha própria com pelo menos 16 caracteres. |

Faça **Redeploy** após cadastrar as variáveis. O build prepara as tabelas e registra as migrações aplicadas. O primeiro acesso inicializa o conteúdo de exemplo; alterações posteriores ficam salvas no banco. A configuração local usa outro banco: os dados de `data/` não são enviados automaticamente.

Abra `https://seu-dominio/admin`. O navegador pedirá o usuário e a senha administrativa. Na Vercel, o painel usa essas credenciais; o login com ChatGPT continua reservado à hospedagem original do Sites.

Sem as variáveis do banco, a landing page e os artigos demonstrativos ficam disponíveis para visualização. Publicações, comentários e uploads ficam desabilitados, com uma mensagem explícita. Sem `ADMIN_PASSWORD`, o painel permanece bloqueado. Tokens e senhas não são enviados ao navegador.

Para preparar manualmente um banco, coloque as variáveis em `.env.local` (ignorado pelo Git) e execute:

```sh
npm run db:setup:vercel
```

## Arquivos da adaptação

- `vercel.json`: build, diretório de saída, inclusão do Worker e rewrites.
- `api/site.js`: entrada da função Vercel.
- `server/vercel.js`: adaptação das requisições, autenticação administrativa e modo demonstrativo.
- `server/turso.js`: banco persistente e armazenamento de capas.
- `scripts/build-vercel.mjs`: gera `public/` e aplica as migrações configuradas.
- `scripts/setup-vercel-db.mjs`: migrações versionadas e idempotentes do banco remoto.
- `.env.example`: nomes das variáveis, sem credenciais reais.

Referências: [funções Node.js](https://vercel.com/docs/functions/runtimes/node-js), [configuração de builds](https://vercel.com/docs/builds), [armazenamento SQLite na Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel) e [SDK libSQL/Turso](https://docs.turso.tech/sdk/ts/reference).
