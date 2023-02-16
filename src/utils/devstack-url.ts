import { isLocal } from './config-getters';

export default function devstackUrl(url: string): string {
	url = url.trim();
	// trim slashes
	url = url.replace(/^\/|\/$/g, '');

	if (isLocal()) {
		return `http://localhost:3000/api/${url}`;
	}

	return `https://devstack.imagelance.com/api/${url}`;
}
