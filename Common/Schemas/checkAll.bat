set CATALOGPATH=..\..
set LOGFILE=check.log

del %LOGFILE%
for /r "%CATALOGPATH%"  %%f in (*.pct) do cscript //nologo check.js "%%f" >> %LOGFILE% 2>&1

start notepad %LOGFILE%
