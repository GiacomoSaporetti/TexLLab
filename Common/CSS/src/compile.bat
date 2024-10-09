@echo off
pushd %~dp0
echo Compilazione di LESS in CSS...
call lessc style.less ..\style.css
pause
