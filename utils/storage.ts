export const getJSON = <T>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(
      `Failed to parse localStorage key "${key}", using fallback.`,
      error
    );
    return fallback;
  }
};

export const setJSON = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};
