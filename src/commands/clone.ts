import { Args } from '@oclif/core';
import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import * as fs from 'node:fs';
import simpleGit from 'simple-git';

import AuthenticatedCommand from '../authenticated-command';
import { getGitConfig, getPassword, getRoot, getUsername } from '../utils/config-getters';

export class Clone extends AuthenticatedCommand {
	static args = {
		repoName: Args.string({
			required: true,
		}),
	};

	static description = 'Clone existing template';

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Clone);
		const { repoName } = args;
		const { debug } = flags;

		if (!repoName.includes('/')) {
			console.error(chalk.red('Invalid repo name'));
			return;
		}

		const root = getRoot();
		const username = getUsername();
		const password = getPassword();

		const remote = `https://${username}:${password}@git.imagelance.com/${repoName}.git`;

		try {
			await fs.promises.mkdir(root);
		} catch {
			// do nothing
		}

		try {
			const stats = await fs.promises.lstat(`${root}/${repoName}`);
			const exists = /* (stats.isDirectory() && ) || */stats.isFile();

			if (exists) {
				console.error(chalk.red('Repository already cloned'));
				return;
			}
		} catch {
			// do nothing
		}

		const brandFolder = repoName.split('/')[0];

		try {
			await fs.promises.mkdir(`${root}/${brandFolder}`);
			await fs.promises.mkdir(`${root}/${repoName}`);
		} catch {
			// do nothing
		}

		try {
			console.log(chalk.blue('Starting cloning...'));

			const git = simpleGit(getGitConfig());

			await git.clone(remote, `${root}/${repoName}`, { '--depth': '1' });

			console.log(chalk.green('Repository successfully cloned'));
		} catch (error: any) {
			Sentry.captureException(error);

			if (debug) {
				this.reportError(error);
			}
		}
	}
}
