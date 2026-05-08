import { createAdminWriteQueue } from './admin-api';

export const withAdminContentWriteLock = createAdminWriteQueue();
