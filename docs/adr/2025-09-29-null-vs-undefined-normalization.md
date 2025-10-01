# ADR: Null vs Undefined Normalization

**Date**: 2025-09-29
**Status**: Accepted
**Context**: TypeScript Compilation Errors in Invoice Versioning System
**Decision Makers**: Engineering Team

## Context and Problem Statement

When implementing the invoice diff tracking system, we encountered TypeScript compilation errors (TS2345) due to a type mismatch between Prisma's nullable field types and our TypeScript interface optional property types.

**The Core Issue:**
- TypeScript optional properties (`name?: string`) translate to `string | undefined`
- Prisma nullable fields (`String?` in schema) are typed as `string | null`
- This creates a type incompatibility: `string | null` ≠ `string | undefined`

**Error Example:**
```typescript
interface ActorInfo {
  name?: string;  // Means: string | undefined (NOT null)
}

const user = await prisma.user.findUnique(...);
// user.name is typed as: string | null

const actorInfo: ActorInfo = {
  name: user.name  // ❌ TS2345: Type 'string | null' not assignable to 'string | undefined'
};
```

## Decision Drivers

1. **Type Safety**: Maintain strict TypeScript contracts without widening types
2. **Consistency**: Standardize on a single approach for optional values
3. **Simplicity**: Minimize boilerplate and cognitive overhead
4. **Prisma Compatibility**: Work seamlessly with Prisma's generated types
5. **Developer Experience**: Clear, predictable behavior at type boundaries

## Considered Options

### Option 1: Widen Interface Types to Accept Null ❌
```typescript
interface ActorInfo {
  name?: string | null;  // Accept both undefined and null
}
```

**Pros:**
- No conversion needed
- Direct assignment works

**Cons:**
- Weakens type safety
- Forces null-checks throughout the codebase
- Inconsistent with TypeScript's optional property semantics
- Makes APIs less predictable (callers must handle both null and undefined)

### Option 2: Use Required Non-Nullable Types ❌
```typescript
interface ActorInfo {
  name: string;  // Always required
}

const actorInfo: ActorInfo = {
  name: user.name || 'Unknown'  // Provide default
};
```

**Pros:**
- Eliminates nullability entirely
- Simpler type signatures

**Cons:**
- Not semantically correct (name IS optional)
- Requires artificial default values
- Loses information (can't distinguish "no name" from "name is Unknown")

### Option 3: Normalize Null to Undefined at Boundaries ✅ **SELECTED**
```typescript
interface ActorInfo {
  name?: string;  // Keep optional (undefined only)
}

const actorInfo: ActorInfo = {
  name: nullToUndefined(user.name)  // Convert null → undefined
};
```

**Pros:**
- Maintains strict type safety
- Consistent with TypeScript optional property semantics
- Clear boundary conversion (at data layer edges)
- No type weakening
- Predictable API contracts

**Cons:**
- Requires explicit conversion at boundary points
- Small runtime overhead (nullish coalescing)

## Decision Outcome

**Chosen Option:** Option 3 - Normalize Null to Undefined at Boundaries

We will standardize on `undefined` for optional properties and convert Prisma's `null` values to `undefined` at system boundaries (where we construct domain objects from database results).

### Implementation

**Utility Function:**
```typescript
// server/utils/normalize.ts
export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}
```

**Usage Pattern:**
```typescript
const user = await prisma.user.findUnique(...);

const actorInfo: ActorInfo = {
  id: user.id,
  email: user.email,
  name: nullToUndefined(user.name),  // Convert at boundary
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
};
```

### Rationale

1. **TypeScript Alignment**: Optional properties in TypeScript (`prop?: Type`) are syntactic sugar for `prop: Type | undefined`, NOT `Type | null | undefined`. Our approach aligns with this semantic.

2. **JSON Compatibility**: While JSON has `null` but not `undefined`, TypeScript treats `undefined` as "property absent" which maps naturally to optional fields. When serializing, `undefined` properties are omitted (which is often desired).

3. **Clarity of Intent**: `undefined` means "no value provided", `null` means "explicitly set to no value". For optional properties, `undefined` is more semantically correct.

4. **Type Safety**: By keeping types strict (`string | undefined`), we catch potential issues at compile time rather than runtime.

5. **Minimal Surface Area**: Conversion happens only at system boundaries (Prisma → domain objects), keeping the transformation localized and explicit.

## Consequences

### Positive

- ✅ TypeScript compilation succeeds without type assertions or `any`
- ✅ Consistent type contracts across services
- ✅ Clear separation between database layer (nullable) and domain layer (optional)
- ✅ Improved type safety catches null-handling bugs at compile time
- ✅ Predictable API contracts for service consumers

### Negative

- ⚠️ Requires explicit conversion at data boundaries
- ⚠️ Developers must remember to use `nullToUndefined` when constructing domain objects from Prisma results
- ⚠️ Small runtime overhead (negligible in practice)

### Neutral

- 📝 Establishes coding convention requiring documentation and team alignment
- 📝 May need ESLint rule to enforce null→undefined conversion at boundaries

## Compliance and Validation

### Automated Checks

**TypeScript Compilation:**
```bash
npx tsc --noEmit  # Must pass with 0 errors
```

**Unit Tests:**
- `server/utils/__tests__/normalize.test.ts` - Tests utility function
- `server/routes/__tests__/invoice.audit.test.ts` - Tests integration with ActorInfo

**Type Tests (Future):**
Consider adding `tsd` for compile-time type assertions:
```typescript
import { expectType } from 'tsd';

const result = nullToUndefined(nullableString);
expectType<string | undefined>(result);  // Never string | null
```

## Related Decisions

- [ADR-0001] Database Schema Nullable Fields (Prisma convention)
- [ADR-0015] Invoice Diff Tracking System Architecture
- [Future] ESLint Rule for Null Boundary Conversion

## References

- [TypeScript Handbook: Optional Properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#optional-properties)
- [Prisma Documentation: Null vs Undefined](https://www.prisma.io/docs/concepts/components/prisma-client/null-and-undefined)
- [TypeScript Issue #13195: Distinction between null and undefined](https://github.com/microsoft/TypeScript/issues/13195)

## Notes

This ADR was created in response to TS2345 compilation errors encountered during the invoice diff tracking implementation (2025-09-29). The decision establishes a project-wide standard for handling the Prisma nullable/TypeScript optional mismatch.

**Review Schedule:** Revisit in 6 months or when upgrading Prisma major versions to assess if Prisma's type generation has evolved.