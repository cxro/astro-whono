<script lang="ts">
import { onMount } from 'svelte';
import {
  createAdminStatusFeedback,
  type StatusState
} from './content-action-feedback';
import {
  ADMIN_CONTENT_STATUS_EVENT,
  getAdminContentStatus,
  type AdminContentStatusEventDetail
} from './content-action-status-events';

let statusState = $state<StatusState>('idle');
let statusText = $state('');

const statusFeedback = createAdminStatusFeedback({
  getState: () => statusState,
  getText: () => statusText,
  setStatus: (state, text) => {
    statusState = state;
    statusText = text;
  }
});

const applyStatus = (detail: AdminContentStatusEventDetail | null | undefined) => {
  if (!detail || !detail.text) {
    statusFeedback.clearStatus();
    return;
  }

  statusFeedback.setStatus(
    detail.state,
    detail.text,
    detail.autoClear === undefined ? {} : { autoClear: detail.autoClear }
  );
};

const handleStatusEvent = (event: Event) => {
  applyStatus((event as CustomEvent<AdminContentStatusEventDetail>).detail);
};

onMount(() => {
  window.addEventListener(ADMIN_CONTENT_STATUS_EVENT, handleStatusEvent);
  applyStatus(getAdminContentStatus());
  return () => {
    window.removeEventListener(ADMIN_CONTENT_STATUS_EVENT, handleStatusEvent);
    statusFeedback.dispose();
  };
});
</script>

<p class="admin-status admin-content-action-status" data-state={statusState} role="status" aria-live="polite" aria-atomic="true">
  {statusText}
</p>
