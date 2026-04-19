# Deploy na VPS (Vite + React)

## Rito Operacional Obrigatório

Em produção, o deploy do FatoPago deve seguir sempre esta sequência:

1. Rodar `build` local completo.
2. Limpar **somente o conteúdo** de `/var/www/fatopago/dist`.
3. Subir o novo `dist`.
4. Reiniciar **apenas** o container `app_01_fatopago`.
5. Validar:
   - `healthcheck`
   - `HTTP 200`
   - assets novos publicados
6. Reiniciar `PM2` **somente** quando houver mudança no worker de notícias (`fatopago-news`).

### Regra crítica

- **Nunca apagar a pasta raiz montada** `/var/www/fatopago/dist`, apenas o conteúdo.
- **Nunca limpar o PM2 globalmente** em VPS compartilhada.
- O `PM2` do projeto é usado para o worker `fatopago-news`.
- O frontend público/admin roda no container Docker `app_01_fatopago`.

## Deploy Automatizado (Recomendado Para Produção)

O padrão deste projeto é fazer deploy via script (SSH com **chave SSH**, sem senha em arquivo):

- **Uma vez por máquina** (instalar chave na VPS):
  ```powershell
  node --env-file=.env scripts/provision_vps_ssh_key.cjs
  ```
  Ou:
  ```powershell
  npm run vps:provision-key
  ```
- **Deploy do dia a dia** (o script já faz build local e upload do `dist/`):
  ```powershell
  node --env-file=.env scripts/deploy_quick.cjs
  ```
  Ou:
  ```powershell
  npm run deploy:quick
  ```

Esse script agora segue exatamente o rito operacional:
- limpa apenas `/var/www/fatopago/dist/*`
- sobe o novo `dist`
- reinicia apenas `app_01_fatopago`
- valida `healthcheck`, `HTTP 200` e os assets novos publicados

Documentação completa: `vps-upload-rules.md`.

## Pré-requisitos

- Node.js 18+ instalado
- Nginx instalado (recomendado)
- Projeto clonado na VPS

## Variáveis de ambiente (obrigatórias)

Essas variáveis são usadas no build do frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Defina elas no shell antes de buildar (exemplo):

```bash
export VITE_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
export VITE_SUPABASE_ANON_KEY="SUA_ANON_KEY"
```

## Build

```bash
npm ci
npm run build
```

O output fica em `dist/`.

## IMPORTANTE (LIMPEZA DO BUILD E DA VPS)

**SEMPRE LIMPE O `dist/` LOCAL E O CONTEÚDO DO `dist` NA VPS ANTES DE ENVIAR O NOVO BUILD.**

Exemplo correto:

```bash
rm -rf dist/
npm run build
mkdir -p /var/www/fatopago/dist
find /var/www/fatopago/dist -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
rsync -a dist/ /var/www/fatopago/dist/
docker restart app_01_fatopago
```

Exemplo incorreto:

```bash
rm -rf /var/www/fatopago/*
pm2 delete all
```

Os comandos acima são incorretos porque:

- podem quebrar o bind mount do container;
- podem afetar outros serviços da VPS compartilhada;
- não são necessários para atualizar o frontend.

## Servir com Nginx (recomendado)

1) Copie o `dist/` para um diretório público:

```bash
sudo mkdir -p /var/www/fatopago
sudo rsync -a --delete dist/ /var/www/fatopago/
```

2) Crie um server block do Nginx (exemplo):

```nginx
server {
  listen 80;
  server_name SEU_DOMINIO_OU_IP;

  root /var/www/fatopago;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

3) Recarregue o Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Observação

Como é SPA, o `try_files ... /index.html` é essencial para rotas como `/dashboard`.
