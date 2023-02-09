import fs, {Dirent} from 'node:fs'

export default async function getDirectories(source: string) {
	const files = await fs.promises.readdir(source, {withFileTypes: true})

	return files
		.filter((directory: Dirent) => directory.isDirectory())
		.map((directory: Dirent) => directory.name)
}
