import * as vscode from 'vscode';
import { Yai } from "../types";
import { TextDecoder } from 'util';
import { exec } from 'child_process';

type PythonImport = {
  filePath: string
  from?: string
  module?: string
  imports: ImportElements[]
}

type ImportElements = {
  element: string
  alias?: string
}

type Dependency = {
  name: string
  version: string
}

const KEY_PYTHON_IMPORTS = "PYTHON_IMPORTS"
const KEY_PYTHON_DEPS = "PYTHON_DEPS"

export class PythonProcessor extends Yai {
  private dependencies: Dependency[] = []
  private previousImport: string | undefined
  private indexed: boolean = false
  private localImports: Map<string, PythonImport[]> = new Map()
  private indexPromise: Promise<void> | undefined
  private rootUri: vscode.Uri

  constructor(
    private readonly context: vscode.ExtensionContext,
  ) {
    super()
    this.rootUri = vscode.workspace.workspaceFolders![0].uri
    this.localImports = this.context.workspaceState.get(KEY_PYTHON_IMPORTS, new Map())
    this.dependencies = this.context.workspaceState.get(KEY_PYTHON_DEPS, [])
    if (this.dependencies.length === 0) {
      this.indexPromise = this.index()
    }
  }

  // PROBLEM: Why is the initial call of index() delayed?
  // It will be executed twice when the command is called manually for the first time.
  // FIX: Added an entry in activationEvents of package.json
  public async index() {
    if (this.indexPromise) {
      await this.indexPromise
    } else {
      console.log("Indexing python dependencies...")
      this.dependencies = await this.loadDependencies()
      this.dependencies.push(...(await this.loadLocalPackages()))

      this.context.workspaceState.update(KEY_PYTHON_DEPS, this.dependencies)
        .then(() => {
          this.indexed = true
        })
    }
    this.indexPromise = undefined
  }

