import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'node:fs';
import simpleGit from 'simple-git';
import Listr from 'listr';
import * as Sentry from '@sentry/node';

import AuthenticatedCommand from '../authenticated-command';
import { getRoot, setConfig, getConfig, getCommand, getGitConfig } from '../utils/config-getters';
import devstackUrl from '../utils/devstack-url';
import studioUrl from '../utils/studio-url';

export class Create extends AuthenticatedCommand {
	static description = 'Creates new template'

	private isDebugging = false

	async run(): Promise<void> {
		const { flags } = await this.parse(Create);
		const { debug } = flags;

		this.isDebugging = debug;

		if (!this.user) {
			console.log(chalk.red('You are not logged in.'));
			return await this.exitHandler(1);
		}

		const root = getRoot();

		let brands;

		try {
			const response = await this.performRequest({
				url: devstackUrl('/gitea/orgs'),
				method: 'GET',
			});

			brands = response.data;

			if (this.isDebugging) {
				console.log(brands);
			}
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			return await this.exitHandler(1);
		}

		let brand: string | null = null;

		// only prompt brand select if user has more than 1 brands
		if (brands.length > 1) {
			const brandAnswer = await inquirer.prompt([{
				type: 'search-list',
				name: 'brand',
				message: 'Select brand',
				choices: brands.map(({ name, full_name }: any) => ({
					name: `${full_name} ${chalk.grey(`(${name})`)}`,
					value: name,
				})),
			}]);

			brand = brandAnswer.brand;
		} else {
			brand = brands[0].name;
		}

		if (!brand) {
			console.log(chalk.red('No brand selected'));
			return await this.exitHandler(1);
		}

		const modeAnswer = await inquirer.prompt({
			type: 'list',
			name: 'mode',
			message: 'Select mode',
			choices: [
				{ name: 'Create blank', value: 'blank' },
				{ name: 'Create from template', value: 'template' },
			],
		});

		const { mode } = modeAnswer;

		let outputCategory;
		let template;

		if (mode === 'blank') {
			const outputCategoryAnswer = await inquirer.prompt([{
				type: 'search-list',
				name: 'outputCategory',
				message: 'Select format',
				choices: [
					{ name: 'HTML', value: 'html' },
					{ name: 'Static', value: 'image' },
					{ name: 'Print', value: 'print' },
					{ name: 'Video', value: 'video' },
					{ name: 'Audio', value: 'audio' },
					{ name: 'Fallback', value: 'fallback' },
				],
			}]);

			outputCategory = outputCategoryAnswer.outputCategory;
		} else {
			let templates = [];

			try {
				const { data } = await this.performRequest({
					url: devstackUrl('/gitea/templates'),
					method: 'GET',
					headers: {
						'X-Brand': brand,
					},
				});

				templates = data.templates;
			} catch (error: any) {
				Sentry.captureException(error);

				if (this.isDebugging) {
					this.reportError(error);
				}

				await this.exitHandler(1);
			}

			const templateAnswer = await inquirer.prompt([{
				type: 'search-list',
				name: 'template',
				message: 'Select template',
				choices: templates.map(({ value, label }: any) => ({
					name: label,
					value,
				})),
			}]);

			template = templateAnswer.template;
		}

		const nameAnswer = await inquirer.prompt({
			type: 'input',
			name: 'name',
			message: `Template name ${chalk.yellow('[min 4 characters]')} ${chalk.grey('(public, can be changed later)')}`,
			validate: input => input && input.length > 3,
		});

		const { name } = nameAnswer;

		const descriptionAnswer = await inquirer.prompt({
			type: 'input',
			name: 'description',
			message: `Description ${chalk.grey('(optional)')}`,
		});

		const { description } = descriptionAnswer;

		const tagsAnswer = await inquirer.prompt({
			type: 'input',
			name: 'tags',
			message: `Tags ${chalk.grey('(separate with a comma, optional)')}`,
		});

		const tags = `${tagsAnswer.tags}`
			.split(',')
			.map((word: string) => word.trim())
			.filter((word: string) => word.length > 0);

		const payload: any = {
			mode,
			outputCategory,
			template,
			name,
			description,
			tags
		};

		console.log(chalk.blue(`Creating template in brand "${chalk.bold(brand)}"`));
		console.log(chalk.blue(JSON.stringify(payload, null, 2)));

		const confirm = await inquirer.prompt({
			type: 'confirm',
			name: 'confirm',
			message: 'Is everything correct?',
			default: true,
		});

		if (!confirm.confirm) {
			await this.exitHandler();
		}

		let repository: any = null;

		try {
			const runner = new Listr([{
				title: chalk.blue('Creating template...'),
				task: async (ctx, task) => {
					const { data } = await this.performRequest({
						url: devstackUrl('/gitea/repos'),
						method: 'POST',
						data: payload,
						headers: {
							'X-Brand': `${brand}`,
						},
					});

					repository = data.repo;

					task.title = chalk.green('Template created');
				},
			}]);

			await runner.run();
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			return await this.exitHandler(1);
		}

		let processedRepository: any = null;

		try {
			const runner = new Listr([{
				title: chalk.blue('Processing repository...'),
				task: async (ctx, task) => await new Promise<void>(resolve => {
					let checks = 0;

					const checkInterval: ReturnType<typeof setInterval> = setInterval(async () => {
						if (this.isDebugging) {
							task.title = chalk.blue(`Processing repository... (${checks + 1}x)`);
						}

						if (checks > 60) { // 2 minutes, check every 2 seconds
							clearInterval(checkInterval);
							resolve();
						}

						checks++;

						const repo = await this.fetchRepo(repository, brand);

						if (repo.is_processed) {
							processedRepository = repo;
						}

						if (processedRepository) {
							task.title = chalk.green(`Repository "${processedRepository.full_name}" processed and synced`);

							clearInterval(checkInterval);
							resolve();
						}
					}, 2000);
				}),
			}]);

			await runner.run();
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			return await this.exitHandler(1);
		}

		if (!processedRepository) {
			console.log(chalk.yellow('Processing repository is taking longer than usual'));
			console.log(chalk.yellow('You will have to manually sync the template after it has been processed'));
			console.log(chalk.yellow(`Please visit ${studioUrl('/visuals')}, select template and download it using the "${getCommand('sync')}" command`));
			return await this.exitHandler();
		}

		try {
			await fs.promises.mkdir(`${root}/src`);
		} catch {
			// do nothing
		}

		const origin = processedRepository.clone_url;

		try {
			await fs.promises.mkdir(`${root}/src/${brand}`);
		} catch {
			// do nothing
		}

		const repoPath = `${root}/src/${processedRepository.full_name}`;
		const git = simpleGit(getGitConfig());

		try {
			await fs.promises.mkdir(repoPath);
			await git.clone(origin, repoPath, {});

			console.log(chalk.green(`Repository cloned into "${repoPath}"`));
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			return this.exitHandler(1);
		}

		await git.cwd(repoPath);

		/**
		 * Set user.name + user.email for repo
		 */
		const userName = getConfig('name');

		if (userName) {
			await git.addConfig('user.name', userName);
		}

		const userEmail = getConfig('email');

		if (userEmail) {
			await git.addConfig('user.email', userEmail);
		}

		setConfig('newestVisual', processedRepository.full_name);

		console.log(chalk.green(`Development can be started with command "${getCommand('dev --newest')}"`));
	}

	async fetchRepo(repository: any, brand: string | null): Promise<any> {
		if (!brand) {
			throw new Error('Cannot fetch repo without brand');
		}

		try {
			const { data } = await this.performRequest({
				url: devstackUrl(`/gitea/repos/${repository.name}`),
				method: 'GET',
				headers: {
					'X-Brand': brand,
				},
			});

			return data.repo;
		} catch (error: any) {
			if (this.isDebugging) {
				this.reportError(error);
			}

			return null;
		}
	}
}
