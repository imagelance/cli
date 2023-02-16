import { environment } from './config-getters';

export default function apiUrl(url: string): string {
	url = url.trim();
	// trim slashes
	url = url.replace(/^\/|\/$/g, '');

	switch (environment()) {
		// sazka environments
		case 'sazka':
			return `https://sazka.imagelance.com/api/public/cli/${url}`;
		case 'sazukauat':
			return `https://sazukauat.imagelance.com/api/public/cli/${url}`;
		// dev environments
		case 'rainy':
			return `https://api.rainy.imagelance.com/api/public/cli/${url}`;
		case 'cloudy':
			return `https://api.cloudy.imagelance.com/api/public/cli/${url}`;
		case 'sunny':
			return `https://api.sunny.imagelance.com/api/public/cli/${url}`;
		case 'uat':
			return `https://api.uat.imagelance.com/api/public/cli/${url}`;
		case 'local':
			return `http://localhost:8070/api/public/cli/${url}`;
		// production environment
		case 'client':
		default:
			return `https://api.app.imagelance.com/api/public/cli/${url}`;
	}
}
