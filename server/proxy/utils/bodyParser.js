export const readRequestBody = (req, maxBytes = 10 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > maxBytes) {
        const err = new Error('Request body too large');
        err.code = 'PAYLOAD_TOO_LARGE';
        req.destroy(err);
        return reject(err);
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

export const parseJsonBody = async (req, maxBytes) => {
  const raw = await readRequestBody(req, maxBytes);
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    const err = new Error('Invalid JSON');
    err.code = 'INVALID_JSON';
    err.cause = error;
    throw err;
  }
};
