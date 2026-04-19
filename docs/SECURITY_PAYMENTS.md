# Security: Payments (PIX / Mercado Pago)

## Current Architecture (as of 2026-02-09)

- Frontend calls Supabase Edge Functions:
  - `mercadopago-create-pix`
  - `mercadopago-check-payment`
  - `mercadopago-pix-withdraw`
  - `mercadopago-webhook` (called by Mercado Pago)
- VPS/PM2 backend is not part of the PIX flow.

## Threat Model (high level)

- Attacker is an authenticated user with access to browser devtools.
- They can modify request bodies (plan id, price, etc.).
- Goal: activate a more expensive plan while paying less; or drain balance via concurrency.

## Hardened Invariants (target)

1. Plan activation must be based on server-side plan price, never client-provided price.
2. A payment can only activate the plan if Mercado Pago confirms:
   - `metadata.user_id` matches the authenticated user
   - `metadata.plan_id` matches the stored record
   - `transaction_amount` matches the expected amount for that plan
3. Withdrawals must be atomic: balance cannot go negative due to concurrent requests.

## Before vs After (2026-02-09 change set)

| Ponto | Antes | Depois |
|---|---|---|
| Preco do plano | `plan_price` do cliente | Preco calculado no servidor por `plan_id` |
| Validacao na aprovacao | Atualiza/ativa sem validar "preco oficial" | Valida metadata + amount contra preco esperado |
| Saque | Read-then-write | RPC atomico com `FOR UPDATE` |

## Files

- Edge Functions:
  - `supabase/functions/mercadopago-create-pix/index.ts`
  - `supabase/functions/mercadopago-check-payment/index.ts`
  - `supabase/functions/mercadopago-webhook/index.ts`
  - `supabase/functions/mercadopago-pix-withdraw/index.ts`
- DB Migration:
  - `supabase/migrations/20260209000000_pix_withdrawal_rpc.sql`

## Deploy (manual)

1. Link the project (once):
   - `supabase link --project-ref <your-project-ref>`
2. Apply migrations to remote:
   - `supabase db push`
3. Deploy the functions:
   - `supabase functions deploy mercadopago-create-pix`
   - `supabase functions deploy mercadopago-check-payment`
   - `supabase functions deploy mercadopago-webhook`
   - `supabase functions deploy mercadopago-pix-withdraw`
4. Ensure required secrets exist on Supabase (names used by code):
   - `MERCADOPAGO_ACCESS_TOKEN`
   - `MERCADOPAGO_WEBHOOK_TOKEN`

## Deploy (scripted)

If you prefer a single command, use:
- `node scripts/deploy_supabase_payments_security.cjs`

Environment expected by the script:
- `SUPABASE_ACCESS_TOKEN` (required)
- `SUPABASE_PROJECT_REF` (optional; derived from `SUPABASE_URL`/`VITE_SUPABASE_URL`)
- `SUPABASE_DB_PASSWORD` (optional; if missing, migrations are skipped and `mercadopago-pix-withdraw` is not deployed)
