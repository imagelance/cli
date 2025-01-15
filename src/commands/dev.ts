import isHiddenFile from '@frigus/is-hidden-file';
import { Flags } from '@oclif/core';
import * as Sentry from '@sentry/node';
import AdmZip from 'adm-zip';
import { AxiosProgressEvent } from 'axios';
import chalk from 'chalk';
import chokidar from 'chokidar';
import Table from 'cli-table';
import FormData from 'form-data';
import fs from 'fs-extra';
import glob from 'glob';
import inquirer from 'inquirer';
import Listr from 'listr';
import path from 'node:path';
import open from 'open';
import simpleGit from 'simple-git';

import AuthenticatedCommand from '../authenticated-command';
import { Endpoint, Endpoints } from '../types/dev';
import { getConfig, getGitConfig, getLastDev, getRoot, hasSynced, setConfig } from '../utils/config-getters';
import devstackUrl from '../utils/devstack-url';
import { performSync } from '../utils/perform-sync';
import selectVisual from '../utils/select-visual';
import studioUrl from '../utils/studio-url';

export class Dev extends AuthenticatedCommand {
	static description = 'Run development server to create templates';

	static flags = {
		latest: Flags.boolean({
			char: 'l',
			default: false,
			description: 'Start dev with latest edited template',
			required: false,
		}),
		newest: Flags.boolean({
			char: 'n',
			default: false,
			description: 'Start dev with newly created template',
			required: false,
		}),
	};

	private bundle: any = null;

	private bundler: any = null;

	private chokidarOptions: any = {
		// that use "atomic writes" instead of writing directly to the source file
		atomic: true,
		// don't fire add/addDir unless file write is finished
		awaitWriteFinish: {
			// after last write, wait for 1s to compare outcome with source to ensure add/change are properly fired
			stabilityThreshold: 300,
		},
		// don't fire add/addDir on init
		ignoreInitial: true,
		// automatically filters out artifacts that occur when using editors
		// ignore dotfiles
		ignored: /(^|[/\\])\../,
		// keep on running after initial "ready" event
		persistent: true,
	};

	private endpoints: Endpoints = {
		copy: { method: 'post', url: '/filesystem/{bundleId}/copy?srcPath={srcPath}&destPath={destPath}' },
		delete: { method: 'delete', url: '/filesystem/{bundleId}?path={value}' },
		list: { method: 'get', url: '/filesystem/{bundleId}?path={path}' },
		mkdir: { method: 'post', url: '/filesystem/{bundleId}/mkdir?path={value}' },
		mkfile: { method: 'post', url: '/filesystem/{bundleId}/mkfile?path={value}' },
		mkresize: { method: 'post', url: '/filesystem/{bundleId}/mkresize' },
		move: { method: 'post', url: '/filesystem/{bundleId}/move?destPath={value}' },
		rename: { method: 'post', url: '/filesystem/{bundleId}/rename?name={value}' },
		rollback: { method: 'post', url: '/git/{bundleId}/rollback?path={value}' },
		show: { method: 'get', url: '/filesystem/{bundleId}/show?path={path}' },
		store: { method: 'post', url: '/filesystem/{bundleId}/store?path={path}' },
		upload: { method: 'post', url: '/filesystem/upload' },
	};

	private isDebugging = false;

	private localZipPath: null | string = null;

	private shouldDestroyBundle = false;

	private visualRoot: null | string = null;

	async createBundle(branch: string, orgName: string, repoName: string, outputCategory: string): Promise<any> {
		try {
			const config = {
				data: {
					branch,
					gitOrgName: orgName,
					gitRepoName: repoName,
					// clone repo without checking out files
					noCheckout: true,
					outputCategory,
					// initially we stop the bundle file watcher on devstack side
					// because we'll be performing an ingest operation which would
					// unnecessary fire file change events, after ingest, we need to
					// manually start the watcher again
					startFileWatcher: false,
					target: 'local',
				},
				headers: {
					'X-Brand': orgName,
				},
				method: 'POST',
				url: devstackUrl('/bundles'),
			};

			const { data } = await this.performRequest(config);

			return data;
		} catch (error: any) {
			Sentry.captureException(error);

			if (
				error.response
				&& error.response.data
				&& error.response.data.message
				&& error.response.data.message === 'ERR_REPO_ARCHIVED_OR_DELETED'
			) {
				console.log(chalk.red('😾 Repository archived or deleted.'));
			}

			if (this.isDebugging) {
				this.reportError(error);
			}

			return null;
		}
	}

