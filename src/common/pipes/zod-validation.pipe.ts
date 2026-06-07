import { Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { DomainError } from '../../domain/errors/domain-errors';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new DomainError('validation_error', 'Request validation failed', result.error.issues);
    }
    return result.data;
  }
}
