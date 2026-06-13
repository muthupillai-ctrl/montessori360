import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies before importing the service
jest.mock('../../../config/database.js', () => ({
  tenantQuery:       jest.fn(),
  tenantTransaction: jest.fn(),
}));
jest.mock('../../../config/redis.js', () => ({
  cacheGet:        jest.fn().mockResolvedValue(null),
  cacheSet:        jest.fn().mockResolvedValue(undefined),
  cacheDel:        jest.fn().mockResolvedValue(undefined),
  cacheDelPattern: jest.fn().mockResolvedValue(undefined),
}));

import { tenantQuery, tenantTransaction } from '../../../config/database.js';
import { studentsService } from '../students.service.js';
import { AppError } from '../../../middleware/errorHandler.js';

const mockTenantQuery = tenantQuery as jest.MockedFunction<typeof tenantQuery>;
const mockTenantTx    = tenantTransaction as jest.MockedFunction<typeof tenantTransaction>;

const SCHEMA = 'tenant_test';
const USER_ID = '00000000-0000-0000-0000-000000000001';

const mockStudent = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  admission_no: 'ADM2500001',
  first_name: 'Arjun',
  last_name: 'Sharma',
  dob: new Date('2020-04-15'),
  gender: 'male',
  class_id: 'cccccccc-0000-0000-0000-000000000001',
  class_name: 'Casa 1 (3–4y)',
  blood_group: 'O+',
  nationality: 'Indian',
  aadhar_no: null,
  emergency_contacts: [{ name: 'Raj Sharma', relation: 'father', phone: '+919876543210', is_primary: true }],
  medical_notes: {},
  dietary_notes: null,
  allergies: [],
  previous_school: null,
  admission_date: new Date('2025-06-01'),
  sibling_ids: [],
  transport_route_id: null,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('StudentsService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getById ─────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('returns student when found', async () => {
      mockTenantQuery.mockResolvedValueOnce([mockStudent]);
      const result = await studentsService.getById(SCHEMA, mockStudent.id);
      expect(result.admission_no).toBe('ADM2500001');
      expect(result.first_name).toBe('Arjun');
    });

    it('throws 404 when student not found', async () => {
      mockTenantQuery.mockResolvedValueOnce([]);
      await expect(
        studentsService.getById(SCHEMA, 'nonexistent-id')
      ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });
  });

  // ── list ─────────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('returns paginated students', async () => {
      mockTenantQuery
        .mockResolvedValueOnce([{ total: '2' }])     // count query
        .mockResolvedValueOnce([mockStudent, { ...mockStudent, id: 'bbbbbbbb-0000-0000-0000-000000000001' }]);

      const result = await studentsService.list(SCHEMA, { page: 1, limit: 20 });
      expect(result.meta.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('applies class_id filter', async () => {
      mockTenantQuery
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([mockStudent]);

      await studentsService.list(SCHEMA, { class_id: mockStudent.class_id! });
      // Verify both queries used the correct schema
      expect(mockTenantQuery).toHaveBeenCalledTimes(2);
      expect(mockTenantQuery.mock.calls[0][0]).toBe(SCHEMA);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates student and returns admission number', async () => {
      mockTenantTx.mockImplementationOnce(async (_schema, fn) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })                 // nextAdmissionNo
            .mockResolvedValueOnce({ rows: [{ capacity: 20, enrolled: 5 }] }) // assertClassCapacity
            .mockResolvedValueOnce({ rows: [mockStudent] })                   // INSERT
            .mockResolvedValueOnce({ rows: [] }),                             // audit
        } as any;
        return fn(mockClient);
      });

      const dto = {
        first_name: 'Arjun',
        last_name: 'Sharma',
        dob: '2020-04-15',
        class_id: mockStudent.class_id!,
        emergency_contacts: [{ name: 'Raj Sharma', relation: 'father', phone: '+919876543210', is_primary: true }],
      };

      const result = await studentsService.create(SCHEMA, dto, USER_ID);
      expect(result.first_name).toBe('Arjun');
    });

    it('rejects when class is at full capacity', async () => {
      mockTenantTx.mockImplementationOnce(async (_schema, fn) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ cnt: '10' }] })
            .mockResolvedValueOnce({ rows: [{ capacity: 20, enrolled: 20 }] }),
        } as any;
        return fn(mockClient);
      });

      await expect(
        studentsService.create(SCHEMA, {
          first_name: 'Test', last_name: 'Student', dob: '2020-01-01',
          class_id: mockStudent.class_id!,
          emergency_contacts: [{ name: 'Parent', relation: 'mother', phone: '+910000000000', is_primary: true }],
        }, USER_ID)
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ── linkSiblings ──────────────────────────────────────────────────────────────
  describe('linkSiblings', () => {
    const studentB = { ...mockStudent, id: 'bbbbbbbb-0000-0000-0000-000000000002', sibling_ids: [] };

    it('links two students as siblings', async () => {
      mockTenantQuery
        .mockResolvedValueOnce([mockStudent])   // getById A (no cache)
        .mockResolvedValueOnce([studentB]);     // getById B (no cache)

      mockTenantTx.mockImplementationOnce(async (_schema, fn) => {
        const mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }) } as any;
        return fn(mockClient);
      });

      await expect(
        studentsService.linkSiblings(SCHEMA, mockStudent.id, studentB.id, USER_ID)
      ).resolves.toBeUndefined();
    });

    it('throws if same student ID passed for both', async () => {
      await expect(
        studentsService.linkSiblings(SCHEMA, mockStudent.id, mockStudent.id, USER_ID)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws if already linked', async () => {
      const alreadyLinked = { ...mockStudent, sibling_ids: [studentB.id] };
      mockTenantQuery
        .mockResolvedValueOnce([alreadyLinked])
        .mockResolvedValueOnce([studentB]);

      await expect(
        studentsService.linkSiblings(SCHEMA, alreadyLinked.id, studentB.id, USER_ID)
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────────
  describe('deactivate', () => {
    it('deactivates an active student', async () => {
      mockTenantQuery.mockResolvedValueOnce([mockStudent]);
      mockTenantTx.mockImplementationOnce(async (_schema, fn) => {
        const mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }) } as any;
        return fn(mockClient);
      });
      await expect(
        studentsService.deactivate(SCHEMA, mockStudent.id, USER_ID)
      ).resolves.toBeUndefined();
    });

    it('throws if student already inactive', async () => {
      mockTenantQuery.mockResolvedValueOnce([{ ...mockStudent, is_active: false }]);
      await expect(
        studentsService.deactivate(SCHEMA, mockStudent.id, USER_ID)
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

});
