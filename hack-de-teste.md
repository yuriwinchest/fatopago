# Hack de Teste

## Objetivo

Este playbook define como o agente de segurança deve auditar o FatoPago de forma técnica, controlada e repetível, com foco em brechas reais de:

- autenticação
- autorização
- manipulação de preço e saldo
- ativação indevida de planos
- validação indevida de notícias
- exposição de segredos
- abuso de rotas administrativas
- fraude em pagamentos PIX

O objetivo não é fazer varredura genérica. O objetivo é encontrar falhas exploráveis no contexto real do produto.

## Regra operacional

Antes de qualquer ação técnica, declarar explicitamente:

- ambiente alvo
- host alvo
- serviço/container alvo
- diretório alvo

## Restrições críticas

- Não executar testes destrutivos em produção.
- Não apagar dados reais.
- Não invalidar pagamentos reais.
- Não expor chaves, tokens, segredos ou credenciais em logs.
- Não alterar saldos, planos ou rankings de usuários reais fora de ambiente controlado.
- Em produção, só realizar validações não destrutivas e de baixo impacto.
- Sempre preferir auditoria local/código e validação controlada antes de tocar produção.

## Fontes obrigatórias de referência

Usar fontes primárias e atuais:

- OWASP Top 10: [https://owasp.org/www-project-top-ten/](https://owasp.org/www-project-top-ten/)
- OWASP WSTG: [https://owasp.org/www-project-web-security-testing-guide/](https://owasp.org/www-project-web-security-testing-guide/)
- Supabase RLS: [https://supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Mercado Pago notifications/webhooks: [https://www.mercadopago.com.br/developers/pt/guides/notifications/webhooks](https://www.mercadopago.com.br/developers/pt/guides/notifications/webhooks)

## Superfícies obrigatórias de auditoria

### 1. Autenticação e sessão

Validar:

- redirecionamento incorreto entre login, admin e vendedor
- persistência de sessão após login
- recuperação de sessão
- possibilidade de assumir papel de admin ou vendedor apenas alterando frontend
- risco de sessão expirada continuar autorizando ação crítica

### 2. Autorização e controle de acesso

Validar:

- acesso indevido a `/admin-dashboard`
- acesso indevido a dados de vendedores
- acesso indevido a relatórios, rankings, pagamentos e ganhadores
- RLS em tabelas sensíveis
- RPCs executáveis por usuário sem papel correto

### 3. Links de vendedor

Validar:

- troca de `plan` manualmente na URL
- troca manual de `windowStartAt` e `windowEndAt`
- reutilização de link mensal expirado
- uso de link mensal por usuário sem vínculo com vendedor
- criação de fluxo mensal sem `affiliate_code` válido

### 4. Pagamento PIX

Validar:

- manipulação de `plan_price` no frontend
- tentativa de pagar valor menor para ativar plano maior
- replay de `payment_id`
- uso de pagamento de outro usuário
- inconsistência entre `metadata`, `external_reference` e valor
- webhook falso ou parcialmente validado
- ativação duplicada de plano por corrida entre `check-payment` e `webhook`

### 5. Consumo de saldo e validação

Validar:

- possibilidade de validar notícia sem plano
- possibilidade de validar notícia com saldo insuficiente
- gasto concorrente do mesmo saldo em múltiplas requisições paralelas
- duplicação de validação da mesma notícia
- divergência entre custo da notícia e saldo debitado
- carry-over indevido de plano semanal entre ciclos
- expiração incorreta de plano mensal e semanal

### 6. Frontend e exposição de segredos

Validar:

- chaves privilegiadas presentes no bundle
- rotas internas expostas
- caminhos administrativos previsíveis
- dados sensíveis em `console.log`
- dependência do frontend para decisão de preço, saldo, papel ou permissão

### 7. Conteúdo administrável

Validar:

- XSS em notícias, observações de ganhadores, nomes e campos administrativos
- upload abusivo de vídeo/imagem
- URL maliciosa em link de notícia ou prova

## Estratégia de execução

Executar nesta ordem:

1. Pesquisa externa dos vetores atuais mais relevantes para este tipo de stack.
2. Leitura do código dos fluxos críticos.
3. Tentativas locais controladas de manipulação de payload.
4. Verificação de RLS/RPC.
5. Verificação de idempotência e concorrência.
6. Apenas por fim, smoke checks não destrutivos em produção.

## Arquivos e fluxos prioritários do projeto

- `src/pages/Login.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/BackofficeDashboard.tsx`
- `src/lib/pixPaymentService.ts`
- `src/lib/planService.ts`
- `src/lib/sellerMonthlyLinks.ts`
- `src/hooks/useValidationTask.ts`
- `supabase/functions/mercadopago-create-pix/index.ts`
- `supabase/functions/mercadopago-check-payment/index.ts`
- `supabase/functions/mercadopago-webhook/index.ts`
- migrations que definem `submit_validation`, `admin_create_seller`, `seller_get_my_report`, `pix_payments`, `plan_purchases`

## Formato obrigatório de achado

Cada achado deve conter:

- título
- severidade: crítica, alta, média ou baixa
- impacto real no negócio
- hipótese de exploração
- passos de reprodução
- evidência técnica
- arquivo ou função afetada
- correção recomendada
- se a correção deve ocorrer no frontend, backend, banco ou infraestrutura

## Critério de sucesso

O agente só conclui quando entregar:

- lista priorizada de achados reais
- o que já está protegido corretamente
- o que ainda depende de correção
- quais testes ficaram pendentes por risco operacional

## Regra final

Se houver dúvida entre "parece seguro" e "está comprovadamente seguro", considerar como não validado até existir evidência.
