# Release

## Bump version and regenerate `README.md`

---

1. `yarn verion`
2. bump version in yarn
3. push new commit with tags
4. `npm publish`

## Create release files and upload them to S3

---

Copy `.env.example` to `.env`. Fill out `.env` variables, you can find them shared in SharePoint.

1. `oclif pack tarballs`
2. `yarn upload tarballs`
3. `oclif pack macos`
4. `yarn upload macos`
5. `oclif pack win`
6. `yarn upload win`

## Move uploaded files to a stable channel

---

You can find the `sha` variable in the generated file names, or it's the last 7 characters of the version commit hash.
The `version` variable is the version, you want to release, ideally the same version you entered during the first step
of the release process. You need to separately promote each version, without specific flag it's the tarballs, `--macos`
is promoting mac version to the stable channel, `--win` is windows.

1. `yarn promote --version={version} --sha={sha}`
2. `yarn promote --version={version} --sha={sha} --macos`
3. `yarn promote --version={version} --sha={sha} --win` 

## Done!
