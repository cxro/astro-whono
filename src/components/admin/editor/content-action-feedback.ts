import type { StatusState } from './editor-shell-helpers';

export type { StatusState };

export type AdminStatusFeedbackOptions = {
  autoClear?: boolean;
};

type AdminStatusFeedbackAccessors = {
  getState: () => StatusState;
  getText: () => string;
  setStatus: (state: StatusState, text: string) => void;
};

const STATUS_FEEDBACK_VISIBLE_MS = 2_000;

export const createAdminStatusFeedback = ({
  getState,
  getText,
  setStatus
}: AdminStatusFeedbackAccessors) => {
  let clearTimerId: number | null = null;

  const clearTimer = () => {
    if (clearTimerId === null) return;
    window.clearTimeout(clearTimerId);
    clearTimerId = null;
  };

  const clearStatus = () => {
    clearTimer();
    setStatus('idle', '');
  };

  const setFeedbackStatus = (
    state: StatusState,
    text: string,
    { autoClear = false }: AdminStatusFeedbackOptions = {}
  ) => {
    clearTimer();
    setStatus(state, text);

    if (!autoClear || !text) return;
    clearTimerId = window.setTimeout(() => {
      clearTimerId = null;
      if (getState() === state && getText() === text) {
        clearStatus();
      }
    }, STATUS_FEEDBACK_VISIBLE_MS);
  };

  return {
    clearStatus,
    dispose: clearTimer,
    setStatus: setFeedbackStatus
  };
};
