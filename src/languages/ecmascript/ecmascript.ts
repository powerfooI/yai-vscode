import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path';
import { Dependency } from './dependency';
import { pathExists } from '../utils';

const MODULE_KEY = 'YAI_NODE_MODULE_KEY'

/** Handle ecmascript-like languages */
export async function ecmascriptHandler(context: vscode.ExtensionContext, ws: vscode.WorkspaceFolder, document: vscode.TextDocument) {
  let modules: string[] | undefined = context.workspaceState.get(MODULE_KEY)
  console.log('cached modules', modules)

  if (!modules || modules.length === 0) {
    const readModules = getDepsInPackageJson(ws.uri.path, path.join(ws.uri.path, 'package.json')).map(dep => dep.label)
    context.workspaceState.update(MODULE_KEY, readModules)
    modules = readModules
  }
  if (modules.length === 0) {
    vscode.window.showErrorMessage('No module found in package.json')
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
  const items = await vscode.window.showInputBox({ title: 'Input the name to import it, all by default' })

  const moduleImportSection = `from '${module}'`
  if (document.getText().includes(moduleImportSection) && items) {
  	const lines = document.getText().split('\n').map((l) => l.trim())
  	for (let i = 0; i < lines.length; ++i) {
  		if (lines[i].includes(moduleImportSection)) {
        const splittedItems = items.split(',').map((i) => i.trim())
        if (!lines[i].includes('import *')) {
          const lineStart = new vscode.Position(i, 0)
          const lineEnd = lineStart.translate(1, 0)
          const pattern = /import \{(.*)\} from/
          const match = lines[i].match(pattern)
          console.log(match, lines[i])
          if (match && match.length > 1) {
            // Existing statement is like `import { a, b, c } from 'module'`
            const importedItems = match[1].split(',').map((i) => i.trim())
            for (const item of splittedItems) {
              if (!importedItems.includes(item)) {
                importedItems.push(item)
              }
            }
            const instStatement = `import { ${importedItems.join(', ')} } from '${module}'\n`
            edit.replace(document.uri, new vscode.Range(lineStart, lineEnd), instStatement)
          } else {
            // Existing statement is NOT like `import { a, b, c } from 'module'`.
            // Then what should it be?
            const instModules: string[] = []
            for (const item of splittedItems) {
              if (!lines[i].includes(item)) {
                instModules.push(item)
              }
            }
            const instStatement = `import { ${instModules.join(', ')} } from '${module}'\n`
            edit.replace(document.uri, new vscode.Range(lineStart, lineEnd), instStatement)
          }
        }
  			break
  		}
  	}
  } else {
  	edit.insert(document.uri, new vscode.Position(0, 0), `import * as ${module} from '${module}'\n`)
  }

  const ok = await vscode.workspace.applyEdit(edit)
  if (ok) {
    vscode.window.showInformationMessage('Insert successfully!')
    // vscode.commands.executeCommand('editor.action.formatDocument')
  } else {
    vscode.window.showErrorMessage('Fail to insert importing sentence')
  }
}

/**
 * Given the path to package.json, read all its dependencies and devDependencies.
 */
function getDepsInPackageJson(wsRoot: string, packageJsonPath: string): Dependency[] {
  if (pathExists(packageJsonPath)) {
    console.log('packageJsonPath exists', packageJsonPath)
    const toDep = (moduleName: string, version: string): Dependency => {
      if (pathExists(path.join(wsRoot, 'node_modules', moduleName))) {
        return new Dependency(
          moduleName,
          version,
          vscode.TreeItemCollapsibleState.Collapsed
        );
      } else {
        return new Dependency(moduleName, version, vscode.TreeItemCollapsibleState.None);
      }
    };

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const deps = packageJson.dependencies
      ? Object.keys(packageJson.dependencies).map(dep =>
        toDep(dep, packageJson.dependencies[dep])
      )
      : [];
    const devDeps = packageJson.devDependencies
      ? Object.keys(packageJson.devDependencies).map(dep =>
        toDep(dep, packageJson.devDependencies[dep])
      )
      : [];
    return deps.concat(devDeps);
  } else {
    return [];
  }
}



export class NodeDependenciesProvider implements vscode.TreeDataProvider<Dependency> {
  constructor(private workspaceRoot: string) { }

  getTreeItem(element: Dependency): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Dependency): Thenable<Dependency[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No dependency in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      return Promise.resolve(
        getDepsInPackageJson(
          this.workspaceRoot,
          path.join(this.workspaceRoot, 'node_modules', element.label, 'package.json')
        )
      );
    } else {
      const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
      if (pathExists(packageJsonPath)) {
        return Promise.resolve(getDepsInPackageJson(this.workspaceRoot, packageJsonPath));
      } else {
        vscode.window.showInformationMessage('Workspace has no package.json');
        return Promise.resolve([]);
      }
    }
  }

}