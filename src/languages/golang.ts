import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path';
import { Dependency } from './dependency';
import { pathExists } from './utils';

const GO_MODULE_KEY = "YAI_GO_MODULE_KEY"

export async function golangHandler(context: vscode.ExtensionContext, ws: vscode.WorkspaceFolder, document: vscode.TextDocument) {
  let modules: string[] | undefined = context.workspaceState.get(GO_MODULE_KEY)

  if (!modules || modules.length === 0) {
    const readModules = getDepsFromGoMod(path.join(ws.uri.path, 'go.mod')).map(dep => dep.label)
    context.workspaceState.update(GO_MODULE_KEY, readModules)
    modules = readModules
  }

  if (modules.length === 0) {
    vscode.window.showErrorMessage('No module found in go.mod')
    return
  }
  const module = await vscode.window.showQuickPick(modules as string[], {
    placeHolder: 'Pick the base module, please.',
    title: 'Module'
  })
  if (!module) {
    return
  }
  
  const edit = new vscode.WorkspaceEdit()
  const alias = await vscode.window.showInputBox({ title: 'Input the alias of the importing package, original name by default' })
  // 1. not exist, insert directly; no import statement
  // 2. exist, compare the alias; from import 'xxx' to import ( ... )
  // 2.1 same, do nothing
  // 2.2 different, replace the alias or throw an error
  // TODO: implement the edit logic
}

function getDepsFromGoMod(goModPath: string): Dependency[] {
  if (!pathExists(goModPath)) {
    return []
  }
  const content = fs.readFileSync(goModPath, 'utf-8')
  const pattern = /require\s+\(([\s\S]+?)\)/g
  const matches = content.match(pattern)
  if (!matches) {
    return []
  }

  const deps: Dependency[] = []
  for (const match of matches) {
    const lines = match.split('\n').slice(1, -1).map((line) => line.trim())
    lines.forEach((line) => {
      const words = line.split(' ')
      deps.push(new Dependency(words[0], words[1], vscode.TreeItemCollapsibleState.None))
    })
  }
  console.log('deps', deps)

  return deps
}