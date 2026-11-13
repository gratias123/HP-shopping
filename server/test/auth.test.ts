import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestContext, DEMO_EMAIL, DEMO_PASSWORD } from './helpers.js';

const ctx = await createTestContext();
test.after(async () => ctx.stop());

test('GET /api/health renvoie un état exploitable', async () => {
  const response = await ctx.client.request<{ ok: boolean; mode: string }>('GET', '/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.data.ok, true);
  assert.equal(response.data.mode, 'local');
});

test('les en-têtes de sécurité sont appliqués', async () => {
  const response = await ctx.client.request('GET', '/api/store');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});

test('une mutation sans jeton CSRF est refusée', async () => {
  const response = await ctx.client.request(
    'POST',
    '/api/auth/login',
    { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    { csrf: false },
  );
  assert.equal(response.status, 403);
  assert.equal((response.data as { error: { code: string } }).error.code, 'csrf_invalid');
});

test('l’inscription valide les champs et accepte les conditions', async () => {
  const missingTerms = await ctx.client.request('POST', '/api/auth/register', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    fullName: 'Client Démo',
    acceptTerms: false,
  });
  assert.equal(missingTerms.status, 422);
  assert.equal((missingTerms.data as { error: { code: string } }).error.code, 'validation_error');

  const response = await ctx.client.request<{
    user: { id: string; email: string; fullName: string; phone: string; role: string; isAdmin: boolean };
  }>('POST', '/api/auth/register', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    fullName: 'Client Démo',
    phone: '+33 6 12 34 56 78',
    acceptTerms: true,
  });
  assert.equal(response.status, 201);
  assert.equal(response.data.user.email, DEMO_EMAIL);
  assert.equal(response.data.user.phone, '+33 6 12 34 56 78');
  assert.equal(response.data.user.role, 'customer');
  assert.equal(response.data.user.isAdmin, false);
  assert.ok(response.data.user.id);
});

test('le doublon d’inscription est refusé proprement', async () => {
  const response = await ctx.client.request('POST', '/api/auth/register', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    fullName: 'Client Démo',
    acceptTerms: true,
  });
  assert.equal(response.status, 409);
  assert.equal((response.data as { error: { code: string } }).error.code, 'email_taken');
});

test('la session est reconnue par /api/auth/me', async () => {
  const response = await ctx.client.request<{ user: { email: string; phone: string } | null }>('GET', '/api/auth/me');
  assert.equal(response.status, 200);
  assert.equal(response.data.user?.email, DEMO_EMAIL);
  assert.equal(response.data.user?.phone, '+33 6 12 34 56 78');
});

test('les routes d’administration sont refusées aux clients', async () => {
  const response = await ctx.client.request('GET', '/api/admin/dashboard');
  assert.equal(response.status, 403);
  assert.equal((response.data as { error: { code: string } }).error.code, 'forbidden');
});

test('le profil met à jour le nom et le téléphone', async () => {
  const response = await ctx.client.request<{ user: { fullName: string; phone: string } }>(
    'PATCH',
    '/api/auth/profile',
    { fullName: 'Client Démo Modifié', phone: '06 00 00 00 00' },
  );
  assert.equal(response.status, 200);
  assert.equal(response.data.user.fullName, 'Client Démo Modifié');
  assert.equal(response.data.user.phone, '06 00 00 00 00');
});

test('la déconnexion invalide la session', async () => {
  const logout = await ctx.client.request('POST', '/api/auth/logout');
  assert.equal(logout.status, 200);
  const me = await ctx.client.request<{ user: unknown }>('GET', '/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.user, null);
});

test('la connexion refuse un mauvais mot de passe puis accepte le bon', async () => {
  const invalid = await ctx.client.request('POST', '/api/auth/login', { email: DEMO_EMAIL, password: 'MauvaisMotDePasse1' });
  assert.equal(invalid.status, 401);
  assert.equal((invalid.data as { error: { code: string } }).error.code, 'invalid_credentials');

  const valid = await ctx.client.request<{ user: { email: string; phone: string } }>('POST', '/api/auth/login', {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  assert.equal(valid.status, 200);
  assert.equal(valid.data.user.email, DEMO_EMAIL);
  assert.equal(valid.data.user.phone, '06 00 00 00 00');
});
