; Let companion screens (stage display, phone remote, OBS overlay) reach this
; machine. Without an inbound rule Windows Firewall silently refuses the
; connection and a phone on the same Wi-Fi just times out, which is the single
; most common reason those features appear not to work.
;
; The rule is scoped to remoteip=localsubnet, so only devices on the same
; network can connect - never the wider internet - and it is not tied to a
; firewall profile, so it keeps working whether Windows has decided the church
; Wi-Fi is Private or Public.
;
; This is best effort. A per-user install runs unelevated and netsh will fail,
; which is fine: the app detects that case and offers to add the rule itself
; from Settings, with a proper elevation prompt. Failing here must never block
; the install, so nothing is checked and nothing is reported.

; The virtual camera driver.
;
; A DirectShow filter has to be registered with the system before anything can
; enumerate it, which is the one part of "Vifug appears in OBS" that cannot be
; done from inside the app: it writes under HKCR and needs the elevation the
; installer already has.
;
; Best effort, like the firewall rule above. A per-user install is not
; elevated and this will fail; the app notices (Settings reports the driver as
; not registered) and the camera is simply unavailable rather than broken. An
; install that cannot register a camera must never fail outright over it.
!macro vifugRegisterCamera
  nsExec::Exec '"$SYSDIR\regsvr32.exe" /s "$INSTDIR\resources\camera\vifug-camera.dll"'
!macroend

!macro customInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Vifug companion screens"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Vifug companion screens" dir=in action=allow program="$INSTDIR\Vifug.exe" enable=yes profile=any remoteip=localsubnet'
  !insertmacro vifugEnsureVcRuntime
  !insertmacro vifugRegisterCamera
!macroend

; Microsoft Visual C++ runtime.
;
; Vifug's database module needs VCRUNTIME140.dll. Without it the app does not
; open at all, and plenty of PCs - fresh or tightly managed ones - do not have
; it. The installer carries Microsoft's own vc_redist.x64.exe (put in build/ by
; win-runtime.ts), so this works with no internet, which is how a lot of
; churches install.
;
; Only run when missing, and only after saying why: the redistributable installs
; for the whole machine, so Windows asks for an administrator even though Vifug
; itself installs just for this user. Declining is not fatal - the app also
; carries app-local copies of the DLLs beside the module that needs them - so
; nothing here can fail the install.
;
; Skipped for a silent install (/S): a UAC prompt nobody is watching for is
; worse than relying on the app-local copies.
!macro vifugEnsureVcRuntime
  IfSilent vifug_vc_done

  SetRegView 64
  ClearErrors
  ReadRegDWORD $R0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  SetRegView lastused
  ${If} $R0 == 1
    Goto vifug_vc_done
  ${EndIf}

  MessageBox MB_YESNO|MB_ICONINFORMATION "Vifug needs the Microsoft Visual C++ Runtime, which is not installed on this PC.$\r$\n$\r$\nInstall it now? Windows will ask for permission, because it is shared by other programs on this computer.$\r$\n$\r$\nIt comes with this installer, so no internet is needed." IDNO vifug_vc_declined

  InitPluginsDir
  File "/oname=$PLUGINSDIR\vc_redist.x64.exe" "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
  DetailPrint "Installing the Microsoft Visual C++ Runtime..."
  ${StdUtils.ExecShellWaitEx} $R1 $R2 "$PLUGINSDIR\vc_redist.x64.exe" "runas" "/install /passive /norestart"
  ${If} $R1 != "ok"
    ; Usually the Windows permission prompt was refused.
    Goto vifug_vc_declined
  ${EndIf}
  ${StdUtils.WaitForProcEx} $R3 $R2
  ; 0 = installed, 3010 = installed but wants a restart, 1638 = a newer one is already there.
  ${If} $R3 == 0
  ${OrIf} $R3 == 3010
  ${OrIf} $R3 == 1638
    DetailPrint "Microsoft Visual C++ Runtime installed."
    Goto vifug_vc_done
  ${EndIf}
  DetailPrint "The Microsoft Visual C++ Runtime installer returned $R3."

  vifug_vc_declined:
    MessageBox MB_OK|MB_ICONEXCLAMATION "The Microsoft Visual C++ Runtime was not installed.$\r$\n$\r$\nVifug includes its own copy and should still open. If it does not, install the runtime from:$\r$\nhttps://aka.ms/vs/17/release/vc_redist.x64.exe"

  vifug_vc_done:
!macroend

; Leaving a rule behind pointing at a deleted executable is untidy and confusing
; to anyone auditing their firewall later.
!macro customUnInstall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Vifug companion screens"'
  ; Unregister before the file goes, or the CLSID is left pointing at nothing
  ; and every host that enumerates cameras pays for a failed load for ever.
  nsExec::Exec '"$SYSDIR\regsvr32.exe" /u /s "$INSTDIR\resources\camera\vifug-camera.dll"'
!macroend
