@echo off

rem In modalità simulazione non scarica i fonts e bitmap, il simulatore troverà i PLK insieme al progetto
if "%SIMUL%"=="1" goto :EOF

rem Percorso specifico per il target corrente; se non assoluto, è relativo al working path di LLExec
set TARGET_FONTS_DIR=fonts

"%~dp0\GDBFontDownload.exe" fontDownload.xml %TARGET_FONTS_DIR% %PRJCONN%



rem Percorso specifico per il target corrente; se non assoluto, è relativo al working path di LLExec
set TARGET_BITMAPS_DIR=bitmaps

"%~dp0\GDBBmpDownload.exe" bmpDownload.xml %TARGET_BITMAPS_DIR% %PRJCONN%
