import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

import AuthenticatedCommand from '../AuthenticatedCommand';
import getDirectories from '../utils/getDirectories';
import checkConfig from '../utils/checkConfig';
import checkSchema from '../utils/checkSchema';
import { getRoot } from '../utils/configGetters';

export class Validate extends AuthenticatedCommand {
	static description = 'Validate the config and schema of all local templates';

	async run(): Promise<void> {
		const root: string = getRoot();
		const brandFolders: string[] = await getDirectories(path.join(root, 'src'));
		const brands: string[] = brandFolders.filter((folder: string) => folder[0] !== '.');

		for (let brandIndex in brands) {
			if (!brands.hasOwnProperty(brandIndex)) {
				continue;
			}

			const brand: string = brands[brandIndex];
			const visualFolders: string[] = await getDirectories(path.join(root, 'src', brand));
			const visuals: string[] = visualFolders.filter((folder: string) => folder[0] !== '.');

			for (let visualIndex in visuals) {
				if (!visuals.hasOwnProperty(visualIndex)) {
					continue;
				}

				const visual = visuals[visualIndex];
				const visualPath = path.join(root, 'src', brand, visual);

				await this.validate(visualPath, brand, visual);
			}
		}

		console.log(chalk.green('Done.'));
	}

	async validate(visualPath: string, brand: string, visual: string) {
		const configPath = path.join(visualPath, 'config.json');

		if (fs.existsSync(configPath)) {
			console.log(`Checking config of ${brand}/${visual}`);
			await checkConfig(configPath)
		}

		const schemaPath = path.join(visualPath, 'schema.json');

		if (fs.existsSync(schemaPath)) {
			console.log(`Checking schema of ${brand}/${visual}`);

			const state = {};

			await checkSchema(schemaPath, state);
		}
	}
}
