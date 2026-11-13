import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestContext, TestClient } from './helpers.js';

const ctx = await createTestContext();
test.after(async () => ctx.stop());

interface AddressResponse {
  address: {
    id: string;
    label: string;
    firstName: string;
    lastName: string;
    line1: string;
    line2: string;
    postalCode: string;
    city: string;
    country: string;
    phone: string;
    isDefault: boolean;
  };
}

interface AddressListResponse {
  addresses: AddressResponse['address'][];
}

const FIRST_ADDRESS = {
  label: 'Maison',
  firstName: 'Awa',
  lastName: 'Dossou',
  line1: '12 rue des Palmiers',
  line2: 'Porte 3',
  postalCode: 'Akpakpa',
  city: 'Cotonou',
  country: 'bj',
  phone: '+229 01 97 00 00 00',
};

test('le carnet d’adresses exige une session', async () => {
  const response = await ctx.client.request('GET', '/api/addresses');
  assert.equal(response.status, 401);
});

test('un client crée, modifie et supprime ses adresses', async () => {
  const registration = await ctx.client.request('POST', '/api/auth/register', {
    email: 'carnet.adresses@example.com',
    password: 'MotDePasse123!',
    fullName: 'Awa Dossou',
    phone: '+229 01 97 00 00 00',
    acceptTerms: true,
  });
  assert.equal(registration.status, 201);

  const empty = await ctx.client.request<AddressListResponse>('GET', '/api/addresses');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.data.addresses, []);

  const first = await ctx.client.request<AddressResponse>('POST', '/api/addresses', FIRST_ADDRESS);
  assert.equal(first.status, 201);
  assert.equal(first.data.address.country, 'BJ');
  assert.equal(first.data.address.isDefault, true);

  const second = await ctx.client.request<AddressResponse>('POST', '/api/addresses', {
    label: 'Bureau',
    firstName: 'Awa',
    lastName: 'Dossou',
    line1: '45 boulevard de la Marina',
    line2: '',
    postalCode: 'Haie Vive',
    city: 'Cotonou',
    country: 'BJ',
    phone: '+229 01 97 00 00 01',
    isDefault: false,
  });
  assert.equal(second.status, 201);
  assert.equal(second.data.address.isDefault, false);

  const list = await ctx.client.request<AddressListResponse>('GET', '/api/addresses');
  assert.equal(list.data.addresses.length, 2);
  assert.equal(list.data.addresses[0].id, first.data.address.id);
  assert.equal(list.data.addresses[0].isDefault, true);

  const promoted = await ctx.client.request<AddressResponse>(
    'POST',
    `/api/addresses/${second.data.address.id}/default`,
    {},
  );
  assert.equal(promoted.status, 200);
  assert.equal(promoted.data.address.isDefault, true);

  const updated = await ctx.client.request<AddressResponse>('PUT', `/api/addresses/${second.data.address.id}`, {
    label: 'Bureau principal',
    firstName: 'Awa',
    lastName: 'Dossou',
    line1: '45 boulevard de la Marina',
    line2: '2e étage',
    postalCode: 'Haie Vive',
    city: 'Cotonou',
    country: 'BJ',
    phone: '+229 01 97 00 00 01',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.address.label, 'Bureau principal');
  assert.equal(updated.data.address.isDefault, true);

  const removed = await ctx.client.request<{ ok: boolean }>('DELETE', `/api/addresses/${second.data.address.id}`);
  assert.equal(removed.status, 200);
  assert.equal(removed.data.ok, true);

  const afterDelete = await ctx.client.request<AddressListResponse>('GET', '/api/addresses');
  assert.equal(afterDelete.data.addresses.length, 1);
  assert.equal(afterDelete.data.addresses[0].id, first.data.address.id);
  assert.equal(afterDelete.data.addresses[0].isDefault, true);
});

test('un client ne peut pas modifier l’adresse d’un autre client', async () => {
  const owner = await ctx.client.request<AddressListResponse>('GET', '/api/addresses');
  const addressId = owner.data.addresses[0].id;

  const other = new TestClient(ctx.baseUrl);
  await other.init();
  const registration = await other.request('POST', '/api/auth/register', {
    email: 'carnet.autre@example.com',
    password: 'MotDePasse123!',
    fullName: 'Autre Client',
    acceptTerms: true,
  });
  assert.equal(registration.status, 201);

  const otherList = await other.request<AddressListResponse>('GET', '/api/addresses');
  assert.equal(otherList.status, 200);
  assert.deepEqual(otherList.data.addresses, []);

  const forbiddenUpdate = await other.request('PUT', `/api/addresses/${addressId}`, FIRST_ADDRESS);
  assert.equal(forbiddenUpdate.status, 404);

  const forbiddenDelete = await other.request('DELETE', `/api/addresses/${addressId}`);
  assert.equal(forbiddenDelete.status, 404);
});

test('une adresse invalide est refusée avant écriture', async () => {
  const response = await ctx.client.request('POST', '/api/addresses', {
    ...FIRST_ADDRESS,
    line1: 'x',
    country: 'France',
  });
  assert.equal(response.status, 422);
});
