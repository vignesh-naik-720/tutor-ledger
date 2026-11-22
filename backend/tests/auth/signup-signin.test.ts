import { describe, expect, it, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Owner Sign-Up and Sign-In Flow', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildApp({
      deps: {
        pepper: 'test_pepper_at_least_32_characters_long_!',
        auditHmacKey: 'test_audit_key_32_characters_long_!',
        fieldKey: Buffer.alloc(32, 1),
        phoneKey: 'test_phone_key_32_characters_long_!',
      },
      setupSecret: 'test_setup_secret',
    });
  });

  it('rejects sign-up with invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        name: 'John Doe',
        email: 'invalid-email',
        dob: '1995-05-15',
        password: 'ValidPassword123!',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects sign-up with password shorter than 8 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        name: 'John Doe',
        email: 'john.short@example.com',
        dob: '1995-05-15',
        password: 'short',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects sign-up for user under 16 years old', async () => {
    // 10 years ago
    const youngDate = new Date();
    youngDate.setFullYear(youngDate.getFullYear() - 10);
    const dob = youngDate.toISOString().slice(0, 10);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        name: 'Too Young',
        email: 'young@example.com',
        dob,
        password: 'ValidPassword123!',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('successfully registers a new tutor owner', async () => {
    const email = `tutor.${Date.now()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        name: 'Professor Smith',
        email,
        dob: '1990-08-20',
        password: 'SecurePassword123!',
        currency_code: 'INR',
        minimum_balance_minor: 1000000,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('created');
    expect(body.owner.name).toBe('Professor Smith');
    expect(body.owner.email).toBe(email.toLowerCase());
    expect(body.owner.dob).toBe('1990-08-20');
    expect(body.csrf_token).toBeDefined();

    // Verify duplicate registration with same email (even with different case) is rejected with 409
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        name: 'Professor Smith Clone',
        email: email.toUpperCase(),
        dob: '1990-08-20',
        password: 'AnotherPassword123!',
      },
    });
    expect(dupRes.statusCode).toBe(409);

    // Verify login with registered email (case-insensitive) and correct password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: email.toUpperCase(),
        password: 'SecurePassword123!',
      },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.body);
    expect(loginBody.status).toBe('ok');
    expect(loginBody.owner.email).toBe(email.toLowerCase());

    // Verify login with wrong password fails with 401
    const badLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email,
        password: 'WrongPassword!',
      },
    });
    expect(badLoginRes.statusCode).toBe(401);
  });
});
