# Especificações Técnicas - FatoPago

## 1. Arquitetura do Sistema
**Modelo Adotado: Monolito Modular**
Embora utilizemos serviços externos (BaaS), a aplicação frontend é construída como um monolito modular na estrutura de pastas, facilitando a manutenção e a escalabilidade inicial sem a complexidade prematura de microserviços.

### Decisões Arquiteturais:
- **Frontend**: Single Page Application (SPA) construída com React e Vite.
- **Backend / BaaS**: Supabase. Atua como o "backend" unificado, fornecendo Banco de Dados, Autenticação e Edge Functions.
- **Microserviços?**: Não por enquanto. A complexidade de microserviços não se justifica no estágio atual. Funcionalidades específicas (como processamento de pagamentos complexos) podem ser movidas para **Edge Functions** (Serverless) no futuro, mantendo o core enxuto.
- **Estilização**: **Tailwind CSS** puro. Evitar arquivos `.css` isolados ou CSS-in-JS (Styled Components) para manter o padrão utilitário e performance.

## 2. Padrões de Código e Segurança

### Identificadores (IDs)
- **Tipo Obrigatório**: **UUID v4** (Universally Unique Identifier).
- **Justificativa**: Segurança e escalabilidade. IDs sequenciais (1, 2, 3...) expõem o volume de dados do negócio e são vulneráveis a ataques de enumeração.
- **Implementação**: O banco de dados (PostgreSQL) deve gerar UUIDs automaticamente (`gen_random_uuid()`) para todas as chaves primárias.

### Segurança de Dados
- **RLS (Row Level Security)**: Obrigatório em TODAS as tabelas públicas. Nenhum dado deve ser acessível sem uma política explícita de `SELECT`, `INSERT` ou `UPDATE` vinculada ao usuário autenticado (`auth.uid()`).

## 3. Stack Tecnológico Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **Linguagem**: TypeScript (Strict Mode)
- **Estilização**: Tailwind CSS v3.
- **Ícones**: Lucide React.
- **Roteamento**: React Router DOM.
- **Gerenciamento de Estado**: React Hooks (Nativo) e Context API para estados globais simples (Auth).

## 4. Estrutura do Banco de Dados (Supabase PostgreSQL)

### Tabela: `profiles`
- `id` (uuid, PK, references auth.users) - **Segurança Crítica**
- `name` (text)
- `lastname` (text)
- `city` (text)
- `state` (varchar 2)
- `affiliate_code` (text, unique)
- `referred_by` (uuid, FK profiles.id)
- `reputation_score` (float)
- `current_balance` (decimal)
- `is_active` (bool)

### Tabela: `cycles`
- `id` (uuid, PK, default gen_random_uuid())
- `name` (text)
- `price` (decimal)
- `validations_count` (int)
- `payout_per_validation` (decimal)

### Tabela: `user_cycles`
- `id` (uuid, PK, default gen_random_uuid())
- `user_id` (uuid, FK profiles.id)
- `cycle_id` (uuid, FK cycles.id)
- `progress` (int)
- `status` (enum: active, completed, expired)

### Tabela: `news_tasks`
- `id` (uuid, PK, default gen_random_uuid())
- `content` (jsonb) - Flexibilidade para armazenar metadados da notícia.
- `consensus_reached` (bool)
- `correct_verdict` (bool/null)

### Tabela: `validations`
- `id` (uuid, PK, default gen_random_uuid())
- `task_id` (uuid, FK news_tasks.id)
- `user_id` (uuid, FK profiles.id)
- `verdict` (bool)
- `created_at` (timestamp)

## 5. Integrações
- **Pagamentos**: Gateway externo (Stripe/Pix) via Webhooks para atualizar o saldo/ciclos no Supabase.

## 6. Requisitos Não-Funcionais
- **Performance**: Mobile-first.
- **Segurança**: Validação de inputs no client-side (Zod) e server-side (Constraint Checks no banco).
