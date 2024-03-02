import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path';
import { LocalModuleImport, LocalModuleImportType, ModuleDependency } from './types';
import { pathExists } from '../utils';
import { parseGoFile, parseGoMod, findImportPos, ImportPosType } from './parse'
import { goStdLibs } from './std';

const GO_MODULE_KEY = "YAI_GO_MODULE_KEY"

const customInput = '#CUSTOM INPUT'

export class GolangProcessor {
  private localImports: Map<string, LocalModuleImport> = new Map()
  private importableDeps: ModuleDependency[] = []

  constructor(private readonly context: vscode.ExtensionContext) {
    this.localImports = this.context.workspaceState.get(GO_MODULE_KEY, new Map<string, LocalModuleImport>())
  }

  private async indexLocal(): Promise<LocalModuleImport[]> {
    const deps: LocalModuleImport[] = []
    const depMapping: Map<string, LocalModuleImport> = new Map()

    const goFiles = await vscode.workspace.findFiles('**/*.go')
    if (goFiles.length === 0) {
      return []
    }
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Indexing go module',
      cancellable: true,
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Indexing go module' })
      for (let i = 0; i < goFiles.length; i++) {
        const file = goFiles[i]
        const content = fs.readFileSync(file.fsPath, 'utf-8').replace(/\/\/.+/g, '//')
        const imports = parseGoFile(content)
        imports.forEach((imp) => {
          let local = depMapping.get(imp.name)
          if (!local) {
            local = new LocalModuleImport(this.context, LocalModuleImportType.Local, imp.name, '')
            depMapping.set(imp.name, local)
            deps.push(local)
          }
          local.addAlias(imp.alias, file)
        })
        progress.report({ increment: (i + 1) / goFiles.length * 100, message: 'Indexing go module' })
      }
    })
    return deps
  }

  private indexDeps() {
    const ws = vscode.workspace.workspaceFolders![0]
    const goModPath = path.join(ws.uri.path, 'go.mod')
    if (!pathExists(goModPath)) {
      vscode.window.showErrorMessage('No go.mod found in the workspace')
      return []
    }
    const content = fs.readFileSync(goModPath, 'utf-8')
    const deps = parseGoMod(content)
    return deps
  }

  public async index() {
    const deps = this.indexDeps()
    const locals = await this.indexLocal()
    const stdDeps = goStdLibs.map((dep: string) => ({ name: dep, version: '' }))
    deps.push(...stdDeps)
    this.importableDeps = deps
    this.localImports = new Map(locals.map((dep) => [dep.name, dep]))
    vscode.window.showInformationMessage('go.mod and local imports indexed')
  }

  public async import() {
    const candidates: string[] = [customInput]
    this.importableDeps.forEach((dep) => {
      candidates.push(dep.name)
    })
    const optionSet = new Set(candidates)
    const localImportKeys = Array.from(this.localImports.keys())
    localImportKeys.forEach((key) => {
      if (!optionSet.has(key)) {
        candidates.push(key)
      }
    })

    const selectedMod = await vscode.window.showQuickPick(candidates, {
      placeHolder: 'Pick the base module, please.',
      title: 'Select the module to import'
    })

    if (!selectedMod) {
      return
    }
    let importingModule = selectedMod
    if (selectedMod === customInput) {
      // Custom input
      importingModule = await vscode.window.showInputBox({ title: 'Input the module to import' }) ?? ''
      if (!importingModule) {
        return
      }
    }

    const subPackages = candidates.filter((c) => c.startsWith(importingModule + "/"))

    if (subPackages.length > 0) {
      const subPackageOptions = subPackages
      subPackageOptions.unshift(customInput)
      const selectedSub = await vscode.window.showQuickPick(subPackages, {
        placeHolder: 'Pick the sub package to import',
        title: 'Select the sub package to import'
      })
      if (!selectedSub) {

      } else if (selectedSub === customInput) {
        const inputtedSub = await vscode.window.showInputBox({ title: 'Input the sub package to import' })
        if (inputtedSub) {
          importingModule = inputtedSub
        }
      } else {
        importingModule = selectedSub
      }
    } else {
      const inputtedSub = await vscode.window.showInputBox({ title: 'Input the sub package to import' })
      if (inputtedSub && inputtedSub.startsWith(importingModule + "/")) {
        importingModule = inputtedSub
      } else if (inputtedSub && inputtedSub !== '') {
        importingModule = path.join(importingModule, inputtedSub)
      }
    }

    let alias = ''
    const currentFile = vscode.window.activeTextEditor!.document.uri
    const localImport = this.localImports.get(importingModule)
    if (localImport && localImport.aliases.length > 0) {
      const aliases = localImport.aliases.map((alias) => alias.alias).filter((alias) => alias !== '')
      aliases.unshift(customInput)
      const selectedAlias = await vscode.window.showQuickPick(aliases, {
        placeHolder: 'Pick the alias to import, empty for original name',
        title: 'Select the alias to import'
      })
      if (!selectedAlias) {
        // Do nothing, keep alias empty
      } else if (selectedAlias === customInput) {
        const inputtedAlias = await vscode.window.showInputBox({ title: 'Input the alias to import' })
        if (inputtedAlias) {
          alias = inputtedAlias
          localImport.addAlias(inputtedAlias, currentFile)
        }
      } else {
        alias = selectedAlias
      }
    } else {
      const inputtedAlias = await vscode.window.showInputBox({ title: 'Input the alias to import' })
      if (inputtedAlias) {
        alias = inputtedAlias
        if (localImport) {
          localImport.addAlias(inputtedAlias, currentFile)
        } else {
          const newLocalImport = new LocalModuleImport(this.context, LocalModuleImportType.Local, importingModule, '')
          this.localImports.set(importingModule, newLocalImport)
          newLocalImport.addAlias(inputtedAlias, currentFile)
        }
      }
    }
    const edit = new vscode.WorkspaceEdit()
    const docText = vscode.window.activeTextEditor!.document.getText().replace(/\/\/.+/g, '//')
    try {
      const importPos = findImportPos(docText, importingModule)
      const parts = [`"${importingModule}"`]
      if (alias) {
        parts.unshift(alias)
      }
      const aliasedModule = parts.join(' ')
      switch (importPos.type) {
        case ImportPosType.AlreadyImported:
          vscode.window.showInformationMessage('The module has been imported')
          break
        case ImportPosType.NoImport:
          edit.insert(currentFile, new vscode.Position(importPos.start! + 1, 0), `import ${aliasedModule}\n`)
          break
        case ImportPosType.SingleImport:
          const keptOrigin = importPos.extra!.replace('import ', '')
          edit.replace(currentFile, new vscode.Range(new vscode.Position(importPos.start!, 0), new vscode.Position(importPos.start! + 1, 0)), `import (\n\t${keptOrigin}\n\t${aliasedModule}\n)\n`)
          break
        case ImportPosType.MultiImport:
          edit.insert(currentFile, new vscode.Position(importPos.start! + 1, 0), `\t${aliasedModule}\n`)
          break
      }
    } catch (err) {
      const e = err as Error
      vscode.window.showErrorMessage(e.message)
    }
    const ok = await vscode.workspace.applyEdit(edit)
    if (ok) {
      vscode.window.showInformationMessage('Import successfully!')
    } else {
      vscode.window.showErrorMessage('Fail to import the module')
    }
  }
}
