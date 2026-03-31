# Security Changes (Running Log)

This file is an append-only log of security hardening changes, written in a "Before vs After" comparison style so decisions and impact are easy to review.

## 2026-02-09: Mercado Pago PIX hardening (Supabase Edge Functions)

| Ponto | Como esta hoje | O que vou mudar | O que melhora na pratica |
|---|---|---|---|
| Preco do plano (PIX create) | `plan_price` vem do cliente e vai direto para o Mercado Pago | O servidor calcula o valor pelo `plan_id` e ignora `plan_price` do cliente | Impede fraude "paga menos e ativa plano mais caro" |
| Ativacao do plano | Ativa com base em status `approved` e dados salvos, sem cruzar valor "oficial" do plano | Validar `metadata.user_id`, `metadata.plan_id` e `transaction_amount` do Mercado Pago contra o preco esperado do plano | Evita ativacao indevida mesmo se tentarem manipular request/registro |
| Webhook | Protegido por `?token=` e faz fetch no MP para validar status | Mantem token, mas passa a validar consistencia (user/plan/valor) antes de atualizar/ativar | Mesmo com token vazado, nao ativa plano sem pagamento consistente |
| Saque (withdraw) | Debito de saldo por read-then-write (race condition) e fluxo pode ficar inconsistente | RPC no Postgres (atomico): debita saldo com `FOR UPDATE` + cria `pix_withdrawals` + `transactions` | Impede saldo negativo por concorrencia e garante consistencia dos registros |

Steps (planned/implemented in code):
1. Edge: `supabase/functions/mercadopago-create-pix/index.ts` passa a usar tabela de precos server-side.
2. Edge: `supabase/functions/mercadopago-create-pix/index.ts` inclui `external_reference=fatopago:<user_id>:<plan_id>` para validacao robusta.
3. Edge: `supabase/functions/mercadopago-check-payment/index.ts` valida (metadata OU external_reference) + amount antes de ativar plano.
4. Edge: `supabase/functions/mercadopago-webhook/index.ts` valida (metadata OU external_reference) + amount antes de atualizar/ativar.
5. DB: `supabase/migrations/20260209000000_pix_withdrawal_rpc.sql` adiciona `request_pix_withdrawal(...)`.
6. Edge: `supabase/functions/mercadopago-pix-withdraw/index.ts` chama `request_pix_withdrawal` (atomico).

## 2026-03-31: segunda rodada de blindagem (concorrencia e payload estrito)

| Ponto | Como esta hoje | O que vou mudar | O que melhora na pratica |
|---|---|---|---|
| Concorencia de saque | Validacao de saque pendente podia ocorrer antes da trava da linha de saldo | Revalidar saque pendente somente apos `FOR UPDATE` da linha do perfil + indice unico parcial por usuario | Impede saque duplo em requests paralelos no mesmo usuario |
| Integridade historica de saques | Podia existir mais de 1 saque `pending/processing` legado por usuario | Normalizacao automatica dos duplicados abertos antes de criar o indice unico parcial | Estado do banco fica consistente para a nova regra |
| Check de pagamento (entrada) | Endpoint aceitava JSON livre e ignorava campos extras | Endpoint aceita somente `payment_id`; qualquer `amount/price/user_id/plan_id` retorna `400` | Reduz superficie de parameter tampering e abuso de payload |
| Saque PIX (entrada) | Endpoint aceitava campos extras e ignorava | Endpoint aceita somente `amount/pix_key/pix_key_type`; campos sensiveis extras retornam `400` | Evita tentativa de injecao logica por payload adulterado |

Arquivos alterados nesta rodada:
1. `supabase/migrations/20260331183000_harden_pix_withdrawal_concurrency.sql`
2. `supabase/functions/mercadopago-check-payment/index.ts`
3. `supabase/functions/mercadopago-pix-withdraw/index.ts`

## 2026-03-31: isolamento de dados em `plan_purchases` (RLS)

| Ponto | Como esta hoje | O que vou mudar | O que melhora na pratica |
|---|---|---|---|
| Isolamento de pacotes comprados | Tabela `plan_purchases` sem RLS explicito nas migrations historicas | Habilitar RLS e criar policy de leitura apenas do proprio usuario + policy de leitura admin | Impede leitura cruzada de pacotes entre usuarios autenticados |

