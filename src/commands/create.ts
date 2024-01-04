import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Listr from 'listr';
import fs from 'node:fs';
import simpleGit from 'simple-git';

import AuthenticatedCommand from '../authenticated-command';
import { getCommand, getConfig, getGitConfig, getRoot, setConfig } from '../utils/config-getters';
import devstackUrl from '../utils/devstack-url';
import studioUrl from '../utils/studio-url';

export class Create extends AuthenticatedCommand {
	static description = 'Creates new template';

	private isDebugging = false;

	async fetchRepo(repository: any, brand: null | string): Promise<any> {
		if (!brand) {
			throw new Error('Cannot fetch repo without brand');
		}

		try {
			const { data } = await this.performRequest({
				headers: {
					'X-Brand': brand,
				},
				method: 'GET',
				url: devstackUrl(`/gitea/repos/${repository.name}`),
			});

			return data.repo;
		} catch (error: any) {
			if (this.isDebugging) {
				this.reportError(error);
			}

			return null;
		}
	}

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
				method: 'GET',
				url: devstackUrl('/gitea/orgs'),
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

		let brand: null | string = null;

		// only prompt brand select if user has more than 1 brands
		if (brands.length > 1) {
			const brandAnswer = await inquirer.prompt([{
				choices: brands.map(({ full_name, name }: any) => ({
					name: `${full_name} ${chalk.grey(`(${name})`)}`,
					value: name,
				})),
				message: 'Select brand',
				name: 'brand',
				type: 'search-list',
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
			choices: [
				{ name: 'Create blank', value: 'blank' },
				{ name: 'Create from template', value: 'template' },
			],
			message: 'Select mode',
			name: 'mode',
			type: 'list',
		});

		const { mode } = modeAnswer;

		let outputCategory;
		let template;

		if (mode === 'blank') {
			const outputCategoryAnswer = await inquirer.prompt([{
				choices: [
					{ name: 'HTML', value: 'html' },
					{ name: 'Static', value: 'image' },
					{ name: 'Print', value: 'print' },
					{ name: 'Video', value: 'video' },
					{ name: 'Audio', value: 'audio' },
					{ name: 'Fallback', value: 'fallback' },
				],
				message: 'Select format',
				name: 'outputCategory',
				type: 'search-list',
			}]);

			outputCategory = outputCategoryAnswer.outputCategory;
		} else {
			let templates = [];

			try {
				const { data } = await this.performRequest({
					headers: {
						'X-Brand': brand,
					},
					method: 'GET',
					url: devstackUrl('/gitea/templates'),
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
				choices: templates.map(({ label, value }: any) => ({
					name: label,
					value,
				})),
				message: 'Select template',
				name: 'template',
				type: 'search-list',
			}]);

			template = templateAnswer.template;
		}

		const nameAnswer = await inquirer.prompt({
			message: `Template name ${chalk.yellow('[min 4 characters]')} ${chalk.grey('(public, can be changed later)')}`,
			name: 'name',
			type: 'input',
			validate: (input) => input && input.length > 3,
		});

		const { name } = nameAnswer;

		const descriptionAnswer = await inquirer.prompt({
			message: `Description ${chalk.grey('(optional)')}`,
			name: 'description',
			type: 'input',
		});

		const { description } = descriptionAnswer;

		const tagsAnswer = await inquirer.prompt({
			message: `Tags ${chalk.grey('(separate with a comma, optional)')}`,
			name: 'tags',
			type: 'input',
		});

		const tags = `${tagsAnswer.tags}`
			.split(',')
			.map((word: string) => word.trim())
			.filter((word: string) => word.length > 0);

		const payload: any = {
			description,
			mode,
			name,
			outputCategory,
			tags,
			template,
		};

		console.log(chalk.blue(`Creating template in brand "${chalk.bold(brand)}"`));
		console.log(chalk.blue(JSON.stringify(payload, null, 2)));

		const confirm = await inquirer.prompt({
			default: true,
			message: 'Is everything correct?',
			name: 'confirm',
			type: 'confirm',
		});

		if (!confirm.confirm) {
			await this.exitHandler();
		}

		let repository: any = null;

		try {
			const runner = new Listr([{
				task: async (ctx, task) => {
					const { data } = await this.performRequest({
						data: payload,
						headers: {
							'X-Brand': `${brand}`,
						},
						method: 'POST',
						url: devstackUrl('/gitea/repos'),
					});

					repository = data.repo;

					task.title = chalk.green(`Template "${repository.full_name}" created and synced`);
				},
				title: chalk.blue('Creating template...'),
			}]);

			await runner.run();
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			return await this.exitHandler(1);
		}

		if (!repository) {
			console.log(chalk.red('Something went wrong while trying to create template'));
			return await this.exitHandler(1);
		}

		try {
			await fs.promises.mkdir(`${root}/src`);
		} catch {
			// do nothing
		}

		const origin = repository.clone_url;

		try {
			await fs.promises.mkdir(`${root}/src/${brand}`);
		} catch {
			// do nothing
		}

		const repoPath = `${root}/src/${repository.full_name}`;
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

		setConfig('newestVisual', repository.full_name);

		console.log(chalk.green(`Development can be started with command "${getCommand('dev --newest')}"`));
	}
}
