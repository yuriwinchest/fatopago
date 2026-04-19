ENGINEERING_HANDBOOK_ANTIGRAVITY.md

# 🚀 ENGINEERING HANDBOOK

# Projeto Antigravity

Versão 2.0 — Padrão Oficial de Engenharia

---

# 📌 1. VISÃO GERAL

Este documento define o padrão oficial de engenharia, arquitetura, segurança, infraestrutura e governança do Projeto Antigravity.

Qualquer desvio das regras aqui descritas deve ser documentado e justificado.

## Fonte canônica complementar

As instruções operacionais e de comportamento do agente no projeto também estão consolidadas em `AGENTS.md` na raiz.
Quando houver sobreposição, seguir a versão mais segura, mais específica e mais recente.

---

# 🧠 2. PRINCÍPIOS FUNDAMENTAIS

## 2.1 Idioma Oficial

Toda comunicação técnica deve ser realizada em Português do Brasil.

## 2.2 Filosofia de Engenharia

- Código simples > Código complexo
- Clareza > Inteligência desnecessária
- Segurança é obrigatória
- Escalabilidade desde o início
- Zero código morto
- Processos previsíveis e auditáveis

---

# 🏗️ 3. ARQUITETURA E CÓDIGO

## 3.1 Limites Estruturais

- Máximo 600 linhas por arquivo
- Máximo 50 linhas por função/método
- Proibido arquivos monolíticos
- Proibido código comentado
- Código não utilizado deve ser removido imediatamente

## 3.2 Princípios Obrigatórios

- SOLID
- Clean Architecture
- Separation of Concerns
- DRY
- KISS

## 3.3 Estrutura Padrão

/src
/modules
/controllers
/services
/repositories
/middlewares
/utils
/tests
/docker
/docs

## 3.4 Padrões Técnicos

- Controllers não devem conter regra de negócio
- Repository Pattern obrigatório
- Services contêm regras de negócio
- Middlewares isolam validações e autenticação
- Funções puras sempre que possível
- Imports não utilizados devem ser removidos

---

# 🧪 4. TESTES

## 4.1 Regras Gerais

- Testes unitários obrigatórios para cada módulo
- Testes de integração para endpoints críticos
- Cobertura mínima de 80%
- CI/CD deve rodar todos os testes antes do deploy
- Hook pre-commit obrigatório

## 4.2 O que deve ser testado

- Regras de negócio
- Validações
- Autenticação
- Autorização
- Integrações externas

---

# 🗄️ 5. BANCO DE DADOS (SUPABASE)

## 5.1 Estrutura

- Toda alteração estrutural gera migration
- Versionamento obrigatório
- Revisão antes de aplicar migrations

## 5.2 Convenções

- snake_case para tabelas
- id como chave primária padrão
- created_at e updated_at obrigatórios
- Índices obrigatórios em campos de busca

## 5.3 Segurança

- RLS ativado em 100% das tabelas
- Policies revisadas antes de produção
- Nunca usar service_role no frontend
- JWT com expiração curta

---

# 🐳 6. INFRAESTRUTURA (DOCKER + VPS)

## 6.1 Docker

- Multi-stage build obrigatório
- Imagem leve (alpine)
- Containers não devem rodar como root
- Healthcheck obrigatório
- restart: always configurado
- Limites de memória e CPU definidos

## 6.2 Docker Compose

Separação clara entre:

- app
- proxy
- worker
- cron

Variáveis via .env por ambiente.

## 6.3 Estratégia de VPS

- VPS 1 → Aplicações principais (produção)
- VPS 2 → Workers, staging, testes

Nunca misturar:

- Produção com staging
- Serviços críticos com experimentais

---

# 🚀 7. PROCESSO OFICIAL DE DEPLOY

Seguir exatamente esta ordem:

1. Acessar VPS
2. Limpar apenas o conteúdo de `dist` na VPS (ex.: `dist/*`)
   - Nunca apagar a pasta raiz montada (`/var/www/fatopago/dist`) quando houver bind mount Docker
3. Subir novo `dist`
4. Reiniciar apenas o container do frontend alvo
5. Validar `healthcheck`, `HTTP 200` e assets publicados
6. Reiniciar `PM2` apenas para processos específicos do projeto, quando houver mudança no worker correspondente
7. Validar migrations
8. Testar endpoints manualmente
9. Commit no GitHub (sem secrets)

