# Requisitos Técnicos - FatoPago

## 1. Backend e Regras de Negócio

### 1.1. Gestão de Ciclos (Cycle Management)
- **Definição**: O sistema deve suportar "Ciclos Globais" com horário de início e fim definidos (ex: DIARIO_00_23).
- **Entidades**:
  - `Cycle`: id, start_time, end_time, status (active, closed, processing).
  - `UserCycleAccess`: user_id, cycle_id, competition_level (MUNICIPAL, STATE, NATIONAL), payment_status, purchased_at.

### 1.2. Sistema de Pontuação e Ranking (Scoring & Ranking)
- **Cálculo Isolado**: A pontuação de um usuário (`CycleScore`) deve estar estritamente vinculada a um `cycle_id`.
- **Particionamento Geográfico**:
  - Rankings devem ser filtrados por `competition_level` + `location_id` (cidade_id ou estado_id ou 'BR').
  - Usuários só aparecem no ranking do nível escolhido na compra do ciclo.
- **Job de Fechamento**: Rotina automática (Cron) que roda ao fim do ciclo para:
  1. Congelar pontuações.
  2. Calcular posições finais.
  3. Gerar registros de premiação (`PrizeDistribution`).

### 1.3. Sistema de Afiliados (Affiliates)
- **Vínculo**: Tabela `UserReferral` (referrer_id, referred_user_id).
- **Comissionamento**: Gatilho na confirmação de pagamento de `UserCycleAccess` que gera crédito na carteira do `referrer_id`.
- **Ranking de Afiliados**: View ou Tabela agregada somando conversões por período.

## 2. Banco de Dados (Sugestão de Schema Simplificado)

```sql
CREATE TABLE cycles (
  id UUID PRIMARY KEY,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  is_active BOOLEAN
);

CREATE TABLE user_cycle_access (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  cycle_id UUID NOT NULL,
  selected_level VARCHAR(20) CHECK (selected_level IN ('MUNICIPAL', 'STATE', 'NATIONAL')),
  paid_at TIMESTAMP,
  UNIQUE(user_id, cycle_id) -- Usuário só compra 1 vez por ciclo
);

CREATE TABLE cycle_scores (
  user_id UUID,
  cycle_id UUID,
  points INT DEFAULT 0,
  last_activity TIMESTAMP,
  PRIMARY KEY (user_id, cycle_id)
);
```

## 3. Frontend (Adaptações)
- **Modal de Seleção de Nível**: Antes de iniciar a validação, se o usuário não tiver acesso ao ciclo atual, exibir modal de compra + seleção de nível.
- **Display de Tempo**: Exibir cronômetro regressivo para o fim do ciclo atual no Dashboard.
- **Rankings**: Abas no painel de ranking filtrando apenas pelo ciclo atual e nível do usuário.
