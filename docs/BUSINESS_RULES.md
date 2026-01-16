# Regras de Negócio - FatoPago

## 1. Modelo de Negócio (Sistema de Ciclos)
- **Eliminação de Mensalidades**: O sistema não cobra mensalidade recorrente.
- **Venda de Ciclos**: O usuário adquire "Ciclos de Validação".
  - Cada ciclo dá direito a um número X de notícias para validar.
  - O usuário trabalha no seu ritmo.
- **Progresso**: Ao completar um ciclo, o usuário pode adquirir outro ou usar parte dos ganhos para reinvestir em ciclos de categorias superiores (que pagam mais por validação).

## 2. Validação e Reputação
- **Mecanismo de Consenso**: As notícias são enviadas para múltiplos validadores. A resposta "correta" é determinada pelo consenso da maioria qualificada ou por validadores "Master" (auditoria).
- **Taxa de Precisão**: Cada validador tem um `accuracy_score` (0-100%).
  - Se acertar (concordar com o consenso/gabarito): Ganha pontos e valor financeiro.
  - Se errar: Perde pontos de reputação.
- **Níveis de Validador**:
  1. **Iniciante**: Acesso limitado, menor valor por validação.
  2. **Intermediário**: Desbloqueado após X validações com > Y% de precisão.
  3. **Elite**: Acesso a tarefas de auditoria e maiores pagamentos.

## 3. Sistema de Ranking e Gamificação
- **Escopo**:
  - **Municipal**: Ranking dentro da cidade.
  - **Estadual**: Ranking dentro do estado (UF).
  - **Nacional**: Ranking Brasil.
- **Competitividade**: Os topos do ranking recebem bônus (multiplicadores de ganhos) ou prêmios em dinheiro ao final de períodos (semanais/mensais).
- **Critérios de Rankeamento**:
  1. Quantidade de validações.
  2. Taxa de precisão (fator de peso maior).

## 4. Programa de Afiliação (Indicação)
- **Códigos Únicos**: Cada usuário gerado tem um código de afiliado único (ex: `joao772`).
- **Recompensa**:
  - Quem convida ganha um valor fixo (ex: R$ 10,00) quando o convidado adquire seu primeiro ciclo ou realiza o primeiro saque.
  - O sistema deve rastrear a origem do cadastro (`affiliate_id`).

## 5. Saques e Financeiro
- **Método**: PIX.
- **Regras de Saque**:
  - Valor mínimo (ex: R$ 50,00).
  - Prazo de processamento: Até 24 horas úteis (para auditoria antifraude).
  - **Bloqueio de Fraude**: Contas com comportamento suspeito (cliques muito rápidos, padrões robóticos) entram em "Análise" automaticamente.

## 6. Cadastro e Geolocalização
- **Dados Obrigatórios**: Nome, Sobrenome, E-mail, Senha, Estado (UF), Cidade.
- **Opcional**: Código de Afiliado.
- **Geolocalização**: O sistema usará a cidade/estado para os rankings regionais.
