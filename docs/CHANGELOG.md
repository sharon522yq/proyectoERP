# CHANGELOG

## [1.0.0] - 2026-09-22

### Added
- FASE 10: Production module (BOM, Production Orders, Work Orders, Material Consumption)
- FASE 11: Dashboard module (sales, inventory, finance, production, CRM, HR summaries + reports)
- E2E tests: 3 complete scenarios (Sales, Multi-tenancy, Production)
- Swagger/OpenAPI documentation at /docs
- Docker support (Dockerfile + docker-compose.yml)
- GitHub Actions CI pipeline
- .env.example

### Fixed (Audit)
- product.price: changed from String to Number (critical bug)
- inventory.adjustStock: removed silent Math.max(0) that hid insufficient stock errors
- Added missing permissions for Sales, Purchases, Finance, HR, Projects modules
- Updated ROLE_SEEDS with proper permissions for all modules
- Sales routes: added sales-specific permissions (sales.quotes.*, sales.orders.*, etc.)
- Purchases routes: added purchases-specific permissions
- Finance routes: added finance-specific permissions
- HR routes: added hr-specific permissions
- Projects routes: added projects-specific permissions

### Changed
- API version bumped to 1.0.0
- Health check endpoint returns version 1.0.0
- Production module uses proper status transitions with validation
- Material consumption creates inventory movements automatically
- Production completion creates finished product inventory entry

### Added (FASE 12 — IA)
- Transversal AI layer at `/api/v1/ai/*`: `POST /chat`, `POST /analyze`, `GET /health`
  with RBAC (`ai.chat|analyze|read`, catálogo v4), multi-tenancy server-side and
  interaction audit (`ai_interactions`, metadata-only, TTL 90 days)
- Provider abstraction (`AIProvider`: generateText/generateStructured/analyze/healthCheck)
  with `mock` adapter (deterministic, no keys — default for dev/CI) and generic
  `openai-compatible` adapter (OpenAI/Gemini-compat/DeepSeek/Groq/Ollama) — D-012/D-013
- 11 authorized read-only ERP tools (sales, orders, inventory, low stock, CxC, CxP,
  customer balance, production, projects, CRM, HR headcount) — each with permission +
  companyId from JWT context; zero write tools (human-in-the-loop pending)
- Structured output validation with controlled retry; secure 502 fallback
- AI cost controls: per-IP rate limit (AI_RATE_LIMIT), daily user/company caps
  (AI_DAILY_LIMIT), AI_MAX_TOKENS, AI_TIMEOUT_MS, AI_ENABLED kill-switch (501)
- Frontend `AIAssistantScreen` (RN + RN Web) with history, loading, empty state,
  timeout and 401/403/429/501/502/504 error mapping; Dashboard entry (ai.chat)
- Tests: ai.test.js (17), ai-security.test.js (11), ai-limits.test.js (4),
  ai-rate-limit.test.js (2) — 181/181 PASS (16 suites)
- Docs: AI_ARCHITECTURE_PROPOSAL, AI_PROVIDER_DECISION, AI_SECURITY, AI_API,
  AI_TEST_PLAN; Swagger paths for the 3 endpoints

### Fixed (FASE 12)
- `dashboard.getSalesSummary` aggregated with a string companyId (no ObjectId cast)
  so totalInvoiced/totalPaid were always 0 — detected by the AI cross-tenant
  positive control; regression test added

### Added (Auditoría Final)
- Cross-module links (D-010): confirming a sales order now creates SALE_EXIT stock
  movements (with pre-validation, no partial exits); invoices create accounts
  receivable (CxC 1200); payments credit cash (1000) and reduce CxC (double entry);
  receiving a purchase creates PURCHASE_ENTRY stock + accounts payable (CxP 2100)
- Status transition matrices (D-007) for sales and purchase orders — every stock/
  finance side effect happens exactly once
- System accounts (1000/1200/2100) auto-created per company on first use
- Purchase validation: supplier and products must belong to the company
- `tests/audit-integration.test.js` (18 tests) and `tests/security.test.js`
  (10 tests, non-destructive pen testing)
- Performance benchmark `backend/scripts/perf-benchmark.js` + `docs/PERFORMANCE.md`
- `docs/PENETRATION_TEST.md`, `docs/FINAL_AUDIT.md`
- `.env.example`: `ALLOW_PRIVILEGED_REGISTER` + production secret warnings

### Security (Auditoría Final)
- CRITICAL: public registration no longer accepts arbitrary `role`/`companyId`
  (tenant takeover / privilege escalation, OWASP A01) — environment policy D-011
- CRITICAL: removed `"type": "module"` that made the server and Jest unrunnable
- HIGH: `listByCompany(null)` no longer returns users from all companies
- MEDIUM: NoSQL injection via query params blocked (object params stripped,
  `page`/`limit` coerced to integers)
- MEDIUM: inventory routes rewired to `inventory.*` permissions (role ALMACEN works)
- LOW: `X-Powered-By` disabled; login 429 uses standard error format;
  settings updates are audited; production fails fast on weak/default JWT secrets;
  CI lint step is now blocking; version strings unified to 1.0.0

## [0.3.0] - 2026-09-22

### Added
- FASE 2: CRM module (leads, customers, contacts, activities)
- FASE 3: Products module (categories, products, units)
- FASE 4: Inventory module (warehouses, stock, movements, kardex)
- FASE 5: Sales module (quotes, orders, invoices, payments)
- FASE 6: Purchases module (purchase orders)
- FASE 7: Finance module (accounts, transactions, summary)
- FASE 8: HR module (departments, employees)
- FASE 9: Projects module (projects, tasks)
- API versioning to /api/v1/

## [0.1.0] - 2026-09-21

### Added
- FASE 1 Core: auth, users, roles, companies, branches, audit, settings
- Frontend: Login + Dashboard with refresh token auto-renewal
- 9/9 tests passing
