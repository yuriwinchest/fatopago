# GEMINI.md — Fato Pago

Este arquivo é a fonte única de verdade sobre contexto, padrões e regras operacionais deste projeto. Qualquer agente que entrar neste repositório deve ler este arquivo antes de agir.

> Espelho de `CLAUDE.md`. Em caso de divergência, `CLAUDE.md` é a referência canônica.

---

## 1. Contexto do negócio

**Fato Pago** é um sistema de validação de notícias. O usuário compra um pacote, e com base no pacote validado ganha direito a validar um número X de notícias. Ao fim de cada ciclo, quem validou mais notícias ganha prêmio.

**Fluxo básico:**
1. As notícias são puxadas de fontes externas (Globo, G1, CNN e outras) via scripts de ingestão
2. O usuário compra um plano via PIX (processado pelo Mercado Pago)
3. O usuário valida notícias dentro da plataforma
4. Vendedores e indicadores ganham comissão sobre as vendas
5. No fim do ciclo, o ranking define vencedores e prêmios
6. Usuários solicitam saque de saldo/comissão via PIX

**Atores:**
- Usuários validadores (compram plano, validam notícias)
- Vendedores (vendem planos e recebem comissão)
- Indicadores (indicam usuários e recebem comissão)
- Admin (gerencia usuários, ciclos, saques, conteúdo)
- Colaboradores (acesso restrito à gestão de notícias)

---

## 2. Stack técnica

### Frontend
- **React 18 + TypeScript + Vite**
- Tailwind CSS
- React Router v6
- Lucide Icons
- Build: `npm run build` (produz `/dist` com code-split em ~72 chunks)

### Backend
- **Supabase** (PostgreSQL + Auth + Edge Functions em Deno/TypeScript)
- Pooler: `aws-1-us-east-1.pooler.supabase.com:6543`
- Project ref: `raxjzfvunjxqbxswuipp`
- Migrations versionadas em `supabase/migrations/` (padrão `YYYYMMDDHHMMSS_descricao.sql`)
- Edge Functions em `supabase/functions/`

### Infraestrutura
- **VPS** em `72.60.53.191` (AlmaLinux/RHEL)
- **Docker + Traefik** como reverse proxy (portas 80/443)
- Container da aplicação: **`app_01_fatopago`** em `127.0.0.1:4101`
- Nginx roda **dentro** do container (nginx do sistema está **desativado**, não tentar iniciar)
- Mount do container: `/var/www/fatopago/dist` → `/usr/share/nginx/html` (somente leitura)

### Pagamento
- **Mercado Pago** — recebimento de PIX (checkout + webhooks + reconciliação)
- **Saque PIX** — hoje manual via admin; planejada migração para **Stark Bank** (API de payout)

### Ausências conhecidas
- **Sem test suite configurado** (não há Vitest/Jest). Criar testes só se for montar a infra de teste primeiro.
- Não há CI/CD — deploy é manual seguindo o fluxo abaixo.

---

## 3. Estado atual do sistema

Registra decisões e limitações **descobertas em produção** que afetam o desenvolvimento futuro. Atualizar conforme novas descobertas.

### Saque PIX (crítico)
- **Mercado Pago NÃO possui API de PIX payout no Brasil.** O endpoint `/v1/transfers` não existe. O `/v1/payouts` é só México. Isso **não é bug** — é limitação da plataforma.
- O saque hoje funciona em **fluxo 100% manual** via painel admin (`/admin-dashboard` aba "Saques")
- Threshold de revisão manual: **R$ 0,00** (TODAS as solicitações vão para `pending_manual_review`)
- Admin revela chave PIX, faz a transferência no banco dele, marca como "Já transferi" no painel
- RPCs disponíveis: `admin_list_pix_withdrawals`, `approve_pix_withdrawal_manual_review`, `reject_pix_withdrawal_manual_review`, `admin_get_pix_withdrawal_full_key`, `reconcile_pix_withdrawal`
- Edge Function `process-pending-withdrawals` (worker automático) **existe mas não funciona** por causa do endpoint MP inexistente. Deixar como está até integrar Stark Bank.
- Plano: quando Stark Bank for integrado, trocar URL/formato no worker e subir threshold de volta para R$ 500 (ou valor decidido)

