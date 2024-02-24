import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path';
import { Dependency } from './dependency';

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
  let insertStr = ''
  const items = await vscode.window.showInputBox({ title: 'Input the name to import it' })
  if (!items) {
    insertStr = `import * as ${module} from '${module}'\n`
  } else {
    insertStr = `import ${items} from '${module}'\n`
  }
  // TODO: handle duplicated package import

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

// Judge whether a path exists
function pathExists(p: string): boolean {
  try {
    fs.accessSync(p);
  } catch (err) {
    return false;
  }
  return true;
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