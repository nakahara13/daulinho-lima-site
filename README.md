# Daulinho Lima — Escola de Música

Site institucional em preto e branco, com HTML renderizado no servidor, CSS e JavaScript nativos, sem framework e sem dependências de produção. Blog com painel administrativo, banco compartilhado e envio de imagens.

## Executar localmente

Requer Node.js 22.13 ou posterior, com suporte a `node:sqlite`.

```sh
npm run dev
```

Site: http://127.0.0.1:4180 · Painel: http://127.0.0.1:4180/admin

Não é necessário instalar pacotes. O servidor local escuta somente em `127.0.0.1`, habilita o painel para desenvolvimento e mantém banco e uploads em `data/`, ignorado pelo Git. Para alterar a porta, use `PORT=3000 npm run dev`. Reinicie o processo depois de editar os arquivos.

## Administrar

- `/admin`: criar, editar e excluir posts; publicar ou salvar rascunhos. O título, autor, categoria, resumo, texto e capa são editáveis. A capa pode ser um endereço HTTPS ou upload JPG/PNG/WebP de até 5 MB.
- Texto dos posts: separar parágrafos com uma linha em branco; iniciar subtítulos com `## `. HTML digitado é exibido como texto.
- Comentários: o visitante informa apenas nome e comentário, sem cadastro. O administrador aprova ou recusa antes da exibição pública.
- Escola e contato: editar WhatsApp, telefone, endereço, cidade, e-mail, atendimento, quatro cursos, imagens, descrições e horários. Quando os dados forem reais, desmarcar “Exibir aviso de dados de exemplo” para ativar o mapa e o link de localização.
- WhatsApp: informar país e DDD, somente números (ex.: `5584999999999`). Até a configuração, o botão informa que o número ainda não foi cadastrado, sem direcionar a um número de terceiros.

Os cursos, horários, endereço e e-mail iniciais são exemplos solicitados para a prévia. As três publicações iniciais são conteúdo editorial demonstrativo e podem ser editadas ou excluídas.

## Arquivos

- `worker/views.js`: HTML da landing page, blog, artigo, contato e painel.
- `worker/styles.css`: identidade visual, layout responsivo e acessibilidade.
- `worker/app.js`: menu, busca, filtros, formulários, upload e painel em JavaScript puro.
- `worker/data.js`: conteúdo inicial e fotografias de referência do Unsplash.
- `worker/index.js`: roteamento, API, autorização e persistência.
- `drizzle/`: migração versionada do banco.
- `scripts/dev.mjs` e `scripts/local-storage.mjs`: servidor local com SQLite e uploads em disco.

As fotografias e fontes são carregadas de Unsplash e Google Fonts. Os uploads ficam no próprio armazenamento do site. A marca tipográfica usa o nome da referência fornecida.

## Produção e acesso

Hospedagem Sites com um único Worker ESM, banco D1 (`DB`) e arquivos R2 (`BUCKET`). O build incorpora CSS e JavaScript no Worker e os entrega por `/styles.css` e `/app.js`. Migrações ficam em `drizzle/` e são aplicadas pela publicação do Sites. Dados de desenvolvimento e de produção são independentes.

A primeira publicação é **privada**, conforme o padrão do Sites. O proprietário entra com sua conta ChatGPT e acessa `/admin`. A variável de produção `SITE_OWNER_PRIVATE=true` permite iniciar o painel sob a política de acesso privado; a primeira identidade proprietária que abre a API administrativa é fixada no banco. Outras identidades são recusadas.

Antes de mudar o acesso do site para público, configurar a variável de servidor `ADMIN_USER_ID` com a identidade administrativa autorizada e remover `SITE_OWNER_PRIVATE`. O painel continuará exigindo entrada com ChatGPT, enquanto visitantes poderão ler e comentar sem conta da escola. Não enviar essas variáveis no código do navegador.

```sh
npm test
npm run build
npm run validate
```

Os testes exercitam persistência real em SQLite, rascunhos, atualização e exclusão, moderação, imagens, validação, autorização, bloqueio de origem externa, escape de HTML e limite de comentários. O artefato final é `dist/server/index.js` com `dist/.openai/hosting.json`.