	deleteHangingZipFiles(gitRepoName: string): void {
		if (!this.visualRoot) {
			return;
		}

		const zips = glob.sync(`${gitRepoName}-*.zip`, { cwd: this.visualRoot });

		if (zips.length === 0) {
			return;
		}

		for (const relativeZipPath of zips) {
			fs.removeSync(`${this.visualRoot}${path.sep}${relativeZipPath}`);
		}
	}

	async detectLastVisual(): Promise<null | string> {
		const root = getRoot();
		const lastDev = getLastDev();

		if (!lastDev) {
			return null;
		}

		let visualExists = false;

		try {
			const stats = await fs.promises.lstat(path.join(root, lastDev));
			visualExists = stats.isDirectory();
		} catch {
			// do nothing
		}

		const lastVisualContent = lastDev;

		if (!visualExists) {
			return null;
		}

		const lastVisualAnswers = await inquirer.prompt({
			choices: [
				'Yes',
				'No',
			],
			message: `Develop recent template? ${lastVisualContent}`,
			name: 'first',
			type: 'list',
		});

		return lastVisualAnswers.first === 'Yes' ? lastVisualContent : null;
	}

	async exitHandler(code = 0): Promise<void> {
		if (this.isExiting) {
			return;
		}

		this.isExiting = true;

		const tasks = new Listr([{
			task: async (ctx, task): Promise<void> => {
				if (this.shouldDestroyBundle && this.bundle) {
					const config = {
						data: {
							commitMessage: 'CLI stopped',
							saveChanges: false,
							targetBranch: this.bundle.branch,
						},
						method: 'DELETE',
						url: devstackUrl(`/bundles/${this.bundle.id}`),
					};

					await this.performRequest(config);
				}

				if (this.localZipPath && fs.existsSync(this.localZipPath)) {
					await fs.unlink(this.localZipPath);
				}

				task.title = chalk.green('Stopped');
			},
			title: chalk.blue('Stopping bundler...'),
		}]);

		await this.runTasks(tasks);

		process.exit(Number.isInteger(code) ? code : 0);
	}