Arquivo alterado:
1. `supabase/migrations/20260331193000_harden_plan_purchases_rls.sql`

## 2026-03-31: autorizacao de admin por papel (sem hardcode de e-mail)

| Ponto | Como esta hoje | O que vou mudar | O que melhora na pratica |
|---|---|---|---|
| Fonte de verdade de admin | Regras espalhadas com `email = fatopago@gmail.com` | Criar `public.admin_users` + `public.is_admin_user()` + `public.assert_fatopago_admin()` por role | Permite rotacao de admin sem alterar codigo e reduz risco operacional |
| Policies criticas | Diversas policies usando e-mail hardcoded | Migrar policies para `public.is_admin_user(auth.uid())` | Controle centralizado e auditavel |
| Edge functions admin | `admin-*` validavam admin por e-mail | `admin-*` validam admin via RPC `is_admin_user` | Evita bypass por logica acoplada a e-mail |
| Fluxo de UI de admin | Frontend roteava admin por e-mail fixo | Frontend consulta `is_admin_user` para resolver papel | Comportamento consistente com backend |

Arquivos alterados nesta rodada:
1. `supabase/migrations/20260331201000_role_based_admin_authorization.sql`
2. `supabase/functions/admin-create-seller-user/index.ts`
3. `supabase/functions/admin-delete-seller-user/index.ts`
4. `supabase/functions/admin-reset-seller-password/index.ts`
5. `supabase/functions/admin-delete-user/index.ts`
6. `src/lib/authRouting.ts`
7. `src/pages/Login.tsx`
8. `src/pages/BackofficeDashboard.tsx`
9. `src/hooks/useAdminData.ts`
10. `src/components/AppHeader.tsx`
11. `src/components/BottomNav.tsx`

## 2026-03-31: hardening residual de pagamentos (expiração, MED, ledger e grants)

| Ponto | Como estava | O que foi implementado | Resultado |
|---|---|---|---|
| Timeout/expiração de PIX | Expiração ocorria de forma parcial no fluxo de criação | `expire_stale_pix_payments()` + chamada automática nas funções de pagamento | Usuário não fica travado por PIX pendente vencido |
| Estorno/MED | Sem rotina de compensação dedicada | `process_pix_payment_reversal()` com idempotência e cancelamento do plano ativo vinculado | Webhook/check conseguem aplicar reversão financeira de forma controlada |
| Auditoria financeira | Apenas tabela de transações | `financial_ledger` append-only com trigger de captura de transações e bloqueio de UPDATE/DELETE | Trilha imutável para investigação e reconciliação |
| Escrita direta no financeiro via cliente | Dependia apenas de RLS | `REVOKE INSERT/UPDATE/DELETE` para `authenticated`/`anon` nas tabelas financeiras críticas | Cliente autenticado não consegue mutar estado financeiro direto |
| Vazamento de erro operacional | Resposta de criação PIX ainda retornava detalhe externo | Mensagem mascarada no create-pix (sem detalhes internos) | Menor exposição de superfície técnica em erro |

Arquivos alterados nesta rodada:
1. `supabase/migrations/20260331214000_payment_residual_hardening.sql`
2. `supabase/functions/mercadopago-create-pix/index.ts`
3. `supabase/functions/mercadopago-check-payment/index.ts`
4. `supabase/functions/mercadopago-webhook/index.ts`
5. `supabase/migrations/20260331215500_backfill_financial_ledger.sql`
6. `supabase/migrations/20260331220500_lock_sensitive_payment_rpcs.sql`
7. `supabase/migrations/20260331221500_revoke_authenticated_sensitive_rpcs.sql`

## 2026-03-31: hardening do `submit_validation` (anti-tamper, anti-duplicidade e ledger)

