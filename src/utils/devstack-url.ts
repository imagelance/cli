import { isLocal } from './config-getters';

export default function devstackUrl(url: string): string {
	url = url.trim();
	// trim slashes
	url = url.replaceAll(/^\/|\/$/g, '');

	if (isLocal()) {
		return `http://127.0.0.1:8060/api/${url}`;
	}

	return `https://devstack.imagelance.com/api/${url}`;
}