### Ranking e visibilidade
- Landing page **nunca** mostra contagem de validações — só posição (#1, #2, #3)
- No perfil, contagens só aparecem quando **viewer ≥ 100 E target ≥ 100** (compound gate)
- Barra de progresso tem shimmer animation quando ninguém atingiu 100

### Sincronização de stats
- `user_validation_cycle_stats` tem trigger `validations_sync_cycle_stats` para manter sincronia com `public.validations` (previne drift histórico que aconteceu no ciclo #6)

### Proxy Supabase (crítico)
- **Frontend não acessa Supabase diretamente.** Todas as chamadas passam por `https://fatopago.com/supabase/*` (proxy reverso no nginx do container `app_01_fatopago`), que proxy-passa para `https://raxjzfvunjxqbxswuipp.supabase.co/*`
- **Motivo**: ISPs regionais (ex: Teresina-PI) tinham peering ruim com Cloudflare (que fica na frente do Supabase). Usuários viam "Failed to fetch" no login e imagens não carregavam. A rota via VPS resolve por passar por caminho totalmente diferente
- `.env` do frontend: `VITE_SUPABASE_URL=https://fatopago.com/supabase`
- `.env` de scripts backend (Node local, migrations): `SUPABASE_URL=https://raxjzfvunjxqbxswuipp.supabase.co` (direto, sem proxy)
- A config do proxy está em `/srv/apps/APP-01_fatopago.com/nginx.conf` na VPS (usa `location ^~ /supabase/` — o `^~` é OBRIGATÓRIO para imagens `.png/.jpg` não caírem em regex location)
- URLs de imagens no banco foram todas reescritas para apontar pro proxy (`https://fatopago.com/supabase/storage/...`)
- Script `scripts/fix_fatopago_image_urls.cjs` cobre text/varchar/jsonb — rodar se acumular URLs zumbis no futuro

---

## 4. Postura e comunicação

- **Responder sempre em português do Brasil.**
- Atuar como **engenheiro sênior instruindo júnior**: direto, técnico, claro, sem bajulação.
- Nunca agir para agradar. Se o usuário propõe algo errado, explicar por que é errado e apresentar a alternativa correta com justificativa técnica.
- Sinceridade **não é grosseria**. Comunicação polida, acolhedora e firme na verdade.
- Fatos > ficção. Não inventar informações sobre arquivos, banco, ambiente, infraestrutura ou credenciais. Quando não souber, verificar ou dizer que não sabe.
- Ao dar opinião, justificar com dados reais e explicar por que concorda ou discorda.

---

## 5. Princípios de engenharia

- **SOLID, Separation of Concerns, DRY, KISS** — aplicar sempre, sem superengenharia.
- Preferir arquivos curtos, coesos, com responsabilidade única.
- Evitar funções longas ou com múltiplas responsabilidades.
- Remover código morto, comentários obsoletos e imports não usados.
- Priorizar clareza, simplicidade, manutenibilidade, segurança, observabilidade.
- Buscar sempre a solução mais simples e elegante com menor impacto.

---

## 6. Regras operacionais críticas

Estas regras valem **apenas** para ações com impacto em produção ou potencialmente destrutivas. Para leitura de arquivos locais, edição local, build local, grep, etc., **não se aplicam**.

**Antes de executar ação destrutiva ou em produção, declarar explicitamente:**
- Ambiente alvo (`local`, `staging` ou `prod`)
- Host alvo (ex: `72.60.53.191`)
- Serviço/container alvo (ex: `app_01_fatopago`)
- Diretório alvo (ex: `/var/www/fatopago`)

**Ações que exigem essa declaração:**
- SSH na VPS
- Aplicar migration no banco
- Reiniciar container
- Deploy
- Qualquer `rm`, `docker restart`, `systemctl`, `DROP`, `TRUNCATE`, `DELETE sem WHERE` etc.
- Alterações em chaves, secrets, variáveis de ambiente

**Proibições absolutas:**
- Nunca executar comandos destrutivos amplos sem autorização explícita
- Nunca expor `service_role` key ou chaves privilegiadas no frontend
- Nunca registrar dados sensíveis (senhas, CPF, chaves PIX) em logs
- Em VPS compartilhada, **operar apenas** no container/serviço autorizado (`app_01_fatopago`)
- Nunca reiniciar serviços de outras aplicações (appwrite, fazservico, horapiaui, traefik)

**Sempre validar entradas** nos endpoints (sanitize, whitelist de campos permitidos).

---

## 7. Fluxo de deploy obrigatório

Build é **sempre local**. Nunca confiar no build da VPS (gera bundle único em vez de code-split, causa divergência de node_modules).

**Ordem exata:**

1. **Limpar dist local**: `rm -rf dist`
2. **Build local**: `npm run build` (gera `dist/` com code-split correto)
3. **Limpar dist na VPS**:
   ```bash
   ssh root@72.60.53.191 "rm -rf /var/www/fatopago/dist"
   ```
4. **Empacotar e subir**:
   ```bash
   tar -cf dist.tar dist/
   scp dist.tar root@72.60.53.191:/tmp/
   ```
5. **Extrair e configurar permissões na VPS**:
   ```bash
   ssh root@72.60.53.191 "cd /var/www/fatopago && tar -xf /tmp/dist.tar && chown -R nginx:nginx dist && restorecon -Rv dist 2>/dev/null && rm /tmp/dist.tar"
   ```
6. **Reiniciar container**:
   ```bash
   ssh root@72.60.53.191 "docker restart app_01_fatopago"
   ```
7. **Verificar**:
   - HTTP 200: `curl -sI https://fatopago.com | head -5`
   - Assets corretos: `curl -s https://fatopago.com | grep -o 'assets/[^\"]*\.js' | head -5`
   - Container healthy: `docker ps --filter name=app_01_fatopago`

**Nunca** usar `npm run deploy` como único passo — ele faz build remoto que gera bundle errado.

---

## 8. Banco de dados

### Migrations
- Toda alteração estrutural (tabela, coluna, função, trigger, policy) **deve** gerar arquivo em `supabase/migrations/`
- Nomenclatura: `YYYYMMDDHHMMSS_descricao_em_snake_case.sql`
- Revisar e aplicar via script dedicado (ex: `scripts/apply_migration_YYYYMMDDHHMMSS.cjs`)
- Sempre usar transação (`BEGIN` / `COMMIT` / `ROLLBACK`) no script de aplicação

### Aplicação
```bash
node scripts/apply_migration_YYYYMMDDHHMMSS.cjs
```
O script lê a `SUPABASE_DB_PASSWORD` do `.env.local` ou `.env` e se conecta via pooler.

### Funções críticas (SECURITY DEFINER)
- `request_pix_withdrawal` — usuário solicita saque
- `claim_pending_pix_withdrawals` — worker reclama lote
- `reconcile_pix_withdrawal` — state machine de conclusão
- `approve_pix_withdrawal_manual_review` — admin aprova (manda para `pending`)
- `reject_pix_withdrawal_manual_review` — admin rejeita (estorna saldo)
- `admin_get_pix_withdrawal_full_key` — admin revela chave PIX
- `admin_list_pix_withdrawals` — lista para painel admin
- `is_admin_user(uuid)` — checagem de autorização
- `sync_user_validation_cycle_stats_for_row` — sync de cycle stats

### RLS
- Toda tabela sensível tem Row Level Security ativo
- Policies de SELECT geralmente limitam a `auth.uid() = user_id`
- Admin acessa via funções `SECURITY DEFINER` que checam `is_admin_user` ou `auth.role() = 'service_role'`

---

## 9. Quando planejar antes de implementar

**Entrar em modo de planejamento** (escrever plano curto antes de tocar em código) quando:
- Mudança toca em **3+ arquivos** ou afeta **3+ módulos**
- Envolve **banco de dados** (migration, função, policy, trigger)
- Afeta **pagamento, saque ou saldo** (risco financeiro direto)
- Afeta **autenticação ou permissões**
- Implica **deploy em produção**
- Integra um **provedor externo** (MP, Stark Bank, etc.)

**Plano curto deve conter:**
- Escopo (o que vai e o que não vai ser feito)
- Critério de aceite (como sei que funcionou)
- Riscos e mitigação
- Plano de rollback se der errado

**Se a execução sair do plano, pausar e replanejar.** Não improvisar em produção.

Para bugs simples, reproduzir com logs/erros e corrigir direto — sem cerimônia.

---

## 10. Conclusão de tarefa

Tarefa **só é concluída** com evidência objetiva. Antes de reportar como feito:

- [ ] `npx tsc --noEmit` passa sem erros
- [ ] `npm run build` gera `dist/` sem erros
- [ ] Se mexeu em banco, migration aplicada e validada com query de verificação
- [ ] Se mexeu em frontend, deploy feito e `curl` confirmou HTTP 200
- [ ] Se mexeu em Edge Function, function publicada e testada com payload real
- [ ] Smoke check visual quando aplicável (abrir a tela e confirmar que renderiza)

**Nunca marcar como concluído** com base em "o código parece certo". Precisa de **prova de que roda**.
