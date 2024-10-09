// var GRIDNAME = "UNUSEDPOUSPORT"
var m_filterCriteria;
m_gridDatapath = app.GetWindowData();

var columns 	 = {	name:			0,
						type:			1,
						location:		2
					}

var m_columnsNodes = []

var m_XMLData;

var gentypes = app.CallFunction("common.GetGeneralTypes");

const SYM_LOCATION = {
	ALL: "All",
	PROJECT: "Project",
	TARGET: "Target",
	LIBRARY: "Library",
	LOCAL: "Local",
	EMBEDDED: "Embedded",
	AUX: "Aux"
}

const SID_TGT_LOCATION = "TGT";
const SID_MAIN_LOCATION = "MAIN";
const PROJECT_LOCATION_STRING = "Program";

function InitGrid()
{	
	for (var i in columns)
		m_columnsNodes.push(i)

	grid.AddColumn( 150, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Name"));
	grid.AddColumn( 100, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Type"));
	grid.AddColumn( 100, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Location"));
	grid.Init();


	let prjDir = m_fso.GetParentFolderName(m_prjPath);
	// tolgo l'estensione
	let prjName = m_prjName.substr(0, m_prjName.indexOf('.'));
	let unusedXMLFile = prjDir + "\\Build\\" + prjName + UNUSED_SUFFIX;

	let res = CheckFileExists(unusedXMLFile);
	if (!res) {
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("Could not load unused objects file \"%1%2\". Enable its generation from the Project Options."), prjName, UNUSED_SUFFIX));
		app.CallFunction("extfunct.SelectOutputTab", TAB_RESOURCES);

		pouTypeSel.disabled = true;
		varLocationSel.disabled = true;
		btnFilter.disabled = true;

		return;
	}
	else {
		let xmldoc = LoadXMLFile(unusedXMLFile);
		m_globalVars = GetXMLVars(xmldoc);
		var xmlCodeId = GetXMLCodeId(xmldoc);
	}

	LoadGridContents(null);

	setInterval(ShowUnuFileNotUpdated, 1500, xmlCodeId);
}

function ShowUnuFileNotUpdated(xmlCodeId) {
	let currCodeId = app.CallFunction("logiclab.GetSourceCodeId");

	let isModified = (currCodeId != xmlCodeId) || app.ModifiedFlag;

	// btnDeleteSelected.disabled = isModified;

	if (isModified) {
		var string = pageTitle.innerHTML,
		 substring = "(" + app.Translate("rebuild to update") + ")";
		if (string.indexOf(substring) == -1)
			pageTitle.innerHTML += " (" + app.Translate("rebuild to update") + ")";
	}
	else
		pageTitle.innerHTML = pageTitle.innerHTML.replace("(" + app.Translate("rebuild to update") + ")", "");
}

function LoadXMLFile(filePath) {
	let xmldoc = genfuncs.CreateObject("MSXML2.DOMDocument.6.0");
	xmldoc.load(filePath);

	return xmldoc;
}

function GetXMLCodeId(xmldoc) {
	let node = xmldoc.selectNodes("unuObjects")[0];
	if (node)
		return node.getAttribute("sourceCodeID");

	return null;
}

function GetXMLVars(xmldoc) {
	let res = [];

	// carico i fb
	let fbNodes = xmldoc.selectNodes("unuObjects/unuFunctionBlocks/functionBlock");
	let fNodes = xmldoc.selectNodes("unuObjects/unuFunctions/function");
	let programNodes = xmldoc.selectNodes("unuObjects/unuPrograms/program");

	let pousMap = {
		"Function": fNodes,
		"Function block": fbNodes,
		"Program": programNodes
	}

	for (let key in pousMap) {
		const nodeList = pousMap[key];

		let node;
		while (node = nodeList.nextNode()) {
			let currVar = {};

			currVar.name = node.getAttribute('name');
			currVar.type = key;
			currVar.sid = node.getAttribute('sid');

			let locationAttr = node.getAttribute('sid');
			let location = locationAttr.substring(locationAttr.indexOf(':')+1, locationAttr.lastIndexOf(":"));
			// se la location dell'XML e' vuota oppure e' MAIN allora metto "Program"
			location = (location === "" || location === SID_MAIN_LOCATION) ? PROJECT_LOCATION_STRING : location;

			currVar.location = location;

			res.push(currVar);
		}
	}

	return res;
}

function CheckFileExists(filePath) {
	let res = m_fso.FileExists(filePath);
	return res;
}

/**
 * Carica i contenuti della griglia
 * @param {?object} filter le opzioni del filtro (filter criteria)
 */
function LoadGridContents(filter)
{
	var msg = app.Translate("Loading variables...");
    app.CallFunction("commonDLL.ShowWaitDlg", msg);

	if(grid.NumRows > 0)
		grid.DeleteRows(grid.NumRows);

	// ordina per nome di default
	grid.SortByColumn(columns.name, false);

	let varLocationFilter = varLocationSel.value;
	let pouTypeFilter = pouTypeSel.value;

	m_gridRows = {};
	var counter = 0;
	for (var i = 0, t = m_globalVars.length; i < t; i++)
	{
		var plcVar = m_globalVars[i];

		if (pouTypeFilter != "" && plcVar.type != pouTypeFilter)
			continue;

		if (!FilterVar(plcVar, filter) || !FilterVarLocation(plcVar, varLocationFilter))
			continue;

		var rowData = BuildRow(plcVar);

		// solo se i filtri corrispondono
		let rowID = counter++;
		m_gridRows[rowID] = rowData;
	}

	grid.InsertRows(counter);
    app.CallFunction("commonDLL.CloseWaitDlg");
}

function BuildRow(plcVar)
{
	let SID = plcVar.sid

	let newRow = new Object();
	newRow.name			= plcVar.name;
	newRow.location		= plcVar.location;
	newRow.type			= plcVar.type;
	newRow.SID = SID;

	return newRow;
}

function FilterVar(plcVar, filter)
{
	if (filter)
	{
		let foundSomethig = false;

		if (filter.findInName && MatchString(plcVar.name, filter.searchText, filter.caseSensitive, filter.wholeWord))
			foundSomethig = true;

		if (filter.findInLocation && MatchString(plcVar.location, filter.searchText, false, filter.wholeWord))
			foundSomethig = true;

		if (filter.findInType && MatchString(plcVar.type, filter.searchText, false, filter.wholeWord))
			foundSomethig = true;

		return foundSomethig;
	}

	return true;
}

function FilterVarLocation(plcVar, filterLocation) {
	let varLocation = plcVar.location;

	if (filterLocation != SYM_LOCATION.ALL) {
		if (filterLocation == SYM_LOCATION.TARGET)
			return (varLocation == SID_TGT_LOCATION);
		else if (filterLocation == SYM_LOCATION.PROJECT)
			// nella property della plcVar e' contenuta letteralmente la stringa "Project" (definita nella costante)
			return (varLocation == PROJECT_LOCATION_STRING);
		else if (filterLocation == SYM_LOCATION.LIBRARY)
			// se non e' target o project la location puo' essere qualunque nome della libreria in cui e' contenuta
			return (varLocation != PROJECT_LOCATION_STRING && varLocation != SID_TGT_LOCATION);
	}

	return true;
}

function OnUnload()
{
	//GridSaveSettings(grid, GRIDNAME)
}


/**
 * Apre la finestra di ricerca/settings e prende il risultato
 */
function FilterParameters()
{
	// SOLO INPUT per la dialog: criteri attuali di ricerca
	app.TempVar("FindParameters_criteria") = m_filterCriteria;
	// SOLO OUTPUT per la dialog: nuovi criteri. mette subito ad undefined per capire che la dialog ha fatto cancel
	app.TempVar("FindParameters_result") = undefined;

	app.OpenWindow("LLUtils_FindUnusedPOUsReport", app.Translate("Search filters"), "");

	var result = app.TempVar("FindParameters_result");
	if (!result)
		return;

	m_filterCriteria = result;

	// pulisce tutto per sicurezza e per non lasciare tempvar in giro inutili
	app.TempVar("FindParameters_criteria") = undefined;
	app.TempVar("FindParameters_result") = undefined;

	LoadGridContents(m_filterCriteria);

	//se non c'è "(filtered)" nel titolo lo mette
	var string = pageTitle.innerHTML,
	 substring = "(" + app.Translate("filtered") + ")";
	if (string.indexOf(substring) == -1)
		pageTitle.innerHTML += " (" + app.Translate("filtered") + ")";

	btnClearFilter.style.visibility = "visible";
}

function ClearFilter()
{
	m_filterCriteria = null;
	LoadGridContents(null);
	pageTitle.innerHTML = pageTitle.innerHTML.replace("(" + app.Translate("filtered") + ")", "");

	btnClearFilter.style.visibility = "hidden";
}

/**
 * Verifica se la stringa passata corrisponde ai criteri specificati
 * @param {string} strToCheck la stringa in cui cercare
 * @param {string} strFilter il testo da ricercare nella stringa
 * @param {boolean} caseSens se verificare il case
 * @param {boolean} wholeWord se controllare la corrspondenza di tutta la parola
 * @returns se soddisfa i requisiti specificati
 */
function MatchString(strToCheck, strFilter, caseSens, wholeWord)
{
	if (!caseSens)
	{
		strToCheck = strToCheck.toUpperCase();
		strFilter = strFilter.toUpperCase();
	}

	if (!wholeWord)
	{
		if (strToCheck.indexOf(strFilter) != -1)
			return true;
	}
	else
	{	
		var patt = new RegExp("\\b" + strFilter + "\\b");
		return patt.test(strToCheck);
	}

	return false;
}

function PrintWindow()
{
	// ottiene la variabile di ambiente TEMP
	var shell = genfuncs.CreateObject("WScript.Shell")
	var filename = shell.ExpandEnvironmentStrings("%TEMP%") + "\\LogicLab5_Print.xml"
	var curPageURL = window.location.href;
	var curPath = curPageURL.substr(0, curPageURL.lastIndexOf("/")+1);

	// crea dom xml
	var xmldoc = genfuncs.CreateObject("MSXML2.DOMDocument.6.0")
	xmldoc.appendChild(xmldoc.createProcessingInstruction("xml", "version='1.0' encoding='UTF-8'"))
	xmldoc.appendChild(xmldoc.createProcessingInstruction("xml-stylesheet", "type='text/xsl' href='" + curPath + "PrintGrid.xslt'"))
	var root = xmldoc.appendChild(xmldoc.createElement("print"));

	var pageNode = xmldoc.createElement("page");

	for (let index in m_gridRows) {
		let rowData = m_gridRows[index];

		var nodeNew = xmldoc.createElement("var");

		// settaggio attributi: ATTENZIONE l'ordine sarà quello visualizzato
		nodeNew.setAttribute("name", rowData.name);
		nodeNew.setAttribute("type", rowData.type);
		nodeNew.setAttribute("location", rowData.location);
		pageNode.appendChild(nodeNew);
	}

	pageNode.setAttribute("title", m_prjName + " - Unused Variables Report");
	let date = new Date();
	pageNode.setAttribute("date", date.toLocaleDateString() + " - " + date.toLocaleTimeString());
	root.appendChild(pageNode);

	// salva su file l'xml + stylesheet, la trasformazione sarà fatta dal browser
	try
	{
		xmldoc.save(filename)
	}
	catch (e)
	{
		app.MessageBox(app.Translate("Error saving temporary XML printing file to ") + filename + " :\n" + e.description, "", gentypes.MSGBOX.MB_ICONERROR)
		return true
	}

	// apre la finestra modale ridimensionabile, passando il path tramite variabile temporanea
	app.TempVar("PrintGrid_FileName") = filename
	app.OpenWindow("LLUtils_PrintUnusedPOUsReport", app.Translate("Print preview"), "")
	return true

}

function DeleteSelected()
{
	var selections = app.CallFunction("common.GridGetSelections", grid);
	if(selections.lenght == 0)
		return;

	var ris = app.MessageBox(app.Translate("Do you want to delete the selected POUs?"), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO);
	if (ris == gentypes.MSGBOX.IDNO)
		return;

	var res = 0;

	var msg = genfuncs.FormatMsg(app.Translate("Deleting %1 POUs..."), selections.length);
	app.CallFunction("logiclab.ShowProgressDlg", msg, selections.length)
	for (var i = 0; i < selections.length; i++)
	{
		let selection = selections[i];
		var rowData = m_gridRows[selection];
		if(!rowData)
			continue;

		var name = rowData.name;

		let sid = rowData.SID;
		if(app.CallFunction("logiclab.DeleteObject", sid))
			res++;
		else {
			app.PrintMessage(genfuncs.FormatMsg(app.Translate("Could not delete '%1' POU"), name));
			app.CallFunction("extfunct.SelectOutputTab", TAB_RESOURCES);
		}

		// metto a null il valore. non cancello direttamente perche' altrimenti avrei gli indici sfalsati all'iterazione successiva
		m_globalVars[selection] = null;

		app.CallFunction("logiclab.UpdateProgressDlg", i);
	}

	// cancello tutti i valori nulli
	m_globalVars = m_globalVars.filter(function(item) {
		return (item != null);
	})

	app.CallFunction("logiclab.HideProgressDlg");
	if(res == 0)
		return;

	var msg = genfuncs.FormatMsg(app.Translate("%1 POUs correctly removed from project"), res);
	app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONINFORMATION);
	app.ModifiedFlag = true;

	// richiedo la lista delle variabili globali perche' viene modificata quando faccio una cancellazione
	LoadGridContents();
}