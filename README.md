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

### Development stack for Imagelance templates

[![npm](https://img.shields.io/npm/v/imagelance-cli.svg)](https://www.npmjs.com/package/imagelance-cli)

# Installation

<!-- installation -->

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

- Create proper directory structure `$ lance install`
- Login to your accounts `$ lance login`
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
imagelance-cli/2.2.2 darwin-arm64 node-v16.11.1
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
* [`lance help [COMMAND]`](#lance-help-command)
* [`lance install`](#lance-install)
* [`lance login`](#lance-login)
* [`lance pull`](#lance-pull)
* [`lance push`](#lance-push)
* [`lance status`](#lance-status)
* [`lance sync`](#lance-sync)
* [`lance update [CHANNEL]`](#lance-update-channel)
* [`lance validate`](#lance-validate)

## `lance autocomplete [SHELL]`

display autocomplete installation instructions

```
USAGE
  $ lance autocomplete [SHELL] [-r]

ARGUMENTS
  SHELL  shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  display autocomplete installation instructions

EXAMPLES
  $ lance autocomplete

  $ lance autocomplete bash

  $ lance autocomplete zsh

  $ lance autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v1.3.0/src/commands/autocomplete/index.ts)_

## `lance clone REPONAME`

Clone existing template

```
USAGE
  $ lance clone [REPONAME] [-d]

FLAGS
  -d, --debug  Debug mode

DESCRIPTION
  Clone existing template
```

_See code: [dist/commands/clone.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/clone.ts)_

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

_See code: [dist/commands/convert-pdf.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/convert-pdf.ts)_

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

_See code: [dist/commands/create.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/create.ts)_

## `lance dev`

Run development server to create templates

```
USAGE
  $ lance dev [-d] [-l] [-n] [-a]

FLAGS
  -a, --latest  Start dev with latest edited template
  -d, --debug   Debug mode
  -l, --local   Against local apis
  -n, --newest  Start dev with newly created template

DESCRIPTION
  Run development server to create templates
```

_See code: [dist/commands/dev.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/dev.ts)_

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

_See code: [dist/commands/fetch.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/fetch.ts)_

## `lance help [COMMAND]`

Display help for lance.

```
USAGE
  $ lance help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for lance.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.12/src/commands/help.ts)_

## `lance install`

Set home directory for templates and prepare dev environment

```
USAGE
  $ lance install

DESCRIPTION
  Set home directory for templates and prepare dev environment
```

_See code: [dist/commands/install.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/install.ts)_

## `lance login`

Authorize CLI against web application

```
USAGE
  $ lance login [-d] [-l]

FLAGS
  -d, --debug  Debug mode
  -l, --local  Local

DESCRIPTION
  Authorize CLI against web application
```

_See code: [dist/commands/login.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/login.ts)_

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

_See code: [dist/commands/pull.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/pull.ts)_

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

_See code: [dist/commands/push.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/push.ts)_

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

_See code: [dist/commands/status.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/status.ts)_

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

_See code: [dist/commands/sync.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/sync.ts)_

## `lance update [CHANNEL]`

update the lance CLI

```
USAGE
  $ lance update [CHANNEL] [-a] [-v <value> | -i] [--force]

FLAGS
  -a, --available        Install a specific version.
  -i, --interactive      Interactively select version to install. This is ignored if a channel is provided.
  -v, --version=<value>  Install a specific version.
  --force                Force a re-download of the requested version.

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

_See code: [@oclif/plugin-update](https://github.com/oclif/plugin-update/blob/v3.0.0/src/commands/update.ts)_

## `lance validate`

Validate the config and schema of all local templates

```
USAGE
  $ lance validate

DESCRIPTION
  Validate the config and schema of all local templates
```

_See code: [dist/commands/validate.ts](https://github.com/imagelance/cli/blob/v2.2.2/dist/commands/validate.ts)_
<!-- commandsstop -->
