import fs from 'fs-extra';
import { join } from 'node:path';

export default function getFill(schemaPath: string) {
	const packageJson = JSON.parse(fs.readFileSync(join(__dirname, '../../', 'package.json'), 'utf8'));
	let schema: any = null;
	const demoInputs: any = {};

	if (fs.existsSync(schemaPath)) {
		try {
			const schemaContents = fs.readFileSync(schemaPath, 'utf8');
			schema = JSON.parse(schemaContents);

			for (const slotKey in schema) {
				if (!schema.hasOwnProperty(slotKey)) {
					continue;
				}

				if (schema[slotKey].type === 'array') {
					demoInputs[slotKey] = [];

					const getSubDemoInputs = (i: number) => {
						const subDemoInputs: any = {};
						for (const subSlotKey in schema[slotKey].schema) {
							if (!schema[slotKey].schema.hasOwnProperty(subSlotKey)) {
								continue;
							}

							const { value } = schema[slotKey].schema[subSlotKey];

							if (Array.isArray(value)) {
								subDemoInputs[subSlotKey] = i >= 0 ? value[i % value.length] : value[Math.floor(Math.random() * value.length)];
							} else {
								subDemoInputs[subSlotKey] = value;
							}
						}

						return subDemoInputs;
					};

					const getDemoInputsCount = () => {
						for (const subSlotKey in schema[slotKey].schema) {
							if (!schema[slotKey].schema.hasOwnProperty(subSlotKey)) {
								continue;
							}

							const { value } = schema[slotKey].schema[subSlotKey];
							if (Array.isArray(value)) {
								return value.length;
							}
						}

						return -1;
					};

					let min = Number.parseInt(schema[slotKey].min);
					let max = Number.parseInt(schema[slotKey].max);
					let count = Number.parseInt(schema[slotKey].count);

					if (min < 0) {
						min = 0;
					}

					if (min > 1000) {
						min = 1000;
					}

					if (max < 0) {
						max = 0;
					}

					if (max > 1000) {
						max = 1000;
					}

					if (count < 0) {
						count = 0;
					}

					if (count > 1000) {
						count = 1000;
					}

					if (max < min) {
						max = min;
					}

					const demoInputsCount = getDemoInputsCount();
					if (demoInputsCount !== -1) {
						min = 1;
						max = demoInputsCount;
					}

					if (min && max) {
						for (let i = min; i <= max; i++) {
							demoInputs[slotKey].push(getSubDemoInputs(i - 1));
						}
					} else if (schema[slotKey].count) {
						for (let i = 1; i <= count; i++) {
							demoInputs[slotKey].push(getSubDemoInputs(i - 1));
						}
					}
				} else if (schema[slotKey].value === undefined) {
					demoInputs[slotKey] = null;
				} else {
					const { value } = schema[slotKey];
					if (Array.isArray(value)) {
						demoInputs[slotKey] = value[0];
						// demoInputs[slotKey] = value[Math.floor(Math.random() * value.length)];
					} else {
						demoInputs[slotKey] = value;
					}
				}
			}
		} catch (error) {
			console.error(error);
		}
	}

	console.log('Demo inputs are', demoInputs);
	const demoInputsJson = JSON.stringify(demoInputs);

	return `<script>
		window.EXIT = function (url) {
			url = url ? url : window.clickTag;
			console.log(
				\`%c ↪️ Called EXIT with value: \${url} %c\`,
				'background: #ff8c00; padding: 1px; border-radius: 3px; color: #fff',
				'background: transparent'
			);
		};

		window.IMAGELANCE_CLI_VERSION = '${packageJson.version}';

		window.INPUTS = JSON.parse('${demoInputsJson}');

		// FILL() is called within VisualHelper
	</script>`;
}
