import { CustomError } from './custom-error';

export class ValidationError extends CustomError {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
