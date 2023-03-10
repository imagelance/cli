import path from 'node:path';
import inquirer from 'inquirer';
import chalk from 'chalk';

import { getRoot } from './config-getters';
import getDirectories from './get-directories';

export default async function selectVisual() {
	const root: string = getRoot();

	const brandFolders = await getDirectories(path.join(root, 'src'));
	const brands = brandFolders.filter(folder => {
		return folder[0] !== '.';
	});

	if (brands.length === 0) {
		console.error(chalk.red('No brands'));
		throw new Error('No brands');
	}

	let selectedBrand: string | null = null;

	if (brands.length === 1) {
		selectedBrand = brands[0];
	} else {
		const brandChoices = {
			type: 'search-list',
			name: 'selectedBrand',
			message: 'Select brand',
			choices: brands.map(brandPath => brandPath.toString()
				.replace(`${root}/src/`, '')
				.replace('/brand.json', '')),
		};

		const brandAnswers = await inquirer.prompt([brandChoices]);
		selectedBrand = brandAnswers.selectedBrand;

		console.log(selectedBrand);
	}

	if (!selectedBrand) {
		console.log(chalk.red('No brand selected'));
		throw new Error('No brand selected');
	}

	// Visual

	const visualFolders = await getDirectories(path.join(root, 'src', selectedBrand));
	const visuals = visualFolders.filter(folder => {
		return folder[0] !== '.';
	});

	if (visuals.length === 0) {
		console.error(chalk.red('No templates'));
		process.exit(1);
	}

	visuals.reverse();

	const visualsChoices = {
		type: 'search-list',
		name: 'first',
		message: 'Select template',
		choices: visuals.map(visualPath => visualPath
			.toString()
			.replace(`${root}/src/${selectedBrand}/`, '')
			.replace('/', ''),
		),
	};

	const visualAnswers = await inquirer.prompt([visualsChoices]);
	const selectedVisual = visualAnswers.first;

	return `${selectedBrand}/${selectedVisual}`;
}
