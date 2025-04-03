/**
 * Formats an environment variable key based on namespace and alias
 * This pattern is used across multiple helper files (postgres, redis, http, s3, sns)
 *
 * @param prefix - The prefix for the environment variable (e.g., 'DB', 'CACHE', 'HTTP')
 * @param namespace - Optional namespace for the environment variable
 * @param alias - Optional alias, defaults to 'default'
 * @returns Formatted environment variable key
 */
export function formatEnvKey(
  prefix: string,
  namespace?: string,
  alias = "default",
): string {
  // Remove prefix from alias if present and convert to lowercase
  const normalizedAlias = alias.toLowerCase();
  const prefixPattern = new RegExp(`${prefix.toLowerCase()}[-_]?`, "i");
  const cleanAlias = normalizedAlias.replace(prefixPattern, "");

  // Build the key parts array
  const keyParts = [prefix];

  if (namespace) {
    keyParts.push(namespace);
  }

  if (cleanAlias !== "default") {
    keyParts.push(cleanAlias);
  }

  // Join parts with underscore and convert to uppercase
  return keyParts.join("_").toUpperCase().replaceAll("-", "_");
}

/**
 * Ensures a URL ends with a trailing slash
 *
 * @param url - The URL to normalize
 * @returns URL with trailing slash
 */
export function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
