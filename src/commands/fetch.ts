import Listr, { ListrTask } from 'listr';
import path from 'node:path';

import AuthenticatedCommand from '../authenticated-command';
import { getRoot } from '../utils/config-getters';
import { fetchVisual } from '../utils/fetch-visual';
import getDirectories from '../utils/get-directories';

export class Fetch extends AuthenticatedCommand {
	static description = 'Fetch all local templates';

	async run(): Promise<void> {
		const { flags } = await this.parse(Fetch);
		const { debug } = flags;

		const root: string = getRoot();
		const brandFolders: string[] = await getDirectories(path.join(root, 'src'));
		const tasks: ListrTask[] = [];
		const brands: string[] = brandFolders.filter((folder: string) => folder[0] !== '.');

		for (const brandIndex in brands) {
			if (!brands.hasOwnProperty(brandIndex)) {
				continue;
			}

			const brand: string = brands[brandIndex];
			const visualFolders: string[] = await getDirectories(path.join(root, 'src', brand));
			const visuals: string[] = visualFolders.filter((folder: string) => folder[0] !== '.');

			for (const visualIndex in visuals) {
				if (!visuals.hasOwnProperty(visualIndex)) {
					continue;
				}

				const visual = visuals[visualIndex];
				const visualPath = path.join(root, 'src', brand, visual);

				tasks.push({
					task: async () => await fetchVisual(visualPath, brand, visual),
					title: `Fetching ${visualPath}`,
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
