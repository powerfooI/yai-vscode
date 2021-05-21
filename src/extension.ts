import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
	console.log('Hello from Yai')
	const disposable = vscode.commands.registerCommand('yai.helloWorld', async () => {

		if (vscode.window.activeTextEditor) {
			const module = await vscode.window.showInputBox({
				title: 'Input the name of the Module'
			})
			const items = await vscode.window.showInputBox({ title: 'Input the importing things' })
			const insertStr = `import ${items} from '${module}'\n`

			const { document } = vscode.window.activeTextEditor
			const edit = new vscode.WorkspaceEdit()
			edit.insert(document.uri, new vscode.Position(0, 0), insertStr)
			const ok = await vscode.workspace.applyEdit(edit)
			if (ok) {
				vscode.window.showInformationMessage('Insert successfully!')
				vscode.commands.executeCommand('editor.action.formatDocument')
			} else {
				vscode.window.showErrorMessage('Fail to insert sentences')
			}
		} else {
			vscode.window.showInformationMessage('No Active editor!')
		}
	})

	context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate() { }
