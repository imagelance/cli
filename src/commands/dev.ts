import fs from 'fs-extra';
import glob from 'glob';
import path from 'node:path';
import chalk from 'chalk';
import open from 'open';
import inquirer from 'inquirer';
import simpleGit from 'simple-git';
import AdmZip from 'adm-zip';
import FormData from 'form-data';
import Listr from 'listr';
import chokidar from 'chokidar';
import isHiddenFile from '@frigus/is-hidden-file';
import * as Sentry from '@sentry/node';
import { Flags } from '@oclif/core';

import AuthenticatedCommand from '../authenticated-command';
import selectVisual from '../utils/select-visual';
import devstackUrl from '../utils/devstack-url';
import studioUrl from '../utils/studio-url';
import { getRoot, getLastDev, getConfig, setConfig, hasSynced } from '../utils/config-getters';
import { Endpoint, Endpoints } from '../types/dev';
import { performSync } from '../utils/perform-sync';

export class Dev extends AuthenticatedCommand {
	static description = 'Run development server to create templates'

	static flags = {
		newest: Flags.boolean({
			char: 'n',
			description: 'Start dev with newly created template',
			required: false,
			default: false,
		}),
		latest: Flags.boolean({
			char: 'l',
			description: 'Start dev with latest edited template',
			required: false,
			default: false,
		}),
	}

	private endpoints: Endpoints = {
		list: { url: '/filesystem/{bundleId}?path={path}', method: 'get' },
		show: { url: '/filesystem/{bundleId}/show?path={path}', method: 'get' },
		store: { url: '/filesystem/{bundleId}/store?path={path}', method: 'post' },
		upload: { url: '/filesystem/upload', method: 'post' },
		mkdir: { url: '/filesystem/{bundleId}/mkdir?path={value}', method: 'post' },
		mkresize: { url: '/filesystem/{bundleId}/mkresize', method: 'post' },
		mkfile: { url: '/filesystem/{bundleId}/mkfile?path={value}', method: 'post' },
		rename: { url: '/filesystem/{bundleId}/rename?name={value}', method: 'post' },
		move: { url: '/filesystem/{bundleId}/move?destPath={value}', method: 'post' },
		rollback: { url: '/git/{bundleId}/rollback?path={value}', method: 'post' },
		copy: { url: '/filesystem/{bundleId}/copy?srcPath={srcPath}&destPath={destPath}', method: 'post' },
		delete: { url: '/filesystem/{bundleId}?path={value}', method: 'delete' },
	}

	private chokidarOptions: any = {
		// ignore dotfiles
		ignored: /(^|[/\\])\../,
		// keep on running after initial "ready" event
		persistent: true,
		// don't fire add/addDir on init
		ignoreInitial: true,
		// don't fire add/addDir unless file write is finished
		awaitWriteFinish: {
			// after last write, wait for 1s to compare outcome with source to ensure add/change are properly fired
			stabilityThreshold: 300,
		},
	}

	private visualRoot: string | null = null

	private isDebugging = false

	private bundle: any = null

	private resize: any = null

	private localZipPath: string | null = null

	private shouldDestroyBundle = false

	async run(): Promise<void> {
		const { flags } = await this.parse(Dev);
		const { debug, newest, latest } = flags;

		this.isDebugging = debug;

		// Get templates root folder

		const root = getRoot();

		// Validate, whether sync command was ran at least 1 time

		await this.wasSyncRun();

		// Selected visual being edited

		let visualPath: string | null;

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

		console.log(`Building ${visualPath}`);
		setConfig('lastDev', visualPath);

		this.visualRoot = `${root}/src/${visualPath}`;

		const git = simpleGit();
		git.cwd(this.visualRoot);

		try {
			await git.fetch();
			await git.pull(['--rebase']);
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}

			console.log(chalk.red('Git pull failed, please pull manually'));
			return this.exitHandler(1);
		}

		/**
		 * VisualSizes
		 */
		const folders = glob.sync(`${root}/src/${visualPath}/[!_][0-9]*/index.html`);

		if (folders.length === 0) {
			console.log(chalk.red('🛑 No resize in template! Start by copying the contents of an existing template if it exists or copy a template from https://github.com/imagelance'));
			return this.exitHandler(1);
		}

