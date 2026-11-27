// Thrown when the machine has no folder dialog the server can open, such as Linux without zenity or kdialog, or when the dialog
// fails rather than being cancelled.
export class NoFolderPickerError extends Error {
  constructor(reason) {
    super(`no folder dialog could open: ${reason}`)
  }
}