  public async import() {
    if (!this.indexed) {
      vscode.window.showInformationMessage('Indexing dependencies...')
      if (!this.indexPromise) {
        this.indexPromise = this.index()
      }
      await this.indexPromise
    }
    const candidates: vscode.QuickPickItem[] = []

    this.dependencies.forEach((dependency) => {
      candidates.push({
        label: dependency.name,
        description: dependency.version,
      })
    })
    const selected = await vscode.window.showQuickPick([...candidates, {
      label: "From",
    }], {
      placeHolder: 'Select a dependency to import',
    })
    if (!selected) {
      return
    }
    if (selected?.label === "From") {
      // get active file uri
      const dirName = vscode.window.activeTextEditor?.document.uri.fsPath.split("/").slice(0, -1).join("/")!
      console.log("activeEditorPath", dirName, this.rootUri.path)

      if (dirName !== this.rootUri.path) {
        const packageName = dirName.split(this.rootUri.path).pop()!
          .replace(/\//g, '.') // replace all / with .
          .replace(/\.py$/, '') // remove .py
          .slice(1) // remove leading .
        const filtered = this.dependencies.filter(dep => dep.name.startsWith(packageName))
        // console.log("packageName", packageName)
        // console.log("filtered", filtered)

        filtered.forEach((dependency) => {
          if (dependency.name !== packageName) {
            candidates.push({
              label: dependency.name.split(packageName).pop()!,
              description: dependency.version,
            })
          }
        })
        if (candidates.length > 0) {
          candidates.push({
            label: ".",
          })
        }
      }
      const from = await vscode.window.showQuickPick(candidates, {
        placeHolder: 'Select a dependency to import from',
      })
      if (from) {
        const elements = await vscode.window.showInputBox({
          prompt: 'Enter the elements to import',
        })
        if (elements) {
          const elementsArray = elements.split(',').map(element => element.trim())
          this.doImportEdit(`from ${from.label} import ${elementsArray.join(', ')}`)
        }
      }
    } else {
      const alias = await vscode.window.showInputBox({
        prompt: 'Enter an alias for the import',
      })
      this.doImportEdit(`import ${selected.label}${alias ? ` as ${alias}` : ''}`)
    }
  }

  public async importPrevious() {
    if (this.previousImport) {
      this.doImportEdit(this.previousImport)
    } else {
      vscode.window.showInformationMessage('No previous import found!')
    }
  }

  /**
   * loadDependencies loads the python dependencies from the current workspace
   * takes use of pip freeze to get the dependencies
   * @returns the dependencies
   */
  private async loadDependencies(): Promise<Dependency[]> {
    return new Promise((resolve) => {
      exec('poetry run python -m pip freeze', {
        shell: '/bin/bash',
        cwd: vscode.workspace.workspaceFolders![0].uri.fsPath,
      },
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`Error: ${stderr}`);
            return;
          }
          const dependencies = stdout.split('\n').filter((line) => line.length > 0).map(line => {
            const [name, version] = line.split('==');
            return { name, version };
          });
          // console.log("dependencies", dependencies)
          resolve(dependencies);
        });
    });
  }

  /**
   * indexAllPythonFiles indexes all the python files in the current workspace
   * @param root the uri of root directory to index
   * @returns the python imports
   */
  private async indexAllPythonFiles(root?: vscode.Uri): Promise<PythonImport[]> {
    const pythonImports: PythonImport[] = []

    const rootUri = root || vscode.workspace.workspaceFolders![0].uri
    const pythonFiles = await vscode.workspace.fs.readDirectory(rootUri)

    for (const [fileName, fileType] of pythonFiles) {
      if (fileType === vscode.FileType.File && fileName.endsWith('.py')) {
        const fileUri = vscode.Uri.joinPath(rootUri, fileName)
        const content = await vscode.workspace.fs.readFile(fileUri)
        const contentString = new TextDecoder().decode(content)
        const fromImportRegex = /^from\s+([^\s]+)\s+import\s+(.+)/g;
        const importRegex = /^import\s+(.+)/g;

        let match;
        while ((match = fromImportRegex.exec(contentString)) !== null) {
          const from = match[1];
          const imports = match[2].split(',').map(imp => {
            const [element, alias] = imp.trim().split(' as ');
            return { element, alias: alias || undefined };
          });
          pythonImports.push({ filePath: fileUri.fsPath, from, imports });
        }
        while ((match = importRegex.exec(contentString)) !== null) {
          const module = match[1];
          const imports = module.split(',').map(imp => {
            const [element, alias] = imp.trim().split(' as ');
            return { element, alias: alias || undefined };
          });
          pythonImports.push({ filePath: fileUri.fsPath, module, imports });
        }
      } else if (fileType === vscode.FileType.Directory) {
        const subDirName = fileName
        const subImports = await this.indexAllPythonFiles(vscode.Uri.joinPath(rootUri, subDirName))
        pythonImports.push(...subImports)
      }
    }
    console.log("pythonImports", pythonImports)
    return pythonImports;
  }

  /**
   * loadLocalPackages loads the local packages in the current workspace
   * Every directory with a __init__.py is considered a package
   * Creates list of packageA.packageB.packageC ...
   * @returns the local packages
   */
  private async loadLocalPackages(rootUri?: vscode.Uri): Promise<Dependency[]> {
    const deps: Dependency[] = []
    const root = rootUri || this.rootUri
    const packageFiles = await vscode.workspace.fs.readDirectory(root)

    for (const [fileName, fileType] of packageFiles) {
      if (fileType === vscode.FileType.Directory && !fileName.startsWith(".")) {
        const dirName = fileName
        deps.push(...(await this.loadLocalPackages(vscode.Uri.joinPath(root, dirName))))
      } else if (fileType === vscode.FileType.File) {
        if (fileName === '__init__.py') {
          // Construct the package name from the workspace root to the package
          const packageName = root.path.split(this.rootUri.path + "/").pop()!
            .replace(/\//g, '.')
          deps.push({ name: packageName, version: '(Local)' })
        } else if (fileName.endsWith('.py')) {
          // console.log("local file", (root.path + fileName))
          const filePkgName = vscode.Uri.joinPath(root, fileName).fsPath.split(this.rootUri.path + "/").pop()!
            .replace(/\//g, '.')
            .replace(/\.py$/, '')
          deps.push({ name: filePkgName, version: '(Local)' })
        }
      }
    }
    // if (!rootUri) {
    //   console.log("local packages", deps)
    // }
    return deps
  }

  /**
   * doImportEdit inserts the import statement into the top of the active editor
   * @param statement the import statement to insert
   */
  private doImportEdit(statement: string) {
    const editor = vscode.window.activeTextEditor
    if (editor) {
      editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(0, 0), `${statement}\n`)
      })
      this.previousImport = statement
    } else {
      vscode.window.showInformationMessage('No active editor!')
    }
  }
}