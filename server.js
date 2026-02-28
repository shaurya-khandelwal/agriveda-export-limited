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
const APP_ORIGIN = process.env.APP_ORIGIN || '*';

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'sales@agrivedaexports.com';
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '918209796106';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const rateLimitStore = new Map();

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
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
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
        image: 'https://images.unsplash.com/photo-1564894809611-1742fc40ed80?auto=format&fit=crop&w=1200&q=80',
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
        image: 'https://images.unsplash.com/photo-1612433651488-f3a112a03a8b?auto=format&fit=crop&w=1200&q=80',
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
        image: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=1200&q=80',
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

function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Cross-Origin-Resource-Policy': 'cross-origin'
  };
}

function getCorsOrigin(req) {
  if (APP_ORIGIN === '*') return '*';
  const requestOrigin = req.headers.origin || '';
  return requestOrigin === APP_ORIGIN ? APP_ORIGIN : APP_ORIGIN;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...getSecurityHeaders(),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function sendApiJson(req, res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...getSecurityHeaders(),
    'Access-Control-Allow-Origin': getCorsOrigin(req),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function normalizeString(value, maxLength = 255) {
  const cleaned = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
  return cleaned;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function getRateKey(req, route) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || req.socket.remoteAddress || 'unknown'))
    .split(',')[0]
    .trim();
  return `${route}:${ip}`;
}

function checkRateLimit(req, route, limit) {
  const now = Date.now();
  const key = getRateKey(req, route);
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= limit) {
    return true;
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return false;
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
    sendApiJson(req, res, 401, { error: 'Unauthorized' });
    return null;
  }
  return user;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    sendApiJson(req, res, 403, { error: 'Admin access required' });
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
          res.writeHead(200, { 'Content-Type': 'text/html', ...getSecurityHeaders() });
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

    res.writeHead(200, { 'Content-Type': contentTypeMap[ext] || 'application/octet-stream', ...getSecurityHeaders() });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...getSecurityHeaders(),
      'Access-Control-Allow-Origin': getCorsOrigin(req),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    sendApiJson(req, res, 200, { ok: true, message: 'Agriveda Export Limited API is running' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/public-config') {
    sendApiJson(req, res, 200, { contactEmail: CONTACT_EMAIL, whatsappNumber: WHATSAPP_NUMBER });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    if (checkRateLimit(req, 'register', 20)) {
      sendApiJson(req, res, 429, { error: 'Too many registration attempts. Please try again later.' });
      return;
    }

    try {
      const body = await parseBody(req);
      const name = normalizeString(body.name, 80);
      const email = normalizeString(body.email, 120).toLowerCase();
      const password = String(body.password || '').trim();

      if (!name || !email || !password) {
        sendApiJson(req, res, 400, { error: 'Name, email and password are required' });
        return;
      }

      if (!isValidEmail(email)) {
        sendApiJson(req, res, 400, { error: 'Please enter a valid email address' });
        return;
      }

      if (!isStrongPassword(password)) {
        sendApiJson(req, res, 400, {
          error: 'Password must be at least 8 chars and include uppercase, lowercase, number and symbol'
        });
        return;
      }

      const db = readDb();
      const existing = db.users.find((u) => u.email === email);
      if (existing) {
        sendApiJson(req, res, 409, { error: 'Email already registered' });
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

      sendApiJson(req, res, 201, { message: 'Registration successful. Please login.' });
    } catch (error) {
      sendApiJson(req, res, 400, { error: error.message || 'Invalid request' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    if (checkRateLimit(req, 'login', 30)) {
      sendApiJson(req, res, 429, { error: 'Too many login attempts. Please try again later.' });
      return;
    }

    try {
      const body = await parseBody(req);
      const email = normalizeString(body.email, 120).toLowerCase();
      const password = String(body.password || '').trim();

      if (!isValidEmail(email)) {
        sendApiJson(req, res, 400, { error: 'Please enter a valid email address' });
        return;
      }

      const db = readDb();
      const user = db.users.find((u) => u.email === email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        sendApiJson(req, res, 401, { error: 'Invalid email or password' });
        return;
      }

      const token = signJwt({ sub: user.id, role: user.role, email: user.email });
      sendApiJson(req, res, 200, {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      sendApiJson(req, res, 400, { error: error.message || 'Invalid request' });
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/api/me') {
    const user = requireAuth(req, res);
    if (!user) return;

    sendApiJson(req, res, 200, {
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
      sendApiJson(req, res, 200, db.products);
      return;
    }

    const publicProducts = db.products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription,
      image: p.image
    }));
    sendApiJson(req, res, 200, publicProducts);
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/products/')) {
    const user = requireAuth(req, res);
    if (!user) return;

    const productId = pathname.split('/').pop();
    const db = readDb();
    const product = db.products.find((p) => p.id === productId);
    if (!product) {
      sendApiJson(req, res, 404, { error: 'Product not found' });
      return;
    }

    sendApiJson(req, res, 200, product);
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
        sendApiJson(req, res, 404, { error: 'Product not found' });
        return;
      }

      const current = db.products[index];
      const updated = {
        ...current,
        name: normalizeString(body.name || current.name, 80),
        shortDescription: normalizeString(body.shortDescription || current.shortDescription, 240),
        description: normalizeString(body.description || current.description, 2000),
        origin: normalizeString(body.origin || current.origin, 120),
        grade: normalizeString(body.grade || current.grade, 120),
        minOrder: normalizeString(body.minOrder || current.minOrder, 60),
        image: normalizeString(body.image || current.image, 400),
        updatedAt: new Date().toISOString()
      };

      db.products[index] = updated;
      writeDb(db);

      sendApiJson(req, res, 200, { message: 'Product updated successfully', product: updated });
    } catch (error) {
      sendApiJson(req, res, 400, { error: error.message || 'Invalid request' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/enquiries') {
    if (checkRateLimit(req, 'enquiry', 40)) {
      sendApiJson(req, res, 429, { error: 'Too many enquiries submitted. Please try again later.' });
      return;
    }

    try {
      const body = await parseBody(req);
      const name = normalizeString(body.name, 80);
      const email = normalizeString(body.email, 120);
      const phone = normalizeString(body.phone, 40);
      const product = normalizeString(body.product, 80);
      const message = normalizeString(body.message, 1000);

      if (!name || !email || !product) {
        sendApiJson(req, res, 400, { error: 'Name, email and product are required' });
        return;
      }

      if (!isValidEmail(email)) {
        sendApiJson(req, res, 400, { error: 'Please enter a valid email address' });
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

      sendApiJson(req, res, 201, {
        message: 'Enquiry received successfully',
        enquiry,
        emailLink: `mailto:${CONTACT_EMAIL}?subject=Product%20Enquiry%20-%20${encodeURIComponent(product)}&body=${emailBody}`,
        whatsappLink: `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}`
      });
    } catch (error) {
      sendApiJson(req, res, 400, { error: error.message || 'Invalid request' });
    }
    return;
  }

  if (req.method === 'GET' && pathname === '/api/enquiries') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const db = readDb();
    sendApiJson(req, res, 200, db.enquiries);
    return;
  }

  sendApiJson(req, res, 404, { error: 'API endpoint not found' });
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
  if (JWT_SECRET === 'replace-this-in-production') {
    console.warn('WARNING: Set a strong JWT_SECRET before production use.');
  }
  if (APP_ORIGIN === '*') {
    console.warn('WARNING: Set APP_ORIGIN to your frontend domain for stricter CORS in production.');
  }
});
