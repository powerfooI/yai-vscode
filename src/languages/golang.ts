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

  const singleImportPattern = /import (.*"\S+")/g
  const multiImportPattern = /import \([\s\S]+?\)/g
  const packagePattern = /package (\S+)/g

  const docText = document.getText().replace(/\/\/.+/g, '//')
  const lines = docText.split('\n').map((l) => l.trim())

  const packageMatch = docText.match(packagePattern)
  const singleImportMatch = docText.match(singleImportPattern)
  const multiImportMatch = docText.match(multiImportPattern)

  if (!packageMatch) {
    vscode.window.showErrorMessage('No package statement found in the file')
    return
  }

  let packageLineNo = 0       // line no of package xxx
  let importLineNo = 0        // line no of import [alias] "mode"
  let importStartLineNo = 0   // line no of import (
  let importEndLineNo = 0     // line no of ), pairing with importStartLineNo

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(packagePattern)) {
      packageLineNo = i
      break
    }
  }
  const insertPart = alias ? `${alias} "${module}"` : `"${module}"`

  if (!singleImportMatch && !multiImportMatch) {
    /**
     * No import statement
     */
    edit.insert(document.uri, new vscode.Position(packageLineNo + 1, 0), `\nimport ${insertPart}\n`)
  } else if (singleImportMatch) {
    /**
     * Single import statement like,
     * import "fmt"
     * import f "fmt"
     */
    const targetModIndex = singleImportMatch[0].indexOf(`"${module}"`)
    if (targetModIndex < 0) {
      // no target module
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(singleImportPattern)) {
          importLineNo = i
          break
        }
      }
      const instStatement = `import (\n\t${singleImportMatch[0].replace('import ', '')}\n\t${insertPart}\n)`
      edit.replace(document.uri, new vscode.Range(new vscode.Position(importLineNo, 0), new vscode.Position(importLineNo + 1, 0)), instStatement)
    } else {
      vscode.window.showInformationMessage('The module has been imported')
    }
  } else if (multiImportMatch) {
    /**
     * Multiple import statement like,
     * import (
     *    "fmt"
     *   o "os"
     * )
     */
    const targetModIndex = multiImportMatch[0].indexOf(`"${module}"`)
    if (targetModIndex < 0) {
      // no target module
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("import (")) {
          importStartLineNo = i
        }
        if (lines[i].includes(")")) {
          importEndLineNo = i
          break
        }
      }

      const instStatement = `\t${insertPart}\n`
      console.log(importStartLineNo, importEndLineNo, instStatement)
      edit.insert(document.uri, new vscode.Position(importStartLineNo + 1, 0), instStatement)
    } else {
      vscode.window.showInformationMessage('The module has been imported')
    }
  }

  const ok = await vscode.workspace.applyEdit(edit)
  if (ok) {
    vscode.window.showInformationMessage('Import successfully!')
  } else {
    vscode.window.showErrorMessage('Fail to import the module')
  }
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