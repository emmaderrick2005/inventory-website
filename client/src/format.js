/** All money in this system is Ugandan shillings (UGX). */
export const formatUGX = (value) => `UGX ${Number(value || 0).toLocaleString('en-US')}`;

export const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatDay = (value) =>
  new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });

export const JOB_STATUS = {
  received: 'Received',
  'in-service': 'In service',
  completed: 'Completed',
  released: 'Released',
};

export const toInputDate = (value) => new Date(value).toISOString().slice(0, 10);
