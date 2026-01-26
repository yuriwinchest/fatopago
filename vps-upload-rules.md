# Regras de Upload VPS e Acesso Supabase - FatoPago

Este documento descreve os procedimentos automatizados para atualizar o código na VPS e como acessar o banco de dados Supabase sem necessidade de senha manual (utilizando tokens/chaves configuradas).

## 1. Upload Automático para VPS

O deploy é realizado através de um script Node.js (`scripts/deploy_quick.cjs`) que utiliza SSH para enviar os arquivos compilados e reiniciar o serviço.

### Passo a Passo para Deploy:
1.  **Build Local**: Execute o comando para gerar a pasta `dist`.
    ```bash
    npm run build
    ```
2.  **Execução do Deploy**: Rode o script de deploy passando as credenciais necessárias via variáveis de ambiente ou garantindo que estejam no seu arquivo `.env`.
    ```powershell
    # Exemplo em PowerShell (Windows)
    $env:VPS_HOST='72.60.53.191'; $env:VPS_USER='root'; $env:VPS_PASSWORD='Horapiaui@2026'; node scripts/deploy_quick.cjs
    ```
    *O script irá:*
    - Conectar à VPS via SSH.
    - Fazer o upload das pastas `src`, `public` e arquivos de configuração.
    - Executar `npm run build` dentro da VPS (opcional conforme script).
    - Reiniciar o processo via PM2 (`pm2 restart fatopago`).

### Dados da VPS:
- **Host**: `72.60.53.191`
- **Usuário**: `root`
- **Senha**: `Horapiaui@2026`
- **Diretório da Aplicação**: `/var/www/fatopago`

---

## 2. Acesso ao Supabase (Sem Senha)

Para acessar o banco de dados e APIs do Supabase de forma programática ou via CLI sem digitar senhas, utilizamos o **Access Token** ou as **API Keys** configuradas.

### Credenciais Supabase:
- **URL do Projeto**: `https://raxjzfvunjxqbxswuipp.supabase.co`
- **Project Ref (ID)**: `raxjzfvunjxqbxswuipp`
- **Anon Key**: `sb_publishable_V9cclrMml7jD7GF_8q_r2w_477uS_76`
- **Access Token (CLI)**: `sbp_aecdc8b279a2adb5732e9b3c127a042b3c130db1`

### Como Acessar via CLI:
Se precisar usar a ferramenta de linha de comando do Supabase:
1.  Configure o token de acesso no ambiente:
    ```bash
    export SUPABASE_ACCESS_TOKEN=sbp_aecdc8b279a2adb5732e9b3c127a042b3c130db1
    ```
2.  Ligue o projeto localmente ao remoto (se necessário):
    ```bash
    supabase link --project-ref raxjzfvunjxqbxswuipp
    ```

### Como Testar Conexão (Script):
Existe um script pronto para validar se a aplicação (local ou na VPS) consegue ler o banco:
```bash
node scripts/check_supabase_connection.cjs
```

## 3. Informações para Outras IAs (LLMs)

Sempre que uma nova IA for atuar neste projeto, ela deve:
1.  Verificar o arquivo `.env` para confirmar se as credenciais de VPS e Supabase estão presentes.
2.  Utilizar o script `deploy_quick.cjs` para qualquer atualização em produção.
3.  Utilizar a biblioteca `@supabase/supabase-js` com a `anon_key` para operações de dados, respeitando as políticas de RLS.
