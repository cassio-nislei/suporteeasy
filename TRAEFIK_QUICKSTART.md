# 🚀 Traefik + Docker - Guia Rápido

## ⚡ Comandos Essenciais

### Deploy Rápido

**1️⃣ Build e Deploy da API:**
```bash
docker build -f apps/api/Dockerfile -t apisuporte-api:latest .
docker run -d \
  --name apisuporte-api \
  --restart unless-stopped \
  --network public \
  --env-file api.env \
  -l traefik.enable=true \
  -l traefik.docker.network=public \
  -l 'traefik.http.routers.apisuporte-api.rule=Host(`apisuporte.easylibr.com.br`) && PathPrefix(`/api`)' \
  -l 'traefik.http.routers.apisuporte-api.entrypoints=websecure' \
  -l 'traefik.http.routers.apisuporte-api.tls=true' \
  -l 'traefik.http.routers.apisuporte-api.tls.certresolver=le' \
  -l 'traefik.http.routers.apisuporte-api.service=apisuporte-api' \
  -l 'traefik.http.services.apisuporte-api.loadbalancer.server.port=3001' \
  apisuporte-api:latest
```

**2️⃣ Build e Deploy da Web:**
```bash
docker build -f apps/web/Dockerfile -t suporte-web:latest .
docker run -d \
  --name suporte-web \
  --restart unless-stopped \
  --network public \
  --env-file web.env \
  -l traefik.enable=true \
  -l traefik.docker.network=public \
  -l 'traefik.http.routers.suporte-web.rule=Host(`suporte.easylibr.com.br`)' \
  -l 'traefik.http.routers.suporte-web.entrypoints=websecure' \
  -l 'traefik.http.routers.suporte-web.tls=true' \
  -l 'traefik.http.routers.suporte-web.tls.certresolver=le' \
  -l 'traefik.http.routers.suporte-web.service=suporte-web' \
  -l 'traefik.http.routers.suporte-web.priority=1' \
  -l 'traefik.http.services.suporte-web.loadbalancer.server.port=3000' \
  suporte-web:latest
```

**3️⃣ Usar o Script de Deploy:**
```bash
chmod +x deploy-traefik.sh
./deploy-traefik.sh deploy
```

---

## 📋 Arquivos de Configuração

### api.env
```env
MONGODB_URI=mongodb://usuario:senha@104.234.173.105:27017/atera?authSource=admin
REDIS_HOST=redis-container
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha
PORT=3001
NODE_ENV=production
JWT_SECRET=seu_secret_32_caracteres_aqui
CORS_ORIGIN=https://apisuporte.easylibr.com.br
DISABLE_QUEUES=false
```

### web.env
```env
NEXT_PUBLIC_API_URL=https://apisuporte.easylibr.com.br/api/v1
NEXT_PUBLIC_APP_NAME=Easyli
NODE_ENV=production
```

---

## 🔍 Verificações e Troubleshooting

### Verificar Status
```bash
# Containers rodando
docker ps -a | grep apisuporte

# Logs da API
docker logs apisuporte-api -f

# Logs da Web  
docker logs apisuporte-web -f

# Logs do Traefik
docker logs traefik -f
```

### Testar Endpoints
```bash
# API (local)
curl http://localhost:3001/api/v1/health

# API (externo)
curl https://apisuporte.easylibr.com.br/api/v1/health

# Web
curl https://apisuporte.easylibr.com.br

# Dashboard Traefik
open http://localhost:8080
```

### Verificar Traefik Detectou Containers
```bash
# Ver labels do container
docker inspect apisuporte-api | grep -A 30 Labels

# Ver logs de configuração do Traefik
docker logs traefik | grep -i "apisuporte"
```

---

## 🔄 Gerenciamento

### Atualizar Imagem
```bash
# Parar
docker stop apisuporte-api apisuporte-web

# Remover
docker rm apisuporte-api apisuporte-web

# Rebuild
docker build -f apps/api/Dockerfile -t apisuporte-api:latest .
docker build -f apps/web/Dockerfile -t apisuporte-web:latest .

# Redeployar
# Use os comando docker run acima
# OU use o script:
./deploy-traefik.sh deploy
```

### Restart Rápido
```bash
docker restart apisuporte-api apisuporte-web
```

### Ver Consumo de Recursos
```bash
docker stats apisuporte-api apisuporte-web
```

---

## 🐛 Problemas Comuns

