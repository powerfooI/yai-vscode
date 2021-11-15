import * as vscode from 'vscode'

const MODULE_KEY = 'YAI_NODE_MODULE_KEY'

/** 类似 ecmascript 语言的处理 */
export async function ecmascriptHandler(context: vscode.ExtensionContext, ws: vscode.WorkspaceFolder, document: vscode.TextDocument) {
  let modules = context.workspaceState.get(MODULE_KEY)
  console.log('cached modules', modules)
  const nodeModulesURI = ws.uri.with({ path: ws.uri.path + '/node_modules' })
  if (!modules) {
    const readModules = (await vscode.workspace.fs.readDirectory(nodeModulesURI)).filter((m) => !/^[\_\@\.]/.test(m[0]) && m[1] === 2).map((m) => m[0])
    context.workspaceState.update(MODULE_KEY, readModules)
    modules = readModules
  }

  const module = await vscode.window.showQuickPick(modules as string[], {
    placeHolder: 'Pick the base module, please.',
    title: 'Module'
  })
  if (!module) {
    return
  }

  const items = await vscode.window.showInputBox({ title: 'Input the name to import it' })
  if (!items) {
    return
  }
  const edit = new vscode.WorkspaceEdit()
  const insertStr = `import ${items} from '${module}'\n`
  // const moduleImportSection = `from '${module}'`

  // if (document.getText().includes(moduleImportSection)) {
  // 	const lines = document.getText().split('\n').map((l) => l.trim())
  // 	for (let i = 0; i < lines.length; ++i) {
  // 		if (lines[i].includes(moduleImportSection)) {
  // 			const lineStart = new vscode.Position(i, 0)
  // 			const lineEnd = lineStart.translate(1, 0)
  // 			edit.replace(document.uri, new vscode.Range(lineStart, lineEnd), insertStr)
  // 			break
  // 		}
  // 	}
  // } else {
  // 	edit.insert(document.uri, new vscode.Position(0, 0), insertStr)
  // }

  edit.insert(document.uri, new vscode.Position(0, 0), insertStr)

  const ok = await vscode.workspace.applyEdit(edit)
  if (ok) {
    vscode.window.showInformationMessage('Insert successfully!')
    vscode.commands.executeCommand('editor.action.formatDocument')
  } else {
    vscode.window.showErrorMessage('Fail to insert importing sentence')
  }
}