import * as vscode from 'vscode';
import { Yai } from "../types";
import * as fs from 'fs';
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

// TODO: build local package structure

export class PythonProcessor extends Yai {
  private dependencies: Dependency[] = []
  private previousImport: string | undefined
  private indexed: boolean = false

  constructor(
    private readonly context: vscode.ExtensionContext,
  ) {
    super()
  }

  public async index() {
    this.dependencies = await this.loadDependencies()
    this.indexed = true
  }
  public async import() {
    if (!this.indexed) {
      await this.index()
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

  public importPrevious() {
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
      exec('python3 -m pip freeze', {
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
          const dependencies = stdout.split('\n').map(line => {
            const [name, version] = line.split('==');
            return { name, version };
          });
          console.log("dependencies", dependencies)
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