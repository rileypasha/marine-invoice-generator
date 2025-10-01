import { nullToUndefined } from '../normalize';

describe('nullToUndefined', () => {
  describe('null conversion', () => {
    it('should convert null to undefined', () => {
      expect(nullToUndefined(null)).toBeUndefined();
    });

    it('should preserve undefined', () => {
      expect(nullToUndefined(undefined)).toBeUndefined();
    });
  });

  describe('value preservation', () => {
    it('should preserve string values', () => {
      expect(nullToUndefined('test')).toBe('test');
      expect(nullToUndefined('')).toBe('');
      expect(nullToUndefined('with spaces')).toBe('with spaces');
    });

    it('should preserve number values', () => {
      expect(nullToUndefined(123)).toBe(123);
      expect(nullToUndefined(0)).toBe(0);
      expect(nullToUndefined(-456.789)).toBe(-456.789);
    });

    it('should preserve boolean values', () => {
      expect(nullToUndefined(true)).toBe(true);
      expect(nullToUndefined(false)).toBe(false);
    });

    it('should preserve object values', () => {
      const obj = { key: 'value', nested: { prop: 123 } };
      expect(nullToUndefined(obj)).toBe(obj);
      expect(nullToUndefined(obj)).toEqual({ key: 'value', nested: { prop: 123 } });
    });

    it('should preserve array values', () => {
      const arr = [1, 2, 3];
      expect(nullToUndefined(arr)).toBe(arr);
      expect(nullToUndefined(arr)).toEqual([1, 2, 3]);
    });

    it('should preserve Date objects', () => {
      const date = new Date('2025-01-15');
      expect(nullToUndefined(date)).toBe(date);
    });
  });

  describe('type safety', () => {
    it('should maintain type inference for non-nullable values', () => {
      const value: string = 'test';
      const result = nullToUndefined(value);

      // TypeScript should infer result as string | undefined
      expect(typeof result).toBe('string');
    });

    it('should handle union types correctly', () => {
      const value: string | null = Math.random() > 0.5 ? 'test' : null;
      const result = nullToUndefined(value);

      // result should be string | undefined
      expect(result === undefined || typeof result === 'string').toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle NaN', () => {
      expect(nullToUndefined(NaN)).toBeNaN();
    });

    it('should handle Infinity', () => {
      expect(nullToUndefined(Infinity)).toBe(Infinity);
      expect(nullToUndefined(-Infinity)).toBe(-Infinity);
    });

    it('should handle BigInt values', () => {
      const bigInt = BigInt(9007199254740991);
      expect(nullToUndefined(bigInt)).toBe(bigInt);
    });

    it('should handle Symbol values', () => {
      const sym = Symbol('test');
      expect(nullToUndefined(sym)).toBe(sym);
    });

    it('should handle functions', () => {
      const fn = () => 'test';
      expect(nullToUndefined(fn)).toBe(fn);
      expect(nullToUndefined(fn)()).toBe('test');
    });
  });

  describe('real-world use cases', () => {
    it('should normalize Prisma nullable string to optional property', () => {
      // Simulate Prisma User model with nullable name
      interface PrismaUser {
        id: string;
        email: string;
        name: string | null;
      }

      // Interface with optional property (no null)
      interface ActorInfo {
        id: string;
        email: string;
        name?: string;
      }

      const prismaUser: PrismaUser = {
        id: '123',
        email: 'user@example.com',
        name: null,
      };

      const actorInfo: ActorInfo = {
        id: prismaUser.id,
        email: prismaUser.email,
        name: nullToUndefined(prismaUser.name),
      };

      expect(actorInfo.name).toBeUndefined();
      expect('name' in actorInfo).toBe(true); // Property exists but is undefined
    });

    it('should preserve non-null Prisma values', () => {
      interface PrismaUser {
        name: string | null;
      }

      interface ActorInfo {
        name?: string;
      }

      const prismaUser: PrismaUser = {
        name: 'John Doe',
      };

      const actorInfo: ActorInfo = {
        name: nullToUndefined(prismaUser.name),
      };

      expect(actorInfo.name).toBe('John Doe');
    });
  });
});