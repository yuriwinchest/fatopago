# Deploy na VPS (Vite + React)

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