		// Select resizes
		// ToDo: allow running multiple bundlers
		const folderChoices = {
			type: 'list',
			name: 'selectedFolder',
			message: 'Select resize',
			choices: folders.map((folder: string) => {
				return folder.toString()
					.replace(`${this.visualRoot}/`, '')
					.replace('/index.html', '');
			}),
		};

		const folderAnswers = await inquirer.prompt([folderChoices]);
		const { selectedFolder } = folderAnswers;
		const [orgName, repoName] = visualPath.split('/');

		const repository = await this.getRepository(orgName, repoName);
		// output category is on the 3rd position in repo name
		const outputCategory = repository.name.split('-')[2];

		// let's attempt to find a running bundle in studio, if it exists, resume session
		// in cli
		this.bundle = await this.findRunningBundle(orgName, repository.name, outputCategory);

		// if bundle is not found, we need to create a new edit session
		if (this.bundle) {
			console.log(chalk.yellow.bold('Template is already being edited in studio. If you start a local build, all unsaved changes from studio will be overwritten by local files'));

			const resumingBundleChoice = await inquirer.prompt({
				type: 'list',
				name: 'answer',
				message: chalk.yellow('Do you wish to continue?'),
				choices: [
					'Yes',
					'No',
				],
			});

			if (resumingBundleChoice.answer === 'No') {
				console.log(chalk.blue(`You can continue editing your template in studio here ${studioUrl(`/visuals/${orgName}/${repository.name}`)}`));
				return this.exitHandler();
			}
		} else {
			const branches = await this.getBranches(orgName, repository.name);

			let branch: string | null = null;

			if (branches.length === 0) {
				console.log(chalk.red('🤖 No branches found'));
				return this.exitHandler(1);
			}

			if (branches.length === 1) {
				branch = branches[0].value;
			}

			if (!branch) {
				const branchChoices = {
					type: 'search-list',
					name: 'selectedBranch',
					message: 'Select branch',
					choices: branches,
				};

				const branchAnswer = await inquirer.prompt([branchChoices]);

				branch = branchAnswer.selectedBranch;
			}

			if (!branch) {
				console.log(chalk.red('🤖 No branches selected'));
				return this.exitHandler(1);
			}

			this.bundle = await this.startBundle(branch, orgName, repository.name, outputCategory);
		}

		this.shouldDestroyBundle = true;

		if (!this.bundle) {
			console.log(chalk.red('🤖 Could not start bundle'));
			return this.exitHandler(1);
		}

