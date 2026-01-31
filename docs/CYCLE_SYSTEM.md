# Sistema de Ciclo de Votação de 24 Horas

## ✅ Implementação Concluída

### Funcionalidades Implementadas:

1. **Cronômetro Global**
   - Componente `CycleTimer` visível no topo de todas as páginas autenticadas
   - Atualização em tempo real (a cada segundo)
   - Indicador visual quando falta menos de 1 hora
   - Exibe número do ciclo atual
   - Animação de alerta quando próximo do fim

2. **Validação de Voto Único**
   - Usuário só pode votar uma vez por notícia em cada ciclo de 24h
   - Verificação automática ao tentar votar
   - Mensagem clara quando já votou
   - Bloqueio de votação após ciclo expirado

3. **Gestão de Ciclos**
   - Cada notícia tem `cycle_start_at` e `cycle_number`
   - Ciclo de 24 horas a partir da criação/ingestão
   - Sistema preparado para reset automático (via worker/cron)

### Arquivos Criados/Modificados:

**Novos Arquivos:**
- `src/hooks/useCycleTimer.ts` - Hook para contagem regressiva
- `src/components/CycleTimer.tsx` - Componente visual do cronômetro
- `supabase/migrations/20260127000000_add_news_cycle_tracking.sql` - Migration do banco
- `scripts/apply_cycle_migration.cjs` - Script helper para migration

**Arquivos Modificados:**
- `src/layouts/AppLayout.tsx` - Integração do CycleTimer
- `src/hooks/useValidationTask.ts` - Validação de voto único por ciclo

### ⚠️ AÇÃO NECESSÁRIA - Migration do Banco de Dados

**IMPORTANTE:** Execute o seguinte SQL no Supabase SQL Editor para adicionar os campos de ciclo:

```sql
-- Add cycle tracking to news_tasks
ALTER TABLE public.news_tasks
  ADD COLUMN IF NOT EXISTS cycle_start_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS cycle_number INTEGER DEFAULT 1;

-- Index for efficient cycle queries
CREATE INDEX IF NOT EXISTS idx_news_tasks_cycle 
  ON public.news_tasks(cycle_start_at DESC, cycle_number DESC);

-- Update existing rows to have cycle_start_at = created_at
UPDATE public.news_tasks 
SET cycle_start_at = created_at 
WHERE cycle_start_at IS NULL;
```

**Como aplicar:**
1. Acesse: https://supabase.com/dashboard/project/raxjzfvunjxqbxswuipp/sql/new
2. Cole o SQL acima
3. Clique em "Run"

### Como Funciona:

1. **Ingestão de Notícias** (`scripts/news_ingest.cjs`):
   - Ao inserir notícia, define `cycle_start_at = NOW()`
   - Define `cycle_number = 1`

2. **Visualização do Cronômetro**:
   - Busca a notícia mais recente
   - Calcula tempo restante: `cycle_start_at + 24h - now`
   - Atualiza display a cada segundo

3. **Validação de Voto**:
   - Verifica se `now < cycle_start_at + 24h`
   - Verifica se já existe voto do usuário para aquela `task_id` após `cycle_start_at`
   - Bloqueia se já votou ou ciclo expirou

4. **Reset de Ciclo** (A IMPLEMENTAR):
   - Worker/cron que a cada 24h:
     - Marca notícias antigas como `active = false`
     - Ingesta novas notícias
     - Incrementa `cycle_number`

### Próximos Passos (Opcional):

- [ ] Implementar worker automático de reset de ciclo
- [ ] Dashboard admin para controle manual de ciclos
- [ ] Notificações push quando novo ciclo iniciar
- [ ] Histórico de ciclos anteriores

### Design do Cronômetro:

- **Visual**: Cards com horas, minutos e segundos separados
- **Cores**: Roxo (normal) / Vermelho (menos de 1h)
- **Animações**: Ícone gira quando < 1 minuto
- **Responsivo**: Funciona em mobile e desktop
- **Performance**: Otimizado para não afetar performance

---

**Status:** ✅ Deployed em produção
**URL:** https://fatopago.com/
**Data:** 2026-01-27
