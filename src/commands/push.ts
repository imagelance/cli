import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Listr, { ListrContext, ListrTask, ListrTaskWrapper } from 'listr';
import fs from 'node:fs';
import path from 'node:path';
import simpleGit from 'simple-git';

import AuthenticatedCommand from '../authenticated-command';
import { getGitConfig, getGitOrigin, getRoot } from '../utils/config-getters';
import getDirectories from '../utils/get-directories';

interface PushConfig {
	brand: string;
	commitMessage: string;
	repoName: string;
	visualPath: string;
}

export class Push extends AuthenticatedCommand {
	static description = 'Push all local templates';

	async push(config: PushConfig, task: ListrTaskWrapper, debug: boolean): Promise<void> {
		const { brand, commitMessage, repoName, visualPath } = config;
		const git = simpleGit(getGitConfig());

		if (!fs.existsSync(path.join(visualPath, '.git'))) {
			return;
		}

		await git.cwd(visualPath);

		await git.removeRemote('origin');

		const origin = getGitOrigin(brand, repoName);

		if (debug) {
			console.log(`Started push to ${origin}`);
		}

		await git.addRemote('origin', origin);

		const status = await git.status();

		if (!status.current) {
			console.log(chalk.red(`Cannot read current branch from ${repoName}`));
			return;
		}

		await git.add('./*');
		await git.commit(commitMessage);
		// always push currently checked out branch
		await git.push('origin', status.current);

		task.title = chalk.green(`Pushed "${repoName}"`);
	}

	async run(): Promise<void> {
		const { flags } = await this.parse(Push);
		const { debug } = flags;

		const root: string = getRoot();
		const git = simpleGit(getGitConfig());
		const brandFolders: string[] = await getDirectories(root);
		const tasks: ListrTask[] = [];
		const changedVisuals: any[] = [];
		const brands: string[] = brandFolders.filter((folder: string) => folder[0] !== '.');

		for (const brandIndex in brands) {
			if (!brands[brandIndex]) {
				continue;
			}

			const brand: string = brands[brandIndex];
			const visualFolders: string[] = await getDirectories(path.join(root, brand));
			const visuals: string[] = visualFolders.filter((folder: string) => folder[0] !== '.');

			for (const visualIndex in visuals) {
				if (!visuals[visualIndex]) {
					continue;
				}

				const visual: string = visuals[visualIndex];
				const visualPath: string = path.join(root, brand, visual);

				try {
					await git.cwd(visualPath);

					const status = await git.status();

					if (debug) {
						console.log(status);
					}

					const hasChangedFilesOrCommits = status.files.length > 0 || status.ahead > 0;

					if (!hasChangedFilesOrCommits) {
						continue;
					}

					changedVisuals.push({
						checked: true,
						name: `${visual} (Changed ${status.files.length} files, Local commits ${status.ahead})`,
						value: visualPath,
					});
				} catch (error: any) {
					Sentry.captureException(error);

					if (debug) {
						this.reportError(error);
					}
				}
			}
		}

		if (changedVisuals.length === 0) {
			console.log(chalk.red('No changes in any repository'));
			this.exitHandler(1);
		}

		const visualChoices = {
			choices: changedVisuals,
			message: 'Select templates to be pushed',
			name: 'selectedVisuals',
			type: 'checkbox',
		};

		const visualAnswers = await inquirer.prompt([visualChoices]);
		const { selectedVisuals } = visualAnswers;

		for (const visualPath of selectedVisuals) {
			const splitVisualPath = visualPath.split('/');
			const repoName = splitVisualPath.at(-1);
			const brand = splitVisualPath.at(-2);

			const commitMessageAnswer = await inquirer.prompt({
				default: 'Changes',
				message: `Commit message ${chalk.cyan(repoName)}`,
				name: 'commitMessage',
				type: 'input',
			});

			const { commitMessage } = commitMessageAnswer;

			const config: PushConfig = {
				brand,
				commitMessage,
				repoName,
				visualPath,
			};

			tasks.push({
				task: (ctx: ListrContext, task: ListrTaskWrapper) => this.push(config, task, debug),
				title: chalk.blue(`Pushing "${repoName}"...`),
			});
		}

		if (tasks.length === 0) {
			console.log(chalk.red('No templates selected'));
			this.exitHandler(1);
		}

		const runner = new Listr(tasks, {
			concurrent: true,
			exitOnError: false,
			renderer: debug ? 'verbose' : 'default',
		});

		try {
			await runner.run();
		} catch (error) {
			Sentry.captureException(error);

			if (debug) {
				this.reportError(error);
			}
		}
	}
}
