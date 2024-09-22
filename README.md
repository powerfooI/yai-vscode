# YAI - Yet Another Importer

Have you ever got tired of writing the same import statements over and over again? Scroll to the header of the file, add the import, scroll back to the place you were working on, and then repeat the process for every import you need? Well, I have. The official language extensions do not always import the module as expected correctly. And that's why I created this extension.

## Features

This extension allows you to add imports to your file without having to scroll to the top of the file and disrupting your flow. Just type the name of the module you want to import, and the extension will take care of the rest.

## How to use

1. Install the extension and activate it.
2. Open a workspace in supported languages.
3. Type `[CMD/Ctrl]+Shift+P` to open the command palette, and execute the command "YAI: Import module".
4. Type the name of the module you want to import and press enter, the following steps depend on the language you are using. In Golang, for example, the extension will ask you sub package and alias to use.

### Commands

- `YAI: Import module`: Import a module to the current file.
- `YAI: Repeat Previous Import`: Import the same module with the same alias as before.
- `YAI: Index modules`: Index all local modules in the workspace and generate prompts used in importing.

### Configurations

- `yai.indexExclude`: Exclude paths from indexing. Default is `["node_modules", "vendor", "tests", "__pycache__"]`, which excludes common paths that do not contain source code.
- `yai.verbose`: Enable/disable verbose mode of the extension. Default is `false`, which deduct the extension from showing info messages.
- `yai.customInput`: Enable/disable custom input of the extension. Default is `false`, which shorten the input process by skipping the custom input step. (For example in golang, it does not ask for sub package and any other custom input.) The extension will always use the indexed information.

## Roadmap

- [x] Golang
- [x] Python (For projects that take poetry as the package manager)
- [ ] Golang alias search
- [ ] ECMAScript
- [ ] C/C++
