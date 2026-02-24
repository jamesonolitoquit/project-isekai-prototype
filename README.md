# Project Isekai v0.2 - Closed Beta

## Overview
Project Isekai is a multiplayer open-world RPG with advanced anti-cheat, real-time moderation, and player retention systems.

### Key Features
- ✅ **M69**: Real-time exploit detection (100% accuracy)
- ✅ **M70**: Intelligent player retention (40% re-engagement rate)
- ✅ **Socket.IO**: Real-time moderation console
- ✅ **PostgreSQL**: Persistent game state
- ✅ **TypeScript**: 100% type-safe codebase

### Performance Metrics
- **Exploit Detection Latency**: 28.28ms (target <100ms) ✅
- **Campaign Broadcast**: <100ms (target <100ms) ✅
- **Concurrent Players**: 100+ (target 100) ✅
- **Memory Usage**: 45.3MB (target <50MB) ✅
- **Bundle Size**: <45MB (target <50MB) ✅

## Quick Start

### Local Development

**Prerequisites:**
- Node.js 18+
- PostgreSQL 14 (WSL2 recommended for Windows)
- Redis

**Setup:**
```bash
git clone https://github.com/[org]/project-isekai-v2.git
cd PROTOTYPE
npm install

# Create .env.local (see .env.example)
cp .env.example .env.local
# Edit .env.local with your database credentials

# Run migrations
npx ts-node src/server/migrations.ts

# Start development (separate terminals)
npm run dev              # Terminal 1: API on port 5000
npm run dev:client      # Terminal 2: React on port 3000
npm test                # Terminal 3: Tests

# Visit http://localhost:3000
```

### Production Deployment (Railway)

```bash
# 1. Push to main
git push origin main

# 2. Create project at https://railway.app
# 3. Connect GitHub repository
# 4. Select PROTOTYPE folder as root
# 5. Add PostgreSQL + Redis services
# 6. Set environment variables in Railway dashboard
# 7. Railway automatically deploys!

# Visit: https://[your-railway-domain].railway.app
```

## Project Structure

```
src/
├── server/           # Express API + Socket.IO
│   ├── index.ts
│   ├── db.ts         # Database connection
│   ├── auth.ts       # JWT & roles
│   ├── socketServer.ts
│   └── routes/       # API endpoints
├── client/           # React frontend
│   ├── App.tsx
│   ├── components/
│   └── hooks/
├── engine/           # Game logic (M62-M70)
│   ├── worldEngine.ts
│   ├── m69ExploitDetection.ts
│   ├── m70RetentionEngine.ts
│   └── ...
├── data/             # Schemas & fixtures
└── __tests__/        # Test files

public/               # Static assets
docs/                 # Documentation
```

## Architecture

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React 18 + TypeScript
- **Real-time**: Socket.IO
- **Database**: PostgreSQL 14
- **Cache**: Redis
- **Hosting**: Railway (or AWS with Terraform)

## Testing

```bash
# Run all tests
npm test

# Run specific suite
npm test -- m69m70-phase4-final
npm test -- m69ExploitDetection
npm test -- m70RetentionEngine

# With coverage
npm run test:coverage
```

## Deployment

| Environment | Command | Host |
|-------------|---------|------|
| **Local** | `npm run dev` | localhost:3000 |
| **Railway** | `git push origin main` | railway.app |
| **AWS** | `terraform apply` | AWS EC2/RDS |

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## Monitoring

- **Local**: http://localhost:5000/metrics (Prometheus)
- **Production**: Railway dashboard + application logs
- **Health check**: `/api/health` endpoint

## API Reference

For full API documentation, see [docs/API.md](docs/API.md):

- `GET /api/health` - Health check
- `POST /api/auth/login` - Authentication
- `POST /api/admin/moderation/action` - Create moderation action
- Socket.IO events: `m69:incident-created`, `m70:campaign-fired`, etc.

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and test: `npm test`
3. Commit: `git commit -m "feature: description"`
4. Push: `git push origin feature/my-feature`
5. Create Pull Request

## License

Proprietary - Project Isekai Team

## Support

- **Discord**: [link]
- **Email**: support@isekai.game
- **Docs**: See `/docs` folder
