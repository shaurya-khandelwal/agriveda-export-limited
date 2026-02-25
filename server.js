const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadDotEnv();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace-this-in-production';
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'sales@agrivedaexports.com';
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '919999999999';

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString();
}

function signJwt(payload, expiresInSeconds = 60 * 60 * 8) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${headerPart}.${payloadPart}.${signature}`;
}

function verifyJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signature] = parts;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerPart}.${payloadPart}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expectedHash] = stored.split(':');
  if (!salt || !expectedHash) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function ensureDb() {
  if (fs.existsSync(DB_PATH)) return;

  const seedData = {
    users: [
      {
        id: crypto.randomUUID(),
        name: 'Owner Admin',
        email: 'admin@agrivedaexports.com',
        passwordHash: hashPassword('Admin@123'),
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Sample Customer',
        email: 'customer@agrivedaexports.com',
        passwordHash: hashPassword('Customer@123'),
        role: 'customer',
        createdAt: new Date().toISOString()
      }
    ],
    products: [
      {
        id: crypto.randomUUID(),
        name: 'Turmeric',
        slug: 'turmeric',
        shortDescription: 'Premium Indian turmeric with high curcumin content.',
        description: 'Sourced from trusted farms in India, our export-grade turmeric is sun-dried, cleaned, and sorted for quality consistency. Suitable for food processing, spice blends, and nutraceutical use.',
        origin: 'Maharashtra, India',
        grade: 'Export Grade A',
        minOrder: '500 kg',
        image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=1200&q=80',
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Ashvagandha',
        slug: 'ashvagandha',
        shortDescription: 'High-quality ashwagandha roots for wellness and herbal formulations.',
        description: 'Our ashwagandha is selected for purity and active compound potential, carefully processed to meet international export expectations for botanical ingredients and herbal products.',
        origin: 'Madhya Pradesh, India',
        grade: 'Premium Root Cut',
        minOrder: '300 kg',
        image: 'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?auto=format&fit=crop&w=1200&q=80',
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Moringa',
        slug: 'moringa',
        shortDescription: 'Nutrient-rich moringa leaves processed for global buyers.',
        description: 'Agriveda Export Limited supplies clean, food-safe moringa leaves and powders with traceable sourcing. Ideal for health supplements, tea blends, and superfood applications.',
        origin: 'Tamil Nadu, India',
        grade: 'Food Grade',
        minOrder: '400 kg',
        image: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=1200&q=80',
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Cumin',
        slug: 'cumin',
        shortDescription: 'Aromatic cumin seeds with robust flavor profile.',
        description: 'Our cumin seeds are machine-cleaned and quality checked for color, aroma, and moisture level. Packaged for secure international shipping and wholesale distribution.',
        origin: 'Gujarat, India',
        grade: 'Sortex Clean',
        minOrder: '500 kg',
        image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80',
        updatedAt: new Date().toISOString()
      }
    ],
    enquiries: []
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(seedData, null, 2));
}

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;

  const db = readDb();
  return db.users.find((user) => user.id === payload.sub) || null;
}

function requireAuth(req, res) {
  const user = getAuthUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  return user;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    sendJson(res, 403, { error: 'Admin access required' });
    return null;
  }
  return user;
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (pathname !== '/index.html' && pathname !== '/') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (indexErr, indexData) => {
          if (indexErr) {
            sendJson(res, 404, { error: 'Not found' });
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(indexData);
        });
        return;
      }
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(filePath);
    const contentTypeMap = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    res.writeHead(200, { 'Content-Type': contentTypeMap[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { ok: true, message: 'Agriveda Export Limited API is running' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/public-config') {
    sendJson(res, 200, { contactEmail: CONTACT_EMAIL, whatsappNumber: WHATSAPP_NUMBER });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    try {
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();

      if (!name || !email || !password) {
        sendJson(res, 400, { error: 'Name, email and password are required' });
        return;
      }

      const db = readDb();
      const existing = db.users.find((u) => u.email === email);
      if (existing) {
        sendJson(res, 409, { error: 'Email already registered' });
        return;
      }

      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash: hashPassword(password),
        role: 'customer',
        createdAt: new Date().toISOString()
      };

      db.users.push(user);
      writeDb(db);

      sendJson(res, 201, { message: 'Registration successful. Please login.' });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Invalid request' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();

      const db = readDb();
      const user = db.users.find((u) => u.email === email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        sendJson(res, 401, { error: 'Invalid email or password' });
        return;
      }

      const token = signJwt({ sub: user.id, role: user.role, email: user.email });
      sendJson(res, 200, {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Invalid request' });
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/api/me') {
    const user = requireAuth(req, res);
    if (!user) return;

    sendJson(res, 200, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/products') {
    const db = readDb();
    const user = getAuthUser(req);

    if (user) {
      sendJson(res, 200, db.products);
      return;
    }

    const publicProducts = db.products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription,
      image: p.image
    }));
    sendJson(res, 200, publicProducts);
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/products/')) {
    const user = requireAuth(req, res);
    if (!user) return;

    const productId = pathname.split('/').pop();
    const db = readDb();
    const product = db.products.find((p) => p.id === productId);
    if (!product) {
      sendJson(res, 404, { error: 'Product not found' });
      return;
    }

    sendJson(res, 200, product);
    return;
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/products/')) {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const productId = pathname.split('/').pop();

    try {
      const body = await parseBody(req);
      const db = readDb();
      const index = db.products.findIndex((p) => p.id === productId);
      if (index === -1) {
        sendJson(res, 404, { error: 'Product not found' });
        return;
      }

      const current = db.products[index];
      const updated = {
        ...current,
        name: String(body.name || current.name),
        shortDescription: String(body.shortDescription || current.shortDescription),
        description: String(body.description || current.description),
        origin: String(body.origin || current.origin),
        grade: String(body.grade || current.grade),
        minOrder: String(body.minOrder || current.minOrder),
        image: String(body.image || current.image),
        updatedAt: new Date().toISOString()
      };

      db.products[index] = updated;
      writeDb(db);

      sendJson(res, 200, { message: 'Product updated successfully', product: updated });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Invalid request' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/enquiries') {
    try {
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim();
      const phone = String(body.phone || '').trim();
      const product = String(body.product || '').trim();
      const message = String(body.message || '').trim();

      if (!name || !email || !product) {
        sendJson(res, 400, { error: 'Name, email and product are required' });
        return;
      }

      const db = readDb();
      const enquiry = {
        id: crypto.randomUUID(),
        name,
        email,
        phone,
        product,
        message,
        createdAt: new Date().toISOString()
      };

      db.enquiries.push(enquiry);
      writeDb(db);

      const emailBody = encodeURIComponent(
        `Hello Agriveda Export Limited,%0D%0A%0D%0AI want to enquire about ${product}.%0D%0AName: ${name}%0D%0AEmail: ${email}%0D%0APhone: ${phone}%0D%0AMessage: ${message}`
      );
      const whatsappText = encodeURIComponent(
        `Hello Agriveda Export Limited, I want to enquire about ${product}. Name: ${name}, Email: ${email}, Phone: ${phone}, Message: ${message}`
      );

      sendJson(res, 201, {
        message: 'Enquiry received successfully',
        enquiry,
        emailLink: `mailto:${CONTACT_EMAIL}?subject=Product%20Enquiry%20-%20${encodeURIComponent(product)}&body=${emailBody}`,
        whatsappLink: `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}`
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Invalid request' });
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/api/enquiries') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const db = readDb();
    sendJson(res, 200, db.enquiries);
    return;
  }

  sendJson(res, 404, { error: 'API endpoint not found' });
}

ensureDb();

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname);
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Agriveda Export Limited running at http://localhost:${PORT}`);
  console.log('Default admin: admin@agrivedaexports.com / Admin@123');
  console.log('Default customer: customer@agrivedaexports.com / Customer@123');
});
