import { CustomError } from './custom-error';

export class ValidationError extends CustomError {
  constructor(message) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