	async findRunningBundle(orgName: string, repoName: string, outputCategory: string): Promise<any> {
		try {
			const config = {
				headers: {
					'X-Brand': orgName,
				},
				method: 'GET',
				params: {
					gitOrgName: orgName,
					gitRepoName: repoName,
					outputCategory,
				},
				url: devstackUrl('/bundles/running'),
			};

			const { data } = await this.performRequest(config);

			return data.bundle;
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}
		}
	}

	async getBranches(orgName: string, repoName: string): Promise<any> {
		try {
			const config = {
				headers: {
					'X-Brand': orgName,
				},
				method: 'get',
				params: {
					gitRepoName: repoName,
				},
				url: devstackUrl('/gitea/branches'),
			};

			const { data } = await this.performRequest(config);

			return data.branches;
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			return null;
		}
	}

	async getLastVisual(): Promise<null | string> {
		const root = getRoot();
		const lastDev = getLastDev();

		if (!lastDev) {
			return null;
		}

		let visualExists = false;

		try {
			const stats = await fs.promises.lstat(path.join(root, lastDev));
			visualExists = stats.isDirectory();
		} catch (error) {
			console.error(error);
		}

		if (!visualExists) {
			return null;
		}

		return lastDev;
	}

	getRelativePath(filePath: string): string {
		const replace = new RegExp(`\\${path.sep}`, 'g');
		// on windows, chokidar return path with windows separators
		// normalize that, since we use unix separators across the board
		const normalizedPath = filePath.replace(replace, '\/');

		// console.log('VISUAL ROOT: ', this.visualRoot, '\nFILE PATH:', filePath, '\nNORMALIZED PATH:', normalizedPath);

		return normalizedPath.replace(`${this.visualRoot}`, '');
	}

	async getRepository(orgName: string, repoName: string): Promise<any> {
		try {
			const config = {
				headers: {
					'X-Brand': orgName,
				},
				method: 'get',
				url: devstackUrl(`/gitea/repos/${repoName}`),
			};

			const { data } = await this.performRequest(config);

			return data.repo;
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			return null;
		}
	}

	async onAdd(filepath: string): Promise<void> {
		const relativePath = this.getRelativePath(filepath);

		const tasks = new Listr([{
			task: async (ctx, task): Promise<void> => new Promise(async (resolve, reject) => {
				if (this.isDebugging) {
					console.log(`Added file: ${this.endpoints.store.url.replaceAll('{path}', relativePath)}`);
				}

				try {
					const filename = path.basename(filepath);
					const formData = new FormData();

					formData.append('bundleId', this.bundle.id);
					formData.append('path', relativePath.replace(`/${filename}`, '') || '/');
					formData.append('files[]', fs.createReadStream(filepath), filename);

					const config = {
						cancelToken: this.getCancelToken(filepath),
						data: formData,
						headers: {
							'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
						},
						method: this.endpoints.upload.method,
						url: this.endpoints.upload.url,
					};

					await this.performRequest(config);

					task.title = chalk.green(`Stored file "${relativePath}"`);

					resolve();
				} catch (error: any) {
					reject(error);
				}
			}),
			title: chalk.blue(`Storing file "${relativePath}"...`),
		}]);

		await this.runTasks(tasks);
	}

	async onAddDir(filepath: string): Promise<void> {
		const relativePath = this.getRelativePath(filepath);
		const tasks = new Listr([{
			task: async (ctx, task): Promise<void> => new Promise(async (resolve, reject) => {
				try {
					const config = {
						cancelToken: this.getCancelToken(filepath),
						method: this.endpoints.mkdir.method,
						url: this.endpoints.mkdir.url.replaceAll('{value}', this.getRelativePath(filepath)),
					};

					await this.performRequest(config);

					task.title = chalk.green(`Created directory "${relativePath}"`);

					resolve();
				} catch (error: any) {
					reject(error);
				}
			}),
			title: chalk.blue(`Creating directory "${relativePath}"...`),
		}]);

		await this.runTasks(tasks);
	}

	async onChange(filepath: string): Promise<void> {
		const relativePath = this.getRelativePath(filepath);
		const tasks = new Listr([{
			task: (ctx, task): Promise<void> => new Promise(async (resolve, reject) => {
				if (this.isDebugging) {
					console.log(`Edited file: ${this.endpoints.store.url.replaceAll('{path}', relativePath)}`);
				}

				try {
					const config = {
						cancelToken: this.getCancelToken(filepath),
						data: {
							content: fs.readFileSync(filepath, { encoding: 'utf8' }),
						},
						method: this.endpoints.store.method,
						url: this.endpoints.store.url.replaceAll('{path}', relativePath),
					};

					await this.performRequest(config);

					task.title = chalk.green(`Updated "${relativePath}"`);

					resolve();
				} catch (error: any) {
					reject(error);
				}
			}),
			title: chalk.blue(`Updating "${relativePath}"...`),
		}]);

		await this.runTasks(tasks);
	}

	async onUnlink(filepath: string): Promise<void> {
		await this.unlink(filepath);
	}

	async onUnlinkDir(filepath: string): Promise<void> {
		await this.unlink(filepath);
	}

	async run(): Promise<void> {
		const { flags } = await this.parse(Dev);
		const { debug, latest, newest } = flags;

		this.isDebugging = debug;

		// Get templates root folder

		const root = getRoot();

		// Validate, whether sync command was ran at least 1 time

		await this.wasSyncRun();

		// Selected visual being edited

		let visualPath: null | string;

		if (newest && getConfig('newestVisual')) {
			visualPath = getConfig('newestVisual');
		} else if (latest) {
			visualPath = await this.getLastVisual();
		} else {
			visualPath = await this.detectLastVisual();
		}

		if (!visualPath) {
			visualPath = await selectVisual();
		}

		console.log(chalk.blue(`Preparing ${visualPath}`));
		setConfig('lastDev', visualPath);

		this.visualRoot = `${root}/${visualPath}`;

		const git = simpleGit(getGitConfig());
		git.cwd(this.visualRoot);

		try {
			const status = await git.status();

			const table = new Table({
				head: [
					chalk.cyan('Current branch'),
					chalk.cyan('Commits behind'),
					chalk.cyan('Commits ahead'),
					chalk.cyan('Uncommitted changes'),
				],
				rows: [
					[`${status.current}`, `${status.behind}`, `${status.ahead}`, `${status.files.length}`],
				],
			});

			console.log(table.toString());
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			console.log(chalk.red('Detecting repository status failed'));
			return this.exitHandler(1);
		}

		/**
		 * VisualSizes
		 */
		const folders = glob.sync(`${root}/${visualPath}/[!_][0-9]*/index.html`);

		if (folders.length === 0) {
			console.log(chalk.red('🛑 No resize in template! Copy an existing template or get one from https://git.imagelance.com/templates'));
			return this.exitHandler(1);
		}

		const [orgName, repoName] = visualPath.split('/');

		const repository = await this.getRepository(orgName, repoName);

		if (!repository) {
			console.log(chalk.red('Couldn\'t fetch repository from devstack, exiting. Please try again later.'));
			return this.exitHandler(1);
		}

		// output category is on the 3rd position in repo name
		const outputCategory = repository.name.split('-')[2];

		// let's attempt to find a running bundle in studio, if it exists, resume session
		// in cli
		this.bundle = await this.findRunningBundle(orgName, repository.name, outputCategory);

		// if bundle is not found, we need to create a new edit session
		if (this.bundle) {
			console.log(chalk.yellow.bold('Template is already being edited in studio. If you start a local build, all unsaved changes from studio will be overwritten by local files'));

			const resumingBundleChoice = await inquirer.prompt({
				choices: [
					'Yes',
					'No',
				],
				message: chalk.yellow('Do you wish to continue?'),
				name: 'answer',
				type: 'list',
			});

			if (resumingBundleChoice.answer === 'No') {
				console.log(chalk.blue(`You can continue editing your template in studio here ${studioUrl(`/${orgName}/visuals/${repository.name}`)}`));
				return this.exitHandler();
			}
		} else {
			const branches = await this.getBranches(orgName, repository.name);

			let branch: null | string = null;

			if (branches.length === 0) {
				console.log(chalk.red('🤖 No branches found'));
				return this.exitHandler(1);
			}

			if (branches.length === 1) {
				branch = branches[0].value;
			}

			if (!branch) {
				const branchChoices = {
					choices: branches,
					message: 'Select branch',
					name: 'selectedBranch',
					type: 'search-list',
				};

				const branchAnswer = await inquirer.prompt([branchChoices]);

				branch = branchAnswer.selectedBranch;
			}

			if (!branch) {
				console.log(chalk.red('🤖 No branches selected'));
				return this.exitHandler(1);
			}

			this.bundle = await this.createBundle(branch, orgName, repository.name, outputCategory);
		}

		if (!this.bundle) {
			console.log(chalk.red('🤖 Could not start bundle'));
			return this.exitHandler(1);
		}

		this.shouldDestroyBundle = true;

		// replace bundleId in endpoints with actual bundle.id
		for (const endpoint of Object.keys(this.endpoints)) {
			const endpointConfig: Endpoint = this.endpoints[endpoint];
			endpointConfig.url = devstackUrl(endpointConfig.url.replace('{bundleId}', this.bundle.id));

			if (this.isDebugging) {
				console.log(`Updated url: ${endpointConfig.url}`);
			}
		}

		const synced = await this.syncLocalFilesToDevstack(repository.name);

		if (!synced) {
			console.log(chalk.red('🤖 Could not sync local files to devstack'));
			return this.exitHandler(1);
		}

		// after syncing local files to devstack, we need to manually start the file watcher for the bundle
		await this.startBundleWatcher(orgName);

		// run preview
		const tasks = new Listr([{
			task: async (ctx, task) => {
				this.bundler = await this.startBundler(orgName, this.bundle.id);

				if (!this.bundler) {
					throw new Error('Bundling resize unavailable');
				}

				const url = studioUrl(`/${orgName}/visuals/local/${repoName}`);

				await open(url);

				task.title = chalk.green(`Started bundle ${url}`);
			},
			title: chalk.blue('Running bundler...'),
		}]);

		await this.runTasks(tasks);

		await this.startWatcher();

		console.log(chalk.blue('🤖 Watching for changes... Press ctrl + c to stop bundler'));
	}

	async runTasks(tasks: Listr): Promise<boolean> {
		try {
			await tasks.run();

			return true;
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			return false;
		}
	}

	async startBundler(orgName: string, bundleId: number): Promise<any> {
		try {
			const config = {
				headers: {
					'X-Brand': orgName,
				},
				method: 'post',
				url: devstackUrl(`/bundlers/${bundleId}`),
			};

			const { data } = await this.performRequest(config);

			return data;
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			return null;
		}
	}

	async startBundleWatcher(orgName: string): Promise<void> {
		try {
			const config = {
				headers: {
					'X-Brand': orgName,
				},
				method: 'POST',
				url: devstackUrl(`/bundle-watchers/start/${this.bundle.id}`),
			};

			await this.performRequest(config);
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}
		}
	}

	async startWatcher(): Promise<any> {
		if (!this.visualRoot) {
			console.log(chalk.red('🛑 Templates root not set! Cannot start watcher.'));
			return this.exitHandler(1);
		}

		// init file watcher
		const watcher = chokidar.watch(`${this.visualRoot}`, this.chokidarOptions);

		// bind event listeners + set context of functions to current class
		watcher.on('add', this.onAdd.bind(this));
		watcher.on('unlink', this.onUnlink.bind(this));
		watcher.on('change', this.onChange.bind(this));
		watcher.on('addDir', this.onAddDir.bind(this));
		watcher.on('unlinkDir', this.onUnlinkDir.bind(this));

		return watcher;
	}

	async syncLocalFilesToDevstack(gitRepoName: string): Promise<boolean> {
		this.deleteHangingZipFiles(gitRepoName);

		const tasks = new Listr([{
			task: async (ctx, task) => {
				const zip = new AdmZip();

				if (!this.visualRoot) {
					return;
				}

				// add everything from template except hidden files to zip
				zip.addLocalFolder(this.visualRoot, undefined, (filename: string) => !isHiddenFile(filename));

				// create unique zip file name
				const zipName = `${gitRepoName}-${Date.now()}.zip`;
				this.localZipPath = path.join(this.visualRoot, zipName);

				// save zip file to disk
				zip.writeZip(this.localZipPath);

				const formData = new FormData();

				formData.append('bundleId', this.bundle.id);
				formData.append('path', '/');
				formData.append('files[]', fs.createReadStream(this.localZipPath), zipName);

				const config = {
					cancelToken: this.getCancelToken(this.localZipPath),
					data: formData,
					headers: {
						'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
					},
					// 10 * 1 Gb
					maxBodyLength: 10 * 1_073_741_824,
					// 10 * 1 Gb
					maxContentLength: 10 * 1_073_741_824,
					method: 'POST',
					onUploadProgress({ loaded, total }: AxiosProgressEvent) {
						if (!total) {
							return;
						}

						const percent = Math.floor((loaded * 100) / total);

						task.title = percent < 100
							? chalk.blue(`Uploading local files to devstack ${percent}%...`)
							: chalk.blue('Processing uploaded file...');
					},
					url: devstackUrl('/ingest'),
				};

				await this.performRequest(config);

				await fs.unlink(this.localZipPath);

				task.title = chalk.green('Uploaded local files to devstack');
			},
			title: chalk.blue('Uploading local files to devstack 0%...'),
		}]);

		return this.runTasks(tasks);
	}

	async unlink(filepath: string): Promise<void> {
		const relativePath = this.getRelativePath(filepath);
		const tasks = new Listr([{
			task: async (ctx, task): Promise<void> => new Promise(async (resolve, reject) => {
				if (this.isDebugging) {
					console.log(`Removed file: ${this.endpoints.store.url.replaceAll('{path}', relativePath)}`);
				}

				try {
					const config = {
						cancelToken: this.getCancelToken(filepath),
						method: this.endpoints.delete.method,
						url: this.endpoints.delete.url.replaceAll('{value}', relativePath),
					};

					await this.performRequest(config);

					task.title = chalk.green(`Deleted "${relativePath}"`);

					resolve();
				} catch (error: any) {
					// in case of deleting a directory and all it's content multiple unlink are fired
					// and are not ordered properly, let's assume everything has been deleted since
					// rimraf is fired on backend
					if (error.response && error.response.data && error.response.data.code === 404) {
						task.title = chalk.green(`Deleted "${relativePath}"`);

						resolve();
						return;
					}

					reject(error);
				}
			}),
			title: chalk.blue(`Deleting "${relativePath}"...`),
		}]);

		await this.runTasks(tasks);
	}

	private async wasSyncRun(): Promise<void> {
		if (hasSynced()) {
			return;
		}

		const shouldRunSyncCommand = await inquirer.prompt({
			choices: [
				'Yes',
				'No',
			],
			message: chalk.yellow(`Before running the dev command you need to run "${this.config.bin} sync" to download synchronised templates. Do you wish to run this command now?`),
			name: 'answer',
			type: 'list',
		});

		if (shouldRunSyncCommand.answer === 'No') {
			console.log(chalk.blue(`Take your time! When you're ready, just call the "${this.config.bin} sync" command.`));
			return this.exitHandler(1);
		}

		await performSync({ debug: this.isDebugging });
	}
}
