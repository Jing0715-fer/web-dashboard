---
Task ID: 1
Agent: Main Agent
Task: Optimize project - add agent gateway monitoring (OpenClaw, Hermes, etc.) and fix UI shortcomings

Work Log:
- Read current state of page.tsx, gateway status API, and prisma schema
- Investigated system processes to identify running agent gateways (Z-AI Gateway on 12600, OpenClaw on 19001, Hermes on 19006, File Server on 19005)
- Enhanced `/api/gateway/status` API to detect and report agent gateway statuses
- Added `AgentGateway` interface and `KNOWN_AGENT_GATEWAYS` configuration list
- Implemented `checkAgentGatewayHealth()` with proper handling (404 = still reachable for API services)
- Implemented `getProcessInfoForPort()` with multiple PID detection fallback methods (ss, lsof, fuser)
- Redesigned `GatewayMonitorDialog` with tabbed navigation (Overview / Agent Gateways / Project Services)
- Added `AGENT_ICON_MAP` for agent gateway icons in the UI
- Overview tab shows: Caddy status, System Resources, Agent Gateways quick summary (4-column grid), Gateway Configuration
- Agent Gateways tab shows: detailed cards for each agent with status, port, HTTP, response time, description
- Project Services tab shows: existing service health list
- Updated stats bar Gateway indicator to show agent count ("4 agents")
- Updated footer to show "4 agents online" with Sparkles icon
- Updated version to v2.1
- Lint passes cleanly, dev server running, browser verification all 8/8 checks pass

Stage Summary:
- Agent gateway monitoring fully implemented with OpenClaw, Hermes, Z-AI Gateway, File Server
- Gateway Monitor now has 3 tabs: Overview, Agent Gateways, Project Services
- All 4 agent gateways detected as Online with proper HTTP health checks
- Stats bar and footer now show agent gateway count
- No console errors, all browser checks pass
