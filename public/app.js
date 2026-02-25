const state = {
  token: localStorage.getItem('agriveda_token') || '',
  user: null,
  products: [],
  config: { contactEmail: 'sales@agrivedaexports.com', whatsappNumber: '919999999999' }
};

const el = {
  openAuthBtn: document.getElementById('openAuthBtn'),
  closeAuthBtn: document.getElementById('closeAuthBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  authModal: document.getElementById('authModal'),
  showLogin: document.getElementById('showLogin'),
  showRegister: document.getElementById('showRegister'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  authStatus: document.getElementById('authStatus'),
  accountStatus: document.getElementById('accountStatus'),
  productGrid: document.getElementById('productGrid'),
  enquiryForm: document.getElementById('enquiryForm'),
  enquiryProduct: document.getElementById('enquiryProduct'),
  enquiryStatus: document.getElementById('enquiryStatus'),
  adminSection: document.getElementById('adminSection'),
  adminProductSelect: document.getElementById('adminProductSelect'),
  productEditForm: document.getElementById('productEditForm'),
  adminStatus: document.getElementById('adminStatus')
};

function showStatus(target, message, isError = false) {
  target.textContent = message;
  target.style.color = isError ? '#a11f1f' : '#3f5728';
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function renderProducts() {
  el.productGrid.innerHTML = '';

  state.products.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card';

    const detailBlock = state.user
      ? `<p class="product-meta"><strong>Origin:</strong> ${product.origin || 'N/A'}</p>
         <p class="product-meta"><strong>Grade:</strong> ${product.grade || 'N/A'} | <strong>Min Order:</strong> ${product.minOrder || 'N/A'}</p>
         <p>${product.description || ''}</p>`
      : '<p class="product-meta">Login to access full technical details.</p>';

    const message = encodeURIComponent(
      `Hello Agriveda Export Limited, I am interested in ${product.name}. Please share quotation and shipment details.`
    );
    const emailLink = `mailto:${state.config.contactEmail}?subject=Enquiry%20for%20${encodeURIComponent(product.name)}&body=${message}`;
    const whatsappLink = `https://wa.me/${state.config.whatsappNumber}?text=${message}`;

    card.innerHTML = `
      <img src="${product.image || 'https://placehold.co/600x400?text=Agriveda'}" alt="${product.name}" />
      <div class="product-content">
        <h4>${product.name}</h4>
        <p>${product.shortDescription || ''}</p>
        ${detailBlock}
        <div class="hero-cta">
          <a class="btn" href="${emailLink}">Enquire by Email</a>
          <a class="btn btn-outline" href="${whatsappLink}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
        </div>
      </div>
    `;

    el.productGrid.appendChild(card);
  });

  renderProductOptions();
}

function renderProductOptions() {
  const options = state.products
    .map((p) => `<option value="${p.name}">${p.name}</option>`)
    .join('');

  el.enquiryProduct.innerHTML = '<option value="">Select Product</option>' + options;
  el.adminProductSelect.innerHTML = '<option value="">Select Product to Edit</option>' + options;
}

function setAuthView() {
  if (state.user) {
    el.logoutBtn.classList.remove('hidden');
    el.openAuthBtn.classList.add('hidden');
    el.accountStatus.textContent = `Logged in as ${state.user.name} (${state.user.role})`;
  } else {
    el.logoutBtn.classList.add('hidden');
    el.openAuthBtn.classList.remove('hidden');
    el.accountStatus.textContent = 'You are browsing as a guest.';
  }

  if (state.user?.role === 'admin') {
    el.adminSection.classList.remove('hidden');
  } else {
    el.adminSection.classList.add('hidden');
  }
}

function bindAuthTabs() {
  el.showLogin.addEventListener('click', () => {
    el.showLogin.classList.add('active');
    el.showRegister.classList.remove('active');
    el.loginForm.classList.remove('hidden');
    el.registerForm.classList.add('hidden');
    el.authStatus.textContent = '';
  });

  el.showRegister.addEventListener('click', () => {
    el.showRegister.classList.add('active');
    el.showLogin.classList.remove('active');
    el.registerForm.classList.remove('hidden');
    el.loginForm.classList.add('hidden');
    el.authStatus.textContent = '';
  });
}

async function loadPublicConfig() {
  try {
    state.config = await api('/api/public-config');
  } catch {
    // Keep default fallback values.
  }
}

async function loadProducts() {
  state.products = await api('/api/products');
  renderProducts();
}

async function loadCurrentUser() {
  if (!state.token) {
    state.user = null;
    setAuthView();
    return;
  }

  try {
    state.user = await api('/api/me');
  } catch {
    state.token = '';
    state.user = null;
    localStorage.removeItem('agriveda_token');
  }

  setAuthView();
}

el.openAuthBtn.addEventListener('click', () => el.authModal.showModal());
el.closeAuthBtn.addEventListener('click', () => el.authModal.close());

el.logoutBtn.addEventListener('click', async () => {
  state.token = '';
  state.user = null;
  localStorage.removeItem('agriveda_token');
  setAuthView();
  await loadProducts();
});

el.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('agriveda_token', state.token);

    setAuthView();
    await loadProducts();
    showStatus(el.authStatus, 'Login successful.');
    setTimeout(() => el.authModal.close(), 500);
  } catch (error) {
    showStatus(el.authStatus, error.message, true);
  }
});

el.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    const payload = Object.fromEntries(formData.entries());
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showStatus(el.authStatus, 'Registration successful. Please login now.');
    el.showLogin.click();
  } catch (error) {
    showStatus(el.authStatus, error.message, true);
  }
});

el.enquiryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await api('/api/enquiries', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showStatus(el.enquiryStatus, 'Enquiry submitted. Opening email and WhatsApp options...');
    window.open(result.emailLink, '_blank');
    window.open(result.whatsappLink, '_blank');
    event.currentTarget.reset();
  } catch (error) {
    showStatus(el.enquiryStatus, error.message, true);
  }
});

el.adminProductSelect.addEventListener('change', () => {
  const name = el.adminProductSelect.value;
  const product = state.products.find((p) => p.name === name);
  if (!product) return;

  document.getElementById('editName').value = product.name || '';
  document.getElementById('editOrigin').value = product.origin || '';
  document.getElementById('editGrade').value = product.grade || '';
  document.getElementById('editMinOrder').value = product.minOrder || '';
  document.getElementById('editImage').value = product.image || '';
  document.getElementById('editShortDescription').value = product.shortDescription || '';
  document.getElementById('editDescription').value = product.description || '';
});

el.productEditForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const product = state.products.find((p) => p.name === el.adminProductSelect.value);
  if (!product) {
    showStatus(el.adminStatus, 'Please select a product first.', true);
    return;
  }

  const payload = {
    name: document.getElementById('editName').value,
    origin: document.getElementById('editOrigin').value,
    grade: document.getElementById('editGrade').value,
    minOrder: document.getElementById('editMinOrder').value,
    image: document.getElementById('editImage').value,
    shortDescription: document.getElementById('editShortDescription').value,
    description: document.getElementById('editDescription').value
  };

  try {
    await api(`/api/products/${product.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    showStatus(el.adminStatus, 'Product updated successfully.');
    await loadProducts();
    el.adminProductSelect.value = payload.name;
  } catch (error) {
    showStatus(el.adminStatus, error.message, true);
  }
});

bindAuthTabs();

(async function init() {
  await loadPublicConfig();
  await loadCurrentUser();
  await loadProducts();
})();
