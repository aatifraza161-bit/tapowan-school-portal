!macro customInit
  nsExec::Exec 'taskkill /F /IM EduCore.exe /T'
  nsExec::Exec 'taskkill /F /IM face_server.exe /T'
  nsExec::Exec 'taskkill /F /IM vidya_ai.exe /T'
  nsExec::Exec 'taskkill /F /IM school-management-system.exe /T'
  Sleep 1000
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /F /IM EduCore.exe /T'
  nsExec::Exec 'taskkill /F /IM face_server.exe /T'
  nsExec::Exec 'taskkill /F /IM vidya_ai.exe /T'
  nsExec::Exec 'taskkill /F /IM school-management-system.exe /T'
  Sleep 1000
!macroend
