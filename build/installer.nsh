!macro customUnInstall
  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /D /S /C ""$INSTDIR\resources\setup\scripts\uninstall-adapters.cmd""'
  RMDir /r "$APPDATA\agent-garden"
  RMDir /r "$APPDATA\agent-garden-desktop"
!macroend
