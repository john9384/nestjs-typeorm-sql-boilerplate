import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  content: T;
  message: string;
  statusCode: number;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode || 200;

    return next.handle().pipe(
      map((data) => {
        // If data is already in the expected format, return it as is
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'content' in data &&
          'message' in data &&
          'statusCode' in data
        ) {
          return data;
        }

        // Handle different response types
        let content: any = data;
        let message = 'Success';

        // If data has a message property, extract it
        if (data && typeof data === 'object' && 'message' in data) {
          message = (data as { message: string }).message;
          // Remove message from content if it exists
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { message: _message, ...rest } = data;
          content = Object.keys(rest).length > 0 ? rest : data;
        }

        if (content === undefined) {
          content = null;
        }

        return {
          success: true,
          content,
          message,
          statusCode,
        };
      }),
    );
  }
}
