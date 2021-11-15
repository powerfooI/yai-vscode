import * as vscode from 'vscode'
import { ecmascriptHandler } from './languages/ecmascrypt'

const languageMapping: Record<string, string> = {
	javascript: 'ecmascript',
	typescript: 'ecmascript',
	javascriptreact: 'ecmascript',
	typescriptreact: 'ecmascript'
}

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('yai.helloWorld', async () => {
		if (vscode.window.activeTextEditor) {
			const { document } = vscode.window.activeTextEditor
			const ws = vscode.workspace.getWorkspaceFolder(document.uri)
			if (!ws) {
				return
			}
			if (!languageMapping[document.languageId]) {
				vscode.window.showInformationMessage(`Sorry, YAI does not support ${document.languageId} yet.`)
			} else if (languageMapping[document.languageId] === 'ecmascript') {
				// ecmascript-like 语言处理器
				ecmascriptHandler(context, ws, document)
			}
		} else {
			vscode.window.showInformationMessage('No Active editor!')
		}
	})

	context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate() { }
