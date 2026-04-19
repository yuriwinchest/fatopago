# Plano Completo (VPS Roxa) — Isolamento Real, Deploy Sem Efeito Dominó e Rollback

> **Meta:** administrar vários sites na mesma VPS com **padronização**, **isolamento**, **deploy previsível**, **rollback real** e **migração sem downtime**, usando **Traefik (SSL)** + **Docker (1 app por domínio)**.

Este documento já inclui os ajustes para evitar:

1. Efeito dominó (um deploy derrubar outro app).
2. Cutover arriscado (legacy -> container) com downtime.
3. Exposição acidental de containers no Traefik.
4. Debug/observabilidade improvisados.

---

## 0) Estado Atual (VPS) (ATUALIZADO)

1. **Traefik** está ocupando as portas padrao de HTTP/HTTPS e fazendo SSL (Let’s Encrypt).
2. **Nginx do host** (legado) esta rodando, mas deve ficar **somente interno** (sem acesso externo).
3. O Traefik foi padronizado para **file provider por diretorio**:
   - `/opt/traefik/dynamic.d/*.yml` (1 arquivo por app/rota)
4. Rotas Traefik (em `/opt/traefik/dynamic.d/`):
   - `fatopago.com`, `www.fatopago.com` -> `app_01_fatopago` (container nginx)
   - `fazservico.com`, `www.fazservico.com` -> `app_02_fazservico` (container nginx)
   - `xn--fazservio-x3a.com.br` (fazserviço.com.br) -> **redirect** para `https://fazservico.com`
   - `horapiaui.com`, `www.horapiaui.com` -> `horapiaui-frontend` e `horapiaui-og` (path `/noticia/`)

Observacao:

1. Tentamos ativar Traefik com **docker provider** (labels), mas o servidor retornou erro de versao da API do Docker. Por isso, aqui o padrao oficial e **file provider por diretorio** (sem dependencia do Docker API).
2. Para manter previsibilidade (neste servidor/neste padrao), o Traefik deve declarar explicitamente:
   - `--providers.docker=false`

---

## 1) Matriz de Dominios (Regra de Ouro)

1. `fatopago.com` e `www.fatopago.com` -> APP-01
2. `fazservico.com` e `www.fazservico.com` -> APP-02
3. `xn--fazservio-x3a.com.br` (fazserviço.com.br) -> redirect para `fazservico.com` (punycode/IDN)
4. `horapiaui.com` e `www.horapiaui.com` -> APP-03

Padrao de canonical:

1. Escolher um (ex.: sem `www`) e manter para todos.
2. Implementar redirect no Traefik (middleware) ou no app.

Sugestao (padrao simples):

1. Sempre canonical = sem `www`
2. `www.DOMINIO` -> 308 -> `DOMINIO`

---

## 2) Padrao de Pastas e Compose (Sem Efeito Domino)

### 2.1 Estrutura obrigatoria

Criar e manter:

`/srv/apps/APP-01_fatopago.com/`
`/srv/apps/APP-02_fazservico.com.br/`
`/srv/apps/APP-03_horapiaui.com/`

Em cada app:

1. `docker-compose.yml`
2. `.env` (somente do app)
3. `logs/` (opcional)

### 2.2 Regra operacional critica: project name fixo

Sempre subir com `-p` fixo:

1. `docker compose -p app_01_fatopago up -d --remove-orphans`
2. `docker compose -p app_02_fazservico up -d --remove-orphans`
3. `docker compose -p app_03_horapiaui up -d --remove-orphans`

Isso evita:

1. `remove-orphans` matar container do app errado.
2. Alguem rodar compose fora da pasta e derrubar outro projeto.

---

## 3) Traefik (Docker Provider) Sem Exposicao Acidental

### 3.1 Objetivo (FUTURO/OPCIONAL)

Cada app define suas rotas por labels. O Traefik so enxerga e publica o que for explicitamente permitido.

Status atual:

1. **Nao esta em uso** neste servidor (problema de compatibilidade com API do Docker).
2. Mantemos o mesmo nivel de isolamento usando **file provider por diretorio** (`/opt/traefik/dynamic.d/`).

### 3.2 Regras obrigatorias

1. `providers.docker.exposedbydefault=false`
2. So roteia containers com:
   - `traefik.enable=true`
   - conectados a network `web`
3. `providers.docker.network=web` (constraint por network)

### 3.3 Observacao de seguranca (docker.sock)

Traefik com docker provider precisa do docker socket. Isso e poderoso.

Mitigacao recomendada (opcional, mas ideal):

1. Usar um `docker-socket-proxy` (camada intermediaria).
2. Se nao usar proxy, montar socket com o minimo necessario e manter VPS restrita.

---

## 4) Porta do Legado (Nginx Host) Sem Bypass e Sem Quebrar Traefik

