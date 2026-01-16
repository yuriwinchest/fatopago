# Modelo de Negócio e Regras do Sistema FatoPago

## 1. Conceito Central
O FatoPago combina gamificação, escassez de tempo e monetização recorrente em uma plataforma de verificação de notícias.

## 2. Ciclo de Validação
O acesso à validação não é contínuo, mas baseado em **ciclos temporais**.
- **Duração**: Janelas de 24h, 40h ou 48h (Padrão inicial: 24h).
- **Mecânica**:
    - O ciclo pode ser individual (tempo corrido após ativação) ou global (horário fixo, ex: 00:00 às 23:59).
    - **Definição Inicial**: Ciclos globais diários (00:00 às 23:59).
- **Regra de Acesso**: O usuário paga uma taxa para desbloquear o ciclo. Ao fim do tempo, o acesso expira e é necessário novo pagamento para validar novamente.

## 3. Rankings e Premiação
- **Escopo do Ranking**: O ranking considera apenas os pontos acumulados no **ciclo vigente**.
- **Níveis de Competição**:
    - Municipal
    - Estadual
    - Nacional
- **Regra de Exclusividade**: Ao comprar o ciclo, o usuário deve escolher **um** nível para competir (Municipal, Estadual ou Nacional).
- **Premiação**:
    - Vencedores são definidos ao fim do ciclo.
    - Premiados em níveis inferiores são removidos de níveis superiores (se houvesse sobreposição, mas a regra de escolha única mitiga isso).
- **Reset**: A cada novo ciclo, a pontuação começa do zero.

## 4. Monetização e Afiliados
- **Venda de Ciclos**: Pagamento recorrente por uso (ex: R$ 5,00 por ciclo).
- **Sistema de Afiliados**:
    - Influenciadores recebem links com cotas limitadas.
    - Usuários cadastrados via link ficam vinculados ao afiliado.
    - Afiliados ganham comissão sobre os pagamentos de ciclos dos seus indicados.
    - **Ranking de Afiliados**: Competição baseada em volume de cadastros e receita gerada.

## 5. Fluxo do Usuário
1.  **Acesso/Login**.
2.  **Escolha do Ciclo**: Compra de acesso (ex: R$ 5,00).
3.  **Seleção de Nível**: Escolhe competir no ranking Municipal, Estadual ou Nacional.
4.  **Validação**: Durante o tempo do ciclo, valida notícias e acumula pontos.
5.  **Encerramento**: Ciclo fecha, rankings congelam, prêmios são apurados.
6.  **Renovação**: Novo pagamento necessário para jogar no dia seguinte.
