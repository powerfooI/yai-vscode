# Change Log

## 0.0.1

### Golang

* Support for Indexing go.mod, standard libs and local packages imports
* Support for importing modules with quick pick and quick input
* Ranked aliases of go modules by count of usage

## 0.0.2

### Golang

* Added configuration group "Yet Another Importer" for excluding paths from indexing
* Parsed go.mod to get module info and indexed all local sub packages in the workspace

### Others

* Set a extension icon :)
* Added nyc dependency for code coverage

## 0.0.3

### Golang

* Added support for repeating previous import. Now you can import the same module with the same alias as before through command `YAI: Repeat Previous Import`.
* Shortened the input process by skipping the custom input step and alias selection (when there is only one alias).

### Others 

* Added configuration item to enable/disable `verbose` mode of the extension. Default is `false`, which deduct the extension from showing info messages.
* Added configuration item to enable/disable `custom input` of the extension. Default is `false`, which shorten the input process by skipping the custom input step. (For example in golang, it does not ask for sub package and any other custom input.) The extension will always use the indexed information.