import fs from 'fs-extra';
import glob from 'glob';
import chalk from 'chalk';
import which from 'which';
import Listr from 'listr';
import { Flags } from '@oclif/core';
import { fromPath } from 'pdf2pic';

import BaseCommand from '../base-command';
import selectVisual from '../utils/select-visual';
import { getRoot } from '../utils/config-getters';

export class ConvertPdf extends BaseCommand {
	static description = 'Convert pdf to jpg'

	static flags = {
		debug: Flags.boolean({ char: 'd', description: 'Debug mode', required: false, default: false }),
	}

	async run(): Promise<void> {
		const { flags } = await this.parse(ConvertPdf);
		const { debug } = flags;

		try {
			const resolvedGmPath = await which('gm');

			if (debug) {
				console.log(chalk.blue(`Using binary for gm: ${resolvedGmPath}`));
			}
		} catch (error) {
			console.error(error);

			const message = 'GraphicsMagick (gm) is not installed! https://github.com/yakovmeister/pdf2image/blob/HEAD/docs/gm-installation.md';

			console.error(chalk.red(message));
			throw new Error(message);
		}

		try {
			const resolvedGsPath = await which('gs');

			if (debug) {
				console.log(chalk.blue(`Using binary for gs: ${resolvedGsPath}`));
			}
		} catch (error) {
			console.error(error);

			const message = 'GhostScript (gs) is not installed! https://github.com/yakovmeister/pdf2image/blob/HEAD/docs/gm-installation.md';

			console.error(chalk.red(message));
			throw new Error(message);
		}

		const visualPath = await selectVisual();

		const root = getRoot();
		const pdfs = glob.sync(`${root}/src/${visualPath}/[!_][0-9]*/*.pdf`);

		console.log(chalk.blue(`Converting ${pdfs.length} pdfs`));

		const tasks: any[] = [];

		for (const pdf of pdfs) {
			tasks.push({
				title: `Converting ${pdf}`,
				task: async () => this.convertPdf(pdf, root, visualPath),
			});
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

	async convertPdf(pdf: string, root: string, visualPath: string) {
		const fileName = pdf.toString().replace(`${root}/src/${visualPath}/`, '');

		const parts1 = fileName.split('mm'); // @variant
		const parts3 = parts1[1].split('/');
		const filenameWithExtension = parts3[1];
		const parts2 = parts1[0].split('x').map((value: string) => Number.parseInt(value, 10));

		const filename = filenameWithExtension.replace('.pdf', '');
		const width = parts2[0];
		const height = parts2[1];

		const dpi = 300;
		const pixelWidth = Math.round(width * dpi / 25.4);
		const pixelHeight = Math.round(height * dpi / 25.4);

		const savePath = `${root}/src/${visualPath}/${width}x${height}mm${parts3[0]}`;

		const pdf2picOptions = {
			density: dpi,
			savePath,
			saveFilename: filename,
			format: 'jpg',
			width: pixelWidth,
			height: pixelHeight,
		};

		// generate convert command by pdf2pic
		const convert = await fromPath(`${savePath}/${filename}.pdf`, pdf2picOptions);
		// actually convert pdf to image
		await convert(1);

		await fs.promises.rename(`${savePath}/${filename}.1.jpg`, `${savePath}/${filename}.jpg`);
	}
}
