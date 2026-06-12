import type { AdminStatusFeedbackOptions, StatusState } from './content-action-feedback';

export const ADMIN_CONTENT_STATUS_EVENT = 'admin-content:status';

export type AdminContentStatusEventDetail = AdminStatusFeedbackOptions & {
  state: StatusState;
  text: string;
};

let currentAdminContentStatus: AdminContentStatusEventDetail = {
  state: 'idle',
  text: ''
};

export const getAdminContentStatus = (): AdminContentStatusEventDetail =>
  currentAdminContentStatus;

export const dispatchAdminContentStatus = (
  state: StatusState,
  text: string,
  options: AdminStatusFeedbackOptions = {}
) => {
  currentAdminContentStatus = {
    state,
    text,
    ...options
  };

  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent<AdminContentStatusEventDetail>(ADMIN_CONTENT_STATUS_EVENT, {
    detail: currentAdminContentStatus
  }));
};
