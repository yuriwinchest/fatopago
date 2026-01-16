# Especificações Técnicas - FatoPago

## 1. Arquitetura Geral
- **Frontend**: Single Page Application (SPA).
- **Backend / BaaS**: Supabase (PostgreSQL, Auth, Edge Functions).
- **Hospedagem Frontend**: Vercel ou Netlify (ou VPS própria com Nginx).

## 2. Stack Tecnológico Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS (Utility-first) + CSS Modules (para customizações específicas "Glassmorphism").
- **Ícones**: Lucide React.
- **Roteamento**: React Router DOM.
- **Gerenciamento de Estado**: React Hooks (useState, useContext) ou Zustand (se complexidade aumentar).

## 3. Banco de Dados (Supabase PostgreSQL)

### Tabela: `profiles`
- `id` (uuid, PK, ref auth.users)
- `name` (text)
- `lastname` (text)
- `city` (text)
- `state` (varchar 2)
- `affiliate_code` (text, unique)
- `referred_by` (uuid, FK self)
- `reputation_score` (float)
- `current_balance` (decimal)
- `is_active` (bool)

### Tabela: `cycles`
- `id` (uuid, PK)
- `name` (text) - e.g., "Ciclo Iniciante"
- `price` (decimal)
- `validations_count` (int) - Quantas validações permitidas
- `payout_per_validation` (decimal)

### Tabela: `user_cycles`
- `id` (uuid, PK)
- `user_id` (uuid, FK profiles)
- `cycle_id` (uuid, FK cycles)
- `progress` (int)
- `status` (enum: active, completed, expired)

### Tabela: `news_tasks`
- `id` (uuid, PK)
- `content` (text/json) - Título, resumo, link original
- `consensus_reached` (bool)
- `correct_verdict` (bool/null)

### Tabela: `validations`
- `id` (uuid, PK)
- `task_id` (uuid, FK news_tasks)
- `user_id` (uuid, FK profiles)
- `verdict` (bool) - Verdadeiro/Falso
- `created_at` (timestamp)

## 4. Integrações
- **Pagamentos (Entrada)**: Gateway de pagamento para compra de ciclos (ex: Stripe, Mercado Pago ou API Pix direta).
- **Pagamentos (Saída)**: API de PIX para payouts aos usuários.

## 5. Requisitos Não-Funcionais
- **Performance**: Carregamento inicial < 2s. Uso de code-splitting.
- **Responsividade**: Mobile-first obrigatório. Layout deve funcionar perfeitamente em telas 320px+.
- **Segurança**: RLS (Row Level Security) no Supabase para proteger dados dos usuários. Validação de inputs no frontend e backend.
- **UX/UI**: Uso de animações sutis (transições), feedback visual imediato e estética "Dark Premium" (Roxo/Preto).
