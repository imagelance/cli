import { isLocal } from './config-getters';

export default function accountsUrl(url: string, isApiRoute = true): string {
	url = url.trim();
	// trim slashes
	url = url.replace(/^\/|\/$/g, '');

	const baseUrl = isLocal() ? 'http://localhost' : 'https://accounts.imagelance.com';

	return `${baseUrl}${isApiRoute ? '/api/' : '/'}${url}`;
}
