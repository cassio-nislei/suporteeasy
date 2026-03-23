# 🐳 Implantação Docker - Guia Completo

## 📋 Pré-requisitos

- Docker Desktop instalado (Windows/Mac) ou Docker Engine (Linux)
- Docker Compose instalado (incluso no Docker Desktop)
- Git com projeto clonado
- Porta 3000 e 3001 disponíveis (ou alterar no docker-compose.yml)

**Verificar instalação:**

```bash
docker --version
docker-compose --version
```

---

## 🚀 Opção 1: Docker Compose (RECOMENDADO)

### 1.1 Iniciar Todos os Serviços

```bash
cd d:\easyliSRC

# Compilar e iniciar
docker-compose up --build

# Ou em background
docker-compose up -d --build
```

**O que inicia:**
- ✅ Redis (porta 6379)
- ✅ API NestJS (porta 3001)
- ✅ Web Next.js (porta 3000)
- ✅ MongoDB (remoto, já configurado)

### 1.2 Verificar Status

```bash
# Ver containers rodando
docker-compose ps

# Ver logs da API
docker-compose logs api

# Ver logs da Web
docker-compose logs web

# Acompanhar em tempo real
docker-compose logs -f
```

### 1.3 Parar Serviços

```bash
# Parar sem remover
docker-compose stop

# Parar e remover (cleanup)
docker-compose down

# Parar e remover volumes
docker-compose down -v
```

---

## 🚀 Opção 2: Docker Individual

### 2.1 Build Manual da API

```bash
docker build -f apps/api/Dockerfile -t easyli-api:latest .
docker run -d \
  --name easyli-api \
  -p 3001:3001 \
  -e MONGODB_URI="mongodb://admin:Ncm%40647534@104.234.173.105:27017/atera?authSource=admin" \
  -e REDIS_HOST="host.docker.internal" \
  -e REDIS_PORT="6379" \
  -e DISABLE_QUEUES="false" \
  easyli-api:latest
```

### 2.2 Build Manual da Web

```bash
docker build -f apps/web/Dockerfile -t easyli-web:latest .
docker run -d \
  --name easyli-web \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1" \
  easyli-web:latest
```

---

## 📁 Arquivo docker-compose.yml Atual

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    container_name: atera_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: atera_api
    restart: unless-stopped
    depends_on:
      - redis
    environment:
      NODE_ENV: development
      PORT: 3001
      MONGODB_URI: mongodb://admin:...@104.234.173.105:27017/atera
      REDIS_HOST: redis
      REDIS_PORT: 6379
      DISABLE_QUEUES: "false"
    ports:
      - "3001:3001"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: atera_web
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api/v1
    ports:
      - "3000:3000"

volumes:
  redis_data:
```

---

## 🔧 Customizações

### Mudar Portas

Edite `docker-compose.yml`:

```yaml
api:
  ports:
    - "3001:3001"  # Mude para "8080:3001" por exemplo

web:
  ports:
    - "3000:3000"  # Mude para "8000:3000" por exemplo
```

### Adicionar Variáveis de Ambiente

Crie arquivo `.env.docker`:

```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://admin:...@104.234.173.105:27017/atera
REDIS_HOST=redis
REDIS_PORT=6379
DISABLE_QUEUES=false
JWT_ACCESS_SECRET=seu-secret-seguro
JWT_REFRESH_SECRET=seu-refresh-seguro
CORS_ORIGIN=http://seu-dominio.com
```

Atualize `docker-compose.yml`:

```yaml
api:
  env_file: .env.docker
```

### Persistência de Dados

Se quiser manter dados do API:

```yaml
api:
  volumes:
    - api_data:/workspace/apps/api/logs

volumes:
  api_data:
  redis_data:
```

---

## 🧪 Testes

### 1. Verificar API

```bash
# Swagger UI
curl http://localhost:3001/api/docs

# Health check
curl http://localhost:3001/health

# API endpoint
curl http://localhost:3001/api/v1/users
```

### 2. Verificar Web

```bash
# Just access
http://localhost:3000
```

### 3. Logs

```bash
# Ver erros específicos
docker-compose logs api | grep -i error
docker-compose logs web | grep -i error

# Seguir em tempo real
docker-compose logs -f api
```

---

## 🚢 Implantação em Produção

### 1. Criar Stage de Produção

```yaml
# docker-compose.prod.yml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --requirepass sua_senha_redis

  api:
    image: seu-registry/easyli-api:latest
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3001
      MONGODB_URI: ${MONGODB_URI}
      REDIS_HOST: redis
      REDIS_PASSWORD: sua_senha_redis
      DISABLE_QUEUES: "false"
    ports:
      - "3001:3001"
    depends_on:
      - redis

  web:
    image: seu-registry/easyli-web:latest
    restart: always
    environment:
      NEXT_PUBLIC_API_URL: ${API_URL}
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  redis_data:
```

### 2. Build para Registry

```bash
# Login no Docker Hub ou Registry privado
docker login