| Ponto | Como estava | O que foi implementado | Resultado |
|---|---|---|---|
| Duplicidade de validação | Usuário podia repetir validação do mesmo `task_id` em cenários de corrida | Saneamento de duplicados históricos + índice único parcial `(user_id, task_id)` | Banco passa a impedir dupla validação no mesmo fato |
| Race condition em submissão | Fluxo fazia check e insert sem trava específica por par usuário+tarefa | `pg_advisory_xact_lock(hashtext(user_id:task_id))` + fallback de `unique_violation` | Requests paralelos não furam a regra de unicidade |
| Estado da tarefa | Função não bloqueava explicitamente tarefa encerrada por consenso | `submit_validation` agora valida `consensus_reached` antes de aceitar voto | Evita validação em tarefa fechada |
| Auditoria de consumo | Consumo de saldo na validação não entrava no ledger imutável | Inserção append-only em `financial_ledger` com `source_table='validations'` | Trilha financeira/auditável por validação |
| Inserção direta em `validations` | Grants permitiam DML para roles cliente (dependendo só de RLS) | `REVOKE INSERT/UPDATE/DELETE/...` de `authenticated/anon` + `SELECT` controlado | Cliente não consegue contornar RPC por mutação direta |

Arquivo alterado nesta rodada:
1. `supabase/migrations/20260331233000_harden_submit_validation_anti_tamper_and_uniqueness.sql`

## 2026-03-31: hardening do settlement de notícias (consenso + liquidação)

| Ponto | Como estava | O que foi implementado | Resultado |
|---|---|---|---|
| Fechamento do fato | Não havia rotina transacional dedicada para consenso/liquidação | `settle_news_task(task_id, min_votes)` com `FOR UPDATE` em `news_tasks` | Um fato não pode ser liquidado em paralelo por duas execuções |
| Dupla premiação | Sem trava explícita por fato+usuário no momento de liquidação | Créditos no ledger com `source_table='task_settlement_credit'` e `source_id='task:user'` + `ON CONFLICT DO NOTHING` | Idempotência forte por usuário/fato |
| Frações de centavos | Risco de drift por divisão decimal | Split em centavos inteiros (`reward_cents`) com resto distribuído deterministicamente | Soma distribuída sempre fecha exatamente |
| Reabertura de fato liquidado | Não havia metadado explícito de liquidação | `news_tasks` recebe `settled_at` + métricas de settlement + `consensus_reached=true` | Fato liquidado fica fechado e auditável |
| Orquestração de lote | Não havia função dedicada para varrer itens abertos | `settle_open_news_tasks(limit, min_votes)` com `FOR UPDATE SKIP LOCKED` | Execução concorrente de workers sem colisão |

Arquivos alterados nesta rodada:
1. `supabase/migrations/20260331235000_harden_news_task_settlement_atomic.sql`
2. `supabase/migrations/20260331235500_lock_settlement_rpc_grants.sql`
3. `supabase/migrations/20260331235800_allow_financial_ledger_cascade_user_delete.sql`

## 2026-03-31: hardening de exclusão de usuário sem corromper ledger

| Ponto | Como estava | O que foi implementado | Resultado |
|---|---|---|---|
| Deleção com histórico financeiro | Fluxo podia forçar caminho de cascade e apagar rastro financeiro | Nova estratégia: histórico financeiro => anonimização + bloqueio de conta; hard delete só sem histórico | Preserva integridade do livro-razão e permite privacidade por anonimização |
| Integridade do ledger | Trigger teve exceção para cascade em cenário específico | Trigger restaurado para append-only estrito (sem UPDATE/DELETE) | Não há remoção de linhas financeiras por deleção de usuário |
| Segurança operacional de deleção | Deleção física podia ser acionada sem trava financeira no perfil | Trigger em `profiles` bloqueia DELETE quando existe histórico financeiro | Reduz risco de corrupção por fluxo manual/interno |
| Fluxo de autoexclusão | RPC antigo deletava sem separar cenários financeiros | `delete-account` agora decide por histórico e aplica anonimização+bloqueio quando necessário | Fluxo consistente com política financeira |

Arquivos alterados nesta rodada:
1. `supabase/migrations/20260331243000_harden_user_deletion_with_ledger_integrity.sql`
2. `supabase/functions/admin-delete-user/index.ts`
3. `supabase/functions/delete-account/index.ts`
4. `src/hooks/useAdminData.ts`
5. `src/pages/Profile.tsx`
