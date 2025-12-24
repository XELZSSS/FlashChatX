import axios from 'axios';

// Search parameters interface
export interface SearchParams {
  query: string;
  site?: string;
  filetype?: string;
  fetch_full?: boolean;
  timeout_ms?: number;
  limit?: number;
  page?: number;
}

// Search result interface
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

// Search response interface
export interface SearchResponse {
  results: SearchResult[];
  total_results?: number;
  search_time?: number;
  query: string;
}

const getBaseUrl = () =>
  (import.meta.env?.SEARCH_BASE_URL || 'https://uapis.cn').replace(/\/$/, '');
const getProxyBaseUrl = () =>
  (import.meta.env?.PROXY_BASE_URL || 'http://localhost:8787').replace(
    /\/$/,
    ''
  );

/**
 * Perform web search
 * @param params Search parameters
 * @returns Search results
 */
export const performSearch = async (
  params: SearchParams
): Promise<SearchResponse> => {
  if (!params.query || !params.query.trim()) {
    return { query: '', results: [] };
  }

  try {
    const baseUrl = getProxyBaseUrl();
    const endpoint = '/api/search/aggregate';

    const payload = {
      query: params.query,
      limit: params.limit ?? 5,
      page: params.page || 1,
      site: params.site || '',
      filetype: params.filetype || '',
      fetch_full: params.fetch_full || false,
      timeout_ms: params.timeout_ms || 5000,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await axios.post(
      `${baseUrl}${endpoint}`,
      {
        ...payload,
        baseUrl: getBaseUrl(),
      },
      {
        headers,
        timeout: params.timeout_ms || 10000,
      }
    );

    // Convert response format to match our interface
    const searchResponse: SearchResponse = {
      query: params.query,
      results: [],
      total_results: response.data.total_results || 0,
      search_time: response.data.search_time || 0,
    };

    // Process search results
    if (response.data.results && Array.isArray(response.data.results)) {
      searchResponse.results = response.data.results.map(
        (item: any, index: number) => ({
          title: item.title || '',
          url: item.url || '',
          snippet: item.snippet || item.description || '',
          position: index + 1,
        })
      );
    }

    return searchResponse;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message =
        (error.response?.data as any)?.message ||
        error.response?.statusText ||
        error.message;
      throw new Error(`Search failed: ${message}`);
    }
    throw new Error(
      `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Format search results into AI-friendly concise text
 * @param searchResponse Search response
 * @returns Formatted text
 */
export const formatSearchResults = (searchResponse: SearchResponse): string => {
  if (!searchResponse.results || searchResponse.results.length === 0) {
    return `No relevant information found about "${searchResponse.query}".`;
  }

  // Return only the top 5 most relevant results to provide concise information for AI
  const topResults = searchResponse.results.slice(0, 5);

  let formattedText = `Based on the search results for "${searchResponse.query}", here is the relevant information:\n\n`;

  topResults.forEach((result, index) => {
    formattedText += `${index + 1}. ${result.title}\n`;
    formattedText += `   ${result.snippet}\n`;
    // Do not include links to let AI focus on content
  });

  return formattedText;
};

/**
 * Perform search and return formatted results
 * @param params Search parameters
 * @returns Formatted search result text
 */
export const searchAndFormat = async (
  params: SearchParams
): Promise<string> => {
  try {
    const searchResponse = await performSearch(params);
    return formatSearchResults(searchResponse);
  } catch (error) {
    console.error('Search failed, returning empty results:', error);
    return '';
  }
};