# Build para production
docker build -f apps/api/Dockerfile -t seu-usuario/easyli-api:v1.0.0 .
docker build -f apps/web/Dockerfile -t seu-usuario/easyli-web:v1.0.0 .

# Push para registry
docker push seu-usuario/easyli-api:v1.0.0
docker push seu-usuario/easyli-web:v1.0.0
```

### 3. Deploy em Servidor

```bash
# SSH no servidor
ssh user@seu-servidor

# Clone o repo
git clone https://github.com/cassio-nislei/suporteeasy.git
cd suporteeasy

# Criar arquivo de variáveis
cat > .env.prod << EOF
MONGODB_URI=seu-mongodb-uri
API_URL=https://seu-dominio.com/api/v1
EOF

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔒 Segurança

### 1. Senha Redis

```yaml
redis:
  command: redis-server --requirepass sua_senha_forte
```

### 2. Variáveis Sensíveis

Nunca commite `.env` no Git!

```bash
# .gitignore
.env
.env.local
.env.prod
.env.*.local
```

### 3. CORS Configurado

```yaml
api:
  environment:
    CORS_ORIGIN: https://seu-dominio-frontend.com
```

### 4. Secrets via Docker Secrets (Swarm)

```bash
docker secret create db_password db_password.txt
```

Referencia em docker-compose:

```yaml
api:
  secrets:
    - db_password
```

---

## 📊 Monitoramento

### 1. Docker Stats

```bash
# Ver uso de recursos
docker stats

# Por container
docker stats atera_api atera_web atera_redis
```

### 2. Logs Centralizados

```bash
# Salvar logs em arquivo
docker-compose logs > logs.txt

# Com timestamp
docker-compose logs --timestamps > logs.txt
```

### 3. Health Checks

Adicionar ao docker-compose.yml:

```yaml
api:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s

web:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000"]
    interval: 30s
    timeout: 10s
    retries: 3
```

---

## 🐛 Troubleshooting

### Erro: "Port already in use"

```bash
# Verificar qual processo usa porta 3001
netstat -ano | findstr :3001

# Ou mudar porta em docker-compose.yml
# De: "3001:3001"
# Para: "8080:3001"
```

### Erro: "Cannot connect to Redis"

```bash
# Verificar se Redis está rodando
docker-compose ps redis

# Verificar logs Redis
docker-compose logs redis

# Reiniciar Redis
docker-compose restart redis
```

### Erro: "Database connection refused"

```bash
# Verificar se MongoDB URI está correta
docker-compose logs api | grep MONGODB

# Verificar conectividade
docker exec atera_api ping 104.234.173.105
```

### Aplicação consome muita memória

```bash
# Limitar recursos
docker update --memory 512m --memory-swap 512m atera_api

# Ou em docker-compose.yml:
api:
  deploy:
    resources:
      limits:
        cpus: '1'
        memory: 512M
```

---

## 🔄 Workflow Recomendado

### Desenvolvimento Local

```bash
# Terminal 1
docker-compose up

# Terminal 2
# Editar código localmente
# Hot-reload automático (Next.js/NestJS com volume mounts)
```

### Com Volume Mounts (Sync de Código)

```yaml
api:
  volumes:
    - ./apps/api/src:/workspace/apps/api/src
    - ./apps/api/package.json:/workspace/apps/api/package.json

web:
  volumes:
    - ./apps/web/src:/workspace/apps/web/src
```

### Teste em Container

```bash
# Pull latest
docker-compose pull

# Rebuild
docker-compose build --no-cache

# Up
docker-compose up
```

### Produção

```bash
# Tag versão
docker tag easyli-api:latest seu-usuario/easyli-api:v1.0.0

# Push
docker push seu-usuario/easyli-api:v1.0.0

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📚 Docker Compose Comandos Úteis

```bash
# Build sem cache
docker-compose build --no-cache

# Rebuild e reiniciar
docker-compose up --build --force-recreate

# Validar arquivo
docker-compose config

# Ver logs de um serviço
docker-compose logs -f api

# Executar comando em container
docker-compose exec api ls -la

# Shell no container
docker-compose exec api sh

# Remover volumes não usados
docker-compose down --volumes

# Limpeza completa
docker system prune -a
```

---

## 🎯 Próximos Passos

1. **Agora:**
   ```bash
   docker-compose up --build
   ```

2. **Testar:**
   - API: http://localhost:3001/api/docs
   - Web: http://localhost:3000

3. **Customizar:**
   - Ajustar variáveis em docker-compose.yml
   - Adicionar .env.docker

4. **Produção:**
   - Criar docker-compose.prod.yml
   - Build e push para registry
   - Deploy em servidor

---

## 📞 Comando Rápido (Copy-Paste)

```bash
cd d:\easyliSRC
docker-compose up --build
```

Pronto! Sua aplicação estará rodando em:
- **API:** http://localhost:3001 (Swagger: /api/docs)
- **Web:** http://localhost:3000
- **Redis:** localhost:6379

