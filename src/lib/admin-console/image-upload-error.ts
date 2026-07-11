export class AdminImageUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AdminImageUploadError';
    this.status = status;
  }
}
