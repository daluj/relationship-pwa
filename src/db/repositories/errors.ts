import type { ZodError } from 'zod';

export class ValidationError extends Error {
  constructor(
    readonly entity: string,
    readonly issues: ZodError['issues'],
  ) {
    super(
      `Invalid ${entity}: ${issues.map((i) => `${i.path.join('.') || '(root)'} ${i.message}`).join('; ')}`,
    );
    this.name = 'ValidationError';
  }
}

export class RecordNotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    // Distinct from Dexie's own "NotFoundError", which Dexie re-wraps when thrown inside a transaction.
    this.name = 'RecordNotFoundError';
  }
}

export class DuplicateError extends Error {
  constructor(entity: string, key: string) {
    super(`${entity} "${key}" already exists`);
    this.name = 'DuplicateError';
  }
}
