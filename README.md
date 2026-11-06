# Daulinho Lima — Escola de Música

Site estático em HTML, CSS e JavaScript, mantendo o visual em preto e branco. Cada post é um arquivo `.html` dentro de `blog/`. Sem banco de dados, funções de servidor ou dependências npm.

Para abrir localmente, com Node.js instalado:

```sh
npm run dev
```

Site: http://localhost:4180 · Editor de posts: http://localhost:4180/editor.html

O editor fica fora dos menus e da indexação. Nele, você escreve o texto, escolhe a capa e pode:

- **Baixar HTML:** coloque o arquivo em `blog/` e envie para o repositório.
- **Publicar diretamente no GitHub:** informe o repositório conectado à Vercel e um token com permissão de escrita em conteúdo. O editor envia somente o HTML do post. O token não fica no código nem no arquivo gerado.
- **Editar um post:** abra o HTML existente no editor e baixe ou publique a versão atualizada.

Imagens escolhidas do computador são incorporadas ao HTML, sem precisar enviar outro arquivo. Imagens por URL também são aceitas. Os comentários foram removidos nesta versão.

```text
index.html       Página institucional
blog/index.html  Listagem do blog
blog/*.html      Posts independentes
editor.html      Editor fora dos menus
assets/          CSS, JavaScript, configurações e favicon
scripts/         Build e servidor estático de desenvolvimento
```

Edite os cursos e a apresentação em `index.html`. Para mudar WhatsApp, endereço, e-mail e atendimento, edite `assets/config.js`. Os dados atuais são exemplos.

Na Vercel, use **Framework: Other**, **Build Command: `npm run build`** e **Output Directory: `public`**. O `vercel.json` já declara essa configuração; não são necessárias variáveis de ambiente. A cada novo HTML adicionado ao repositório, o build atualiza os cards da página inicial, o blog e as recomendações dos artigos.

`npm test` verifica os posts e o build. `npm run build` gera os arquivos finais em `public/`.
