// Run: node --test server/infrastructure/driven/native-folder-picker.adapter.test.mjs
// The dialog commands each platform runs; the dialogs themselves need a person, so no test opens one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dialogCommands } from './native-folder-picker.adapter.mjs'

test('Windows runs one STA PowerShell whose script carries the title, quotes doubled', () => {
  const [[file, args], ...rest] = dialogCommands('win32', "Pick Bob's brain")
  const script = Buffer.from(args.at(-1), 'base64').toString('utf16le')
  assert.deepEqual({ file, flags: args.slice(0, -1), rest, title: script.includes("'Pick Bob''s brain'") }, { file: 'powershell.exe', flags: ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand'], rest: [], title: true })
})

test('macOS asks the frontmost app to choose a folder, the title escaped', () => {
  const [[file, args]] = dialogCommands('darwin', 'Pick the "work" brain')
  assert.deepEqual([file, args], ['osascript', ['-e', 'tell application (path to frontmost application as text) to POSIX path of (choose folder with prompt "Pick the \\"work\\" brain")']])
})

test('Linux tries zenity, then kdialog', () => {
  assert.deepEqual(dialogCommands('linux', 'Pick').map(([file]) => file), ['zenity', 'kdialog'])
})

test('a non-zero exit is a cancel only where the platform says so; on Windows it is always a failure', () => {
  const cancelled = (platform, code, stderr = '') => dialogCommands(platform, 'Pick').map(([, , isCancel]) => isCancel(code, stderr))
  assert.deepEqual(
    { win: cancelled('win32', 1), mac: cancelled('darwin', 1, 'execution error: User canceled. (-128)'), macFail: cancelled('darwin', 1, 'syntax error'), linux: cancelled('linux', 1), linuxFail: cancelled('linux', 255) },
    { win: [false], mac: [true], macFail: [false], linux: [true, true], linuxFail: [false, false] },
  )
})
