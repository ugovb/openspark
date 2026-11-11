const RISKY_EXTENSIONS = new Set(
  'exe msi bat cmd com scr pif ps1 vbs vbe js jse wsf wsh hta cpl msc jar lnk reg app pkg dmg command sh desktop appimage deb rpm run iso img vhd docm xlsm pptm url scf chm msp jnlp xll py'.split(' '),
)

/** True when opening the file could run code (programs, scripts, macro documents). Last extension only, case-insensitive. */
export function isRiskyAttachment(filename: string): boolean {
  // Windows ignores trailing dots and spaces: 'x.exe.' and 'x.exe ' still run as x.exe
  const name = filename.replace(/[. ]+$/, '')
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return false
  return RISKY_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
}
