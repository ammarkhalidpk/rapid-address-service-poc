/**
 * Search mode type for selecting data source
 */
export type SearchMode = 'paf' | 'location' | 'both';

/**
 * LocalStorage key for persisting search mode
 */
export const SEARCH_MODE_STORAGE_KEY = 'rapid-address-search-mode';

/**
 * Default search mode when no preference stored
 */
export const DEFAULT_SEARCH_MODE: SearchMode = 'both';
