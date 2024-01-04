import { isLocal } from './config-getters';

export default function studioUrl(url = ''): string {
	const baseUrl = isLocal() ? 'http://localhost:3010' : 'https://studio.imagelance.com';

	if (!url) {
		return baseUrl;
	}

	url = url.trim();
	// trim slashes
	url = url.replaceAll(/^\/|\/$/g, '');

	return `${baseUrl}/${url}`;
}
