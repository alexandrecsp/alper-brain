// The folder picker port: the machine's own folder dialog, which the server opens since a page's folder picker never tells the
// path. A driven adapter implements the one call, by the platform's dialog command or in memory:
//   pick(title) → Promise of the absolute path of the folder the user chose, or null when they cancelled. It rejects with
//                 `NoFolderPickerError` when the machine has no dialog to open, or the dialog fails.
export {}
