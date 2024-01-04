import { User } from '../types/authenticated-command';
import { Token } from '../types/login';
import config from './config';

const isLocal = function (): boolean {
	const args = process.argv.slice(2);

	return args && args.join(' ').includes('--local');
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

const getAccessToken = function (): null | string {
	const token: Token | null = getConfig('token');

	if (!token) {
		return null;
	}

	return `${token.token_type} ${token.access_token}`;
};

const setConfig = function (key: string, value: any): void {
	return config.set(key, value);
};

const setIsInstalled = function (value = true): void {
	config.set('isInstalled', value);
};

const isInstalled = function (): boolean {
	return Boolean(config.get('isInstalled'));
};

const getCommand = function (command: string): string {
	return `lance ${command}`;
};

const hasSynced = function (): boolean {
	return Boolean(config.get('lastSync'));
};

const getGitConfig = function (mergedConfig: { [key: string]: any } = {}): { [key: string]: any } {
	return {
		...mergedConfig,
		config: [
			'core.eol=lf',
			'core.autocrlf=false',
		],
	};
};

const getGitOrigin = function (organization: string, repo: string): string {
	const gitUsername = getUsername();
	const gitPassword = getPassword();
	const gitDomain = 'git.imagelance.com';

	return `https://${gitUsername}:${gitPassword}@${gitDomain}/${organization}/${repo}.git`;
};

const setUser = (user: User): void => {
	setConfig('username', user.git_username);
	setConfig('password', user.git_password);
	setConfig('email', user.email);
	setConfig('user_id', user.id);
	setConfig('name', user.name);
};

export {
	getAccessToken,
	getCommand,
	getConfig,
	getGitConfig,
	getGitOrigin,
	getLastDev,
	getPassword,
	getRoot,
	getUsername,
	hasSynced,
	isInstalled,
	isLocal,
	setConfig,
	setIsInstalled,
	setUser,
};
