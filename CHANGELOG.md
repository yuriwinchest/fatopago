# Changelog

## [2026-01-31] - Atualizações Recentes

### Adicionado

- **Script de Verificação de VPS**: `scripts/check_vps_ports.cjs`
  - Implementada verificação automatizada de rede e segurança via SSH.
  - Funções para checar portas abertas (`netstat`/`ss`), processos Node.js/PM2 ativos e configurações do Nginx.
  - Validação de regras de Firewall (UFW).
- **Migrações de Banco**: Novos arquivos SQL em `supabase/migrations/` para atualizações de ciclo e validação segura.

### Alterado

- **Acessibilidade (UI/UX)**:
  - Melhorias em `src/components/WithdrawalModal.tsx` para conformidade com leitores de tela.
  - Correção de labels de formulário em `src/pages/Profile.tsx`.
  - Ajustes de `viewport` em `index.html`.
- **Lógica de Negócio**:
  - Refatoração do temporizador de ciclos em `src/components/CycleTimer.tsx` e `src/hooks/useCycleTimer.ts` para maior precisão.
  - Ajustes no carrossel de notícias (`src/components/NewsCarousel.tsx`).
- **Scripts de Manutenção**:
  - Atualizações em `scripts/remote_check_db.cjs` para diagnósticos remotos.
  - Correção de *linting* (variáveis não utilizadas) em `scripts/check_vps_ports.cjs`.
- **Configuração de Projeto**:
  - Ajustes em `tsconfig.json`, `tsconfig.node.json` e `vite.config.ts` para otimização do build.
