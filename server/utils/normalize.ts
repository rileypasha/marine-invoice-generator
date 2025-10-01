/**
 * Null Normalization Utilities
 *
 * Provides type-safe conversion between null and undefined values
 * to maintain strict TypeScript type contracts.
 */

/**
 * Normalize null values to undefined for strict TypeScript type safety
 *
 * This ensures compatibility with interfaces that use optional properties
 * (e.g., `name?: string`) which don't accept null values.
 *
 * TypeScript optional properties (`prop?: Type`) translate to `Type | undefined`,
 * NOT `Type | null | undefined`. However, Prisma nullable fields (`String?`)
 * are typed as `string | null`, creating a type mismatch.
 *
 * This utility bridges that gap by normalizing null to undefined at
 * boundary points where we construct objects matching strict interfaces.
 *
 * @param value - Value that may be null, undefined, or of type T
 * @returns The value if not nullish, otherwise undefined
 *
 * @example
 * ```typescript
 * interface Actor {
 *   name?: string;  // string | undefined (NOT string | null | undefined)
 * }
 *
 * const user = await prisma.user.findUnique(...);
 * // user.name is typed as string | null
 *
 * const actor: Actor = {
 *   name: nullToUndefined(user.name)  // Converts null → undefined
 * };
 * ```
 */
export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}