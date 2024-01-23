import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'node:fs';
import path from 'node:path';
import rimraf from 'rimraf';
import simpleGit from 'simple-git';

import { Org, Sync } from '../types/syncs';
import { getConfig, getGitConfig, getGitOrigin, getRoot, setConfig } from './config-getters';
import devstackUrl from './devstack-url';
import getDirectories from './get-directories';
import { performRequest } from './perform-request';
import studioUrl from './studio-url';

export async function performSync(flags: any): Promise<void> {
	const { debug, shallow } = flags;

	const root: string = getRoot();

	try {
		await fs.promises.mkdir(root);
	} catch {
		// do nothing
	}

	let orgs: Org[] | null;
	let syncs: Sync[] | null;

	/**
	 * Get user variables, used later for in git config
	 */
	const userEmail = getConfig('email');
	const userName = getConfig('name');

	console.log(chalk.green('Downloading template list available for sync...'));

	/**
	 * Get orgs
	 */
	try {
		const { data } = await performRequest({
			method: 'GET',
			url: devstackUrl('/gitea/orgs'),
		});

		orgs = data as Org[];
	} catch (error: any) {
		Sentry.captureException(error);
		console.log(error);
		console.error(chalk.red(error.message));
		return;
	}

	/**
	 * Select brands
	 */
	let selectedBrands;
	//	const isAllBrands = argv.all;
	const isAllBrands = true; // always sync all brands

	if (isAllBrands) {
		selectedBrands = orgs.map((org: any) => org.name);
	} else {
		const brandAnswers = await inquirer.prompt({
			choices: orgs.map((org: any) => ({
				checked: true,
				name: `${org.full_name} (${org.name})`,
				value: org.name,
			})),
			message: 'Select brands to sync',
			name: 'brands',
			type: 'checkbox',
		});
		selectedBrands = brandAnswers.brands;
	}

	try {
		const { data } = await performRequest({
			method: 'GET',
			params: {
				organizations: selectedBrands,
			},
			url: devstackUrl('/syncs'),
		});

		syncs = data as Sync[];
		setConfig('lastSyncResponseData', syncs);
	} catch (error: any) {
		Sentry.captureException(error);
		console.log(error);
		console.error(chalk.red(error.message));
		return;
	}

	const git = simpleGit(getGitConfig({
		progress({ method, progress, stage }: any): void {
			if (debug) {
				console.log(`git.${method} ${stage} stage ${progress}% complete`);
			}
		},
	}));

	const gitIgnorePath = path.join(root, '.gitignore');

	if (!fs.existsSync(gitIgnorePath)) {
		fs.writeFileSync(gitIgnorePath, '*.url');
	}

	try {
		await fs.promises.mkdir(root);
	} catch {
		// do nothing
	}

	let totalSyncedCount = 0;

	/**
	 * Check whether brand folders exist
	 */

	for (const brand of selectedBrands) {
		const brandPath = path.join(root, brand);

		try {
			const stats = fs.lstatSync(brandPath);

			if (!stats.isDirectory()) {
				throw new Error('Not directory');
			}
		} catch {
			fs.mkdirSync(brandPath);
			console.log(`Creating directory ${brandPath}`);
		}

		/**
		 * Get list of syncs for current brand
		 */

		const brandSyncs = syncs.filter((sync) => sync.organization === brand);

		const repoNames: string[] = brandSyncs.map((sync) => sync.repo);

		const repoFolders = await getDirectories(brandPath);

		console.log(chalk.cyan(`Syncing brand: ${chalk.cyan.bold(brand)} (${brandSyncs.length} synced templates)`));

		/**
		 * Delete folders for repos, that have been unsynced
		 */

		for (const repoFolder of repoFolders) {
			if (!repoNames.includes(repoFolder)) {
				// console.log(`Should delete ${brand}/${repoFolder}`);
				// const files = await fs.promises.readdir(path.join(brandPath, repoFolder), { withFileTypes: true });
				// const hasNoFiles = files.length === 0;
				// const hasOnlyGit = files.length === 1 && files[0].name === '.git';
				// const hasGitAndConfig = files.length === 2 && files[0].name === '.git' && files[1].name === 'config.json';
				// if (hasNoFiles || hasOnlyGit || hasGitAndConfig) {
				if (debug) {
					console.log(`DELETING ${repoFolder}`);
				}

				rimraf.sync(path.join(brandPath, repoFolder));
				// }
			}
		}

		/**
		 * Clone and fetch synced repos
		 */

		for (const repoName of repoNames) {
			if (!repoName) {
				continue;
			}

			totalSyncedCount++;

			if (debug) {
				console.log(chalk.cyan(`Syncing template: ${brand}/${repoName}`));
			}

			const repoPath = path.join(root, brand, repoName);

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

					await git.removeRemote('origin');

					const origin = getGitOrigin(brand, repoName);

					await git.addRemote('origin', origin);

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
					const origin = getGitOrigin(brand, repoName);

					if (debug) {
						console.log(`Starting cloning ${origin}`);
					}

					const options = shallow ? { '--depth': '1' } : undefined;

					await git.clone(origin, repoPath, options);

					if (debug) {
						console.log(chalk.green('Repository successfully cloned'));
					}
				} catch (error) {
					console.log('An error occurred while cloning repository');
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
				} catch {
					// do nothing
				}

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
					console.log(chalk.red(`${repoPath} threw error: ${error.message}`));
					continue;
				}

				let status;

				try {
					status = await git.status();
				} catch (error: any) {
					console.log(chalk.red(`${repoPath} threw git status error: ${error.message}`));
					continue;
				}

				if (status.files.length > 0) {
					if (debug) {
						console.log(chalk.yellow(`${repoPath} has some changed files, commit them or push them!`));
					}

					continue;
				}

				if (status.behind > 0) {
					if (debug) {
						console.log(chalk.yellow(`${repoPath} is behind, pulling`));
					}

					await git.pull();
				}

				if (status.ahead > 0) {
					console.log(chalk.yellow(`${repoPath} is ahead, push the changes!`));
				}
			} catch (error) {
				Sentry.captureException(error);
				console.error(error);
			}
		}
	}

	console.log(chalk.green(`Successfully synchronized ${totalSyncedCount} templates`));

	console.log(chalk.blue(`You can change which templates to synchronize at: ${studioUrl()}`));

	const now = new Date();
	setConfig('lastSync', now.toISOString());
}
