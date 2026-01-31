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
    $env:VPS_HOST='SEU_IP'; $env:VPS_USER='SEU_USER'; $env:VPS_PASSWORD='SUA_SENHA'; node scripts/deploy_quick.cjs
    ```
    *O script irá:*
    - Conectar à VPS via SSH.
    - Fazer o upload das pastas `src`, `public` e arquivos de configuração.
    - Executar `npm run build` dentro da VPS (opcional conforme script).
    - Reiniciar o processo via PM2 (`pm2 restart fatopago`).

### Dados da VPS:
- **Domínio (Principal)**: `https://SEU_DOMINIO`
- **Host (IP)**: `SEU_IP`
- **Usuário**: `SEU_USER`
- **Senha**: `SUA_SENHA`
- **Diretório da Aplicação**: `/var/www/fatopago`

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
2.  Utilizar o script `deploy_quick.cjs` para qualquer atualização em produção.
3.  Utilizar a biblioteca `@supabase/supabase-js` com a `anon_key` para operações de dados, respeitando as políticas de RLS.
