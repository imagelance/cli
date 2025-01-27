# Release

## 1. Install `oclif` cli if not yet installed
```bash
npm install -g oclif
```

## 2. Bump version and regenerate `README.md`

```bash
yarn build
yarn version
git push origin main --tags
npm publish
```

## 3. Create release files and upload them to S3

!! Copy `.env.example` to `.env`. Fill out `.env` variables, you can find them shared in SharePoint. (Imagelance/Devel/Přístupy/imagelance-cli-s3-access-tokens) !!

```bash
oclif pack tarballs
yarn upload tarballs
oclif pack macos
yarn upload macos
oclif pack win
yarn upload win
```

## 4. Publish new release on S3

You can find the `sha` variable for release in the first 7 characters of the commit hash for instance (c06ad11)8, or you
can copy it from the generated file names.

The `version` variable is the version, you want to release. You need to separately release each platform, without
specific flag it's the tarballs, `--macos` is releasing mac version to the stable channel, `--win` is windows.

```bash
yarn promote --version={version} --sha={sha}
yarn promote --version={version} --sha={sha} --macos
yarn promote --version={version} --sha={sha} --win
```
## 5. Done!
