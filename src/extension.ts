import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';


const logger = vscode.window.createOutputChannel('Sumatra Tools', { log: true });


function launchSumatra(...args: string[]) {

	const config = vscode.workspace.getConfiguration('sumatra-tools');
	const executable = config.get('executable', 'SumatraPDF');

	logger.info('Spawning SumatraPDF process:', executable, args.join(' '));

	// This works fine on Windows, but I'm not sure its portable.
	// The child_process docs mention needing to .unref() the process
	// and ignore the parent's stdio connections.
	//
	// This works for now and I'm currently only using this on Windows
	const process = spawn(executable, args, { detached: true });

	process.on('error', (error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') {
			logger.error("Can't find specified SumatraPDF executable:", executable);

			vscode.window.showErrorMessage("Can't find the specified SumatraPDF executable. Check that it's in your PATH or that the provided path is correct.");
		} else {
			logger.error('Unexpected SumatraPDF error:', error);

			vscode.window.showErrorMessage("Unexpected SumatraPDF error, check the output panel for more details.");
		}
	});
}


async function openFile(filePath?: vscode.Uri) {

	if (filePath === undefined) {

		logger.debug('No file path provided, launching open file dialog')

		let defaultUri;

		// Try finding the folder of the current file
		const currentDocumentPath = vscode.window.activeTextEditor?.document.fileName;

		if (currentDocumentPath !== undefined) {
			defaultUri = vscode.Uri.file(path.dirname(currentDocumentPath));
		}
		// Otherwise try the first workspace folder
		else if (vscode.workspace.workspaceFolders) {
			defaultUri = vscode.workspace.workspaceFolders[0].uri
		}
		// Otherwise default to the homedir
		else {
			defaultUri = vscode.Uri.file(os.homedir());
		}

		const paths = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			defaultUri: defaultUri,
			filters: { 'PDF': ['pdf'] },
			title: 'Open PDF File',
		})

		if (paths === undefined) {
			logger.debug('No file picked, exiting')
			return;
		}
		filePath = paths[0]
	}

	logger.info('Opening PDF file:', filePath.fsPath);

	launchSumatra(filePath.fsPath);
}


function forwardSearch() {

	if (vscode.window.activeTextEditor === undefined) {
		return;
	}

	const document = vscode.window.activeTextEditor.document;

	if (document.languageId !== 'latex') {
		return;
	}

	const documentPath = path.parse(document.fileName);

	const pdfPath = path.format({
		dir: documentPath.dir,
		name: documentPath.name,
		ext: '.pdf',
	})

	const lineNumber = vscode.window.activeTextEditor.selection.active.line + 1

	launchSumatra(
		pdfPath,
		'-forward-search',
		document.fileName,
		lineNumber.toString(),
	)
}


export function activate(context: vscode.ExtensionContext) {

	logger.info('Extension activated');

	context.subscriptions.push(
		vscode.commands.registerCommand('sumatra-tools.openFile', openFile),
		vscode.commands.registerCommand('sumatra-tools.forwardSearch', forwardSearch),
	)
}
