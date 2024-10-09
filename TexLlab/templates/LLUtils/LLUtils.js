// apre il report delle variabili globali
function ShowVarsReport()
{
	app.OpenWindow("LLUtils_VarsReport", "", "");
}

// apre il report delle variabili inutilizzate
function ShowUnusedVarsReport()
{
	app.OpenWindow("LLUtils_UnusedVarsReport", "", "");
}

// apre il report delle POU inutilizzate
function ShowUnusedPOUsReport()
{
	app.OpenWindow("LLUtils_UnusedPOUsReport", "", "");
}

// apre il report delle dipendenze
function ShowDependenciesReport()
{
	app.OpenWindow("LLUtils_DependenciesReport", "", "");
}
