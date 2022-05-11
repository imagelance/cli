import * as fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import simpleGit from 'simple-git';
import Table from 'cli-table';

import AuthenticatedCommand from '../AuthenticatedCommand';
import getDirectories from '../utils/getDirectories';
import { getRoot } from '../utils/configGetters';

export class Status extends AuthenticatedCommand {
	static description = 'Git status of all local visuals';

	async run(): Promise<void> {
		const root = getRoot();
		const git = simpleGit();
		const brandFolders = await getDirectories(path.join(root, 'src'));
		const brands = brandFolders.filter((folder: string) => folder[0] !== '.');
		const table = new Table({
			head: ['Organization', 'Visual', 'Branch', 'Status']
		});

		let tableContainsRows = false;

		for (let brandIndex in brands) {
			if (!brands.hasOwnProperty(brandIndex)) {
				continue;
			}

			const brand = brands[brandIndex];
			const visualFolders = await getDirectories(path.join(root, 'src', brand));

			const visuals = visualFolders.filter((folder) => {
				return folder[0] !== '.';
			});

			for (let visualIndex in visuals) {
				if (!visuals.hasOwnProperty(visualIndex)) {
					continue;
				}

				const visual = visuals[visualIndex];
				const visualPath = path.join(root, 'src', brand, visual);

				const visualFiles = await fs.promises.readdir(visualPath, { withFileTypes: true });

				if (visualFiles.length === 0) {
					table.push([brand, visual, `Empty folder, deleting`]);
					tableContainsRows = true;
					await fs.promises.rmdir(visualPath);
					continue;
				}

				if (!fs.existsSync(path.join(visualPath, '.git'))) {
					table.push([brand, visual, `Git not initialized`]);
					tableContainsRows = true;
					continue;
				}

				try {
					await git.cwd(visualPath);

					const status = await git.status();

					if (status.files.length) {
						const fileNames = status.files.map((file) => file.path).join(', ');
						const currentBranch = status.current === 'master'
							? status.current
							: chalk.yellow(`${status.current} (not on master)`);

						table.push([brand, visual, currentBranch, `Changed ${status.files.length} files: ${fileNames}`]);
						tableContainsRows = true;
					}

				} catch (error: any) {
					table.push([brand, visual, 'Error: ' + error.toString()]);
					tableContainsRows = true;
				}
			}
		}

		if (tableContainsRows) {
			console.log(table.toString());
		} else {
			console.log(chalk.green(`No changes ✅️`));
		}
	}
}
