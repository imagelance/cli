import Listr, { ListrTask } from 'listr';
import path from 'node:path';

import AuthenticatedCommand from '../authenticated-command';
import { getRoot } from '../utils/config-getters';
import { fetchVisual } from '../utils/fetch-visual';
import getDirectories from '../utils/get-directories';

export class Pull extends AuthenticatedCommand {
	static description = 'Pull all local templates';

	async fetchAndPull(repoPath: string, brand: string, repoName: string): Promise<void> {
		const git = await fetchVisual(repoPath, brand, repoName);

		if (!git) {
			return;
		}

		await git.branch(['--set-upstream-to=origin/master', 'master']);
		await git.pull();
	}

	async run(): Promise<void> {
		const { flags } = await this.parse(Pull);
		const { debug } = flags;

		const tasks: ListrTask[] = [];
		const root: string = getRoot();
		const brandFolders: string[] = await getDirectories(root);
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

				const visual = visuals[visualIndex];
				const visualPath = path.join(root, brand, visual);

				tasks.push({
					task: () => this.fetchAndPull(visualPath, brand, visual),
					title: `Fetching & pulling ${visualPath}`,
				});
			}
		}

		const runner = new Listr(tasks, {
			concurrent: true,
			exitOnError: false,
			renderer: debug ? 'verbose' : 'default',
		});

		try {
			await runner.run();
		} catch {
			// do nothing (this is here to silence ugly errors thrown into the console, listr prints errors in a pretty way)
		}
	}
}
