const request = require('supertest');
const express = require('express');
const { createLead } = require('../src/modules/crm/crm.validation');
const { validate, errorHandler } = require('../src/middlewares/http');
const app = express().use(express.json());
app.post('/lead', createLead, validate, (req, res) => res.json({ name: req.body.name }));
app.use(errorHandler);
test('invalid email reports the field without returning submitted personal data', async () => {
  const response = await request(app).post('/lead').send({ name: 'Test', email: 'private-invalid-value' });
  expect(response.status).toBe(400);
  expect(response.body.fields).toEqual(['email']);
  expect(JSON.stringify(response.body)).not.toContain('private-invalid-value');
});
test('name and phone limits identify both fields', async () => {
  const response = await request(app).post('/lead').send({ name: 'x'.repeat(151), phone: '9'.repeat(31) });
  expect(response.status).toBe(400);
  expect(response.body.fields).toEqual(['name', 'phone']);
});
test('lead supports a trimmed name without optional contact fields', async () => {
  const response = await request(app).post('/lead').send({ name: '  Nuevo Lead  ' });
  expect(response.status).toBe(200);
  expect(response.body.name).toBe('Nuevo Lead');
});
