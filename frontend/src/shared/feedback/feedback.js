let dispatch = null;

export const registerFeedback = handler => {
  dispatch = handler;
  return () => { if (dispatch === handler) dispatch = null; };
};

const emit = (type, payload) => {
  if (!dispatch) {
    console.warn('Tripio feedback provider is not mounted.', type, payload);
    return type === 'toast' ? undefined : Promise.resolve(type === 'confirm' ? false : null);
  }
  return dispatch(type, payload);
};

const showToast = (variant, message, options = {}) => emit('toast', { variant, message, ...options });

export const toast = {
  success: (message, options) => showToast('success', message, options),
  error: (message, options) => showToast('error', message, options),
  warning: (message, options) => showToast('warning', message, options),
  info: (message, options) => showToast('info', message, options),
};

export const confirmDialog = options => emit('confirm', options);
export const promptDialog = options => emit('prompt', options);
