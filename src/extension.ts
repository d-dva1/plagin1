import * as vscode from 'vscode';

const TODO_REGEX = /(TODO|FIXME|BUG).*/;


interface TodoEntry {
    label: string;
    line: number;
    uri: vscode.Uri;
}


class TodoTreeItem extends vscode.TreeItem {
    constructor(public readonly entry: TodoEntry) {
        super(entry.label, vscode.TreeItemCollapsibleState.None);

        this.tooltip = `${entry.label} (строка ${entry.line + 1})`;
        this.description = `Строка ${entry.line + 1}`;

        this.command = {
            command: 'todoHighlighter.revealTodo',
            title: 'Перейти к TODO',
            arguments: [entry.uri, entry.line]
        };
    }
}


class TodoTreeDataProvider implements vscode.TreeDataProvider<TodoTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TodoTreeItem | undefined | void> =
        new vscode.EventEmitter<TodoTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TodoTreeItem | undefined | void> =
        this._onDidChangeTreeData.event;

    private items: TodoEntry[] = [];

    refresh(entries: TodoEntry[]): void {
        this.items = entries;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TodoTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TodoTreeItem): Thenable<TodoTreeItem[]> {
        if (!this.items) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.items.map(e => new TodoTreeItem(e)));
    }
}


const todoDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 215, 0, 0.2)', 
    isWholeLine: true
});


function scanDocument(document: vscode.TextDocument): { entries: TodoEntry[]; ranges: vscode.Range[] } {
    const entries: TodoEntry[] = [];
    const ranges: vscode.Range[] = [];

    for (let line = 0; line < document.lineCount; line++) {
        const textLine = document.lineAt(line);
        const text = textLine.text;

        const match = text.match(TODO_REGEX);
        if (match) {
            const label = match[0].trim();

            entries.push({
                label,
                line,
                uri: document.uri
            });

            const range = new vscode.Range(line, 0, line, text.length);
            ranges.push(range);
        }
    }

    return { entries, ranges };
}


function updateForActiveEditor(treeDataProvider: TodoTreeDataProvider) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        treeDataProvider.refresh([]);
        return;
    }

    const document = editor.document;
    const { entries, ranges } = scanDocument(document);

    treeDataProvider.refresh(entries);
    editor.setDecorations(todoDecorationType, ranges);
}


export function activate(context: vscode.ExtensionContext) {
    const treeDataProvider = new TodoTreeDataProvider();

    vscode.window.createTreeView('todoView', {
        treeDataProvider
    });

    const scanCommand = vscode.commands.registerCommand('todoHighlighter.scanTodos', () => {
        updateForActiveEditor(treeDataProvider);
        vscode.window.showInformationMessage('TODO Highlighter: сканирование завершено.');
    });

    const revealCommand = vscode.commands.registerCommand('todoHighlighter.revealTodo',
        (uri: vscode.Uri, line: number) => {
            vscode.window.showTextDocument(uri).then(editor => {
                const position = new vscode.Position(line, 0);
                const range = new vscode.Range(position, position);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            });
        }
    );

    const activeEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
        updateForActiveEditor(treeDataProvider);
    });

    const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
        const active = vscode.window.activeTextEditor;
        if (active && event.document === active.document) {
            updateForActiveEditor(treeDataProvider);
        }
    });

    context.subscriptions.push(
        scanCommand,
        revealCommand,
        activeEditorChangeDisposable,
        documentChangeDisposable,
        todoDecorationType
    );

    updateForActiveEditor(treeDataProvider);
}


export function deactivate() { }
