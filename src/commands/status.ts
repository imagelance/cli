import * as fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import simpleGit from 'simple-git';
import Table from 'cli-table';
import * as Sentry from '@sentry/node';
import { Flags } from '@oclif/core';

import AuthenticatedCommand from '../authenticated-command';
import getDirectories from '../utils/get-directories';
import { getRoot } from '../utils/config-getters';

export class Status extends AuthenticatedCommand {
	static description = 'Git status of all local templates'

	static flags = {
		debug: Flags.boolean({ char: 'd', description: 'Debug mode', required: false, default: false }),
		local: Flags.boolean({ char: 'a', description: 'Against local apis', required: false, default: false }),
	}

	async run(): Promise<void> {
		const { flags } = await this.parse(Status);
		const { debug } = flags;

		const root = getRoot();
		const git = simpleGit();
		const brandFolders = await getDirectories(path.join(root, 'src'));
		const brands = brandFolders.filter((folder: string) => folder[0] !== '.');
		const table = new Table({
			head: ['Brand', 'Template', 'Git Branch', 'Status'],
		});

		let tableContainsRows = false;

		for (const brandIndex in brands) {
			if (!brands.hasOwnProperty(brandIndex)) {
				continue;
			}

			const brand = brands[brandIndex];
			const visualFolders = await getDirectories(path.join(root, 'src', brand));

			const visuals = visualFolders.filter(folder => {
				return folder[0] !== '.';
			});

			for (const visualIndex in visuals) {
				if (!visuals.hasOwnProperty(visualIndex)) {
					continue;
				}

				const visual = visuals[visualIndex];
				const visualPath = path.join(root, 'src', brand, visual);

				const visualFiles = await fs.promises.readdir(visualPath, { withFileTypes: true });

				if (visualFiles.length === 0) {
					table.push([brand, visual, 'Empty folder, deleting']);
					tableContainsRows = true;
					await fs.promises.rmdir(visualPath);
					continue;
				}

				if (!fs.existsSync(path.join(visualPath, '.git'))) {
					table.push([brand, visual, 'Git not initialized']);
					tableContainsRows = true;
					continue;
				}

				try {
					await git.cwd(visualPath);

					const status = await git.status();

					if (status.files.length > 0) {
						const fileNames = status.files.map(file => file.path).join(', ');
						const currentBranch = status.current === 'master' ? status.current : chalk.yellow(`${status.current} (not on master)`);

						table.push([brand, visual, currentBranch, `Changed ${status.files.length} files: ${fileNames}`]);
						tableContainsRows = true;
					}
				} catch (error: any) {
					Sentry.captureException(error);

					if (debug) {
						this.reportError(error);
					}

					table.push([brand, visual, `Error: ${error.toString()}`]);
					tableContainsRows = true;
				}
			}
		}

		if (tableContainsRows) {
			console.log(table.toString());
		} else {
			console.log(chalk.green('No changes ✅️'));
		}
	}
}
