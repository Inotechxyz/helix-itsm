# Release Notes

All notable changes to this project will be documented in this file.

## [v1.0.0] - Initial Release (2026)

### What's New

#### Multi-Tenant Architecture
- Complete data isolation between organizations
- Organization-scoped access control
- License-based feature gating per organization

#### Core ITSM Features
| Module | Description |
|--------|-------------|
| **Tickets** | Full incident lifecycle management with priority, status, and assignment |
| **Service Catalog** | Request catalogs with approval workflows |
| **Knowledge Base** | Articles and categories for self-service support |
| **Problems** | Root cause analysis and problem tracking |
| **Changes** | Change request workflows with impact assessment |

#### Asset Management
- Configuration Items (CMDB) management
- Software license tracking and compliance
- Asset lifecycle tracking

#### AI Chatbot
- Intelligent AI-powered chatbot for ticket creation and queries
- Multi-provider LLM support:
  - OpenAI (GPT-4o, GPT-4o-mini)
  - Anthropic (Claude 3.5)
  - DeepSeek
  - MiniMax
- DSML tool execution for ticket operations
- RAG-enabled responses from knowledge base

#### Email Integration
- Inbound email to ticket conversion (IMAP)
- Email notifications for ticket updates (SMTP)
- Configurable email templates

#### Operations & Analytics
- SLA/OLA policy management
- SLA breach monitoring and notifications
- CSAT surveys and reporting
- Dashboard with key metrics

#### Security & Access
- Local authentication (email/password)
- Azure AD SSO integration
- Role-based access control (RBAC)
- Organization-level role hierarchy

### Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand |
| Backend | NestJS, Prisma ORM, PostgreSQL, Redis, Bull Queue |
| AI | OpenAI, Anthropic, DeepSeek, MiniMax |
| Infrastructure | Docker, Docker Compose |

### Database
- PostgreSQL 16+ for persistent data
- Redis 7+ for caching and session management

### Getting Started

```bash
# Clone the repository
git clone https://github.com/Inotechxyz/helix-itsm.git
cd helix-itsm

# Install dependencies
npm install

# Configure environment
cp apps/api/.env.example apps/api/.env

# Build and initialize
npm run build --workspace=packages/shared
npm run db:generate -w apps/api
npm run db:migrate -w apps/api
npm run db:seed -w apps/api

# Start development servers
npm run dev
```

### License

This release is published under the [MIT License](LICENSE).

---

**Documentation:** Full documentation available in [README.md](README.md)
**API Docs:** Available at `/api/docs` when running the API server
