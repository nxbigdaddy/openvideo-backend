export class NonRetryableError extends Error {
  nonRetryable = true;
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'NonRetryableError';
    this.code = code;
  }
}