### Regras críticas de deploy

- Nunca apagar a pasta raiz montada de `dist`, apenas o conteúdo.
- Nunca usar `pm2 delete all` ou limpeza global de PM2 em VPS compartilhada.
- O frontend do FatoPago roda no container `app_01_fatopago`.
- O `PM2` deve ser usado apenas para processos específicos, como `fatopago-news`.

---

# 🔐 8. SEGURANÇA

## 8.1 Variáveis

- `.env` nunca deve ser commitado
- Separar:
- .env.dev
- .env.staging
- .env.prod

## 8.2 API

- Rate limit obrigatório
- Validação de input em todos endpoints
- Sanitização de dados
- Logs não devem conter:
- Senhas
- Tokens
- Dados sensíveis

## 8.3 VPS

- Firewall ativo
- SSH apenas com chave privada
- Login root desativado
- Atualizações mensais obrigatórias

---

# 📈 9. OBSERVABILIDADE

## 9.1 Logs

- Logs estruturados (JSON)
- Níveis:
- info
- warn
- error
- critical

## 9.2 Monitoramento

- CPU
- Memória
- Disco
- Status dos containers

## 9.3 Alertas

- Falha de container
- Erro 500 recorrente
- Uso excessivo de memória

---

# 🔄 10. VERSIONAMENTO

## 10.1 Padrão

Semantic Versioning:

## 10.2 Padrão de Commit

- feat:
- fix:
- refactor:
- chore:
- test:
- docs:

---

# 🧩 11. AMBIENTES

Separação obrigatória:

- DEV
- STAGING
- PROD

Cada ambiente deve ter:

- Banco separado
- Variáveis próprias
- Configuração isolada

Proibido usar banco de produção em testes.

---

# 📦 12. BACKUP & DISASTER RECOVERY

- Backup diário automático do banco
- Snapshot semanal da VPS
- Teste de restauração mensal
- Processo documentado de recovery
- Último build estável sempre armazenado

Tempo máximo de rollback: 10 minutos.

---

# 👀 13. CODE REVIEW

Nenhum código vai para produção sem revisão.

Checklist obrigatório:

- Segurança
- Performance
- Escalabilidade
- Clareza
- Testes cobrindo regras críticas

---

# 📊 14. PERFORMANCE

- Tempo médio da API: até 300ms
- Queries devem ter índices
- Evitar N+1 queries
- Cache quando necessário
- Monitoramento de latência obrigatório

---

# 🧨 15. POLÍTICA ANTI-CÓDIGO MORTO

Proibido:

- Código comentado
- Dependências não utilizadas
- Funções obsoletas
- Imports não usados

Auditoria mensal obrigatória.

---

# 🔁 16. POLÍTICA DE ROLLBACK

- Última versão estável armazenada
- Última migration documentada
- Script rápido de reversão
- Processo validado previamente

---

# 🏢 17. GOVERNANÇA DE ENGENHARIA

Toda mudança crítica deve conter:

- Documento técnico
- Justificativa
- Impacto esperado
- Plano de rollback

Decisões arquiteturais devem ser registradas.

---

# 📋 18. CHECKLIST PRÉ-DEPLOY

Antes de qualquer deploy:

- [ ] Testes passando
- [ ] Cobertura mínima atingida
- [ ] Migrations revisadas
- [ ] RLS validado
- [ ] .env correto
- [ ] Backup recente disponível
- [ ] Healthcheck funcionando
- [ ] Logs funcionando
- [ ] Monitoramento ativo
- [ ] Rate limit ativo

---

# 🧠 19. USO DE SKILLS

- quiz → testes automatizados
- studying → revisão arquitetural
- flashcards → padronização
- art-creation → diagramas

---

# 🏁 20. DEFINIÇÃO DE QUALIDADE

Um deploy só é considerado válido quando:

- Nenhum erro crítico em log
- CPU estável
- Memória estável
- Banco com RLS ativo
- Testes passaram
- Monitoramento ativo
- Sem código morto

---

# 🎯 DECLARAÇÃO FINAL

Este documento estabelece o padrão oficial de engenharia do Projeto Antigravity.

Seu cumprimento é obrigatório para manter:

- Segurança
- Escalabilidade
- Estabilidade
- Governança
- Crescimento sustentável
