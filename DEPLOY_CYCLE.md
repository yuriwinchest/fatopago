# 🚀 Deploy do Sistema de Ciclo - Instruções Finais

## ✅ Status Atual

- **Frontend**: Deployed em https://fatopago.com/ (HTTP 200 ✓)
- **Código**: Todos os componentes implementados e testados
- **VPS**: Aplicação rodando corretamente

## ⚠️ PASSO OBRIGATÓRIO: Aplicar Migration no Banco

### Opção 1: Via Supabase Dashboard (RECOMENDADO)

1. **Acesse o SQL Editor:**
   https://supabase.com/dashboard/project/raxjzfvunjxqbxswuipp/sql/new

2. **Cole o seguinte SQL:**

```sql
-- Adicionar colunas de ciclo
ALTER TABLE public.news_tasks
  ADD COLUMN IF NOT EXISTS cycle_start_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS cycle_number INTEGER DEFAULT 1;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_news_tasks_cycle 
  ON public.news_tasks(cycle_start_at DESC, cycle_number DESC);

-- Atualizar registros existentes
UPDATE public.news_tasks 
SET cycle_start_at = created_at 
WHERE cycle_start_at IS NULL;

-- Verificar resultado
SELECT id, cycle_start_at, cycle_number, created_at 
FROM public.news_tasks 
LIMIT 5;
```

3. **Clique em "RUN"** (F5)

4. **Verifique** se retornou:
   - Rows affected por cada comando
   - SELECT final mostrando as colunas novas

### Opção 2: Via psql na VPS

```bash
# Conectar na VPS
ssh root@SEU_IP_OU_HOST

# Executar psql (NÃO cole senha em documentação/repo)
# Use variável de ambiente ou digite interativamente se preferir.
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h aws-0-sa-east-1.pooler.supabase.com \
  -U postgres.raxjzfvunjxqbxswuipp \
  -d postgres \
  -p 6543 \
  -f /path/to/migration.sql
```

### Opção 3: Via Script Node.js

```bash
cd D:\fatopago
# Execute o script (pode falhar por limitações da API)
node scripts/apply_cycle_migration_v2.cjs
```

## 📋 Checklist Pós-Migration

Após aplicar a migration, verifique:

- [ ] Colunas adicionadas: `cycle_start_at` e `cycle_number`
- [ ] Índice criado: `idx_news_tasks_cycle`
- [ ] Registros atualizados com `cycle_start_at = created_at`
- [ ] Acesse https://fatopago.com/dashboard e veja se o cronômetro aparece
- [ ] Tente votar em uma notícia e veja se bloqueia na segunda tentativa

## 🧪 Como Testar

1. **Acessar:** https://fatopago.com/login
2. **Fazer login** com suas credenciais
3. **Verificar:** Cronômetro deve aparecer no topo
4. **Votar** em uma notícia
5. **Tentar votar novamente** → Deve bloquear com mensagem "Você já votou"

## 🔍 Verificar Migration Aplicada

Execute no SQL Editor para confirmar:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'news_tasks' 
  AND column_name IN ('cycle_start_at', 'cycle_number');
```

Deve retornar 2 linhas (uma para cada coluna).

## 📞 Suporte

Se encontrar erros:

1. **Erro de permissão:** Use Service Role Key
2. **Coluna já existe:** Migration já foi aplicada (tudo OK!)
3. **Timeout:** Use Supabase Dashboard (mais confiável)

## 🎯 Arquivos da Migration

- SQL: `supabase/migrations/20260127000000_add_news_cycle_tracking.sql`
- Script: `scripts/apply_cycle_migration_v2.cjs`
- Temp: `temp_migration.sql`

---

**Depois de aplicar a migration, o sistema estará 100% funcional!**
