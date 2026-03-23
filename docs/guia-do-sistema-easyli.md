# Guia do Sistema Easyli

## O que e o Easyli

O Easyli e uma plataforma SaaS multi-tenant para operacao de servicos gerenciados de TI. Na pratica, ele centraliza o trabalho de atendimento, monitoramento, automacao e operacao remota de ambientes de clientes em uma unica interface web.

Neste repositorio, o sistema e composto por:

- `apps/web`: frontend Next.js usado por administradores, owners, tecnicos e usuarios do portal.
- `apps/api`: API NestJS responsavel por autenticacao, regras de negocio, persistencia e integracoes.
- MongoDB: banco principal do SaaS.
- Redis/BullMQ: suporte opcional a filas e jobs assincronos.
- `tools/agent-simulator/index.js`: simulador local de agente, usado para testes de cadastro de dispositivo, heartbeat, metricas e execucao de scripts.
- `tools/windows-agent/index.js`: agente Windows real, usado para captura de tela, consentimento e controle remoto basico no desktop interativo.

## Como o sistema funciona

O fluxo principal e este:

1. Um usuario interno faz login no frontend.
2. O frontend consome a API para carregar dashboard, clientes, dispositivos, tickets, scripts e demais modulos.
3. Cada tenant enxerga apenas os seus dados, com controle adicional por papeis e permissoes.
4. Dispositivos podem ser registrados no tenant e vinculados a agentes.
5. O agente envia heartbeats e metricas para o SaaS.
6. O SaaS pode criar alertas, tickets, automacoes, execucoes de script e registros operacionais com base nesses dados.

## O que o sistema e capaz de realizar

Pelo estado atual do codigo, o Easyli ja cobre estas areas:

- Autenticacao, refresh token, sessao protegida e Swagger.
- Multi-tenant com isolamento por tenant e RBAC por permissoes.
- Dashboard com visao operacional e de negocio.
- Cadastro e gestao de clientes, contatos, dispositivos e grupos.
- Registro de agentes e monitoramento de status online/offline.
- Coleta de metricas de CPU, RAM, disco e degradacao de servicos.
- Regras de alerta e abertura de tickets a partir de eventos.
- Gestao de tickets, comentarios e politicas de SLA.
- Biblioteca de scripts, disparo em dispositivo ou grupo e historico de execucoes.
- Automacoes e logs de automacao.
- Base de conhecimento com artigos.
- Contratos, subscriptions, invoices e resumo de billing.
- Relatorios e exportacoes.
- Auditoria.
- Gestao de patches e politicas de atualizacao.
- Sessoes de acesso remoto registradas no SaaS.
- Integracoes com webhook e SMTP.
- Configuracoes do tenant.
- API keys.
- Portal do cliente para login, abertura e acompanhamento de chamados proprios.

## O que vai instalado no Windows

### Para rodar o sistema localmente

Para executar este projeto em uma maquina Windows de desenvolvimento ou homologacao, o que voce precisa instalar e:

- Node.js LTS com `npm`.
- Git, caso precise clonar o repositorio.
- Um navegador moderno para testar o frontend.
- Opcionalmente Docker Desktop ou Redis local, se voce quiser testar filas com `DISABLE_QUEUES=false`.

Se voce seguir o caminho mais simples de teste, pode deixar `DISABLE_QUEUES=true` e nao precisa subir Redis.

### Para instalar um agente em Windows

O repositorio agora traz dois caminhos:

- um simulador em Node.js para teste rapido
- um agente Windows real em Node.js + PowerShell para captura de tela, consentimento e input remoto

Ainda nao existe neste repositorio:

- instalador `.msi`
- Windows Service dedicado
- binario nativo empacotado

O que existe hoje para uso real e:

- arquivo: `tools/windows-agent/index.js`
- helper local: `tools/windows-agent/windows-bridge.ps1`
- execucao: `npm run agent:windows`
- backend opcional de captura com `ffmpeg/gdigrab`, quando o executavel estiver disponivel no Windows

O que continua existindo para simulacao e:

- arquivo: `tools/agent-simulator/index.js`
- execucao: `npm run agent:simulator`

Ou seja, no estado atual do projeto, o agente Windows real funciona como um processo interativo rodando a partir do codigo-fonte no desktop do usuario logado.

## Quais informacoes o agente envia para o SaaS

No repositorio atual, o fluxo do simulador/agente envia estes dados para a API:

### 1. Autenticacao inicial

O simulador faz login em `POST /auth/login` com um usuario interno do tenant, por padrao:

