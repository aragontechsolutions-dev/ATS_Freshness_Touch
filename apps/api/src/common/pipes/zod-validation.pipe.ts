import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { API_ERROR_CODES } from '@freshness/types';
import type { ZodType } from 'zod';

/**
 * Valida el cuerpo de la peticion contra un esquema Zod.
 *
 * SEGURIDAD: los esquemas son "strict", asi que cualquier campo no declarado
 * hace fallar la peticion. Esto evita "mass assignment" (que un cliente
 * inyecte campos que el servidor no espera) y garantiza que a la logica de
 * negocio solo llegan datos con la forma y los rangos permitidos.
 */
@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'calculator.errorValidation',
        fields: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}
