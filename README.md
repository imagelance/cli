```text
  _____                            _                                  _____ _      _____ 
 |_   _|                          | |                                / ____| |    |_   _|
   | |  _ __ ___   __ _  __ _  ___| | __ _ _ __   ___ ___   ______  | |    | |      | |  
   | | | '_ ` _ \ / _` |/ _` |/ _ \ |/ _` | '_ \ / __/ _ \ |______| | |    | |      | |  
  _| |_| | | | | | (_| | (_| |  __/ | (_| | | | | (_|  __/          | |____| |____ _| |_ 
 |_____|_| |_| |_|\__,_|\__, |\___|_|\__,_|_| |_|\___\___|           \_____|______|_____|
                         __/ |                                                           
                        |___/                                                            
```

### Development tool for Imagelance templates

[![npm](https://img.shields.io/npm/v/imagelance-cli.svg)](https://www.npmjs.com/package/imagelance-cli)

<!-- installation -->

# Installation

We have 3 separate ways of installing the Imagelance CLI tool. Please select whichever you like.

**1. Install with an Installer**

- [macOS](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-x64.pkg)
- [macOS (Apple silicon)](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-arm64.pkg)
- [Windows (x64)](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-x64.exe)
- [Windows (x86)](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-x86.exe)

**2. Standalone installation with a Tarball**

The standalone installation is a simple tarball with a binary. It contains its own node.js binary and autoupdates.

- [macOS](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-darwin-x64.tar.gz)
- [macOS (Apple silicon)](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-darwin-arm64.tar.gz)
- [Linux (x64)](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-linux-x64.tar.gz)
- [Linux (arm)](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-linux-arm.tar.gz)
- [Windows (x64)](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-win32-x64.tar.gz)
- [Windows (x86)](https://cli-dist.imagelance.com/channels%2Fstable%2Flance-win32-x86.tar.gz)

**3. Install with npm/yarn**

```shell
npm install -g imagelance-cli
```

or

```shell
yarn global add imagelance-cli
```

<!-- installation stop -->

# Getting started

<!-- getting started -->

- Log in to your account `$ lance login`
- Create directory structure `$ lance install`
- Sync templates `$ lance sync`

<!-- getting started stop -->

# List commands

<!-- list commands -->

```shell
$ lance help
```

<!-- list commands stop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g imagelance-cli
$ lance COMMAND
running command...
$ lance (--version)
imagelance-cli/3.0.4 darwin-arm64 node-v18.18.2
$ lance --help [COMMAND]
USAGE
  $ lance COMMAND
...
```
<!-- usagestop -->

<!-- commands -->
* [`lance autocomplete [SHELL]`](#lance-autocomplete-shell)
* [`lance clone REPONAME`](#lance-clone-reponame)
* [`lance convert-pdf`](#lance-convert-pdf)
* [`lance create`](#lance-create)
* [`lance dev`](#lance-dev)
* [`lance fetch`](#lance-fetch)
* [`lance help [COMMANDS]`](#lance-help-commands)
* [`lance install`](#lance-install)
* [`lance login`](#lance-login)
* [`lance pull`](#lance-pull)
* [`lance push`](#lance-push)
* [`lance status`](#lance-status)
* [`lance sync`](#lance-sync)
* [`lance update [CHANNEL]`](#lance-update-channel)
* [`lance validate`](#lance-validate)

## `lance autocomplete [SHELL]`

Display autocomplete installation instructions.

```
USAGE
  $ lance autocomplete [SHELL] [-r]

ARGUMENTS
  SHELL  (zsh|bash|powershell) Shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  Display autocomplete installation instructions.

EXAMPLES
  $ lance autocomplete

  $ lance autocomplete bash

  $ lance autocomplete zsh

  $ lance autocomplete powershell

  $ lance autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v3.0.4/src/commands/autocomplete/index.ts)_

## `lance clone REPONAME`

Clone existing template

```
USAGE
  $ lance clone REPONAME [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Clone existing template
```

_See code: [src/commands/clone.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/clone.ts)_

## `lance convert-pdf`

Convert pdf to jpg

```
USAGE
  $ lance convert-pdf [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Convert pdf to jpg
```

_See code: [src/commands/convert-pdf.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/convert-pdf.ts)_

## `lance create`

Creates new template

```
USAGE
  $ lance create [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Creates new template
```

_See code: [src/commands/create.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/create.ts)_

## `lance dev`

Run development server to create templates

```
USAGE
  $ lance dev [-d] [-l] [-n]

FLAGS
  -d, --debug   Debug mode
  -l, --latest  Start dev with latest edited template
  -n, --newest  Start dev with newly created template

DESCRIPTION
  Run development server to create templates
```

_See code: [src/commands/dev.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/dev.ts)_

## `lance fetch`

Fetch all local templates

```
USAGE
  $ lance fetch [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Fetch all local templates
```

_See code: [src/commands/fetch.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/fetch.ts)_

## `lance help [COMMANDS]`

Display help for lance.

```
USAGE
  $ lance help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for lance.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.9/src/commands/help.ts)_

## `lance install`

Set home directory for templates and prepare dev environment

```
USAGE
  $ lance install [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Set home directory for templates and prepare dev environment
```

_See code: [src/commands/install.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/install.ts)_

## `lance login`

Authorize CLI against web application

```
USAGE
  $ lance login [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Authorize CLI against web application
```

_See code: [src/commands/login.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/login.ts)_

## `lance pull`

Pull all local templates

```
USAGE
  $ lance pull [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Pull all local templates
```

_See code: [src/commands/pull.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/pull.ts)_

## `lance push`

Push all local templates

```
USAGE
  $ lance push [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Push all local templates
```

_See code: [src/commands/push.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/push.ts)_

## `lance status`

Git status of all local templates

```
USAGE
  $ lance status [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Git status of all local templates
```

_See code: [src/commands/status.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/status.ts)_

## `lance sync`

Download all synced templates

```
USAGE
  $ lance sync [-d] [-s]

FLAGS
  -d, --debug    Debug mode
  -s, --shallow  Perform shallow fetch

DESCRIPTION
  Download all synced templates
```

_See code: [src/commands/sync.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/sync.ts)_

## `lance update [CHANNEL]`

update the lance CLI

```
USAGE
  $ lance update [CHANNEL] [-a] [--force] [-i | -v <value>]

FLAGS
  -a, --available        See available versions.
  -i, --interactive      Interactively select version to install. This is ignored if a channel is provided.
  -v, --version=<value>  Install a specific version.
      --force            Force a re-download of the requested version.

DESCRIPTION
  update the lance CLI

EXAMPLES
  Update to the stable channel:

    $ lance update stable

  Update to a specific version:

    $ lance update --version 1.0.0

  Interactively select version:

    $ lance update --interactive

  See available versions:

    $ lance update --available
```

_See code: [@oclif/plugin-update](https://github.com/oclif/plugin-update/blob/v4.1.7/src/commands/update.ts)_

## `lance validate`

Validate the config and schema of all local templates

```
USAGE
  $ lance validate [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Validate the config and schema of all local templates
```

_See code: [src/commands/validate.ts](https://github.com/imagelance/imagelance-cli/blob/v3.0.4/src/commands/validate.ts)_
<!-- commandsstop -->
