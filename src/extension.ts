import * as vscode from 'vscode'
import { ecmascriptHandler, NodeDependenciesProvider } from './languages/ecmascrypt'
import { golangHandler, indexGoModule } from './languages/golang';

const languageMapping: Record<string, string> = {
	javascript: 'ecmascript',
	typescript: 'ecmascript',
	javascriptreact: 'ecmascript',
	typescriptreact: 'ecmascript',
	go: 'go',
}

export function activate(context: vscode.ExtensionContext) {
	const indexRegister = vscode.commands.registerCommand('yai.index', async () => {
		if (vscode.window.activeTextEditor) {
			const goModFile = await vscode.workspace.findFiles('**/go.mod')
			if (goModFile.length > 0) {
				indexGoModule(context, vscode.workspace.workspaceFolders![0])
			}
		}
	})
	const importRegister = vscode.commands.registerCommand('yai.import', async () => {
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
			} else if (languageMapping[document.languageId] === 'go') {
				golangHandler(context, ws, document)
			}
		} else {
			vscode.window.showInformationMessage('No active editor!')
		}
	})

	context.subscriptions.push(importRegister, indexRegister)

	vscode.commands.executeCommand("yai.index")
}

// this method is called when your extension is deactivated
export function deactivate() { }
