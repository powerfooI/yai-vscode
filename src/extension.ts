import * as vscode from 'vscode'
import { RootHandler } from './languages/processor'

export function activate(context: vscode.ExtensionContext) {
	const processor = new RootHandler(context)
	context.subscriptions.push(...processor.disposables())
}

// this method is called when your extension is deactivated
export function deactivate() { }
