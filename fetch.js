import { ofetch } from "ofetch";

/**
 * @template T
 * @param {string} url
 * @param {{auth?: {username: string, password: string}, headers?: Record<string, any>, query?: Record<string, any>}?} options
 * @returns {Promise<T>}
 */
export async function get(url, options) {
  return await ofetch(url, {
    method: "GET",
    credentials: "include",
    query: options?.query,
    headers: {
      ...options?.headers,
      ...(options?.auth ?
        {
          Authorization: "Basic " + Buffer.from(options.auth.username + ":" + options.auth.password).toString("base64"),
        }
      : {}),
    },
  });
}