- `owner@acme.local`
- senha `ChangeMe@123`

Esse login serve para obter um JWT e permitir o cadastro inicial de cliente, dispositivo e agente.

### 2. Cadastro de cliente

Se o cliente de simulacao ainda nao existir, o simulador envia:

- `name`
- `status`
- `tags`
- `notes`

### 3. Cadastro de dispositivo

Ao criar um dispositivo, o simulador envia:

- `clientId`
- `hostname`
- `ipAddress`
- `os`
- `tags`
- `notes`
- `inventory.cpuModel`
- `inventory.cpuCores`
- `inventory.ramGb`
- `inventory.diskGb`
- `inventory.serialNumber`
- `inventory.services`

### 4. Registro do agente

Em `POST /agents/register`, o simulador envia:

- `deviceId`
- `version`

Como resposta, o SaaS devolve um `agentToken`, que passa a identificar esse agente nas chamadas seguintes.

### 5. Heartbeat do agente

Em `POST /agents/heartbeat`, o simulador envia:

- `agentToken`
- `status` (`online` ou `offline`)
- `services[]` com nome e status de servicos locais simulados

Hoje os servicos simulados sao:

- `backup-agent`
- `security-agent`
- `monitor-agent`

### 6. Metricas

Em `POST /monitoring/ingest`, o simulador envia:

- `agentToken`
- metricas de `cpu`
- metricas de `ram`
- metricas de `disk`
- contagem de servicos degradados

### 7. Execucao de scripts

O agente consulta comandos em `POST /script-executions/commands/pull` e, quando encontra um script pendente, devolve o resultado em `POST /script-executions/report` com:

- `agentToken`
- `executionId`
- `status`
- `logs`
- `result.exitCode`
- `result.durationMs`
- `result.output`
- `result.parameters`

### 8. Dados adicionais enviados pelo agente Windows real

Quando voce usa `npm run agent:windows`, o agente tambem passa a enviar e receber dados do modulo de acesso remoto:

- frames reais da area de trabalho Windows em `image/png`
- telemetria da sessao remota, como `consentStatus`, `streamActive`, `lastInputAt` e `lastInputSummary`
- notificacoes operacionais do bridge remoto
- solicitacoes de consentimento exibidas localmente no Windows
- eventos de mouse e teclado recebidos do viewer web e aplicados no desktop local

### 9. O que ainda nao existe no agente Windows real

Mesmo com o agente real, ainda nao foi implementado neste repositorio:

- instalacao como servico do Windows
- transferencia de arquivos
- sincronizacao de clipboard
- audio remoto
- elevacao automatica de privilegios UAC
- inventario completo de software instalado
- coleta detalhada do Windows Event Viewer

## Dados e acessos que o seed cria

Ao rodar o seed, o sistema prepara um tenant demo com:

- tenant `Acme Managed Services`
- clientes demo
- contatos demo
- 50 dispositivos demo
- agentes e metricas historicas
- regras de alerta
- tickets
- scripts
- automacoes
- artigos da base de conhecimento
- contratos
- invoices e subscriptions
- patches simulados
- sessoes de acesso remoto simuladas
- integracoes demo
- configuracoes do tenant
- API key demo

Usuarios demo criados pelo seed:

- Super Admin: `superadmin@atera.local` / `SuperAdmin@123`
- Tenant Owner: `owner@acme.local` / `ChangeMe@123`
- Tenant Admin: `admin@acme.local` / `ChangeMe@123`
- Technician 1: `tech1@acme.local` / `ChangeMe@123`
- Technician 2: `tech2@acme.local` / `ChangeMe@123`
- Technician 3: `tech3@acme.local` / `ChangeMe@123`
- Portal User: `portal@acme.local` / `ChangeMe@123`

## Passo a passo para instalar e usar no Windows

### 1. Preparar os pre-requisitos

Instale:

- Node.js LTS
- Git
- opcionalmente Docker Desktop ou Redis local

### 2. Abrir o projeto

No PowerShell:

```powershell
cd "<pasta-do-projeto>"
```

### 3. Instalar dependencias

```powershell
npm install
npm --prefix apps/api install
npm --prefix apps/web install
```

### 4. Criar os arquivos de ambiente

```powershell
Copy-Item .env.example .env -Force
Copy-Item apps/api/.env.example apps/api/.env -Force
Copy-Item apps/web/.env.local.example apps/web/.env.local -Force
```

### 5. Ajustar a API para o caminho mais simples de teste

Abra `apps/api/.env` e deixe:

