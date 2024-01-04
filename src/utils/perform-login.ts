import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import express from 'express';
import Listr, { ListrContext, ListrTaskWrapper } from 'listr';
import path from 'node:path';
import open from 'open';
import randomstring from 'randomstring';

import { Token } from '../types/login';
import accountsUrl from './accounts-url';
import { setConfig, setUser } from './config-getters';
import { performRequest } from './perform-request';
import { reportError } from './report-error';

export async function performLogin(flags: any): Promise<void> {
	const { debug, local } = flags;

	const oauthClientId = local ? '963b867a-f8a3-4abf-abc7-9b2cf27376eb' : '963bd29c-5162-4e81-b3c7-e6b22915d68e';
	const oauthClientSecret = local ? 'wCeDg2MlEkVURVpVPxxN1cq9R9qhBZcu2lXVK3eY' : 'EDBe481iZWGXk4hnOJUH9FcFqRu7yxzrjDYYj83x';
	const redirectUri = 'http://localhost:8050';
	const expressPort = 8050;

	const app = express();
	let token: Token | null = null;

	app.use('/img', express.static(path.join(__dirname, '../assets/img')));

	app.get('/', async (req, res) => {
		const { code } = req.query;

		if (!code) {
			return res.status(400).send('Unable to login');
		}

		try {
			const { data } = await performRequest({
				data: {
					client_id: oauthClientId,
					client_secret: oauthClientSecret,
					code,
					grant_type: 'authorization_code',
					redirect_uri: redirectUri,
				},
				method: 'POST',
				url: accountsUrl('/oauth/token', false),
			}, false);

			token = data;
		} catch (error: any) {
			return res.status(400).send(error.message);
		}

		return res.sendFile(path.join(__dirname, '../assets/success.html'));
	});

	const server = app.listen(expressPort);

	if (debug) {
		console.log(chalk.green(`Listening on port ${expressPort}`));
	}

	const state = randomstring.generate({ length: 40 });
	const challenge = {
		client_id: oauthClientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: '',
		state,
	};

	const endpoint = `/oauth/authorize?${(new URLSearchParams(challenge)).toString()}`;
	const url: string = accountsUrl(endpoint, false);

	await open(url);
	console.log(chalk.green(`Opening browser ${url}`));

	const runner = new Listr([
		{
			task: async (ctx: ListrContext, task: ListrTaskWrapper) => new Promise<void>((resolve) => {
				let checks = 0;

				const checkInterval: ReturnType<typeof setInterval> = setInterval(async () => {
					if (debug) {
						task.title = `Awaiting login in browser... (${checks + 1}x)`;
					}

					if (checks > 60) { // 2 minutes, check every 2 seconds
						clearInterval(checkInterval);
						throw new Error('Login timed out, please try again');
					}

					checks++;

					if (token) {
						setConfig('token', token);

						try {
							const { data: user } = await performRequest({
								method: 'GET',
								url: accountsUrl('/user'),
							});

							setUser(user);

							task.title = chalk.green(`User ${user.email} successfully logged in`);

							clearInterval(checkInterval);
							resolve();
						} catch (error: any) {
							Sentry.captureException(error);

							reportError(error);

							if (server) {
								server.close();
							}

							process.exit(1);
						}
					}
				}, 2000);
			}),
			title: 'Awaiting login in browser...',
		},
	]);

	try {
		await runner.run();
	} catch (error: any) {
		Sentry.captureException(error);

		if (debug) {
			reportError(error);
		}
	}

	if (server) {
		server.close();
	}
}