### 4.1 Problema

Hoje o legacy fica acessivel por uma porta interna do host. Isso nao pode ficar publico.

### 4.2 Solucao recomendada (segura e simples)

1. **Bloquear firewall externo** para a porta do legado.
2. Manter Traefik acessando o legacy internamente via `host.docker.internal:<LEGACY_PORT>`.

Observacao importante:

1. Em Linux, se voce mudar Nginx para bind apenas em loopback (`listen 127.0.0.1:<LEGACY_PORT>`), o Traefik em container pode parar de acessar (porque container nao enxerga o loopback do host).
2. Se quiser "loopback only", a forma correta e migrar o legacy para um **container nginx** dentro da network `web` e remover a dependencia do Nginx do host.

---

## 5) Migracao Sem Downtime (Blue/Green por Dominio)

> Trocar `legacy-nginx -> container do app` sem cair trafego.

### 5.1 Estrategia (canary -> cutover -> fallback)

Para cada dominio:

1. Subir o novo container em paralelo (ex.: `app_01_fatopago_v2`).
2. Criar rota canary:
   - `canary.fatopago.com` -> novo container
3. Validar:
   - cookies, headers, redirects, assets, APIs, cache, SEO.
4. Fazer cutover:
   - `fatopago.com` e `www.fatopago.com` passam a apontar para o novo container.
5. Manter legacy por 24-48h como fallback.
6. Rollback instantaneo:
   - voltar a rota principal para legacy ou trocar tag de imagem e subir.

### 5.2 DNS (pre-requisito)

Criar registros para canary:

1. `canary.fatopago.com`
2. `canary.fazservico.com.br`

### 5.3 Canary deve ter protecao minima (obrigatorio)

Canary nao deve ficar publico sem protecao. Escolha um:

1. Basic Auth no Traefik (recomendado).
2. IP allowlist temporaria (se voce tiver IP fixo).

Motivo:

1. Evita crawler/SEO indexar.
2. Reduz superficie de ataque durante teste.

---

## 5.4 Cutover e rollback (file provider)

Metodo correto:

1. Backup do arquivo do dominio em `/opt/traefik/dynamic.d/`.
2. Trocar apenas o service/upstream do dominio principal para o container novo.
3. Validar `docker logs traefik` e `curl -I https://DOMINIO`.
4. Manter legacy 24-48h.

Rollback:

1. Restaurar o arquivo `.bak` para o nome original.
2. Validar logs e testar `curl`.

---

## 6) Healthcheck e Trafego So Para "UP"

### 6.1 Padrao minimo

1. Cada app deve ter `/health` (ou usar `/` em estatico).
2. Compose deve ter `healthcheck`.
3. Traefik deve apontar para o service correto e nao mandar trafego se o app estiver quebrado.

Implementacao:

1. Se usar docker provider, configurar healthcheck do service via labels (quando aplicavel).
2. Se usar file provider, configurar `loadBalancer.healthCheck` no `dynamic.yml`.

---

## 7) Logs Padronizados e Rotacao

Em todo `docker-compose.yml` (traefik e apps):

1. `logging: driver: json-file`
2. `max-size: 10m`
3. `max-file: "3"`

Comando padrao:

1. `docker logs -f <container>`
2. `docker compose -p app_xx ps`

---

## 8) Segredos e .env (Hardening Minimo)

1. `.env` por app, com permissao restrita:
   - `chown root:root .env`
   - `chmod 600 .env`
2. `SUPABASE_SERVICE_ROLE_KEY` nunca vai para frontend.
3. Se subir nivel:
   - usar Docker secrets (ou no minimo permissao + env_file por app).

---

## 9) Ordem Mais Segura (Plano Melhorado)

1. **Fase 0:** firewall para a porta do legado + backup de `/opt/traefik/acme.json`
2. **Fase 1:** criar `/srv/apps/...` + compose por app + `-p app_xx`
3. **Fase 2:** padronizar Traefik com **file provider por diretorio** (`/opt/traefik/dynamic.d/`) e 1 arquivo por app
4. **Fase 3:** migrar 1 app piloto via canary (blue/green) usando file provider (sem labels)
5. **Fase 4:** cutover (dominio principal) e manter fallback 24-48h
6. **Fase 5:** padronizar healthcheck, log rotation, scripts de deploy
7. **Fase 6:** hardening extra (non-root, networks internas por app, remover legacy do host quando possivel)

---

## 10) Rollback Real (Regra Operacional)

1. Versionar imagens por tag:
   - `fatopago:2026-02-12_01`
   - `fazservico:2026-02-12_01`
2. Rollback = trocar tag no compose e rodar:
   - `docker compose -p app_01_fatopago up -d`
3. Sem rebuild no desespero.
