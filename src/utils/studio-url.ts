import { isLocal } from './config-getters';

export default function studioUrl(url: string): string {
	url = url.trim();
	// trim slashes
	url = url.replace(/^\/|\/$/g, '');

	const baseUrl = isLocal() ? 'http://localhost:3000' : 'https://studio.imagelance.com';

	return `${baseUrl}/${url}`;
}
