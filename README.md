# YAI - Yet Another Importer

Have you ever got tired of writing the same import statements over and over again? Scroll to the header of the file, add the import, scroll back to the place you were working on, and then repeat the process for every import you need? Well, I have. The official language extensions do not always import the module as expected correctly. And that's why I created this extension.

## Features

This extension allows you to add imports to your file without having to scroll to the top of the file and disrupting your flow. Just type the name of the module you want to import, and the extension will take care of the rest.

## How to use

1. Install the extension and activate it.
2. Open a workspace in supported languages.
3. Type CMD+Shift+P to open the command palette, and execute the command "YAI: Import module".
4. Type the name of the module you want to import and press enter, the following steps depend on the language you are using. In Golang, for example, the extension will ask you sub package and alias to use.

## Supported languages

- [x] Golang
- [ ] ECMAScript (WIP)
- [ ] Python (In planning)
- [ ] C/C++ (In planning)
