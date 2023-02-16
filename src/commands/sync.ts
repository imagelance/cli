import chalk from 'chalk';
import axios from 'axios';
import path from 'node:path';
import fs from 'node:fs';
import simpleGit from 'simple-git';
import inquirer from 'inquirer';
import rimraf from 'rimraf';
import * as Sentry from '@sentry/node';
import { Flags } from '@oclif/core';

import AuthenticatedCommand from '../authenticated-command';
import apiUrl from '../utils/api-url';
import getDirectories from '../utils/get-directories';
import { getRoot, getUsername, getPassword, getConfig, setConfig } from '../utils/config-getters';

export class Sync extends AuthenticatedCommand {
	static description = 'Download all synced templates'

	static flags = {
		debug: Flags.boolean({ char: 'd', description: 'Debug mode', required: false, default: false }),
		shallow: Flags.boolean({ char: 's', description: 'Perform shallow fetch', required: false, default: false }),
	}

	async run(): Promise<void> {
		const { flags } = await this.parse(Sync);
		const { debug, shallow } = flags;

		const root: string = getRoot();

		try {
			await fs.promises.mkdir(path.join(root, 'src'));
		} catch {}

		const username = getUsername();
		const password = getPassword();

		let response;

		try {
			console.log(chalk.green('Downloading template list available for sync..'));

			response = await axios.get(apiUrl('visual'), {
				auth: { username, password },
			});
			setConfig('lastSyncResponseData', response.data);
		} catch (error: any) {
			Sentry.captureException(error);
			console.log(error);
			console.error(chalk.red(error.message));
			return;
		}

		/**
		 * Update user
		 */
		setConfig('username', response.data.user.git_username);
		setConfig('password', response.data.user.git_password);
		setConfig('email', response.data.user.email);
		setConfig('user_id', response.data.user.id);
		setConfig('name', response.data.user.name);

		const userEmail = getConfig('email');
		const userName = getConfig('name');

		/**
		 * Select brands
		 */
		let selectedBrands;
		//	const isAllBrands = argv.all;
		const isAllBrands = true; // always sync all brands

		if (isAllBrands) {
			selectedBrands = Object.keys(response.data.brands);
		} else {
			const brandAnswers = await inquirer.prompt({
				type: 'checkbox',
				name: 'brands',
				message: 'Select brands to sync',
				choices: Object.keys(response.data.brands).map(name => {
					return {
						name,
						checked: true,
					};
				}),
			});
			selectedBrands = brandAnswers.brands;
		}

		// @ts-ignore
		const progress = ({ method, stage, progress }) => {
			if (debug) {
				console.log(`git.${method} ${stage} stage ${progress}% complete`);
			}
		};

		const git = simpleGit({ progress });

		fs.writeFileSync(`${root}/.gitignore`, '*.url');

		try {
			await fs.promises.mkdir(`${root}/src`);
		} catch {}

		let totalSyncedCount = 0;
		let totalCount = 0;

		for (const brand in response.data.brands) {
			if (!response.data.brands.hasOwnProperty(brand)) {
				continue;
			}

			if (!selectedBrands.includes(brand)) {
				continue;
			}

			const brandPath = `${root}/src/${brand}`;

			try {
				const stats = fs.lstatSync(brandPath);

				if (!stats.isDirectory()) {
					throw new Error('Not directory');
				}
			} catch {
				fs.mkdirSync(brandPath);
				console.log(`Creating directory ${brandPath}`);
			}

			const visuals = response.data.brands[brand];
			const reversedVisualKeys = Object.keys(visuals).reverse();

			// Delete archived
			const visualFolders = await getDirectories(brandPath);

			let shouldSyncCount = 0;
			for (const slug in visuals) {
				totalCount++;
				if (visuals[slug].visual_sync_for_logged_user !== null) {
					shouldSyncCount++;
					totalSyncedCount++;
				}
			}

			console.log(chalk.cyan(`Syncing brand: ${brand} (${shouldSyncCount} of ${Object.keys(visuals).length})`));

			for (const i in visualFolders) {
				if (!visualFolders.hasOwnProperty(i)) {
					continue;
				}

				const visualFolder = visualFolders[i];
				if (!reversedVisualKeys.includes(visualFolder)) {
					// console.log(`Should delete ${brand}/${visualFolder}`);
					// const files = await fs.promises.readdir(path.join(brandPath, visualFolder), { withFileTypes: true });
					// const hasNoFiles = files.length === 0;
					// const hasOnlyGit = files.length === 1 && files[0].name === '.git';
					// const hasGitAndConfig = files.length === 2 && files[0].name === '.git' && files[1].name === 'config.json';
					// if (hasNoFiles || hasOnlyGit || hasGitAndConfig) {
					if (debug) {
						console.log(`DELETING ${visualFolder}`);
					}

					rimraf.sync(path.join(brandPath, visualFolder));
					// }
				}
			}

			// Clone/fetch new
			for (const i in reversedVisualKeys) {
				const visual = reversedVisualKeys[i];
				if (!visuals.hasOwnProperty(visual)) {
					continue;
				}

				if (debug) {
					console.log(chalk.cyan(`Syncing template: ${visual}`));
				}

				const visualData = visuals[visual];

				const repoPath = `${root}/src/${brand}/${visual}`;

				// Until feature is deployed to prod, assume old behaviour
				if (typeof visualData.visual_sync_for_logged_user === 'undefined') {
					visualData.visual_sync_for_logged_user = { id: 0 };
					console.log('assume true');
				}

				if (visualData.visual_sync_for_logged_user) {
					// console.log(visualData.visual_sync_for_logged_user);
				} else {
					// console.log(`Template is not set to be synced ${repoPath}`);

					try {
						const stats = fs.lstatSync(repoPath);
						if (!stats.isDirectory()) {
							throw new Error('Not directory');
						}

						await git.cwd(repoPath);
						try {
							const status = await git.status();

							if (status.files.length > 0) {
								console.log(`Template "${visual}" should get de-synced, but there are uncommitted changes, skipping...`);
								continue;
							}

							if (debug) {
								console.log('Deleting');
							}

							rimraf.sync(repoPath);
						} catch (error) {
							console.log(error);
						}
					} catch {
						// Does not exist, that is OK
					}

					continue;
				}

				try {
					const stats = fs.lstatSync(repoPath);

					if (!stats.isDirectory()) {
						throw new Error('Not directory');
					}
				} catch {
					fs.mkdirSync(repoPath);
					if (debug) {
						console.log(`Creating repo directory ${repoPath}`);
					}
				}

				const files = fs.readdirSync(repoPath);

				if (files.length > 0) {
					if (debug) {
						console.log(chalk.green('Git is initialized'));
					}

					try {
						await git.cwd(repoPath);
						// await git.init();
						// await git.addRemote('origin', visualData.origin);
						if (debug) {
							console.log(chalk.green('Repository has been successfully initialized'));
						}
					} catch (error) {
						console.error(error);
						Sentry.captureException(error);
					}
				} else if (!fs.existsSync(path.join(repoPath, '.git'))) {
					if (debug) {
						console.log(chalk.green('Git not yet initialized'));
					}

					try {
						if (debug) {
							console.log(`Starting cloning ${visualData.origin}`);
						}

						const options = shallow ? { '--depth': '1' } : undefined;

						await git.clone(visualData.origin, repoPath, options);

						if (debug) {
							console.log(chalk.green('Repository successfully cloned'));
						}
					} catch (error) {
						console.log('And error occurred while cloning repository');
						console.error(error);
						Sentry.captureException(error);
					}
				}

				try {
					await git.cwd(repoPath);

					/**
					 * Update username + email for repo
					 */
					let localConfigValues = null;
					const config = await git.listConfig();
					try {
						localConfigValues = JSON.parse(JSON.stringify(config.values['.git/config']));
					} catch {}

					if (localConfigValues) {
						const localConfigName = localConfigValues['user.name'];
						const localConfigEmail = localConfigValues['user.email'];

						if (!localConfigName && userName) {
							if (debug) {
								console.log(chalk.blue(repoPath + ' setting user.name'));
							}

							await git.addConfig('user.name', userName);
						}

						if (!localConfigEmail && userEmail) {
							if (debug) {
								console.log(chalk.blue(repoPath + ' setting user.email'));
							}

							await git.addConfig('user.email', userEmail);
						}
					}

					try {
						await git.fetch();
					} catch (error: any) {
						console.log(chalk.red(repoPath + ' threw error: ' + error.message));
						continue;
					}

					let status;

					try {
						status = await git.status();
					} catch (error: any) {
						console.log(chalk.red(repoPath + ' threw git status error: ' + error.message));
						continue;
					}

					if (status.files.length > 0) {
						if (debug) {
							console.log(chalk.yellow(repoPath + ' has some changed files, commit them or push them!'));
						}

						continue;
					}

					if (status.behind > 0) {
						if (debug) {
							console.log(chalk.yellow(repoPath + ' is behind, pulling'));
						}

						await git.pull();
					}

					if (status.ahead > 0) {
						console.log(chalk.yellow(repoPath + ' is ahead, push the changes!'));
					}
				} catch (error) {
					Sentry.captureException(error);
					console.error(error);
				}
			}
		}

		console.log(chalk.green(`Successfully synchronized ${totalSyncedCount} templates (of ${totalCount})`));

		// ToDo: environment
		const url = 'https://app.imagelance.com/visuals/sync';
		console.log(chalk.blue(`You can change which templates to synchronize at: ${url}`));

		const now = new Date();
		setConfig('lastSync', now.toISOString());
	}
}