		// replace bundleId in endpoints with actual bundle.id
		for (const endpoint of Object.keys(this.endpoints)) {
			const endpointConfig: Endpoint = this.endpoints[endpoint];
			endpointConfig.url = devstackUrl(endpointConfig.url.replace('{bundleId}', this.bundle.id));
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
			title: chalk.blue(`Running bundler for resize ${selectedFolder}...`),
			task: async (ctx, task) => {
				this.resize = await this.previewResize(orgName, this.bundle.id, selectedFolder);

				if (!this.resize) {
					throw new Error('Bundling resize unavailable');
				}

				const url = studioUrl(`/visuals/local/${this.bundle.id}/${selectedFolder}`);

				await open(url);

				task.title = chalk.green(`Started bundle ${url}`);
			},
		}]);

		await this.runTasks(tasks);

		await this.startWatcher();

		console.log(chalk.blue('🤖 Watching for changes... Press ctrl + c to stop bundler'));
	}

	async exitHandler(code = 0): Promise<void> {
		const tasks = new Listr([{
			title: chalk.blue('Stopping bundler...'),
			task: async (ctx, task): Promise<void> => {
				if (this.shouldDestroyBundle) {
					if (this.resize) {
						const config = {
							url: devstackUrl(`/resizes/${this.resize.id}`),
							method: 'DELETE',
							cancelToken: this.getCancelToken('resizeDestroy'),
						};

						await this.performRequest(config);
					}

					if (this.bundle) {
						const config = {
							url: devstackUrl(`/bundles/${this.bundle.id}`),
							method: 'DELETE',
							data: {
								saveChanges: false,
								commitMessage: 'CLI stopped',
								targetBranch: this.bundle.branch,
							},
						};

						await this.performRequest(config);
					}
				}

				if (this.localZipPath && fs.existsSync(this.localZipPath)) {
					await fs.unlink(this.localZipPath);
				}

				task.title = chalk.green('Stopped');
			},
		}]);

		await this.runTasks(tasks);

		process.exit(code);
	}

	async getLastVisual() {
		const root = getRoot();
		const lastDev = getLastDev();

		if (!lastDev) {
			return null;
		}

		let visualExists = false;

		try {
			const stats = await fs.promises.lstat(path.join(root, 'src', lastDev));
			visualExists = stats.isDirectory();
		} catch (error) {
			console.error(error);
		}

		if (!visualExists) {
			return null;
		}

		return lastDev;
	}

	async detectLastVisual() {
		const root = getRoot();
		const lastDev = getLastDev();

		if (!lastDev) {
			return null;
		}

		let visualExists = false;

		try {
			const stats = await fs.promises.lstat(path.join(root, 'src', lastDev));
			visualExists = stats.isDirectory();
		} catch {
			// do nothing
		}

		const lastVisualContent = lastDev;

		if (!visualExists) {
			return null;
		}

		const lastVisualAnswers = await inquirer.prompt({
			type: 'list',
			name: 'first',
			message: `Develop recent template? ${lastVisualContent}`,
			choices: [
				'Yes',
				'No',
			],
		});

		return lastVisualAnswers.first === 'Yes' ? lastVisualContent : null;
	}

	async getRepository(orgName: string, repoName: string): Promise<any> {
		try {
			const config = {
				url: devstackUrl(`/gitea/repos/${repoName}`),
				method: 'get',
				headers: {
					'X-Organization': orgName,
				},
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

	async getBranches(orgName: string, repoName: string): Promise<any> {
		try {
			const config = {
				url: devstackUrl('/gitea/branches'),
				method: 'get',
				params: {
					gitRepoName: repoName,
				},
				headers: {
					'X-Organization': orgName,
				},
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

	async findRunningBundle(orgName: string, repoName: string, outputCategory: string): Promise<any> {
		try {
			const config = {
				url: devstackUrl('/bundles/running'),
				method: 'GET',
				params: {
					gitOrgName: orgName,
					gitRepoName: repoName,
					outputCategory: outputCategory,
				},
				headers: {
					'X-Organization': orgName,
				},
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

	async startBundle(branch: string, orgName: string, repoName: string, outputCategory: string): Promise<any> {
		try {
			const config = {
				url: devstackUrl('/bundles'),
				method: 'POST',
				data: {
					branch: branch,
					gitOrgName: orgName,
					gitRepoName: repoName,
					outputCategory: outputCategory,
					// initially we stop the bundle file watcher on devstack side
					// because we'll be performing an ingest operation which would
					// unnecessary fire file change events, after ingest, we need to
					// manually start the watcher again
					startFileWatcher: false,
				},
				headers: {
					'X-Organization': orgName,
				},
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
				url: devstackUrl(`/bundle-watchers/start/${this.bundle.id}`),
				method: 'POST',
				headers: {
					'X-Organization': orgName,
				},
			};

			await this.performRequest(config);
		} catch (error: any) {
			Sentry.captureException(error);

			if (this.isDebugging) {
				this.reportError(error);
			}
		}
	}

	async syncLocalFilesToDevstack(gitRepoName: string): Promise<boolean> {
		const tasks = new Listr([{
			title: chalk.blue('Syncing local files to devstack...'),
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
					url: devstackUrl('/ingest'),
					method: 'POST',
					cancelToken: this.getCancelToken(this.localZipPath),
					data: formData,
					headers: {
						'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
					},
				};

				await this.performRequest(config);

				await fs.unlink(this.localZipPath);

				task.title = chalk.green('Synced local files to devstack');
			},
		}]);

		return this.runTasks(tasks);
	}

	async previewResize(orgName: string, bundleId: number, label: string): Promise<any> {
		try {
			const config = {
				url: devstackUrl('resizes'),
				method: 'post',
				data: {
					bundleId,
					label,
				},
				headers: {
					'X-Organization': orgName,
				},
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

	getRelativePath(path: string): string {
		return path.replace(`${this.visualRoot}`, '');
	}

	async onChange(filepath: string): Promise<void> {
		const relativePath = this.getRelativePath(filepath);
		const tasks = new Listr([{
			title: chalk.blue(`Updating "${relativePath}"...`),
			task: (ctx, task): Promise<void> => new Promise(async (resolve, reject) => {
				try {
					const config = {
						url: this.endpoints.store.url.replace(/{path}/g, relativePath),
						method: this.endpoints.store.method,
						cancelToken: this.getCancelToken(filepath),
						data: {
							content: fs.readFileSync(filepath, { encoding: 'utf8' }),
						},
					};

					await this.performRequest(config);

					task.title = chalk.green(`Updated "${relativePath}"`);

					resolve();
				} catch (error: any) {
					reject(error);
				}
			}),
		}]);

		await this.runTasks(tasks);
	}

	async onAdd(filepath: string): Promise<void> {
		const relativePath = this.getRelativePath(filepath);
		const tasks = new Listr([{
			title: chalk.blue(`Storing file "${relativePath}"...`),
			task: async (ctx, task): Promise<void> => new Promise(async (resolve, reject) => {
				try {
					const filename = path.basename(filepath);
					const formData = new FormData();

					formData.append('bundleId', this.bundle.id);
					formData.append('path', relativePath.replace(`/${filename}`, '') || '/');
					formData.append('files[]', fs.createReadStream(filepath), filename);

					const config = {
						url: this.endpoints.upload.url,
						method: this.endpoints.upload.method,
						cancelToken: this.getCancelToken(filepath),
						data: formData,
						headers: {
							'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
						},
					};

					await this.performRequest(config);

					task.title = chalk.green(`Stored file "${relativePath}"`);

					resolve();
				} catch (error: any) {
					reject(error);
				}
			}),
		}]);

		await this.runTasks(tasks);
	}

	async onUnlink(filepath: string): Promise<void> {
		await this.unlink(filepath);
	}

	async onAddDir(filepath: string): Promise<void> {
		const relativePath = this.getRelativePath(filepath);
		const tasks = new Listr([{
			title: chalk.blue(`Creating directory "${relativePath}"...`),
			task: async (ctx, task): Promise<void> => new Promise(async (resolve, reject) => {
				try {
					const config = {
						url: this.endpoints.mkdir.url.replace(/{value}/g, this.getRelativePath(filepath)),
						method: this.endpoints.mkdir.method,
						cancelToken: this.getCancelToken(filepath),
					};

					await this.performRequest(config);

					task.title = chalk.green(`Created directory "${relativePath}"`);

					resolve();
				} catch (error: any) {
					reject(error);
				}
			}),
		}]);

		await this.runTasks(tasks);
	}

	async onUnlinkDir(filepath: string): Promise<void> {
		await this.unlink(filepath);
	}

	async unlink(filepath: string): Promise<void> {
		const relativePath = this.getRelativePath(filepath);
		const tasks = new Listr([{
			title: chalk.blue(`Deleting "${relativePath}"...`),
			task: async (ctx, task): Promise<void> => new Promise(async (resolve, reject) => {
				try {
					const config = {
						url: this.endpoints.delete.url.replace(/{value}/g, relativePath),
						method: this.endpoints.delete.method,
						cancelToken: this.getCancelToken(filepath),
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
		}]);

		await this.runTasks(tasks);
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

	private async wasSyncRun(): Promise<void> {
		if (hasSynced()) {
			return;
		}

		const shouldRunSyncCommand = await inquirer.prompt({
			type: 'list',
			name: 'answer',
			message: chalk.yellow(`Before running the dev command you need to run "${this.config.bin} sync" to download synchronised templates. Do you wish to run this command now?`),
			choices: [
				'Yes',
				'No',
			],
		});

		if (shouldRunSyncCommand.answer === 'No') {
			console.log(chalk.blue(`Take your time! When you're ready, just call the "${this.config.bin} sync" command.`));
			return this.exitHandler(1);
		}

		await performSync({ debug: this.isDebugging });
	}
}