- `PORT=3001`
- `DISABLE_QUEUES=true` se voce nao quiser depender de Redis
- `CORS_ORIGIN=http://localhost:3000`

Neste workspace, ao copiar o `.env.example`, a `MONGODB_URI` ja vem preenchida com o endpoint configurado para este ambiente.

### 6. Conferir o frontend

Em `apps/web/.env.local`, mantenha:

- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_API_URL=/backend-api`
- `API_PROXY_TARGET=http://127.0.0.1:3001/api/v1`
- `NEXT_PUBLIC_WS_URL=http://127.0.0.1:3001`

Com isso, o frontend fala com a API via proxy do Next.js, o que evita erro de CORS no navegador.

### 7. Rodar o seed

Em um terminal:

```powershell
npm --prefix apps/api run seed
```

### 8. Subir a API

Em um terminal:

```powershell
npm --prefix apps/api run start:dev
```

Links esperados:

- health: `http://localhost:3001/api/v1/health`
- swagger: `http://localhost:3001/api/docs`

Observacao: `http://localhost:3001/` responder `Cannot GET /` e normal. A API nao expoe a raiz.

### 9. Subir o frontend

Em outro terminal:

```powershell
npm --prefix apps/web run dev
```

Link principal:

- `http://localhost:3000`

Se a porta `3000` estiver ocupada:

```powershell
npm --prefix apps/web run build
npm run start:web:3002
```

Nesse caso, ajuste `NEXT_PUBLIC_APP_URL` para `http://localhost:3002`.

### 10. Fazer login

Use no frontend:

- `owner@acme.local`
- `ChangeMe@123`

Portal do cliente:

- `http://localhost:3000/portal/sign-in`
- `portal@acme.local`
- `ChangeMe@123`

### 11. Validar o fluxo principal

Depois de logar, este e um roteiro pratico de validacao:

1. Abrir o dashboard e conferir os cards e graficos.
2. Entrar em clientes e dispositivos para ver o inventario seedado.
3. Abrir alertas e tickets para verificar eventos operacionais.
4. Entrar em scripts e automacoes para ver execucoes e regras.
5. Abrir billing, contracts, reports e audit.
6. Abrir patch management, remote access e integrations.
7. Testar o portal do cliente com o usuario `portal@acme.local`.

### 12. Simular um agente enviando dados

Com a API ja rodando:

```powershell
npm run agent:simulator
```

Isso faz o simulador:

- autenticar no tenant
- criar cliente se necessario
- criar dispositivo se necessario
- registrar agente
- enviar heartbeat
- enviar metricas
- buscar comandos de script
- reportar resultados de execucao

### 13. Rodar o agente Windows real

Na maquina Windows que sera atendida remotamente:

```powershell
$env:EASYLI_API_URL='http://localhost:3001/api/v1'
$env:EASYLI_EMAIL='owner@acme.local'
$env:EASYLI_PASSWORD='ChangeMe@123'
npm run agent:windows
```

Esse agente:

- autentica no tenant
- cria cliente e dispositivo se necessario
- registra um agente real para a maquina Windows atual
- envia heartbeat e metricas basicas
- entra em sessoes `Easyli Windows Agent`
- captura a tela real do Windows
- mostra um prompt real de consentimento no PC atendido
- aplica clique do mouse e teclado recebidos do viewer web

Se a captura de tela via helper PowerShell for bloqueada pelo ambiente Windows, voce pode rodar o agente com backend de captura `ffmpeg`:

```powershell
$env:EASYLI_CAPTURE_BACKEND='ffmpeg'
$env:EASYLI_FFMPEG_PATH='ffmpeg'
npm run agent:windows
```

## Observacoes operacionais importantes

- O branding visivel do frontend foi ajustado para `Easyli`, mas alguns identificadores internos do codigo ainda usam o nome historico `atera`.
- O seed cria usuarios com dominios `@acme.local` e `@atera.local`; isso e esperado no estado atual do backend.
- Se a API nao estiver no ar, o login do frontend vai falhar porque o browser nao consegue buscar `/backend-api`.
- Se voce optar por ligar filas e jobs assincronos, precisara disponibilizar Redis.

## Resumo executivo

Hoje o Easyli deste repositorio ja permite demonstrar um SaaS de operacao de TI com:

- login e multi-tenant
- dashboard
- cadastro operacional
- monitoramento
- alertas e tickets
- scripts e automacoes
- base de conhecimento
- billing e contratos
- portal do cliente
- integracoes

No lado Windows, o que existe no codigo hoje para testes e um simulador em Node.js, nao um agente nativo instalado como servico do sistema operacional.
