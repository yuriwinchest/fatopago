# Regras de Upload VPS e Acesso Supabase - FatoPago

Este documento descreve os procedimentos automatizados para atualizar o código na VPS e como acessar o banco de dados Supabase sem necessidade de senha manual (utilizando tokens/chaves configuradas).

## 1. Deploy na VPS (Padrão Atual)

### 1.0 Rito correto de produção

Para evitar cache antigo e artefato desatualizado, o rito correto é:

1. `build` local
2. limpar apenas `/var/www/fatopago/dist/*`
3. subir o novo `dist`
4. reiniciar apenas `app_01_fatopago`
5. validar `healthcheck` e `HTTP 200`

Se houver alteração no worker de notícias:

6. reiniciar apenas `fatopago-news` no PM2

### Regras críticas

- Não apagar a pasta raiz montada, só o conteúdo de `dist/*`.
- Não usar `pm2 delete all`, `pm2 flush all` ou qualquer limpeza global em VPS compartilhada.
- O `PM2` não é o frontend do FatoPago. Ele só gerencia o worker `fatopago-news`.
- O frontend/admin roda no container Docker `app_01_fatopago`.

O deploy é realizado através de um script Node.js (`scripts/deploy_quick.cjs`) que utiliza SSH (preferencialmente **chave SSH**, não senha) para enviar o build compilado.

O que o script faz:
- Limpa `dist/` local e roda `npm run build`
- Limpa apenas o conteudo remoto de `/var/www/fatopago/dist`
- Faz upload do novo `dist/` para a VPS
- Reinicia apenas o container `app_01_fatopago`
- Valida `healthcheck`, `HTTP 200` e se o HTML publicado referencia os assets novos

### 1.1 Primeira vez (uma vez por máquina): Provisionar chave SSH (recomendado)
Objetivo: parar de depender de senha no `.env`.

Requisitos:
- `VPS_HOST` e `VPS_USER`
- `VPS_PASSWORD` **apenas para este passo** (depois remover)

Rode:
```powershell
node --env-file=.env scripts/provision_vps_ssh_key.cjs
```

Ou:
```powershell
npm run vps:provision-key
```

O script cria a chave local em:
- Windows: `%USERPROFILE%\\.ssh\\fatopago_key`
- Linux/macOS: `~/.ssh/fatopago_key`

Depois que funcionar:
- Remova `VPS_PASSWORD` do `.env`/`.env.local`
- (Opcional e recomendado) Harden do SSH na VPS:
  ```powershell
  node --env-file=.env scripts/harden_vps_ssh_auth.cjs
  ```

### 1.2 Deploy do dia a dia (sem senha)
Rode o script de deploy (ele faz o build local automaticamente):
```powershell
node --env-file=.env scripts/deploy_quick.cjs
```

Ou:
```powershell
npm run deploy:quick
```

### Dados da VPS:
- **Domínio (Principal)**: `https://SEU_DOMINIO`
- **Host (IP)**: `SEU_IP`
- **Usuário**: `SEU_USER`
- **Diretório da Aplicação**: `/var/www/fatopago`

### Variáveis usadas pelo deploy (scripts)
- `VPS_HOST` (obrigatório)
- `VPS_USER` (opcional; default `root` em alguns scripts)
- `VPS_PORT` (opcional)
- `VPS_KEY_PATH` (opcional; se vazio, scripts tentam `~/.ssh/fatopago_key` automaticamente)
- `VPS_APP_DIR` (opcional; default `/var/www/fatopago`)
- `VPS_DEPLOY_DIR` (opcional; default `${VPS_APP_DIR}/dist`)

---

## 2. Acesso ao Supabase (Sem Senha)

Para acessar o banco de dados e APIs do Supabase de forma programática ou via CLI sem digitar senhas, utilizamos o **Access Token** ou as **API Keys** configuradas.

### Credenciais Supabase:
- **URL do Projeto**: `https://SEU-PROJETO.supabase.co`
- **Project Ref (ID)**: `SEU_PROJECT_REF`
- **Anon Key**: `SUA_ANON_KEY`
- **Access Token (CLI)**: `SEU_ACCESS_TOKEN`

### Como Acessar via CLI:
Se precisar usar a ferramenta de linha de comando do Supabase:
1.  Configure o token de acesso no ambiente:
    ```bash
    export SUPABASE_ACCESS_TOKEN=SEU_ACCESS_TOKEN
    ```
2.  Ligue o projeto localmente ao remoto (se necessário):
    ```bash
    supabase link --project-ref SEU_PROJECT_REF
    ```

### Como Testar Conexão (Script):
Existe um script pronto para validar se a aplicação (local ou na VPS) consegue ler o banco:
```bash
node scripts/check_supabase_connection.cjs
```

## 3. Informações para Outras IAs (LLMs)

Sempre que uma nova IA for atuar neste projeto, ela deve:
1.  Verificar o arquivo `.env` para confirmar se as credenciais de VPS e Supabase estão presentes.
2.  Utilizar o script `scripts/deploy_quick.cjs` para qualquer atualização em produção.
3.  Priorizar deploy por **chave SSH** (evitar `VPS_PASSWORD` salvo em arquivo; usar apenas no provisionamento inicial).
4.  Utilizar a biblioteca `@supabase/supabase-js` com a `anon_key` para operações de dados, respeitando as políticas de RLS.
