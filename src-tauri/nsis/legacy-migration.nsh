!define VORTEX_ELECTRON_UNINSTALL_ROOT "Software\Microsoft\Windows\CurrentVersion\Uninstall"

Var VortexLegacyIndex
Var VortexLegacyKey
Var VortexLegacyDisplayName
Var VortexLegacyUninstallCommand
Var VortexLegacyUninstallerPath
Var VortexLegacyInstallPath
Var VortexLegacyPathTail
Var VortexLegacyQuoteIndex
Var VortexLegacyQuote
Var VortexLegacyFileName

!macro NSIS_HOOK_PREINSTALL
  StrCpy $VortexLegacyIndex 0
  StrCpy $VortexLegacyKey ""
  StrCpy $VortexLegacyUninstallerPath ""
  StrCpy $VortexLegacyInstallPath ""
  VortexLegacyScanRegistry:
    EnumRegKey $VortexLegacyKey HKCU "${VORTEX_ELECTRON_UNINSTALL_ROOT}" $VortexLegacyIndex
    StrCmp $VortexLegacyKey "" VortexLegacyScanDone
    ReadRegStr $VortexLegacyDisplayName HKCU "${VORTEX_ELECTRON_UNINSTALL_ROOT}\$VortexLegacyKey" "DisplayName"
    StrCpy $VortexLegacyFileName $VortexLegacyDisplayName 15
    StrCmp $VortexLegacyFileName "Vortex Launcher" 0 VortexLegacyScanNext
    ReadRegStr $VortexLegacyUninstallCommand HKCU "${VORTEX_ELECTRON_UNINSTALL_ROOT}\$VortexLegacyKey" "UninstallString"
    StrCpy $VortexLegacyQuote $VortexLegacyUninstallCommand 1
    StrCmp $VortexLegacyQuote '"' 0 VortexLegacyScanNext
    StrCpy $VortexLegacyPathTail $VortexLegacyUninstallCommand "" 1
    StrCpy $VortexLegacyQuoteIndex 0
  VortexLegacyFindClosingQuote:
    StrCpy $VortexLegacyQuote $VortexLegacyPathTail 1 $VortexLegacyQuoteIndex
    StrCmp $VortexLegacyQuote '"' VortexLegacyFoundUninstaller
    StrCmp $VortexLegacyQuote "" VortexLegacyScanNext
    IntOp $VortexLegacyQuoteIndex $VortexLegacyQuoteIndex + 1
    Goto VortexLegacyFindClosingQuote
  VortexLegacyFoundUninstaller:
    StrCpy $VortexLegacyUninstallerPath $VortexLegacyPathTail $VortexLegacyQuoteIndex
    ${GetFileName} "$VortexLegacyUninstallerPath" $VortexLegacyFileName
    StrCmp $VortexLegacyFileName "Uninstall Vortex Launcher.exe" 0 VortexLegacyScanNext
    ${GetParent} "$VortexLegacyUninstallerPath" $VortexLegacyInstallPath
    IfFileExists "$VortexLegacyInstallPath\Vortex Launcher.exe" 0 VortexLegacyScanNext
    !insertmacro CheckIfAppIsRunning "$VortexLegacyInstallPath\Vortex Launcher.exe" "${PRODUCTNAME}"
    StrCpy $INSTDIR "$VortexLegacyInstallPath"
    SetOutPath "$INSTDIR"
    Goto VortexLegacyScanDone
  VortexLegacyScanNext:
    IntOp $VortexLegacyIndex $VortexLegacyIndex + 1
    Goto VortexLegacyScanRegistry
  VortexLegacyScanDone:
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $VortexLegacyInstallPath != ""
    System::Call 'kernel32::CopyFileW(w "$INSTDIR\vortex-launcher.exe", w "$INSTDIR\Vortex Launcher.exe", i 0)i.r0'
    ${If} $0 = 1
      Delete "$VortexLegacyUninstallerPath"
      DeleteRegKey HKCU "${VORTEX_ELECTRON_UNINSTALL_ROOT}\$VortexLegacyKey"
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$INSTDIR\Vortex Launcher.exe"
!macroend
