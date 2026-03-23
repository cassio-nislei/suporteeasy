# 🐳 Docker Quick Start

## ✨ TL;DR (Começar Agora)

```bash
cd d:\easyliSRC
docker-compose up --build
```

Pronto! Sua app estará rodando em:
- **API:** http://localhost:3001 (Docs: /api/docs)
- **Web:** http://localhost:3000
- **Redis:** localhost:6379

---

## 📋 Pré-requisitos

- ✅ Docker Desktop instalado
- ✅ Docker Compose instalado
- ✅ Portas 3000, 3001, 6379 disponíveis

**Verificar:**
```bash
docker --version
docker-compose --version
```

---

## 🚀 Operações Básicas

### Iniciar
```bash
cd d:\easyliSRC

# Iniciar (modo interativo)
docker-compose up --build

# Iniciar em background
docker-compose up -d --build
```

### Monitorar
```bash
# Ver status
docker-compose ps

# Ver logs (tudo)
docker-compose logs -f

# Ver logs (API)
docker-compose logs -f api

# Ver logs (Web)
docker-compose logs -f web
```

### Parar
```bash
# Parar (manter dados)
docker-compose stop

# Parar e remover (limpar tudo)
docker-compose down

# Parar e remover volumes
docker-compose down -v
```

### Reiniciar
```bash
docker-compose restart

# Ou um serviço específico
docker-compose restart api
```

---

## 🔧 Customizações Rápidas

### Mudar Portas
Edit `docker-compose.yml`:
```yaml
api:
  ports:
    - "8080:3001"  # Acesse em :8080

web:
  ports:
    - "8000:3000"  # Acesse em :8000
```

### Variáveis de Ambiente
Edit `docker-compose.yml`:
```yaml
api:
  environment:
    NOVA_VAR: seu_valor
```

### Shell no Container
```bash
# Acessar shell da API
docker-compose exec api sh

# Executar comando
docker-compose exec api npm run seed
```

---

## 📊 Verificações

### API
```bash
# Health check
curl http://localhost:3001/health

# Swagger UI
http://localhost:3001/api/docs

# API
curl http://localhost:3001/api/v1/users
```

### Web
```bash
# Just open
http://localhost:3000
```

### Redis
```bash
# Connect
docker-compose exec redis redis-cli

# Ping
redis-cli ping
```

---

## 🚨 Troubleshooting

### "Port already in use"
```bash
# Windows - Check process
netstat -ano | findstr :3001

# Solution: Kill process ou change port in docker-compose.yml
```

### "Cannot connect to Redis"
```bash
docker-compose logs redis
docker-compose restart redis
```

### "Database connection refused"
```bash
docker-compose logs api | grep -i mongo
# Check MONGODB_URI in docker-compose.yml
```

### Build failure
```bash
# Clean rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up
```

---

## 🌐 Produção

### 1. Build para Registry
```bash
docker build -f apps/api/Dockerfile -t seu-usuario/easyli-api:v1.0.0 .
docker push seu-usuario/easyli-api:v1.0.0

docker build -f apps/web/Dockerfile -t seu-usuario/easyli-web:v1.0.0 .
docker push seu-usuario/easyli-web:v1.0.0
```

### 2. Deploy
```bash
# Criar .env.prod
cp .env.docker.example .env.prod
# Edit com valores de produção

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📚 Arquivos Importantes

```
📁 d:\easyliSRC\
├── docker-compose.yml             ← Development
├── docker-compose.prod.yml        ← Production [NOVO]
├── .env.docker.example            ← Variáveis [NOVO]
├── docker-start.bat               ← Start script [NOVO]
├── docker-stop.bat                ← Stop script [NOVO]
├── DOCKER_DEPLOYMENT_GUIDE.md     ← Guia completo [NOVO]
├── apps/api/Dockerfile
├── apps/web/Dockerfile
└── ...
```

---

## 🔗 Mais Informações

Veja **DOCKER_DEPLOYMENT_GUIDE.md** para:
- Customizações avançadas
- Health checks
- Monitoramento
- Produção
- Segurança
- Troubleshooting detalhado

---

## ⚡ Comandos Frequentes (Copy-Paste)

```bash
# Start tudo
docker-compose up -d --build

# Ver status
docker-compose ps

# Ver logs
docker-compose logs -f

# Parar tudo
docker-compose down

# Logs API
docker-compose logs -f api

# Shell na API
docker-compose exec api sh

# Clean rebuild
docker-compose down -v && docker-compose build --no-cache && docker-compose up

# Production deploy
docker-compose -f docker-compose.prod.yml up -d
```

---

**Status:** ✅ Pronto para usar  
**Tempo para rodar:** ~2 minutos (primeira vez com build)  
**Suporte:** Veja DOCKER_DEPLOYMENT_GUIDE.md
