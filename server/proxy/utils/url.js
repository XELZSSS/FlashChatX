export const normalizePath = (url = '') => {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url;
  }
};
