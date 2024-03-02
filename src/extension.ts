import * as vscode from 'vscode'
import { LanguageProcessor, YAIProcessor } from './languages/processor'

let processor: LanguageProcessor

export function activate(context: vscode.ExtensionContext) {
	const indexRegister = vscode.commands.registerCommand('yai.index', async () => {
		processor.index()
	})
	const importRegister = vscode.commands.registerCommand('yai.import', async () => {
		if (vscode.window.activeTextEditor && processor.getLanguageIDs().includes(vscode.window.activeTextEditor.document.languageId)) {
			processor.import()
		} else {
			vscode.window.showInformationMessage('No active editor!')
		}
	})
	processor = new YAIProcessor(context)
	context.subscriptions.push(importRegister, indexRegister)
	vscode.commands.executeCommand("yai.index")
}

// this method is called when your extension is deactivated
export function deactivate() { }
