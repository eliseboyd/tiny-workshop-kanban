#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  createKanbanMcpServer,
  createServiceClientFromEnv,
} from '../../../src/lib/kanban-mcp/server-factory';

async function main() {
  const server = createKanbanMcpServer(createServiceClientFromEnv());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main();
