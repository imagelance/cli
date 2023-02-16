import config from './config';
import { Token } from '../types/login';
import { User } from '../types/authenticated-command';

const isSazka = function (): boolean {
	const args = process.argv.slice(2);

	return args && args.join(' ').includes('--sazka');
};

const isLocal = function (): boolean {
	const args = process.argv.slice(2);

	return args && args.join(' ').includes('--local');
};

const isDebug = function (): boolean {
	const args = process.argv.slice(2);

	return args && args.join(' ').includes('--debug');
};

const getRoot = function (): string {
	return isSazka() ? config.get('rootSazka') : config.get('root');
};

const getLastDev = function (): string {
	return isSazka() ? config.get('lastDevSazka') : config.get('lastDev');
};

const getUsername = function (): string {
	return isSazka() ? config.get('usernameSazka') : config.get('username');
};

const getPassword = function (): string {
	return isSazka() ? config.get('passwordSazka') : config.get('password');
};

const getConfig = function (name: string): any {
	return isSazka() ? config.get(`${name}Sazka`) : config.get(name);
};

const getAccessToken = function (): string | null {
	const token: Token | null = getConfig('token');

	if (!token) {
		return null;
	}

	return `${token.token_type} ${token.access_token}`;
};

const setConfig = function (key: string, value: any): void {
	return isSazka() ? config.set(`${key}Sazka`, value) : config.set(key, value);
};

const setIsInstalled = function (value: boolean = true): void {
	config.set('isInstalled', value);
}

const isInstalled = function (): boolean {
	return !!config.get('isInstalled');
}

const getCommand = function (command: string): string {
	return isSazka() ? `lance ${command} --sazka` : `lance ${command}`;
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
	isSazka,
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
	hasSynced
};
