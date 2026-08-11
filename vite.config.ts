import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

const localAdminUsersFile = path.resolve(process.cwd(), 'data/local-admin-users.json');
const localDemoOrdersFile = path.resolve(process.cwd(), 'data/local-demo-orders.json');

function localAdminUsersPlugin(): Plugin {
  return {
    name: 'sfm-local-admin-users',
    configureServer(server) {
      server.middlewares.use('/local-api/admin-users', async (req, res) => {
        try {
          res.setHeader('Content-Type', 'application/json');

          if (req.method === 'GET') {
            res.end(JSON.stringify({ users: await readLocalAdminUsersFile() }));
            return;
          }

          if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const users = await readLocalAdminUsersFile();
            const nextUsers = mergeUsers([body.user, ...users].filter(Boolean));
            await writeLocalAdminUsersFile(nextUsers);
            res.end(JSON.stringify({ users: nextUsers }));
            return;
          }

          if (req.method === 'PATCH') {
            const body = await readJsonBody(req);
            const users = await readLocalAdminUsersFile();
            const nextUsers = users.map((user) =>
              user.user_id === body.userId ? { ...user, ...body.patch } : user,
            );
            await writeLocalAdminUsersFile(nextUsers);
            res.end(JSON.stringify({ users: nextUsers }));
            return;
          }

          res.statusCode = 405;
          res.end(JSON.stringify({ message: 'Method not allowed.' }));
        } catch (error) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              message: error instanceof Error ? error.message : 'Local account store failed.',
            }),
          );
        }
      });

      server.middlewares.use('/local-api/demo-orders', async (req, res) => {
        try {
          res.setHeader('Content-Type', 'application/json');

          if (req.method === 'GET') {
            res.end(JSON.stringify({ orders: await readLocalDemoOrdersFile() }));
            return;
          }

          if (req.method === 'PUT') {
            const body = await readJsonBody(req);
            const orders = Array.isArray(body.orders) ? body.orders : [];
            const nextOrders = mergeOrders(orders);
            await writeLocalDemoOrdersFile(nextOrders);
            res.end(JSON.stringify({ orders: nextOrders }));
            return;
          }

          res.statusCode = 405;
          res.end(JSON.stringify({ message: 'Method not allowed.' }));
        } catch (error) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              message: error instanceof Error ? error.message : 'Local demo order store failed.',
            }),
          );
        }
      });
    },
  };
}

async function readLocalAdminUsersFile() {
  try {
    const raw = await fs.readFile(localAdminUsersFile, 'utf8');
    return mergeUsers(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeLocalAdminUsersFile(users: unknown[]) {
  await fs.mkdir(path.dirname(localAdminUsersFile), { recursive: true });
  await fs.writeFile(localAdminUsersFile, `${JSON.stringify(mergeUsers(users), null, 2)}\n`);
}

async function readLocalDemoOrdersFile() {
  try {
    const raw = await fs.readFile(localDemoOrdersFile, 'utf8');
    return mergeOrders(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeLocalDemoOrdersFile(orders: unknown[]) {
  await fs.mkdir(path.dirname(localDemoOrdersFile), { recursive: true });
  await fs.writeFile(localDemoOrdersFile, `${JSON.stringify(mergeOrders(orders), null, 2)}\n`);
}

function mergeUsers(users: unknown[]) {
  const byUserId = new Map<string, Record<string, unknown>>();

  for (const user of users) {
    if (!user || typeof user !== 'object') continue;
    const candidate = user as Record<string, unknown>;
    const userId = String(candidate.user_id || '').trim();
    if (!userId) continue;
    byUserId.set(userId, candidate);
  }

  return Array.from(byUserId.values()).sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || '')),
  );
}

function mergeOrders(orders: unknown[]) {
  const byId = new Map<string, Record<string, unknown>>();

  for (const order of orders) {
    if (!order || typeof order !== 'object') continue;
    const candidate = order as Record<string, unknown>;
    const orderId = String(candidate.id || '').trim();
    if (!orderId) continue;
    byId.set(orderId, candidate);
  }

  return Array.from(byId.values()).sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || '')),
  );
}

function readJsonBody(req: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localAdminUsersPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // Allow phone testing via ngrok tunnels
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
  },
});
