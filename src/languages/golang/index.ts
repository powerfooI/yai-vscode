import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { pathExists } from '../utils';
import { ImportPosType, findImportPos, parseGoFileImports, parseGoModInfo } from './parse';
import { goStdLibs } from './std';
import { GoModInfo, IndexLocalGoFiles, LocalModuleImport, LocalModuleImportType, LocalSubPackage, ModuleDependency } from './types';

const GO_MODULE_KEY = "YAI_GO_MODULE_KEY"

const customInputLabel = '#CUSTOM INPUT#'
const customInputItem: vscode.QuickPickItem = {
  label: customInputLabel,
  alwaysShow: true,
  description: 'Input the module to import',
}

export class GolangProcessor {
  private localImports: Map<string, LocalModuleImport> = new Map()
  private importableDeps: ModuleDependency[] = []
  private subPackages: LocalSubPackage[] = []
  private goVersion: string = ''
  private goModule: string = ''

  constructor(private readonly context: vscode.ExtensionContext) {
    this.localImports = this.context.workspaceState.get(GO_MODULE_KEY, new Map<string, LocalModuleImport>())
    this.getExtensionConfig()
  }
  private getExtensionConfig() {
    console.log("get extension config", vscode.workspace.getConfiguration().get<string[]>("yai.indexExclude"))
  }

  private async indexAllGoFiles(): Promise<IndexLocalGoFiles | undefined> {
    const deps: LocalModuleImport[] = []
    const depMapping: Map<string, LocalModuleImport> = new Map()
    const packageSet: Set<string> = new Set()
    const ws = vscode.workspace.workspaceFolders![0]
    let excluding = ""
    const excludePatterns = vscode.workspace.getConfiguration().get<string[]>("yai.indexExclude") || []
    if (excludePatterns.length > 0) {
      excluding = `{${excludePatterns.join(',')}}`
    }
    const goFiles = await vscode.workspace.findFiles('**/*.go', excluding)
    if (goFiles.length === 0) {
      return
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

        // Find the package name of the go file
        const packageMatch = content.match(/package (\S+)/)
        if (packageMatch && packageMatch.length > 1 && packageMatch[1] !== 'main' && !packageMatch[1].endsWith('_test')) {
          const packageName = packageMatch[1]
          const dirName = path.dirname(file.fsPath)
          let packageFullName: string
          if (dirName.endsWith(packageName)) {
            packageFullName = path.dirname(file.fsPath).replace(ws.uri.fsPath, this.goModule)
            packageSet.add(packageFullName)
          }
          // else: The package name is not the same as the directory name?
          // What should we do?
        }

        // Parse the go file and find all its imports
        const imports = parseGoFileImports(content)
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
    return { localImports: deps, localSubPackages: Array.from(packageSet.keys())}
  }

  private indexGoMod(): GoModInfo | undefined {
    const ws = vscode.workspace.workspaceFolders![0]
    const goModPath = path.join(ws.uri.path, 'go.mod')
    if (!pathExists(goModPath)) {
      vscode.window.showErrorMessage('No go.mod found in the workspace')
      return
    }
    const content = fs.readFileSync(goModPath, 'utf-8')
    const modInfo = parseGoModInfo(content)
    return modInfo
  }

  public async index() {
    const modInfo = this.indexGoMod()
    if (!modInfo) {
      return
    }
    this.goModule = modInfo.module
    this.goVersion = modInfo.goVersion

    const deps = modInfo?.requirements ?? []
    const locals = await this.indexAllGoFiles()
    if (!locals) {
      return
    }
    locals.localImports.forEach((local) => {
      local.aliases.sort((a, b) => b.files.length - a.files.length)
    })
    locals.localImports.sort((a, b) => b.aliases.reduce((acc, cur) => acc + cur.files.length, 0) - a.aliases.reduce((acc, cur) => acc + cur.files.length, 0))
    const stdDeps = goStdLibs.map((dep: string) => ({ name: dep, version: '' }))
    deps.push(...stdDeps)
    this.importableDeps = deps
    this.subPackages = locals.localSubPackages
    this.localImports = new Map(locals.localImports.map((dep) => [dep.name, dep]))
    vscode.window.showInformationMessage('go.mod and local imports indexed')
  }

  public async import() {
    const candidates: vscode.QuickPickItem[] = [customInputItem]
    const optionSet = new Set(candidates.map((c) => c.label))
    const localImportKeys = Array.from(this.localImports.keys())
    localImportKeys.forEach((key) => {
      if (!optionSet.has(key)) {
        candidates.push({
          label: key,
          description: '(Local)',
        })
        optionSet.add(key)
      }
    })
    this.subPackages.forEach((sub) => {
      if (!optionSet.has(sub)) {
        candidates.push({
          label: sub,
          description: '(Local)',
        })
        optionSet.add(sub)
      }
    })
    this.importableDeps.forEach((dep) => {
      candidates.push({
        label: dep.name,
        description: dep.version,
      })
    })

    const selectedMod = await vscode.window.showQuickPick(candidates, {
      placeHolder: 'Pick the base module, please.',
      title: 'Select the module to import'
    })

    if (!selectedMod) {
      return
    }
    let importingModule = selectedMod.label
    if (importingModule === customInputLabel) {
      // Custom input
      importingModule = await vscode.window.showInputBox({ title: 'Input the module to import' }) ?? ''
      if (!importingModule) {
        return
      }
    }

    const subPackages = candidates.filter((c) => c.label.startsWith(importingModule + "/"))

    if (subPackages.length > 0) {
      const subPackageOptions = subPackages
      subPackageOptions.unshift(customInputItem)
      const selectedSub = await vscode.window.showQuickPick(subPackages, {
        placeHolder: 'Pick the sub package to import',
        title: 'Select the sub package to import'
      })
      if (!selectedSub) {
        // Do nothing, keep importingModule as is
      } else if (selectedSub.label === customInputLabel) {
        const inputtedSub = await vscode.window.showInputBox({ title: 'Input the sub package to import' })
        if (inputtedSub) {
          importingModule = inputtedSub
        }
      } else {
        importingModule = selectedSub.label
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
      const aliases: vscode.QuickPickItem[] = localImport.aliases.
        map((a) => {
          return {
            label: a.alias,
            description: `${a.alias ? 'alias' : 'no alias'} count: ${a.files.length}`,
          }
        })
      aliases.unshift(customInputItem)
      const selectedAlias = await vscode.window.showQuickPick(aliases, {
        placeHolder: 'Pick the alias to import, empty for original name',
        title: 'Select the alias to import'
      })
      if (!selectedAlias) {
        // Do nothing, keep alias empty
      } else if (selectedAlias.label === customInputLabel) {
        const inputtedAlias = await vscode.window.showInputBox({ title: 'Input the alias to import' })
        if (inputtedAlias) {
          alias = inputtedAlias
          localImport.addAlias(inputtedAlias, currentFile)
        }
      } else {
        alias = selectedAlias.label
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
          return
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