### API não conecta ao Redis
**Solução:** Verificar se Redis está acessível
```bash
# Se Redis está em outro container
docker run -it redis:7-alpine redis-cli -h redis-container-name ping

# Se Redis está no host
docker exec apisuporte-api npm exec -- npx node -e "
  const redis = require('redis');
  redis.createClient({
    host: 'redis-container-name',
    port: 6379,
    password: 'sua_senha'
  }).on('connect', () => console.log('Redis OK'))
  .on('error', (e) => console.log('Redis Error:', e))
"
```

### Certificado SSL não funciona
```bash
# Limpar certificados Let's Encrypt
docker exec traefik rm /let\'s-encrypt/acme.json

# Reiniciar Traefik
docker restart traefik

# Aguardar nova emissão (5-10 min)
```

### Traefik não vê os containers
```bash
# Verificar se rede existe
docker network ls | grep public

# Verificar se containers estão na rede
docker network inspect public

# Reiniciar Traefik
docker restart traefik
```

### Porta 80/443 já em uso
```bash
# Encontrar processo
sudo lsof -i :80
sudo lsof -i :443

# Matar processo
sudo kill -9 PID

# OU usar portas diferentes no Traefik
```

---

## 📊 Monitoramento Rápido

### Health Check Script
```bash
#!/bin/bash

echo "🏥 Health Check"

# API
echo -n "API: "
curl -s -o /dev/null -w "%{http_code}" https://apisuporte.easylibr.com.br/api/health && echo " ✓" || echo " ✗"

# Web
echo -n "Web: "
curl -s -o /dev/null -w "%{http_code}" https://apisuporte.easylibr.com.br && echo " ✓" || echo " ✗"

# Traefik
echo -n "Traefik: "
docker ps | grep -q traefik && echo "✓" || echo "✗"

# Containers
echo -n "Containers: "
docker ps | grep -q apisuporte-api && echo "API ✓" || echo "API ✗"
docker ps | grep -q apisuporte-web && echo "Web ✓" || echo "Web ✗"
```

---

## 🚀 Deploy com Docker Compose (Alternativa)

**docker-compose.traefik.yml:**
```bash
# Ver arquivo completo em TRAEFIK_DOCKER_DEPLOYMENT.md
sed -n '/^version:/,/^$/p' TRAEFIK_DOCKER_DEPLOYMENT.md > docker-compose.traefik.yml

# Deploy
docker-compose -f docker-compose.traefik.yml up -d

# Logs
docker-compose -f docker-compose.traefik.yml logs -f

# Stop
docker-compose -f docker-compose.traefik.yml down
```

---

## 📚 Referência Rápida - Labels do Traefik

| Label | Descrição |
|-------|-----------|
| `traefik.enable=true` | Habilitar roteamento automático |
| `traefik.docker.network=public` | Rede que Traefik usa |
| `traefik.http.routers.NAME.rule=...` | Regra de roteamento (Host, Path, etc) |
| `traefik.http.routers.NAME.entrypoints=...` | Entrada (web, websecure) |
| `traefik.http.routers.NAME.tls=true` | Usar TLS/HTTPS |
| `traefik.http.routers.NAME.tls.certresolver=le` | Usar Let's Encrypt |
| `traefik.http.services.NAME.loadbalancer.server.port=...` | Porta do container |
| `traefik.http.routers.NAME.middleware=...` | Middleware (CORS, auth, etc) |
| `traefik.http.routers.NAME.priority=...` | Prioridade de roteamento (padrão: 0) |

---

## 🔐 Segurança

### Adicionar Autenticação Basic Auth
```bash
# Gerar hash
docker run --rm httpd:2.4-alpine htpasswd -nbB admin senha123 | cut -d: -f2

# Usar no label
-l 'traefik.http.middlewares.apisuporte-auth.basicauth.users=admin:$apr1$...'
-l 'traefik.http.routers.apisuporte-api.middlewares=apisuporte-auth'
```

### Rate Limiting
```bash
-l 'traefik.http.middlewares.apisuporte-ratelimit.ratelimit.average=100'
-l 'traefik.http.middlewares.apisuporte-ratelimit.ratelimit.burst=50'
-l 'traefik.http.routers.apisuporte-api.middlewares=apisuporte-ratelimit'
```

---

## 🎯 Próximos Passos

1. Revisar variáveis de ambiente em `api.env` e `web.env`
2. Executar deploy com script: `./deploy-traefik.sh deploy`
3. Verificar logs: `docker logs apisuporte-api -f`
4. Testar endpoints: `curl https://apisuporte.easylibr.com.br/api/v1/health`
5. Acessar Traefik Dashboard: `http://SERVER_IP:8080`

**Tudo pronto! 🚀**
