import { execFile } from 'node:child_process'
import { NoFolderPickerError } from '../../domain/errors/no-folder-picker.error.mjs'

// Windows: the Explorer-style folder dialog (IFileOpenDialog with FOS_PICKFOLDERS), owned by a hidden topmost window so it opens
// in front of the browser, not behind it. Prints the path, or nothing on cancel.
const windowsScript = (title) => `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BrainFolderDialog {
  [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FileOpenDialog {}
  [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(); void GetParent();
    void GetDisplayName(uint sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string name);
  }
  [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileDialog {
    [PreserveSig] int Show(IntPtr owner);
    void SetFileTypes(); void SetFileTypeIndex(); void GetFileTypeIndex(); void Advise(); void Unadvise();
    void SetOptions(uint fos); void GetOptions(out uint fos);
    void SetDefaultFolder(); void SetFolder(); void GetFolder(); void GetCurrentSelection(); void SetFileName(); void GetFileName();
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
    void SetOkButtonLabel(); void SetFileNameLabel();
    void GetResult(out IShellItem item);
  }
  public static string Pick(IntPtr owner, string title) {
    var dialog = (IFileDialog)new FileOpenDialog();
    uint fos; dialog.GetOptions(out fos);
    dialog.SetOptions(fos | 0x20 | 0x40);
    dialog.SetTitle(title);
    if (dialog.Show(owner) != 0) return null;
    IShellItem item; dialog.GetResult(out item);
    string path; item.GetDisplayName(0x80058000, out path);
    return path;
  }
}
'@
$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false; Opacity = 0; StartPosition = 'CenterScreen' }
$owner.Show(); $owner.Activate()
$path = [BrainFolderDialog]::Pick($owner.Handle, '${title.replace(/'/g, "''")}')
$owner.Close()
if ($path) { [Console]::Out.Write($path) }
`

// The command that opens the dialog on `platform`, as [file, args, cancelled], each a fallback for the one before: the first
// whose file exists runs. Each prints the chosen path and exits 0. `cancelled(code, stderr)` tells a cancel from a failure
// when it exits non-zero; the Windows script exits 0 with no output on a cancel, so any non-zero exit there is a failure.
export const dialogCommands = (platform, title) => {
  if (platform === 'win32') {
    const encoded = Buffer.from(windowsScript(title), 'utf16le').toString('base64')
    return [['powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded], () => false]]
  }
  if (platform === 'darwin') {
    const prompt = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    // asked of the frontmost app, the browser, so the dialog opens in front of it; a cancel is AppleScript's error -128
    return [['osascript', ['-e', `tell application (path to frontmost application as text) to POSIX path of (choose folder with prompt "${prompt}")`], (code, stderr) => /-128/.test(stderr)]]
  }
  return [
    ['zenity', ['--file-selection', '--directory', `--title=${title}`], (code) => code === 1],
    ['kdialog', ['--getexistingdirectory', process.env.HOME ?? '/', '--title', title], (code) => code === 1],
  ]
}

// The first line of a failed dialog's error output, PowerShell's CLIXML unwrapped.
const reasonOf = (stderr, code) => {
  const text = stderr.replace(/_x000D__x000A_/g, '\n').replace(/<[^>]+>/g, ' ').replace(/#< CLIXML/, '')
  const line = text.split('\n').map((l) => l.trim()).find((l) => l && !/^(Preparing|Preparando)/.test(l))
  return line ? `the dialog failed: ${line}` : `the dialog exited with ${code}`
}

// Runs [file, args, cancelled]: resolves with its trimmed output, '' on a cancel, or undefined when the file is missing; rejects
// with `NoFolderPickerError` when the dialog fails, so the page falls back to a typed path.
const runDialog = ([file, args, cancelled]) => new Promise((resolve, reject) => {
  execFile(file, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error?.code === 'ENOENT') return resolve(undefined)
    if (!error) return resolve(stdout.trim())
    if (typeof error.code === 'number' && cancelled(error.code, stderr)) return resolve('')
    reject(new NoFolderPickerError(reasonOf(stderr, error.code)))
  })
})

// The folder picker by the platform's own dialog. One dialog at a time: a pick while one is open answers with that one's choice.
export const nativeFolderPicker = ({ platform = process.platform } = {}) => {
  let open
  const pick = async (title) => {
    for (const command of dialogCommands(platform, title)) {
      const out = await runDialog(command)
      if (out !== undefined) return out === '' ? null : out
    }
    throw new NoFolderPickerError(platform === 'linux' ? 'neither zenity nor kdialog is installed' : `no dialog command on ${platform}`)
  }
  return {
    pick(title) {
      open ??= pick(title).finally(() => (open = undefined))
      return open
    },
  }
}
