import { parseJsonBody } from '../utils/bodyParser.js';
import { sendJson } from '../utils/response.js';

export const handleSaveEnv = async (req, res, ctx) => {
  try {
    const payload = await parseJsonBody(req);
    const { provider, apiKey, model, apiUrl } = payload;

    if (!provider) {
      return sendJson(res, 400, {
        error: 'provider required',
        details: 'Provider is a required field',
      });
    }

    const validProviders = Object.keys(ctx.API_PROVIDERS);
    if (!validProviders.includes(provider)) {
      return sendJson(res, 400, {
        error: 'invalid provider',
        details: `Provider must be one of: ${validProviders.join(', ')}`,
      });
    }

    try {
      const providerConfig = ctx.API_PROVIDERS[provider];
      const updates = [{ key: providerConfig.keyEnvVar, value: apiKey || '' }];
      ctx.apiKeys[provider] = apiKey;

      if (model) {
        updates.push({ key: providerConfig.modelEnvVar, value: model });
      }

      if (apiUrl && providerConfig.urlEnvVar) {
        updates.push({ key: providerConfig.urlEnvVar, value: apiUrl });
      }

      const updatedKeys = ctx.persistEnvUpdates(updates);

      console.log(
        `[proxy] Successfully updated environment variables: ${updatedKeys.join(', ')}`
      );

      return sendJson(res, 200, {
        ok: true,
        message: 'Configuration saved successfully',
        updatedKeys,
      });
    } catch (writeError) {
      console.error('[proxy] Failed to write to .env.local:', writeError);
      return sendJson(res, 500, {
        error: 'write failed',
        details: 'Failed to write configuration to file',
      });
    }
  } catch (parseError) {
    console.error('[proxy] Failed to parse request body:', parseError);
    return sendJson(res, 400, {
      error: 'invalid json',
      details: 'Request body contains invalid JSON',
    });
  }
};

export const handleSaveMemuEnv = async (req, res, ctx) => {
  try {
    const payload = await parseJsonBody(req);
    const { baseUrl, apiKey, enabled, autoSave, maxMemories } = payload;

    try {
      const updates = [
        { key: 'MEMU_BASE_URL', value: baseUrl || '' },
        { key: 'MEMU_API_KEY', value: apiKey || '' },
        { key: 'MEMU_ENABLED', value: enabled ? 'true' : 'false' },
        { key: 'MEMU_AUTO_SAVE', value: autoSave ? 'true' : 'false' },
        { key: 'MEMU_MAX_MEMORIES', value: String(maxMemories || 10) },
      ];

      const updatedKeys = ctx.persistEnvUpdates(updates);

      console.log(
        `[proxy] Successfully updated MemU environment variables: ${updatedKeys.join(', ')}`
      );

      return sendJson(res, 200, {
        ok: true,
        message: 'MemU configuration saved successfully',
        updatedKeys,
      });
    } catch (writeError) {
      console.error(
        '[proxy] Failed to write MemU config to .env.local:',
        writeError
      );
      return sendJson(res, 500, {
        error: 'write failed',
        details: 'Failed to write MemU configuration to file',
      });
    }
  } catch (parseError) {
    console.error(
      '[proxy] Failed to parse MemU config request body:',
      parseError
    );
    return sendJson(res, 400, {
      error: 'invalid json',
      details: 'Request body contains invalid JSON',
    });
  }
};
