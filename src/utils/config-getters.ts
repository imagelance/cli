import config from './config';
import { Token } from '../types/login';
import { User } from '../types/authenticated-command';

const isLocal = function (): boolean {
	const args = process.argv.slice(2);

	return args && args.join(' ').includes('--local');
};

const environment = function (): string {
	const args = process.argv.slice(2);

	if (isLocal()) {
		return 'local';
	}

	if (!args || !args.join(' ').includes('--env=')) { // No env argument
		return 'client';
	}

	for (const key in args) {
		if (args[key].indexOf('--env=') !== 0) {
			continue;
		}

		return args[key].replace('--env=', ''); // --env=sunny/uat/...
	}

	return 'client'; // default
};

const getRoot = function (): string {
	return config.get('root');
};

const getLastDev = function (): string {
	return config.get('lastDev');
};

const getUsername = function (): string {
	return config.get('username');
};

const getPassword = function (): string {
	return config.get('password');
};

const getConfig = function (name: string): any {
	return config.get(name);
};

const getAccessToken = function (): string | null {
	const token: Token | null = getConfig('token');

	if (!token) {
		return null;
	}

	return `${token.token_type} ${token.access_token}`;
};

const setConfig = function (key: string, value: any): void {
	return config.set(key, value);
};

const setIsInstalled = function (value: boolean = true): void {
	config.set('isInstalled', value);
}

const isInstalled = function (): boolean {
	return !!config.get('isInstalled');
}

const getCommand = function (command: string): string {
	return `lance ${command}`;
};

const hasSynced = function (): boolean {
	return !!config.get('lastSync');
}

const setUser = (user: User): void => {
	setConfig('username', user.git_username);
	setConfig('password', user.git_password);
	setConfig('email', user.email);
	setConfig('user_id', user.id);
	setConfig('name', user.name);
};

export {
	isLocal,
	getRoot,
	getLastDev,
	getUsername,
	getPassword,
	setConfig,
	getConfig,
	getAccessToken,
	getCommand,
	setUser,
	setIsInstalled,
	isInstalled,
	hasSynced,
	environment,
};
