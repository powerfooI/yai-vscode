import * as path from 'path'
import * as vscode from 'vscode'
import { GolangProcessor } from './golang'
import { Yai } from './types'
import { pathExists } from './utils'
import { PythonProcessor } from './python'

export enum SupportedLanguage {
  Golang = "golang",
  ECMAScript = "ecmascript",
  Python = "python",
}

const langIDMapping: Record<string, string[]> = {
  [SupportedLanguage.Golang]: ['go'],
  [SupportedLanguage.ECMAScript]: ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'],
  [SupportedLanguage.Python]: ['python'],
}

export class RootHandler {
  public commands = {
    Index: 'yai.index',
    Import: 'yai.import',
    ImportPrevious: 'yai.repeatPreviousImport',
  }

  private language: SupportedLanguage | undefined
  private inner: Yai | undefined


  constructor(
    private context: vscode.ExtensionContext
  ) {
    const ws = vscode.workspace.workspaceFolders![0]
    if (pathExists(path.join(ws.uri.path, 'go.mod'))) {
      this.language = SupportedLanguage.Golang
      this.inner = new GolangProcessor(context)
    } else if (pathExists(path.join(ws.uri.path, 'package.json'))) {
      this.language = SupportedLanguage.ECMAScript
    } else if (pathExists(path.join(ws.uri.path, 'requirements.txt')) || pathExists(path.join(ws.uri.path, 'pyproject.toml'))) {
      this.language = SupportedLanguage.Python
      this.inner = new PythonProcessor(context)
    } else {
      vscode.window.showErrorMessage('No supported language found!')
    }
  }

  public disposables(): vscode.Disposable[] {
    const indexRegister = vscode.commands.registerCommand(this.commands.Index, async () => {
      await this.inner?.index()
    })
    const importRegister = vscode.commands.registerCommand(this.commands.Import, async () => {
      if (vscode.window.activeTextEditor && this.getLanguageIDs().includes(vscode.window.activeTextEditor.document.languageId)) {
        await this.inner?.import()
      } else {
        vscode.window.showInformationMessage('No active editor!')
      }
    })
    const importPreviousRegister = vscode.commands.registerCommand(this.commands.ImportPrevious, async () => {
      if (vscode.window.activeTextEditor && this.getLanguageIDs().includes(vscode.window.activeTextEditor.document.languageId)) {
        await this.inner?.importPrevious()
      } else {
        vscode.window.showInformationMessage('No active editor!')
      }
    })
    return [indexRegister, importRegister, importPreviousRegister]
  }

  private getLanguageIDs(): string[] {
    if (!this.language) {
      return []
    }
    return langIDMapping[this.language]
  }
}