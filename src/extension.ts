import * as vscode from 'vscode'
import { ecmascriptHandler, NodeDependenciesProvider } from './languages/ecmascrypt'

const languageMapping: Record<string, string> = {
	javascript: 'ecmascript',
	typescript: 'ecmascript',
	javascriptreact: 'ecmascript',
	typescriptreact: 'ecmascript'
}

export function activate(context: vscode.ExtensionContext) {
	// Register dependency view
  const rootPath =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : undefined;
  const nodeDependenciesProvider = new NodeDependenciesProvider(rootPath!);
  vscode.window.registerTreeDataProvider('yaiDependencies', nodeDependenciesProvider);

	const disposable = vscode.commands.registerCommand('yai.import', async () => {
		if (vscode.window.activeTextEditor) {
			const { document } = vscode.window.activeTextEditor
			const ws = vscode.workspace.getWorkspaceFolder(document.uri)
			if (!ws) {
				return
			}
			if (!languageMapping[document.languageId]) {
				vscode.window.showInformationMessage(`Sorry, YAI does not support ${document.languageId} yet.`)
			} else if (languageMapping[document.languageId] === 'ecmascript') {
				ecmascriptHandler(context, ws, document)
			}
		} else {
			vscode.window.showInformationMessage('No active editor!')
		}
	})

	context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate() { }
